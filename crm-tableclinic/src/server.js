require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');
const { authMiddleware, authApiMiddleware } = require('./auth');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, '../public')));

// serve jornadas publicamente (sem autenticação)
app.use('/jornada', express.static(path.join(__dirname, '../public/jornadas'), {
  extensions: ['html'],
}));

// ── ROTAS PÚBLICAS ──────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/webhook', require('./routes/webhook'));

// ── PÁGINAS HTML ────────────────────────────────────────────
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

// ── API ─────────────────────────────────────────────────────
app.use('/api/pipeline', require('./routes/pipeline'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api', require('./routes/jornadas'));

// ── USER INFO ────────────────────────────────────────────────
app.get('/api/me', authApiMiddleware, (req, res) => res.json(req.user));

// ── ADMIN: gerenciar usuários ────────────────────────────────
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

app.get('/api/admin/users', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { rows } = await pool.query(
    'SELECT id,name,email,role,nutri_name,whatsapp,created_at FROM users ORDER BY id'
  );
  res.json(rows);
});

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

app.post('/api/admin/users/:id/reset-password', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { password } = req.body;
  const hash = await bcrypt.hash(password || 'table2026', 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/admin/users/:id', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });
  const { whatsapp } = req.body;
  await pool.query('UPDATE users SET whatsapp=$1 WHERE id=$2', [whatsapp || null, req.params.id]);
  res.json({ ok: true });
});

// ── START ────────────────────────────────────────────────────
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
