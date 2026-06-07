require('dotenv').config();

// Startup env check
const REQUIRED_VARS = ['DATABASE_URL','JWT_SECRET','ANTHROPIC_API_KEY'];
REQUIRED_VARS.forEach(v => {
  const val = process.env[v];
  if (!val || val.includes('...') || val.includes('placeholder')) {
    console.warn(`⚠️  ${v}: NÃO configurada ou ainda com valor placeholder`);
  } else {
    console.log(`✅  ${v}: OK (${val.substring(0,8)}...)`);
  }
});

const express    = require('express');
const path       = require('path');
const cookieParser = require('cookie-parser');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { initDb } = require('./db');
const { authMiddleware, authApiMiddleware } = require('./auth');

const app = express();

// ── CORS (domínios do projeto) ────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://crm.tableclinic.com.br',
  'http://localhost:3000',
  'http://localhost:3001',
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Helmet (headers de segurança) ─────────────────────────────
// CSP desativado para compatibilidade com scripts inline nas views
app.use(helmet({ contentSecurityPolicy: false }));

// ── Rate limiting ─────────────────────────────────────────────

/** Rotas de autenticação: 10 req/min por IP */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde 1 minuto.' },
});

/** Ações do Meta Ads (pausar, orçamento, duplicar): 30 req/min por IP */
const metaActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Rate limit excedido. Aguarde 1 minuto.' },
});

// ── Middlewares gerais ────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, '../public')));

// Serve jornadas direto do banco — não depende do filesystem efêmero do Railway.
// O html_content é salvo no DB na geração, então sobrevive a restarts/deploys.
app.get('/jornada/:slug', async (req, res) => {
  try {
    const { pool } = require('./db');
    const { rows } = await pool.query(
      'SELECT html_content FROM jornadas WHERE url_slug=$1',
      [req.params.slug]
    );
    if (!rows[0] || !rows[0].html_content) {
      return res.status(404).send('<html><body><h2>Jornada não encontrada.</h2><p>O link pode estar expirado ou incorreto.</p></body></html>');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(rows[0].html_content);
  } catch (err) {
    console.error('[/jornada/:slug]', err.message);
    res.status(500).send('<html><body><h2>Erro ao carregar jornada.</h2></body></html>');
  }
});

// ── ROTAS PÚBLICAS ────────────────────────────────────────────
app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/webhook', require('./routes/webhook'));

// ── PÁGINAS HTML ──────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

app.get('/', (req, res) => {
  const token = req.cookies?.token;
  if (token) return res.redirect('/pipeline');
  res.redirect('/login');
});

app.get('/pipeline', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/pipeline.html'));
});

app.get('/leads', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/leads.html'));
});

app.get('/admin', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.redirect('/pipeline');
  res.sendFile(path.join(__dirname, '../views/admin.html'));
});

app.get('/admin/dashboard', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.redirect('/pipeline');
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// ── Páginas — módulo clínico ──────────────────────────────────
app.get('/pacientes',       authMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, '../views/pacientes.html')));

app.get('/paciente/:id',    authMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, '../views/paciente.html')));

app.get('/agenda-clinica',  authMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, '../views/agenda-clinica.html')));

app.get('/financeiro', authMiddleware, (req, res) => {
  if (!['admin','administrativo'].includes(req.user.role)) return res.redirect('/pipeline');
  res.sendFile(path.join(__dirname, '../views/financeiro.html'));
});

// ── API — módulo comercial ────────────────────────────────────
app.use('/api/pipeline',   require('./routes/pipeline'));
app.use('/api/leads',      require('./routes/leads'));
app.use('/api',            require('./routes/jornadas'));

// Aplica rate limit nas ações do Meta antes de montar o router
app.use(['/api/meta-action', '/api/meta-budget', '/api/meta-duplicate'], metaActionLimiter);
app.use('/api',            require('./routes/meta'));

// ── API — módulo clínico ──────────────────────────────────────
app.use('/api/patients',              require('./routes/patients'));
app.use('/api/appointments-clinical', require('./routes/appointments_clinical'));
app.use('/api/records',               require('./routes/records'));
app.use('/api/charges',               require('./routes/charges'));

// ── USER INFO ─────────────────────────────────────────────────
app.get('/api/me', authApiMiddleware, (req, res) => res.json(req.user));

// ── ADMIN: gerenciar usuários ─────────────────────────────────
const { pool } = require('./db');
const bcrypt   = require('bcryptjs');

// Listar usuários
app.get('/api/admin/users', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { rows } = await pool.query(
    'SELECT id,name,email,role,nutri_name,whatsapp,created_at FROM users ORDER BY id'
  );
  res.json(rows);
});

// Criar usuário
app.post('/api/admin/users', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { name, email, password, role, nutri_name, whatsapp } = req.body;
  try {
    const hash = await bcrypt.hash(password || 'table2026', 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash,role,nutri_name,whatsapp) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role',
      [name, email, hash, role, nutri_name || null, whatsapp || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.detail || 'Erro ao criar usuário' });
  }
});

// Editar usuário (nome, email, whatsapp — e opcionalmente senha)
app.put('/api/admin/users/:id', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { name, email, whatsapp, password } = req.body;
  try {
    const sets   = [];
    const params = [];
    let   i      = 1;
    if (name     !== undefined) { sets.push(`name=$${i++}`);     params.push(name); }
    if (email    !== undefined) { sets.push(`email=$${i++}`);    params.push(email); }
    if (whatsapp !== undefined) { sets.push(`whatsapp=$${i++}`); params.push(whatsapp || null); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password_hash=$${i++}`);
      params.push(hash);
    }
    if (!sets.length) return res.json({ ok: true });
    params.push(req.params.id);
    await pool.query(`UPDATE users SET ${sets.join(',')} WHERE id=$${i}`, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.detail || err.message || 'Erro ao atualizar usuário' });
  }
});

// Resetar senha (mantido para compatibilidade)
app.post('/api/admin/users/:id/reset-password', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { password } = req.body;
  const hash = await bcrypt.hash(password || 'table2026', 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  res.json({ ok: true });
});

// Apagar usuário
app.delete('/api/admin/users/:id', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'Não é possível apagar o próprio usuário.' });
  }
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── CRON (relatórios WhatsApp) ────────────────────────────────
require('./cron');

// ── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Table Clinic CRM rodando na porta ${PORT}`);
  try {
    await initDb();
  } catch (err) {
    console.error('⚠️  DB não inicializado:', err.message);
    console.error('   Configure DATABASE_URL no .env e reinicie.');
  }
});
