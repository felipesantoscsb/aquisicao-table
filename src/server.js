require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Redis = require('ioredis');

// ─── Redis (compartilhado com sdr-table) ──────────────────────────────────────
let _redis;
const captacaoSeenEvents = new Set();

function getRedis() {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL_TRACKING, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (t) => (t > 3 ? null : Math.min(t * 500, 2000)),
    });
    _redis.on('error', (e) => console.error('[Redis]', e.message));
  }
  return _redis;
}
async function redisGet(key) { try { return await getRedis().get(key); } catch { return null; } }
async function redisSet(key, value, ...args) { try { return await getRedis().set(key, value, ...args); } catch { return null; } }
async function redisDel(key) { try { return await getRedis().del(key); } catch { return null; } }

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────


// Body parsers — json primário, text como fallback para webhooks sem Content-Type correto
app.use(express.json({ strict: false }));
app.use(express.text({ type: '*/*' }));
app.use((req, res, next) => {
  if (typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch { req.body = {}; }
  }
  if (req.body === undefined) req.body = {};
  next();
});

// CORS — permite que o quiz em evelynliu.com.br chame este endpoint
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Dashboard e rotas de gestão Meta exigem token (antes do static, senão o
// dashboard.html público vaza — e /api/meta-action permitiria a qualquer um
// pausar campanhas e mexer em orçamento)
app.use(
  ['/dashboard.html', '/dash', '/api/dash', '/api/meta-insights', '/api/meta-action', '/api/meta-budget', '/api/meta-duplicate'],
  requireDashToken
);

// Serve os arquivos estáticos da pasta public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Rotas do funil ───────────────────────────────────────────────────────────

const funil = path.join(__dirname, '..', 'public', 'Funil');
const pub   = path.join(__dirname, '..', 'public');

app.get('/raiz',       (req, res) => res.sendFile(path.join(pub,   'quiz.html')));
app.get('/quiz',       (req, res) => res.redirect(301, '/raiz' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
app.get('/legal',      (req, res) => res.sendFile(path.join(funil, 'privacidade_termos_evelynliu.html')));
app.get('/protocolo-raiz', (req, res) => res.sendFile(path.join(funil, 'protocolo_raiz_bio.html')));
app.get('/obrigado',           (req, res) => res.sendFile(path.join(funil, 'obrigado-protocolo-raiz.html')));
app.get('/obrigado-essential',    (req, res) => res.sendFile(path.join(funil, 'obrigado-essential.html')));
app.get('/obrigado-premium',      (req, res) => res.sendFile(path.join(funil, 'obrigado-premium.html')));
app.get('/obrigado-elite',        (req, res) => res.sendFile(path.join(funil, 'obrigado-elite.html')));
app.get('/obrigado-essential-pr', (req, res) => res.sendFile(path.join(funil, 'obrigado-essential-pr.html')));

// ─── Rotas de ofertas ─────────────────────────────────────────────────────────

const ofertas = path.join(__dirname, '..', 'public', 'Ofertas');

app.get('/oferta-essential-ju',      (req, res) => res.sendFile(path.join(ofertas, 'table-essential-ju.html')));
app.get('/oferta-essential-nati',    (req, res) => res.sendFile(path.join(ofertas, 'table-essential-nati.html')));
app.get('/oferta-essential-pr-ju',   (req, res) => res.sendFile(path.join(ofertas, 'table-essential-pr-ju.html')));
app.get('/oferta-essential-pr-nati', (req, res) => res.sendFile(path.join(ofertas, 'table-essential-pr-nati.html')));
app.get('/oferta-premium-ju',        (req, res) => res.sendFile(path.join(ofertas, 'table-premium-ju.html')));
app.get('/oferta-premium-nati',      (req, res) => res.sendFile(path.join(ofertas, 'table-premium-nati.html')));
app.get('/oferta-premium-pr-ju',     (req, res) => res.sendFile(path.join(ofertas, 'table-premium-pr-ju.html')));
app.get('/oferta-premium-pr-nati',   (req, res) => res.sendFile(path.join(ofertas, 'table-premium-pr-nati.html')));
app.get('/oferta-elite-ju',          (req, res) => res.sendFile(path.join(ofertas, 'table-elite-ju.html')));
app.get('/oferta-elite-nati',        (req, res) => res.sendFile(path.join(ofertas, 'table-elite-nati.html')));
app.get('/oferta-elite-pr-ju',       (req, res) => res.sendFile(path.join(ofertas, 'table-elite-pr-ju.html')));
app.get('/oferta-elite-pr-nati',     (req, res) => res.sendFile(path.join(ofertas, 'table-elite-pr-nati.html')));
app.get('/obrigado-premium-pr',   (req, res) => res.sendFile(path.join(funil, 'obrigado-premium-pr.html')));
app.get('/obrigado-elite-pr',     (req, res) => res.sendFile(path.join(funil, 'obrigado-elite-pr.html')));
app.get('/forms',      (req, res) => res.sendFile(path.join(funil, 'formulario-pre-sessao.html')));
app.get('/onboardinge',(req, res) => res.sendFile(path.join(funil, 'plano-acao-emocional.html')));
app.get('/onboardings',(req, res) => res.sendFile(path.join(funil, 'plano-acao-sobrevivencia.html')));
app.get('/onboardingr',(req, res) => res.sendFile(path.join(funil, 'plano-acao-restritiva.html')));
app.get('/onboardingd',(req, res) => res.sendFile(path.join(funil, 'plano-acao-desconectada.html')));
app.get('/rmkt',       (req, res) => res.sendFile(path.join(funil, 'pagina_vendas_rmkt.html')));
app.get('/links',      (req, res) => res.sendFile(path.join(funil, 'links-bio.html')));
app.get('/table',      (req, res) => res.sendFile(path.join(funil, 'site_table.html')));
app.get('/conversa',   (req, res) => res.sendFile(path.join(funil, 'formulario_captacao_table.html')));
app.get('/evelyn',     (req, res) => res.sendFile(path.join(funil, 'formulario_consulta_evelyn.html')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Aplica hash SHA-256 em uma string normalizada (lowercase + trim).
 * Retorna null se o valor for falsy.
 */
function sha256(value) {
  if (!value) return null;
  return crypto
    .createHash('sha256')
    .update(String(value).toLowerCase().trim())
    .digest('hex');
}

/**
 * Remove tudo que não for dígito e garante o DDI 55 na frente.
 * Ex: "11999999999" → "5511999999999"
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits.startsWith('55')) digits = '55' + digits;
  return digits;
}

/**
 * Extrai o primeiro nome de uma string "Nome Sobrenome".
 */
function firstName(fullName) {
  if (!fullName) return null;
  return String(fullName).trim().split(/\s+/)[0];
}

/**
 * Pega o IP real do usuário, considerando o proxy do Railway
 * que injeta o IP original no header x-forwarded-for.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Pode vir como "IP1, IP2, IP3" — o primeiro é o cliente real
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || null;
}

// ─── Métricas diárias (série temporal p/ dashboard /dash) ────────────────────
//
// Contadores por dia (fuso de São Paulo) em metrics:{YYYY-MM-DD}:{nome}.
// Fire-and-forget: falha de Redis nunca afeta a rota que instrumenta.
// TTL 400 dias — histórico de ~13 meses para comparações ano a ano.

function spDate(ts = Date.now()) {
  // en-CA → formato YYYY-MM-DD direto
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(ts);
}

async function metricsIncr(name, n = 1) {
  const amount = Math.round(Number(n));
  if (!amount) return;
  try {
    const key = `metrics:${spDate()}:${name}`;
    const redis = getRedis();
    await redis.incrby(key, amount);
    await redis.expire(key, 60 * 60 * 24 * 400);
  } catch {}
}

// Autenticação simples por token para dashboard e rotas de gestão Meta.
// Token via ?token= ou header x-dash-token; valor em DASH_TOKEN (ou HEALTH_TOKEN).
function requireDashToken(req, res, next) {
  const expected = process.env.DASH_TOKEN || process.env.HEALTH_TOKEN;
  if (!expected) return res.status(500).json({ error: 'DASH_TOKEN não configurado no servidor.' });
  const got = req.query.token || req.headers['x-dash-token'];
  if (got !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Rota CAPI ────────────────────────────────────────────────────────────────

app.post('/api/capi', async (req, res) => {
  console.log('[CAPI] Payload recebido:', JSON.stringify(req.body, null, 2));

  // Extrai apenas os campos permitidos — profile, profileName, scores,
  // qualification e respostas são ignorados intencionalmente: dados sensíveis
  // de saúde/perfil psicológico que não devem trafegar para a Meta.
  const {
    nome,
    email,
    whats,
    fbc,
    fbp,
    external_id,       // SHA-256 do email — gerado no browser, não rehashear
    lead_event_id,
    pageview_event_id,
    event_name,
    content_name,
    content_category,  // ViewContent do dossiê envia o perfil aqui
    perfil,
    tier,
    event_source_url,
    lid,               // token opaco do dossiê — permite enriquecimento via Redis
  } = req.body;

  // Série diária p/ dashboard (fire-and-forget)
  metricsIncr('evt_' + (event_name || 'Lead')).catch(() => {});

  // SDR forward só no CompleteRegistration: único momento com perfil+respostas+qualificação completos.
  if ((req.body.event_name || 'Lead') === 'CompleteRegistration') {
    forwardToSDR(req.body).catch(err =>
      console.error('[SDR-forward] Erro ao encaminhar para o SDR:', err.message)
    );
  }

  // Fase 2 — persiste lead no Redis para enriquecimento do Purchase CAPI.
  // Gravado no evento Lead: aqui req.body.lead_event_id === _leadEventId do quiz,
  // exatamente o valor enviado em tracking.src do checkout Ticto (join key correto).
  // Bloco ADITIVO e ISOLADO: não toca o envio do Lead à Meta (escrita fire-and-forget).
  if ((req.body.event_name || 'Lead') === 'Lead' && req.body.lead_event_id) {
    const leadRecord = {
      lead_event_id: req.body.lead_event_id,
      nome:          req.body.nome        || null, // para first_name no /api/lead-context
      email:         req.body.email       || null,
      phone:         req.body.whats       || null,
      external_id:   req.body.external_id || null,
      fbc:           req.body.fbc         || null,
      fbp:           req.body.fbp         || null,
      saved_at:      new Date().toISOString(),
    };
    getRedis().set(
      `lead:${req.body.lead_event_id}`,
      JSON.stringify(leadRecord),
      'EX', 60 * 60 * 24 * 90  // 90 dias
    ).catch(e => console.error('[Lead-persist] Redis write error:', e.message));
    console.log(`[Lead-persist] Lead salvo: ${req.body.lead_event_id} / ${req.body.email}`);
  }

  // Credenciais via variáveis de ambiente
  const PIXEL_ID    = process.env.META_PIXEL_ID;
  const CAPI_TOKEN  = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.error('[CAPI] META_PIXEL_ID ou META_CAPI_TOKEN não configurados.');
    return res.status(500).json({ ok: false, error: 'Credenciais da Meta não configuradas no servidor.' });
  }

  // ── Enriquecimento via lid (dossiê) ─────────────────────────────────────────
  // Quando o browser não tem email/phone (ex: ViewContent do dossiê),
  // o servidor faz lookup no Redis usando o lid para montar user_data completo.

  let _email = email, _whats = whats, _nome = nome,
      _fbc = fbc, _fbp = fbp, _external_id = external_id;

  if (lid && (!email || !whats)) {
    const enriched = await enrichFromLid(lid, { phone: whats, em: email, fn: firstName(nome), fbc, fbp });
    _email       = _email       || enriched.em;
    _whats       = _whats       || enriched.phone;
    _fbc         = _fbc         || enriched.fbc;
    _fbp         = _fbp         || enriched.fbp;
    _external_id = _external_id || enriched.external_id;
  }

  // ── Monta user_data ─────────────────────────────────────────────────────────

  const phoneNormalized = normalizePhone(_whats);

  const user_data = {
    em:          sha256(_email),
    ph:          sha256(phoneNormalized),
    fn:          sha256(firstName(_nome)),
    external_id: _external_id || sha256(_email),
    client_ip_address: getClientIp(req),
    client_user_agent: req.headers['user-agent'] || null,
  };

  if (_fbc) user_data.fbc = _fbc;
  if (_fbp) user_data.fbp = _fbp;

  // Remove chaves com valor null para não poluir o payload
  Object.keys(user_data).forEach(k => {
    if (user_data[k] === null || user_data[k] === undefined) {
      delete user_data[k];
    }
  });

  // ── Monta o evento ───────────────────────────────────────────────────────────

  // event_name vem do frontend (ViewContent no page-load, Lead no QuizCompleted).
  // Default 'Lead' por retrocompatibilidade. Page-load não cria mais Lead espúrio.
  const resolvedEventName = event_name || 'Lead';

  const event = {
    event_name:        resolvedEventName,
    event_time:        Math.floor(Date.now() / 1000),   // timestamp unix em segundos
    action_source:     'website',
    event_source_url:  event_source_url || 'https://www.evelynliu.com.br/raiz',
    event_id:          lead_event_id || null,            // deduplicação com pixel browser
    user_data,
  };
  // custom_data por tipo de evento
  // LGPD / Meta policy: perfil e tier são dados psicológicos sensíveis — nunca enviar à Meta
  if (content_name || content_category) {
    event.custom_data = {};
    if (content_name)     event.custom_data.content_name     = content_name;
    if (content_category) event.custom_data.content_category = content_category;
  }
  // value/currency: apenas InitiateCheckout (paridade com o pixel browser p/ dedup).
  // Valor fixo da oferta (R$ 97) — não confia em valor vindo do cliente.
  if (resolvedEventName === 'InitiateCheckout') {
    event.custom_data = event.custom_data || {};
    event.custom_data.value = 97;
    event.custom_data.currency = 'BRL';
  }

  // Remove event_id se não veio (evita enviar null)
  if (!event.event_id) delete event.event_id;

  // ── Chama a API da Meta ──────────────────────────────────────────────────────

  const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;

  const dataEvents = [event];

  // PageView server-side — pareado com browser via pageview_event_id
  // Só no fluxo de page load (ViewContent/QuizView). Mesmo user_data → fbc+fbp
  // presentes → EMQ elevado para tráfego vindo de anúncio.
  if (resolvedEventName === 'ViewContent' && pageview_event_id) {
    dataEvents.push({
      event_name:       'PageView',
      event_time:       Math.floor(Date.now() / 1000),
      action_source:    'website',
      event_source_url: event_source_url || 'https://www.evelynliu.com.br/raiz',
      event_id:         pageview_event_id,
      user_data,
    });
  }

  // QuizCompleted é browser-only (audiences). Sem par server-side.

  const metaPayload = {
    data: dataEvents,
  };

  // test_event_code — só incluído se a variável existir e não estiver vazia.
  // Em produção, deixe META_TEST_EVENT_CODE ausente ou vazia no ambiente.
  const TEST_CODE = process.env.META_TEST_EVENT_CODE;
  if (TEST_CODE) metaPayload.test_event_code = TEST_CODE;

  console.log('[CAPI] Enviando para a Meta:', JSON.stringify(metaPayload, null, 2));

  try {
    const metaRes = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(metaPayload),
    });

    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[CAPI] Erro da Meta:', JSON.stringify(metaJson, null, 2));
      return res.status(500).json({ ok: false, error: 'Erro retornado pela Meta CAPI.', meta_response: metaJson });
    }

    console.log('[CAPI] Sucesso! fbtrace_id:', metaJson.fbtrace_id);
    console.log('[CAPI] Resposta completa:', JSON.stringify(metaJson, null, 2));

    return res.json({ ok: true, meta_response: metaJson });

  } catch (err) {
    console.error('[CAPI] Erro de rede ao chamar a Meta:', err.message);
    return res.status(500).json({ ok: false, error: 'Falha de conexão com a Meta CAPI.', detail: err.message });
  }
});

// ─── Captação Table → SDR direto ─────────────────────────────────────────────

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [value];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeCaptacaoLead(body = {}) {
  const phone = normalizePhone(body.whats || body.whatsapp || body.WhatsApp || '');
  const historico = toArray(body.historico);
  const saude = toArray(body.saude);
  const qualificacao = body.qualificacao && typeof body.qualificacao === 'object'
    ? body.qualificacao
    : null;

  return {
    nome: body.nome || body.Nome || 'Lead',
    whatsapp: phone,
    whats: phone,
    temperatura: body.temperatura || qualificacao?.tier || 'desconhecida',
    score: body.score || qualificacao?.score || '0',
    qualificacao,
    oqueMaisPesa: body.oqueMaisPesa || body.dores || '',
    dores: body.dores || body.oqueMaisPesa || '',
    historico: historico.join(', '),
    saude: saude.join(', '),
    comprometimento: body.comprometimento || '',
    maiorDificuldade: body.maiorDificuldade || body.dificuldade || '',
    dificuldade: body.dificuldade || body.maiorDificuldade || '',
    utm: body.utm || {},
    event_id: body.event_id || crypto.randomUUID(),
    source: body.source || 'formulario_captacao_table_clinic',
    created_at: body.created_at || new Date().toISOString(),
  };
}

async function reserveCaptacaoEvent(eventId) {
  const key = `captacao:event:${eventId}`;
  try {
    const reserved = await getRedis().set(key, '1', 'EX', 24 * 60 * 60, 'NX');
    return reserved === 'OK';
  } catch {
    if (captacaoSeenEvents.has(eventId)) return false;
    captacaoSeenEvents.add(eventId);
    setTimeout(() => captacaoSeenEvents.delete(eventId), 24 * 60 * 60 * 1000).unref?.();
    return true;
  }
}

async function forwardCaptacaoToSDR(leadData) {
  const SDR_URL = process.env.SDR_LEAD_WEBHOOK_URL || 'https://table-production-07c5.up.railway.app/webhook/lead';
  const SDR_SECRET = process.env.SDR_WEBHOOK_SECRET;

  if (!SDR_SECRET) {
    throw new Error('SDR_WEBHOOK_SECRET não configurado');
  }

  const retryDelays = [0, 1500, 4000];
  let lastError;

  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt]) await sleep(retryDelays[attempt]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const sdrRes = await fetch(SDR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SDR_SECRET },
        body: JSON.stringify(leadData),
        signal: controller.signal,
      });
      const text = await sdrRes.text();
      if (!sdrRes.ok) {
        throw new Error(`SDR respondeu ${sdrRes.status}: ${text.slice(0, 300)}`);
      }
      console.log(`[captacao/conversa] SDR ok — ${leadData.nome} (${leadData.whatsapp})`);
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`[captacao/conversa] tentativa ${attempt + 1} falhou: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

app.post('/api/captacao/conversa', async (req, res) => {
  const leadData = normalizeCaptacaoLead(req.body || {});

  if (!leadData.nome || leadData.nome === 'Lead' || !leadData.whatsapp) {
    return res.status(400).json({ ok: false, error: 'Nome e WhatsApp são obrigatórios.' });
  }

  const isNew = await reserveCaptacaoEvent(leadData.event_id);
  if (!isNew) {
    return res.json({ ok: true, duplicate: true, event_id: leadData.event_id });
  }

  try {
    await forwardCaptacaoToSDR(leadData);
    return res.json({ ok: true, event_id: leadData.event_id });
  } catch (err) {
    console.error('[captacao/conversa] falha ao encaminhar para SDR:', err.message);
    await redisSet(
      `captacao:failed:${leadData.event_id}`,
      JSON.stringify({ leadData, error: err.message, failed_at: new Date().toISOString() }),
      'EX',
      7 * 24 * 60 * 60
    );
    return res.status(502).json({ ok: false, error: 'Falha ao encaminhar lead para o SDR.' });
  }
});

// ─── Formulário pré-sessão → Hub CRM direto ─────────────────────────────────

function normalizePreSessaoPayload(body = {}) {
  return {
    nome: body.nome || body.name || '',
    telefone: normalizePhone(body.telefone || body.whats || body.whatsapp || body.phone || ''),
    email: body.email || null,
    dificuldade_hoje: body.dificuldade_hoje || '',
    sentimento_inicial: body.sentimento_inicial || '',
    historico: toArray(body.historico),
    padrao_abandono: body.padrao_abandono || '',
    saude: toArray(body.saude),
    saude_outro: body.saude_outro || '',
    objetivo: toArray(body.objetivo),
    uma_coisa: body.uma_coisa || '',
    rotina: body.rotina || '',
    horario: body.horario || '',
    observacoes: body.observacoes || '',
    origem: body.origem || 'formulario_pre_sessao',
    event_id: body.event_id || crypto.randomUUID(),
    created_at: body.created_at || new Date().toISOString(),
  };
}

async function forwardPreSessaoToHub(payload) {
  const HUB_URL = process.env.HUB_PRE_SESSAO_WEBHOOK_URL || 'https://crm.tableclinic.com.br/webhook/pre-sessao';
  const HUB_SECRET = process.env.HUB_WEBHOOK_SECRET || process.env.INTERNAL_WEBHOOK_SECRET;
  if (!HUB_SECRET) throw new Error('HUB_WEBHOOK_SECRET não configurado');

  const retryDelays = [0, 1500, 4000];
  let lastError;
  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt]) await sleep(retryDelays[attempt]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const hubRes = await fetch(HUB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': HUB_SECRET },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await hubRes.text();
      if (!hubRes.ok) {
        throw new Error(`Hub respondeu ${hubRes.status}: ${text.slice(0, 300)}`);
      }
      console.log(`[pre-sessao] Hub ok — ${payload.nome} (${payload.telefone})`);
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`[pre-sessao] tentativa ${attempt + 1} falhou: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

app.post('/api/pre-sessao', async (req, res) => {
  const payload = normalizePreSessaoPayload(req.body || {});

  if (!payload.nome || !payload.telefone) {
    return res.status(400).json({ ok: false, error: 'Nome e WhatsApp são obrigatórios.' });
  }

  try {
    await forwardPreSessaoToHub(payload);
    return res.json({ ok: true, event_id: payload.event_id });
  } catch (err) {
    console.error('[pre-sessao] falha ao encaminhar para Hub:', err.message);
    await redisSet(
      `pre_sessao:failed:${payload.event_id}`,
      JSON.stringify({ payload, error: err.message, failed_at: new Date().toISOString() }),
      'EX',
      7 * 24 * 60 * 60
    );
    return res.status(502).json({ ok: false, error: 'Falha ao encaminhar formulário para o CRM.' });
  }
});

// Reprocessa formulários pré-sessão que falharam ao encaminhar para o Hub.
// Roda periodicamente; ao ter sucesso, remove a chave de falha do Redis.
let drainingPreSessao = false;
async function drainFailedPreSessao() {
  if (drainingPreSessao) return;
  drainingPreSessao = true;
  try {
    const keys = await getRedis().keys('pre_sessao:failed:*');
    if (!keys.length) return;
    console.log(`[pre-sessao] drain: ${keys.length} pendente(s)`);
    for (const key of keys) {
      const raw = await redisGet(key);
      if (!raw) { await redisDel(key); continue; }
      let payload;
      try { payload = JSON.parse(raw).payload; } catch { await redisDel(key); continue; }
      if (!payload) { await redisDel(key); continue; }
      try {
        await forwardPreSessaoToHub(payload);
        await redisDel(key);
        console.log(`[pre-sessao] drain ok — ${payload.nome} (${payload.telefone})`);
      } catch (err) {
        console.warn(`[pre-sessao] drain ainda falhando para ${key}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[pre-sessao] drain erro:', err.message);
  } finally {
    drainingPreSessao = false;
  }
}

// ─── Rota Purchase (webhook Infinitepay → Meta CAPI) ─────────────────────────

app.post('/api/purchase', async (req, res) => {
  console.log('[PURCHASE] Payload recebido:', JSON.stringify(req.body, null, 2));

  const {
    paid_amount,
    transaction_nsu,
    order_nsu,
    capture_method,
    items,
  } = req.body || {};

  const PIXEL_ID   = process.env.META_PIXEL_ID;
  const CAPI_TOKEN = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.error('[PURCHASE] META_PIXEL_ID ou META_CAPI_TOKEN não configurados.');
    return res.status(500).json({ ok: false, error: 'Credenciais da Meta não configuradas.' });
  }

  // value em reais — paid_amount vem em centavos (ex: 230300 → 2303.00)
  const value = typeof paid_amount === 'number' ? paid_amount / 100 : null;

  const user_data = {};
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || null;
  if (clientIp)  user_data.client_ip_address = clientIp;
  if (userAgent) user_data.client_user_agent  = userAgent;

  const custom_data = {
    value,
    currency:       'BRL',
    capture_method: capture_method || null,
    num_items:      Array.isArray(items) ? items.length : null,
    order_id:       order_nsu       || null,
  };
  // Remove chaves null do custom_data
  Object.keys(custom_data).forEach(k => {
    if (custom_data[k] === null || custom_data[k] === undefined) delete custom_data[k];
  });

  const event = {
    event_name:    'Purchase',
    event_time:    Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_id:      transaction_nsu || null,
    user_data,
    custom_data,
  };
  if (!event.event_id) delete event.event_id;

  const metaPayload = { data: [event] };

  const TEST_CODE = process.env.META_TEST_EVENT_CODE;
  if (TEST_CODE) metaPayload.test_event_code = TEST_CODE;

  console.log('[PURCHASE] Enviando para a Meta:', JSON.stringify(metaPayload, null, 2));

  const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;

  try {
    const metaRes  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(metaPayload),
    });
    const metaJson = await metaRes.json();

    if (!metaRes.ok) {
      console.error('[PURCHASE] Erro da Meta:', JSON.stringify(metaJson, null, 2));
      return res.status(500).json({ ok: false, error: 'Erro retornado pela Meta CAPI.', meta_response: metaJson });
    }

    console.log('[PURCHASE] Sucesso! fbtrace_id:', metaJson.fbtrace_id);
    return res.json({ ok: true, meta_response: metaJson });

  } catch (err) {
    console.error('[PURCHASE] Erro de rede:', err.message);
    return res.status(500).json({ ok: false, error: 'Falha de conexão com a Meta CAPI.', detail: err.message });
  }
});

// ─── Meta Insights ────────────────────────────────────────────────────────────

const PERIOD_MAP = {
  today:      'today',
  yesterday:  'yesterday',
  this_week:  'this_week_mon_today',
  last_week:  'last_week_mon_sun',
  this_month: 'this_month',
  last_month: 'last_month',
};

const INSIGHTS_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpm',
  'actions', 'action_values', 'cost_per_action_type', 'purchase_roas',
].join(',');

// Cache simples para status das campanhas (5 min TTL)
let campaignsCache = { data: null, at: 0 };

function parseInsight(d) {
  if (!d) return null;
  const spend     = parseFloat(d.spend || 0);
  const ctr       = parseFloat(d.ctr   || 0);
  const cpm       = parseFloat(d.cpm   || 0);
  const actions   = d.actions || [];
  const leads     = parseFloat(actions.find(a => a.action_type === 'lead')?.value     || 0);
  const purchases = parseFloat(actions.find(a => a.action_type === 'purchase')?.value || 0);
  const roasArr   = d.purchase_roas || [];
  const roas      = parseFloat(roasArr.find(a => a.action_type === 'omni_purchase')?.value || 0);
  return {
    spend,
    leads,
    cpl:       leads     > 0 ? spend / leads     : null,
    ctr,
    cpm,
    purchases,
    cpa:       purchases > 0 ? spend / purchases : null,
    roas:      roas || null,
  };
}

async function metaFetch(path, params) {
  const token   = process.env.META_ADS_ACCESS_TOKEN;
  const qs      = new URLSearchParams({ ...params, access_token: token });
  const url     = `https://graph.facebook.com/v21.0/${path}?${qs}`;
  const res     = await fetch(url);
  const json    = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

async function getCampaignStatuses() {
  if (campaignsCache.data && Date.now() - campaignsCache.at < 5 * 60 * 1000) {
    return campaignsCache.data;
  }
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const json = await metaFetch(`act_${accountId}/campaigns`, {
    fields: 'id,status',
    limit:  200,
  });
  const map = {};
  for (const c of json.data || []) map[c.id] = c.status;
  campaignsCache = { data: map, at: Date.now() };
  return map;
}

const VALID_LEVELS = ['account', 'campaign', 'adset', 'ad'];

app.get('/api/meta-insights', async (req, res) => {
  const period = req.query.period || 'today';
  const level  = req.query.level  || 'campaign';
  const preset = PERIOD_MAP[period];

  if (!preset) {
    return res.status(400).json({ error: `period inválido. Use: ${Object.keys(PERIOD_MAP).join(', ')}` });
  }
  if (!VALID_LEVELS.includes(level)) {
    return res.status(400).json({ error: `level inválido. Use: ${VALID_LEVELS.join(', ')}` });
  }

  const token     = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) {
    return res.status(500).json({ error: 'META_ADS_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurados.' });
  }

  try {
    const baseParams = { date_preset: preset, limit: 200 };

    // Visão geral (account) — sempre buscada
    const overviewJson = await metaFetch(`act_${accountId}/insights`, {
      ...baseParams, level: 'account', fields: INSIGHTS_FIELDS,
    });
    const overview = parseInsight(overviewJson.data?.[0]);

    // Rows por level solicitado
    let rows = [];
    if (level !== 'account') {
      const levelFields = {
        campaign: `campaign_id,campaign_name,${INSIGHTS_FIELDS}`,
        adset:    `campaign_id,campaign_name,adset_id,adset_name,${INSIGHTS_FIELDS}`,
        ad:       `campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,${INSIGHTS_FIELDS}`,
      }[level];

      const [rowsJson, statuses] = await Promise.all([
        metaFetch(`act_${accountId}/insights`, { ...baseParams, level, fields: levelFields }),
        getCampaignStatuses(),
      ]);

      rows = (rowsJson.data || []).map(d => {
        const base = {
          campaignId:   d.campaign_id,
          campaignName: d.campaign_name,
          status:       statuses[d.campaign_id] || 'UNKNOWN',
          ...parseInsight(d),
        };
        if (level === 'adset' || level === 'ad') {
          base.adsetId   = d.adset_id;
          base.adsetName = d.adset_name;
        }
        if (level === 'ad') {
          base.adId   = d.ad_id;
          base.adName = d.ad_name;
        }
        return base;
      }).sort((a, b) => b.spend - a.spend);
    }

    return res.json({ period, level, overview, rows });

  } catch (err) {
    console.error('[meta-insights]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Ações de gestão ──────────────────────────────────────────────────────────

const VALID_ENTITY_TYPES   = ['campaign', 'adset', 'ad'];
const VALID_ACTIONS        = ['ACTIVE', 'PAUSED'];
const VALID_BUDGET_TYPES   = ['daily', 'lifetime'];
const VALID_DUP_TYPES      = ['campaign', 'adset'];

// Helper para PATCH/POST na entidade
async function metaPatch(entityId, params) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const qs    = new URLSearchParams({ ...params, access_token: token });
  const url   = `https://graph.facebook.com/v21.0/${entityId}?${qs}`;
  const res   = await fetch(url, { method: 'POST' }); // Meta usa POST para updates
  const json  = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

async function metaPost(path, body) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const url   = `https://graph.facebook.com/v21.0/${path}`;
  const res   = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

// POST /api/meta-action — pausar ou ativar entidade
app.post('/api/meta-action', async (req, res) => {
  const { entity_type, entity_id, action } = req.body || {};

  if (!VALID_ENTITY_TYPES.includes(entity_type)) return res.status(400).json({ ok: false, error: 'entity_type inválido.' });
  if (!entity_id)                                 return res.status(400).json({ ok: false, error: 'entity_id obrigatório.' });
  if (!VALID_ACTIONS.includes(action))            return res.status(400).json({ ok: false, error: 'action inválida. Use ACTIVE ou PAUSED.' });

  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'Token não configurado.' });

  console.log(`[meta-action] ${new Date().toISOString()} | ${entity_type} ${entity_id} → ${action}`);

  try {
    await metaPatch(entity_id, { status: action });
    // Invalida cache de status
    campaignsCache = { data: null, at: 0 };
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meta-action] erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/meta-budget — atualizar orçamento
app.post('/api/meta-budget', async (req, res) => {
  const { entity_type, entity_id, budget_type, amount } = req.body || {};

  if (!['campaign', 'adset'].includes(entity_type)) return res.status(400).json({ ok: false, error: 'entity_type deve ser campaign ou adset.' });
  if (!entity_id)                                    return res.status(400).json({ ok: false, error: 'entity_id obrigatório.' });
  if (!VALID_BUDGET_TYPES.includes(budget_type))     return res.status(400).json({ ok: false, error: 'budget_type deve ser daily ou lifetime.' });
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    return res.status(400).json({ ok: false, error: 'amount inválido (em centavos, ex: 5000 = R$50).' });

  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'Token não configurado.' });

  const field = budget_type === 'daily' ? 'daily_budget' : 'lifetime_budget';
  console.log(`[meta-budget] ${new Date().toISOString()} | ${entity_type} ${entity_id} | ${field}=${amount}`);

  try {
    await metaPatch(entity_id, { [field]: String(Math.round(Number(amount))) });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meta-budget] erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/meta-duplicate — duplicar campanha ou conjunto
app.post('/api/meta-duplicate', async (req, res) => {
  const { entity_type, entity_id } = req.body || {};

  if (!VALID_DUP_TYPES.includes(entity_type)) return res.status(400).json({ ok: false, error: 'entity_type deve ser campaign ou adset.' });
  if (!entity_id)                              return res.status(400).json({ ok: false, error: 'entity_id obrigatório.' });

  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'Token não configurado.' });

  // Endpoint de cópia da Meta: POST /{id}/copies
  const copyPath = entity_type === 'campaign'
    ? `${entity_id}/copies`
    : `${entity_id}/copies`;

  console.log(`[meta-duplicate] ${new Date().toISOString()} | ${entity_type} ${entity_id}`);

  try {
    const json = await metaPost(copyPath, { status: 'PAUSED', deep_copy: true });
    const newId = json.copied_campaign_id || json.id || json.copied_adset_id;
    return res.json({ ok: true, new_id: newId });
  } catch (err) {
    console.error('[meta-duplicate] erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── SDR Forward ─────────────────────────────────────────────────────────────

async function forwardToSDR(body) {
  const SDR_URL    = 'https://table-production-07c5.up.railway.app/webhook/quiz';
  const SDR_SECRET = process.env.SDR_WEBHOOK_SECRET;

  if (!SDR_SECRET) {
    console.warn('[SDR-forward] SDR_WEBHOOK_SECRET não configurado — forward ignorado');
    return;
  }

  const phone = normalizePhone(body.whats || body.whatsapp || '');
  if (!phone) return;

  // Mapeia rótulos legíveis para os valores de qualificação do quiz
  const QUAL_LABELS = {
    nutri_convencional:   'nutricionista convencional',
    jejum:                'jejum intermitente',
    dieta_calorias:       'dieta restritiva',
    psicologo:            'psicólogo ou psiquiatra',
    remedios:             'medicação prescrita',
    nutri_comportamental: 'nutrição comportamental',
    cirurgia:             'cirurgia bariátrica',
    coach:                'coach ou programa online',
  };

  // Histórico: monta a partir dos itens de qualificação (tentativas anteriores)
  const qualItems = body.qualification?.items || [];
  const historico = qualItems
    .filter(v => v !== 'nenhum' && QUAL_LABELS[v])
    .map(v => QUAL_LABELS[v])
    .join(', ');

  // "Perguntas e respostas": formata array [{pergunta, resposta}] como string
  const respostasArr = Array.isArray(body.respostas) ? body.respostas : [];
  const perguntasRespostas = respostasArr
    .map(r => `${r.pergunta}: ${r.resposta}`)
    .join(', ');

  const payload = {
    nome:                   body.nome || body.Nome || '',
    whatsapp:               phone,
    perfil:                 body.profileName || body.profile || '',
    historico:              historico || '',
    'Perguntas e respostas': perguntasRespostas,
    source:                 'quiz_evelynliu',
    lead_event_id:          body.quiz_lead_event_id || body.lead_event_id || null,
    tier:                   body.qualification?.tier || body.tier || null, // hot/warm/cold para parágrafo de tier no dossiê
  };

  console.log('[SDR-forward] URL:', SDR_URL);
  console.log('[SDR-forward] Payload:', JSON.stringify(payload, null, 2));

  const sdrRes = await fetch(SDR_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SDR_SECRET },
    body:    JSON.stringify(payload),
  });

  const sdrBody = await sdrRes.text();
  console.log(`[SDR-forward] Status: ${sdrRes.status} — lead ${payload.nome} (${phone})`);
  console.log(`[SDR-forward] Resposta: ${sdrBody}`);
}

// ─── Helper CAPI genérico ─────────────────────────────────────────────────────

async function sendCapiEvent({ eventName, phone, fbclid, fbc, fbp, em, fn, external_id, customData, eventSourceUrl, eventId, req }) {
  const PIXEL_ID   = process.env.META_PIXEL_ID;
  const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
  if (!PIXEL_ID || !CAPI_TOKEN) return;

  const user_data = {};
  const phoneHashed = sha256(phone);
  if (phoneHashed) user_data.ph = phoneHashed;
  const emHashed = sha256(em);
  if (emHashed) user_data.em = emHashed;
  const fnHashed = sha256(fn);
  if (fnHashed) user_data.fn = fnHashed;
  // external_id: já vem pré-hasheado do Redis (sha256 do email)
  if (external_id) user_data.external_id = external_id;
  if (fbclid)      user_data.fbc = fbclid;
  if (fbc)         user_data.fbc = fbc;
  if (fbp)         user_data.fbp = fbp;
  // ip + user_agent quando a requisição original está disponível (melhora EMQ)
  if (req) {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'];
    if (ip) user_data.client_ip_address = ip;
    if (ua) user_data.client_user_agent  = ua;
  }

  const event = {
    event_name:       eventName,
    event_time:       Math.floor(Date.now() / 1000),
    action_source:    'website',
    event_id:         eventId || crypto.randomUUID(),   // pareia com pixel quando enviado
    event_source_url: eventSourceUrl || 'https://www.evelynliu.com.br/raiz',
    user_data,
    custom_data:      customData || {},
  };

  const metaPayload = { data: [event] };
  const TEST_CODE = process.env.META_TEST_EVENT_CODE;
  if (TEST_CODE) metaPayload.test_event_code = TEST_CODE;

  const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload),
    });
    const json = await res.json();
    console.log(`[CAPI] ${eventName} — fbtrace_id: ${json.fbtrace_id}`);
  } catch (err) {
    console.error(`[CAPI] ${eventName} erro:`, err.message);
  }
}

// ─── Lead Context (dossiê bootstrap) ─────────────────────────────────────────
// Retorna hashes e first_name para hidratação do fbq('init') no dossiê.
// Não expõe PII — apenas campos hasheados + primeiro nome em texto puro.

app.get('/api/lead-context', async (req, res) => {
  const lid = req.query.lid;
  if (!lid) return res.status(400).json({ error: 'lid obrigatório' });
  try {
    const raw = await getRedis().get(`lead:${lid}`);
    if (!raw) return res.status(404).json({});
    const lead = JSON.parse(raw);
    const phoneNorm = normalizePhone(lead.phone || '');
    return res.json({
      em_hash:     sha256(lead.email)           || null,
      ph_hash:     sha256(phoneNorm)            || null,
      fn_hash:     sha256(firstName(lead.nome)) || null,
      external_id: lead.external_id || sha256(lead.email) || null,
      first_name:  firstName(lead.nome)         || null,  // texto puro para interpolação visual
    });
  } catch {
    return res.status(404).json({});
  }
});

// Helper: enriquece dados de evento a partir do lid (lookup Redis)
async function enrichFromLid(lid, base = {}) {
  if (!lid) return base;
  try {
    const raw = await getRedis().get(`lead:${lid}`);
    if (!raw) return base;
    const lead = JSON.parse(raw);
    return {
      phone:       base.phone       || lead.phone,
      em:          base.em          || lead.email,
      fn:          base.fn          || firstName(lead.nome),
      fbc:         base.fbc         || lead.fbc,
      fbp:         base.fbp         || lead.fbp,
      external_id: base.external_id || lead.external_id || sha256(lead.email),
    };
  } catch { return base; }
}

// ─── CAPI Dossiê: DossieView ──────────────────────────────────────────────────

app.post('/api/capi/dossie-view', async (req, res) => {
  // DossieView: telemetria interna apenas — não repassa à Meta.
  // ViewContent nativo (2.1) já vai à Meta com EMQ completo via /api/capi.
  // Decisão registrada em CONTRACT.md.
  console.log('[DossieView] Telemetria interna:', req.body?.event_id, '| perfil:', req.body?.perfil, '| lid:', req.body?.lid);
  res.json({ ok: true });
});

// ─── CAPI Dossiê: InitiateCheckout ────────────────────────────────────────────

app.post('/api/capi/initiate-checkout', async (req, res) => {
  const { phone, content_name, perfil, event_source_url, event_id, em, fbp, fbc, fn, lid } = req.body || {};
  res.json({ ok: true });

  const enriched = await enrichFromLid(lid, { phone, em, fbc, fbp, fn });

  // Série diária p/ dashboard (fire-and-forget)
  metricsIncr('evt_InitiateCheckout').catch(() => {});

  // Agenda recuperação de checkout: se o Purchase não chegar via webhook Ticto
  // em RECOVERY_DELAY_MIN, o sweep dispara o WhatsApp (authorized cancela)
  scheduleCheckoutRecovery({
    phone: enriched.phone,
    email: enriched.em,
    name:  enriched.fn,
    lid,
    stage: 'ic',
  }).catch(() => {});

  sendCapiEvent({
    eventName: 'InitiateCheckout',
    phone:       enriched.phone,
    em:          enriched.em,
    fbp:         enriched.fbp,
    fbc:         enriched.fbc,
    fn:          enriched.fn,
    external_id: enriched.external_id,
    customData: {
      content_name: content_name || 'InitiateCheckout_Dossie',
      currency: 'BRL',
      value: 97,
    },
    eventSourceUrl: event_source_url,
    eventId: event_id,
    req,
  }).catch(() => {});
});

// ─── Ticto Webhook ───────────────────────────────────────────────────────────
//
// Estrutura esperada (payload v2.0 da Ticto):
//   order.hash          → event_id para dedup (estável em retries)
//   order.paid_amount   → valor em centavos
//   order.status        → authorized | refunded | chargeback | ...
//   customer.email      → e-mail do comprador
//   customer.cpf        → CPF (usar como external_id hasheado)
//   customer.phone      → telefone
//   query_params.fbclid → fbclid capturado no checkout
//   query_params.fbp    → _fbp
//   query_params.fbc    → _fbc
//   tracking.src        → join key que passamos no redirect (= _leadEventId)
//   tracking.utm_*      → UTMs
//   item.product_name   → nome do produto
//   item.offer_id       → ID da oferta
//
// Env vars:
//   TICTO_WEBHOOK_SECRET  → token de validação (opcional; se ausente, aceita tudo)
//   PURCHASE_CAPI_ENABLED → 'true' para ativar envio à Meta (padrão: false / SOMBRA)

// Helpers Redis para persistência leve de eventos Ticto
async function redisPurchaseSet(hash, data) {
  try {
    const redis = getRedis();
    await redis.set(`ticto:purchase:${hash}`, JSON.stringify(data), 'EX', 60 * 60 * 24 * 90); // 90 dias
  } catch (e) {
    console.error('[Ticto] Redis write error:', e.message);
  }
}
async function redisPurchaseGet(hash) {
  try {
    const raw = await getRedis().get(`ticto:purchase:${hash}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function redisIncrStats(key) {
  try { await getRedis().incr(`ticto:stats:${key}`); } catch {}
}
async function redisSetLastEvent(ts) {
  try { await getRedis().set('ticto:stats:last_event_at', ts); } catch {}
}
async function redisGetStats() {
  try {
    const redis = getRedis();
    const [total, lastAt, totalFbc, totalFbcPresent] = await Promise.all([
      redis.get('ticto:stats:total'),
      redis.get('ticto:stats:last_event_at'),
      redis.get('ticto:stats:authorized'),
      redis.get('ticto:stats:fbc_present'),
    ]);
    return { total: Number(total)||0, lastAt, authorized: Number(totalFbc)||0, fbc_present: Number(totalFbcPresent)||0 };
  } catch { return {}; }
}

// ─── Recuperação de checkout via WhatsApp Cloud API ──────────────────────────
//
// Três gatilhos agendam uma mensagem de recuperação (1 por lead a cada 24h):
//   1. InitiateCheckout do quiz sem Purchase em RECOVERY_DELAY_MIN (cobre quem
//      abriu o checkout e não digitou nada — a Ticto não enxerga esses)
//   2. Webhook abandoned_cart da Ticto (lead digitou email/phone e saiu;
//      payload traz checkout_url de retorno)
//   3. Webhook waiting_payment/pix_created (gerou Pix e não pagou)
// O status authorized cancela qualquer recuperação pendente do telefone.
//
// Env vars:
//   RECOVERY_ENABLED            → 'true' ativa envio real (padrão: SOMBRA, só loga)
//   WHATSAPP_CLOUD_TOKEN        → token permanente da WhatsApp Cloud API
//   WHATSAPP_PHONE_NUMBER_ID    → phone number id do remetente
//   WHATSAPP_RECOVERY_TEMPLATE  → nome do modelo aprovado (padrão: recuperacao_checkout_raiz)
//   RECOVERY_DELAY_MIN          → atraso do envio após o gatilho (padrão: 30)
//   TICTO_CHECKOUT_PATH         → path da oferta no checkout (padrão: O3EB65FBD)

const RECOVERY_TTL_PENDING = 60 * 60 * 24;      // pendência expira em 24h
const RECOVERY_TTL_SENT    = 60 * 60 * 24;      // no máximo 1 mensagem por lead a cada 24h

function recoveryDelayMs() {
  return (Number(process.env.RECOVERY_DELAY_MIN) || 30) * 60 * 1000;
}

// Sufixo do link do checkout (vai no botão do template como variável de URL,
// base fixa https://checkout.ticto.app/ definida no modelo)
function buildCheckoutSuffix({ email, phone, name, lid }) {
  const path = process.env.TICTO_CHECKOUT_PATH || 'O3EB65FBD';
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  // phonenumber: formato DDD+numero, sem DDI 55 (doc de checkout pré-populado da Ticto)
  if (phone) params.set('phonenumber', String(phone).replace(/\D/g, '').replace(/^55/, ''));
  if (name)  params.set('name', name);
  if (lid)   params.set('src', lid);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function scheduleCheckoutRecovery({
  phone, email, name, lid, stage, checkoutSuffix,
  paymentMethod, bankSlipUrl, bankSlipCode, pixCode, pixUrl,
}) {
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm) return;
  try {
    const redis = getRedis();
    if (await redis.get(`recovery:optout:${phoneNorm}`)) return;    // lead pediu SAIR — nunca mais
    if (await redis.get(`recovery:sent:${phoneNorm}`)) return;      // já recebeu nas últimas 24h
    const existing = await redis.get(`recovery:pending:${phoneNorm}`);
    const prev = existing ? JSON.parse(existing) : null;
    const record = {
      phone:           phoneNorm,
      email:           email || prev?.email || null,
      name:            name  || prev?.name  || null,
      lid:             lid   || prev?.lid   || null,
      // Reservado p/ um link de sessão específica melhor que o nosso, se algum
      // evento futuro trouxer um — hoje nenhum gatilho popula isto (ver abandoned_cart)
      checkout_suffix: checkoutSuffix || prev?.checkout_suffix || null,
      // Dados da transação específica (boleto/Pix) — capturados mas ainda não
      // usados no envio (template atual só aceita link de checkout.ticto.app)
      payment_method:  paymentMethod || prev?.payment_method || null,
      bank_slip_url:   bankSlipUrl   || prev?.bank_slip_url  || null,
      bank_slip_code:  bankSlipCode  || prev?.bank_slip_code || null,
      pix_code:        pixCode       || prev?.pix_code       || null,
      pix_url:         pixUrl        || prev?.pix_url        || null,
      stage,                                                        // ic | abandoned_cart | waiting_payment
      due_at:          prev?.due_at || (Date.now() + recoveryDelayMs()),
      created_at:      prev?.created_at || new Date().toISOString(),
    };
    await redis.set(`recovery:pending:${phoneNorm}`, JSON.stringify(record), 'EX', RECOVERY_TTL_PENDING);
    console.log(`[Recovery] Agendada (${stage}): ${phoneNorm} para ${new Date(record.due_at).toISOString()}`);
  } catch (e) {
    console.error('[Recovery] Erro ao agendar:', e.message);
  }
}

async function cancelCheckoutRecovery(phone, reason) {
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm) return;
  try {
    const removed = await getRedis().del(`recovery:pending:${phoneNorm}`);
    if (removed) console.log(`[Recovery] Cancelada (${reason}): ${phoneNorm}`);
  } catch {}
}

async function sendRecoveryMessage(rec) {
  const TOKEN     = process.env.WHATSAPP_CLOUD_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_ID  = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const TEMPLATE  = process.env.WHATSAPP_RECOVERY_TEMPLATE || 'recuperacao_checkout_raiz';
  const ENABLED   = process.env.RECOVERY_ENABLED === 'true';
  // O template aprovado usa botão com URL FIXA (magic link de recuperação da
  // Ticto — link único que resolve a sessão da lead via cookies no aparelho
  // dela). Botão fixo NÃO aceita parâmetro: enviar um faz a API rejeitar a
  // mensagem inteira. Se um dia o template mudar para URL dinâmica
  // (https://checkout.ticto.app/{{1}}), setar RECOVERY_BUTTON_MODE=dynamic
  // para voltar a enviar o sufixo com prefill por lead.
  const BUTTON_MODE = process.env.RECOVERY_BUTTON_MODE || 'static';

  const components = [
    { type: 'body', parameters: [{ type: 'text', text: firstName(rec.name) || 'querida' }] },
  ];
  if (BUTTON_MODE === 'dynamic') {
    const suffix = rec.checkout_suffix
      || buildCheckoutSuffix({ email: rec.email, phone: rec.phone, name: rec.name, lid: rec.lid });
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: suffix }] });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: rec.phone,
    type: 'template',
    template: {
      name: TEMPLATE,
      language: { code: 'pt_BR' },
      components,
    },
  };

  if (!ENABLED || !TOKEN || !PHONE_ID) {
    console.log('[Recovery] SOMBRA — payload WhatsApp:', JSON.stringify(payload));
    return { shadow: true };
  }

  const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`WhatsApp API ${resp.status}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function registerRecoveryTemplateInHub(rec, provider) {
  const HUB_URL = process.env.HUB_TEMPLATE_SENT_URL
    || 'https://crm.tableclinic.com.br/webhook/whatsapp-template-sent';
  const HUB_SECRET = process.env.HUB_WEBHOOK_SECRET || process.env.INTERNAL_WEBHOOK_SECRET;
  if (!HUB_SECRET) {
    console.warn('[Recovery] HUB_WEBHOOK_SECRET não configurado — registro no Hub ignorado');
    return null;
  }

  const payload = {
    phone: rec.phone,
    nome: rec.name || 'Lead',
    template_name: process.env.WHATSAPP_RECOVERY_TEMPLATE || 'recuperacao_checkout_raiz',
    params: [firstName(rec.name) || 'querida'],
    provider,
    provider_message_id: provider?.messages?.[0]?.id || null,
    source: 'checkout_recovery',
    tier: null,
    funnel: 'quiz',
    body_text: 'recuperacao_checkout_raiz',
  };

  try {
    const res = await fetch(HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': HUB_SECRET },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[Recovery] Hub registro falhou (${res.status}): ${text}`);
      return null;
    }
    return await res.json().catch(() => ({}));
  } catch (err) {
    console.warn('[Recovery] Hub registro falhou:', err.message);
    return null;
  }
}

async function recoverySweep() {
  const redis = getRedis();
  let keys = [];
  try { keys = await redis.keys('recovery:pending:*'); } catch { return; }

  for (const key of keys) {
    try {
      const raw = await redis.get(key);
      if (!raw) continue;
      const rec = JSON.parse(raw);
      if (Date.now() < rec.due_at) continue;

      // Blocklist (lead respondeu SAIR): descarta a pendência sem enviar
      if (await redis.get(`recovery:optout:${rec.phone}`)) {
        await redis.del(key);
        console.log(`[Recovery] Descartada (optout): ${rec.phone}`);
        continue;
      }

      const sendingLock = await redis.set(`recovery:sending:${rec.phone}`, rec.stage, 'EX', 5 * 60, 'NX');
      if (!sendingLock) continue;

      const provider = await sendRecoveryMessage(rec);
      if (provider?.shadow) {
        await redis.del(`recovery:sending:${rec.phone}`);
        continue;
      }

      const sentLock = await redis.set(`recovery:sent:${rec.phone}`, rec.stage, 'EX', RECOVERY_TTL_SENT, 'NX');
      await redis.del(`recovery:sending:${rec.phone}`);
      if (!sentLock) continue;

      await redis.del(key);
      registerRecoveryTemplateInHub(rec, provider).catch(() => {});
      await redisIncrStats(`recovery_sent_${rec.stage}`);
      metricsIncr('recovery_sent').catch(() => {});
      console.log(`[Recovery] Enviada (${rec.stage}): ${rec.phone}`);
    } catch (e) {
      console.error('[Recovery] Erro no envio:', e.message);
      await redisIncrStats('recovery_errors');
    }
  }
}

// ─── Webhook WhatsApp Cloud API (mensagens recebidas) ────────────────────────
//
// Processa respostas das leads no número da recuperação:
//   - SAIR/PARAR/STOP/CANCELAR → blocklist permanente (recovery:optout:{phone})
//     + confirmação em texto livre (permitido: janela de 24h aberta pela lead)
//   - Demais mensagens → apenas logadas (Felipe responde manualmente)
//
// Configurar no painel do app Meta (WhatsApp → Configuration → Webhook):
//   Callback URL: https://<dominio>/api/webhooks/whatsapp
//   Verify token: valor de WHATSAPP_VERIFY_TOKEN
//   Campo assinado: messages

// Verificação do webhook (chamada única do Meta ao cadastrar a URL)
app.get('/api/webhooks/whatsapp', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  return res.sendStatus(403);
});

// Palavras que ativam o opt-out (comparação sem acentos/pontuação, minúsculas)
const OPTOUT_WORDS = new Set(['sair', 'parar', 'stop', 'cancelar', 'pare']);

function isOptOutText(text) {
  if (!text) return false;
  const t = String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .toLowerCase().replace(/[^a-z\s]/g, '').trim();
  return OPTOUT_WORDS.has(t);
}

async function sendWhatsAppText(to, bodyText) {
  const TOKEN    = process.env.WHATSAPP_CLOUD_TOKEN;
  const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!TOKEN || !PHONE_ID) return;
  const resp = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: bodyText } }),
  });
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}));
    throw new Error(`WhatsApp API ${resp.status}: ${JSON.stringify(j.error || j)}`);
  }
}

app.post('/api/webhooks/whatsapp', async (req, res) => {
  res.sendStatus(200); // Meta exige resposta rápida; reenvios são deduplicados pelo id da msg

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        // Ignora recibos de entrega/leitura (value.statuses) — só interessa messages
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          const from = normalizePhone(msg.from);
          const text = msg.text?.body || msg.button?.text || null;
          if (!from) continue;

          if (isOptOutText(text)) {
            // Blocklist permanente (sem TTL) + limpa pendência se houver
            await redisSet(`recovery:optout:${from}`, new Date().toISOString());
            await redisDel(`recovery:pending:${from}`);
            await redisIncrStats('recovery_optout');
            console.log(`[WhatsApp] Opt-out registrado: ${from}`);
            await sendWhatsAppText(from,
              'Pronto! Você não vai mais receber mensagens automáticas por aqui. Se mudar de ideia ou precisar de algo, é só me chamar 💚'
            ).catch(e => console.error('[WhatsApp] Erro na confirmação de opt-out:', e.message));
          } else if (text) {
            // Resposta comum — loga para visibilidade (atendimento manual)
            console.log(`[WhatsApp] Mensagem recebida de ${from}: ${String(text).slice(0, 200)}`);
          }
        }
      }
    }
  } catch (e) {
    console.error('[WhatsApp] Erro no processamento do webhook:', e.message);
  }
});

app.post('/api/webhooks/ticto', async (req, res) => {
  // Responde 200 imediatamente — Ticto exige resposta rápida (inclusive no ping de validação)
  res.sendStatus(200);

  const body = req.body || {};

  // Blindagem: qualquer erro não previsto (payload de evento novo/inesperado,
  // ex. assinatura) fica contido aqui — sem isso, uma exceção não capturada
  // dentro de um handler async vira unhandled rejection e derruba o processo
  // inteiro (Node 15+), tirando do ar CAPI e formulários junto com a Ticto.
  try {

  console.log('[Ticto] Payload recebido:', JSON.stringify(body, null, 2));

  // Ping de validação do cadastro: body vazio ou sem order
  // (abandoned_cart é o único evento legítimo sem body.order — payload v2 flat)
  if (!body.order && body.status !== 'abandoned_cart') {
    console.log('[Ticto] Ping de validação — sem order, ignorado.');
    return;
  }

  // Validação do token: token é fixo por integração (confirmado — dois payloads distintos, mesmo token).
  // Setar TICTO_WEBHOOK_SECRET no Railway com o valor do campo body.token.
  const secret = process.env.TICTO_WEBHOOK_SECRET;
  if (secret && body.token !== secret) {
    console.warn('[Ticto] Token inválido — payload rejeitado.');
    return; // já respondeu 200; Ticto não reenvia
  }

  // ── Abandono de checkout: agenda recuperação e encerra ──────────────────────
  // Payload v2 flat: status, email, phone, name (nome do CLIENTE, confirmado em
  // teste real — não é o nome da oferta), checkout_url, tracking.src (opcional).
  //
  // checkout_url neste evento é a URL BASE da oferta (ex: .../O3EB65FBD), sem
  // query params — confirmado em teste real. Não é um link de sessão que
  // resume o carrinho especificamente, então não usamos: nosso próprio link
  // (via buildCheckoutSuffix, no envio) é estritamente melhor porque leva
  // email/telefone/nome para pré-preencher o checkout.
  if (body.status === 'abandoned_cart') {
    await redisIncrStats('abandoned_cart');
    metricsIncr('abandoned_cart').catch(() => {});
    const abandonSrc = (body.tracking?.src && body.tracking.src !== 'Não Informado') ? body.tracking.src : null;
    await scheduleCheckoutRecovery({
      phone: body.phone,
      email: body.email || null,
      name:  body.name  || null,
      lid:   abandonSrc,
      stage: 'abandoned_cart',
    });
    return;
  }

  const transactionId = body.order?.hash;
  // status: top-level no payload real da Ticto (body.status); order.status como fallback
  const status        = body.order?.status || body.status;

  if (!transactionId) {
    console.warn('[Ticto] order.hash ausente — não é possível garantir idempotência. Ignorado.');
    return;
  }

  // ── Pix gerado / aguardando pagamento: lead clicou em comprar e não pagou ──
  // Agenda recuperação (mesmo template; se pagar antes, authorized cancela).
  //
  // transaction.payment_method diz o meio (bank_slip | pix | credit_card).
  // Para boleto, a Ticto manda o PDF e a linha digitável da MESMA transação
  // (transaction.bank_slip_url / bank_slip_code) — melhor que mandar a lead
  // de volta pro checkout, pois reativa o pagamento já gerado, sem novo boleto.
  // Campos equivalentes de Pix (pix_code/qr_code) ainda não confirmados em
  // payload real — capturados abaixo com nomes candidatos; checar no log
  // quando um teste de Pix chegar e ajustar se o nome vier diferente.
  // Guardado no registro por ora (não usado no envio ainda: o botão do
  // template WhatsApp tem URL base fixa checkout.ticto.app, não aceita domínio
  // diferente — enviar o boleto por link exigiria template próprio ou texto
  // no corpo da mensagem; ver com o Felipe antes de linkar isso ao envio).
  if (status === 'waiting_payment' || status === 'pix_created') {
    await redisIncrStats(status);
    metricsIncr('waiting_payment').catch(() => {});
    const wpSrc = (body.tracking?.src && body.tracking.src !== 'Não Informado') ? body.tracking.src : null;
    const wpPhoneObj = body.customer?.phone;
    const wpPhone = body.telefone
      || body.phone_number_customer
      || (wpPhoneObj && typeof wpPhoneObj === 'object'
          ? `${(wpPhoneObj.ddi || '+55').replace('+', '')}${wpPhoneObj.ddd || ''}${wpPhoneObj.number || ''}`
          : wpPhoneObj)
      || null;
    const paymentMethod  = body.transaction?.payment_method || null;
    const bankSlipUrl    = body.transaction?.bank_slip_url  || null;
    const bankSlipCode   = body.transaction?.bank_slip_code || null;
    // Nomes candidatos p/ Pix — não confirmados, ajustar após ver payload real
    const pixCode        = body.transaction?.pix_code || body.transaction?.pix_qr_code || body.transaction?.qr_code || null;
    const pixUrl          = body.transaction?.pix_url || body.transaction?.qr_code_url || null;
    if (paymentMethod) {
      console.log(`[Ticto] waiting_payment método=${paymentMethod} bank_slip_url=${bankSlipUrl || 'n/a'} pix_code=${pixCode ? 'presente' : 'n/a'}`);
    }
    await scheduleCheckoutRecovery({
      phone: wpPhone,
      email: body.customer?.email || null,
      name:  body.customer?.name  || null,
      lid:   wpSrc,
      stage: 'waiting_payment',
      paymentMethod,
      bankSlipUrl,
      bankSlipCode,
      pixCode,
      pixUrl,
    });
    return;
  }

  // Filtro de status relevantes
  const RELEVANT = ['authorized', 'refunded', 'chargeback'];
  if (!RELEVANT.includes(status)) {
    console.log(`[Ticto] Status "${status}" não relevante — ignorado.`);
    return;
  }

  // Idempotência: rejeita duplicatas do mesmo hash + status
  const existing = await redisPurchaseGet(transactionId);
  if (existing && existing.status === status) {
    console.log(`[Ticto] Duplicata detectada: ${transactionId} / ${status} — no-op.`);
    return;
  }

  // Extração dos campos para CAPI
  const customerEmail = body.customer?.email || null;
  const customerCpf   = body.customer?.cpf   || null;

  // Phone: Ticto retorna objeto aninhado {ddi, ddd, number} em customer.phone
  // e também como string flat em body.telefone — usar flat como primário
  const phoneObj      = body.customer?.phone;
  const customerPhone = body.telefone
    || body.phone_number_customer
    || (phoneObj && typeof phoneObj === 'object'
        ? `${(phoneObj.ddi || '+55').replace('+', '')}${phoneObj.ddd || ''}${phoneObj.number || ''}`
        : phoneObj)
    || null;

  const paidAmount = body.order?.paid_amount; // centavos
  const value      = typeof paidAmount === 'number' ? paidAmount / 100 : null;

  const fbclid = body.query_params?.fbclid || null;
  const fbp    = body.query_params?.fbp    || null;
  const fbc    = body.query_params?.fbc    || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null);

  // tracking.src: join key = _leadEventId do quiz. "Não Informado" = compra fora do funil.
  const rawSrc    = body.tracking?.src;
  const srcLeadId = (rawSrc && rawSrc !== 'Não Informado') ? rawSrc : null;

  const productName = body.item?.product_name || null;
  const offerId     = body.item?.offer_id     || null;

  // Persiste o evento (inclui raw payload para debug e auditing)
  const record = {
    transaction_id: transactionId,
    status,
    value,
    email: customerEmail,
    phone: customerPhone,
    src_lead_id: srcLeadId,
    fbc,
    fbp,
    fbclid,
    product_name: productName,
    offer_id: offerId,
    capi_sent_at: null,
    raw_payload: body,
    created_at: new Date().toISOString(),
  };
  await redisPurchaseSet(transactionId, record);

  // Atualiza estatísticas
  await redisIncrStats('total');
  await redisSetLastEvent(new Date().toISOString());
  if (status === 'authorized') await redisIncrStats('authorized');
  if (fbc) await redisIncrStats('fbc_present');

  console.log(`[Ticto] Evento registrado: ${transactionId} / ${status} / R$ ${value}`);
  console.log(`[Ticto] src_lead_id: ${srcLeadId} | fbc: ${fbc} | email: ${customerEmail}`);

  if (status === 'authorized') {
    // Compra confirmada → cancela recuperação pendente do telefone
    await cancelCheckoutRecovery(customerPhone, 'authorized');

    // Série diária p/ dashboard (fire-and-forget) — pós-checagem de
    // idempotência acima, então retries da Ticto não contam duas vezes
    metricsIncr('purchases').catch(() => {});
    if (typeof paidAmount === 'number') metricsIncr('revenue_cents', paidAmount).catch(() => {});

    // Atribuição de recuperação: se este telefone recebeu mensagem de
    // recuperação nas últimas 24h (TTL do marcador recovery:sent), conta a
    // compra como recuperada — métrica que justifica o sistema. Janela de
    // 24h = mesma da dedupe; valor somado em centavos p/ receita recuperada.
    const buyerPhoneNorm = normalizePhone(customerPhone);
    if (buyerPhoneNorm) {
      const sentStage = await redisGet(`recovery:sent:${buyerPhoneNorm}`);
      if (sentStage) {
        await redisIncrStats('recovery_converted');
        await redisIncrStats(`recovery_converted_${sentStage}`);
        metricsIncr('recovery_converted').catch(() => {});
        if (typeof paidAmount === 'number') {
          try { await getRedis().incrby('ticto:stats:recovery_converted_cents', paidAmount); } catch {}
          metricsIncr('recovery_revenue_cents', paidAmount).catch(() => {});
        }
        console.log(`[Recovery] CONVERTIDA (${sentStage}): ${buyerPhoneNorm} — R$ ${value}`);
      }
    }

    // Fase 2 — lookup do lead no Redis para enriquecimento do Purchase
    // Ordem: src_lead_id (join key exato) → email → sem match
    let leadData = null;
    if (srcLeadId) {
      try {
        const raw = await getRedis().get(`lead:${srcLeadId}`);
        if (raw) { leadData = JSON.parse(raw); console.log(`[Ticto] Lead enriquecido via src: ${srcLeadId}`); }
      } catch {}
    }
    if (!leadData && customerEmail) {
      // Fallback: scan por email (O(n) — só executa se src falhar)
      try {
        const keys = await getRedis().keys('lead:*');
        for (const k of keys) {
          const raw = await getRedis().get(k);
          if (!raw) continue;
          const l = JSON.parse(raw);
          if (l.email === customerEmail) { leadData = l; console.log(`[Ticto] Lead enriquecido via email: ${customerEmail}`); break; }
        }
      } catch {}
    }

    // fbc/fbp: preferir dado do lead (capturado no quiz, mais confiável) sobre o do checkout
    const enrichedFbc        = leadData?.fbc || fbc || null;
    const enrichedFbp        = leadData?.fbp || fbp || body.query_params?.fbp || null;
    const enrichedExternalId = leadData?.external_id || sha256(customerEmail);
    const enrichedPerfil     = leadData?.perfil || null;
    const enrichedTier       = leadData?.tier   || null;

    // Monta payload CAPI Purchase
    const capiPreview = {
      event_name:       'Purchase',
      event_time:       Math.floor(Date.now() / 1000),
      action_source:    'website',
      event_id:         transactionId,
      event_source_url: 'https://www.evelynliu.com.br/raiz',
      user_data: {
        em:          sha256(customerEmail),
        ph:          sha256(normalizePhone(customerPhone || '')),
        external_id: enrichedExternalId,
        fbc:         enrichedFbc  || undefined,
        fbp:         enrichedFbp  || undefined,
        client_ip_address: getClientIp(req),
        client_user_agent: req.headers['user-agent'] || null,
      },
      custom_data: {
        value,
        // perfil e tier: dados psicológicos sensíveis — ficam no Redis/Make, não vão à Meta
        currency:     'BRL',
        content_name: productName,
        content_ids:  offerId ? [offerId] : undefined,
      },
    };
    // Remove nulls/undefined do user_data
    Object.keys(capiPreview.user_data).forEach(k => {
      if (!capiPreview.user_data[k]) delete capiPreview.user_data[k];
    });

    const PURCHASE_ENABLED = process.env.PURCHASE_CAPI_ENABLED === 'true';

    if (PURCHASE_ENABLED) {
      // Fase 4 — envio real à Meta (só ativar com autorização explícita)
      const PIXEL_ID   = process.env.META_PIXEL_ID;
      const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
      if (PIXEL_ID && CAPI_TOKEN) {
        const metaPayload = { data: [capiPreview] };
        const TEST_CODE = process.env.META_TEST_EVENT_CODE;
        if (TEST_CODE) metaPayload.test_event_code = TEST_CODE;
        fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metaPayload),
        })
        .then(r => r.json())
        .then(j => console.log('[Ticto] Purchase CAPI enviado. fbtrace_id:', j.fbtrace_id))
        .catch(e => console.error('[Ticto] Purchase CAPI erro:', e.message));
      }
      // Atualiza registro com capi_sent_at
      await redisPurchaseSet(transactionId, { ...record, capi_sent_at: new Date().toISOString(), capi_preview: capiPreview });
    } else {
      // MODO SOMBRA: loga preview, não envia à Meta
      console.log('[Ticto] SOMBRA — Purchase CAPI preview:', JSON.stringify(capiPreview, null, 2));
      // Atualiza registro com preview para inspeção via /health
      const updated = { ...record, capi_preview: capiPreview };
      await redisPurchaseSet(transactionId, updated);
    }
  }

  if (status === 'refunded' || status === 'chargeback') {
    // TODO: reverter/marcar na tabela de leads; não enviar nada à Meta por ora
    metricsIncr('refunds').catch(() => {});
    console.log(`[Ticto] ${status.toUpperCase()} registrado para ${transactionId} — nenhuma ação na Meta.`);
  }

  } catch (e) {
    console.error('[Ticto] Erro não tratado no processamento do webhook:', e.message, e.stack);
    await redisIncrStats('webhook_unhandled_errors');
  }
});

// ─── Ticto Health ─────────────────────────────────────────────────────────────
// Autenticado por HEALTH_TOKEN (env var simples)

app.get('/api/webhooks/ticto/health', async (req, res) => {
  const token = process.env.HEALTH_TOKEN;
  if (token && req.headers['x-health-token'] !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stats = await redisGetStats();
  const fbcRate = stats.authorized > 0
    ? Math.round((stats.fbc_present / stats.authorized) * 100) + '%'
    : 'n/a';

  // Estatísticas de recuperação de checkout
  let recovery = {};
  try {
    const redis = getRedis();
    const [pending, sentIc, sentAb, sentWp, errors, optouts, converted, convertedCents] = await Promise.all([
      redis.keys('recovery:pending:*').then(k => k.length),
      redis.get('ticto:stats:recovery_sent_ic'),
      redis.get('ticto:stats:recovery_sent_abandoned_cart'),
      redis.get('ticto:stats:recovery_sent_waiting_payment'),
      redis.get('ticto:stats:recovery_errors'),
      redis.keys('recovery:optout:*').then(k => k.length),
      redis.get('ticto:stats:recovery_converted'),
      redis.get('ticto:stats:recovery_converted_cents'),
    ]);
    const totalSent = (Number(sentIc) || 0) + (Number(sentAb) || 0) + (Number(sentWp) || 0);
    recovery = {
      enabled: process.env.RECOVERY_ENABLED === 'true',
      pending,
      sent_ic:              Number(sentIc) || 0,
      sent_abandoned_cart:  Number(sentAb) || 0,
      sent_waiting_payment: Number(sentWp) || 0,
      converted:            Number(converted) || 0,
      conversion_rate:      totalSent > 0 ? Math.round(((Number(converted) || 0) / totalSent) * 1000) / 10 + '%' : 'n/a',
      recovered_revenue:    'R$ ' + (((Number(convertedCents) || 0) / 100).toFixed(2)),
      errors:               Number(errors) || 0,
      optouts,
    };
  } catch {}

  return res.json({
    status: 'ok',
    purchase_capi_enabled: process.env.PURCHASE_CAPI_ENABLED === 'true',
    total_events_received: stats.total,
    authorized_count:      stats.authorized,
    last_event_at:         stats.lastAt || null,
    fbc_match_rate:        fbcRate,
    recovery,
  });
});

// ─── Dashboard /dash — funil, faturamento e recuperação ──────────────────────
//
// Série temporal vem dos contadores metrics:{date}:{nome} (a partir de jul/2026)
// + backfill de vendas/faturamento dos registros ticto:purchase:* (TTL 90d).
// Protegido por requireDashToken (aplicado no app.use lá em cima).

const DASH_METRICS = [
  'evt_PageView', 'evt_ViewContent', 'evt_Lead', 'evt_CompleteRegistration', 'evt_InitiateCheckout',
  'abandoned_cart', 'waiting_payment',
  'purchases', 'revenue_cents', 'refunds',
  'recovery_sent', 'recovery_converted', 'recovery_revenue_cents',
];

app.get('/api/dash/data', async (req, res) => {
  try {
    const daysN = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const redis = getRedis();

    // Datas (fuso SP), da mais antiga até hoje
    const dates = [];
    for (let i = daysN - 1; i >= 0; i--) dates.push(spDate(Date.now() - i * 86400000));

    // Contadores diários em um único MGET
    const keys = [];
    for (const d of dates) for (const m of DASH_METRICS) keys.push(`metrics:${d}:${m}`);
    const values = await redis.mget(keys);
    const days = dates.map((date, di) => {
      const row = { date };
      DASH_METRICS.forEach((m, mi) => { row[m] = Number(values[di * DASH_METRICS.length + mi]) || 0; });
      return row;
    });
    const byDate = Object.fromEntries(days.map(r => [r.date, r]));

    // Backfill de vendas a partir dos registros individuais (cobre o período
    // anterior ao início dos contadores). Usa o MAIOR entre as duas fontes por
    // dia para não dobrar contagem no período de transição.
    const backfill = {};
    const purchaseKeys = await redis.keys('ticto:purchase:*');
    for (const k of purchaseKeys) {
      try {
        const raw = await redis.get(k);
        if (!raw) continue;
        const rec = JSON.parse(raw);
        if (!rec?.created_at) continue;
        const d = spDate(new Date(rec.created_at).getTime());
        if (!byDate[d]) continue;
        backfill[d] = backfill[d] || { purchases: 0, revenue_cents: 0, refunds: 0 };
        backfill[d].purchases += 1;
        backfill[d].revenue_cents += Math.round((rec.value || 0) * 100);
        if (rec.status === 'refunded' || rec.status === 'chargeback') backfill[d].refunds += 1;
      } catch {}
    }
    for (const [d, b] of Object.entries(backfill)) {
      const row = byDate[d];
      if (b.purchases > row.purchases) {
        row.purchases = b.purchases;
        row.revenue_cents = b.revenue_cents;
      }
      if (b.refunds > row.refunds) row.refunds = b.refunds;
    }

    // Totais por janela (dias corridos até hoje, dentro da janela pedida)
    function windowTotals(n) {
      const slice = days.slice(-n);
      const sum = (f) => slice.reduce((a, r) => a + r[f], 0);
      const ic = sum('evt_InitiateCheckout'), purch = sum('purchases');
      return {
        page_views:         sum('evt_PageView'),
        view_content:       sum('evt_ViewContent'),
        leads:              sum('evt_Lead'),
        registrations:      sum('evt_CompleteRegistration'),
        initiate_checkout:  ic,
        abandoned_cart:     sum('abandoned_cart'),
        purchases:          purch,
        revenue:            sum('revenue_cents') / 100,
        refunds:            sum('refunds'),
        ic_to_purchase:     ic > 0 ? Math.round((purch / ic) * 1000) / 10 : null,
        recovery_sent:      sum('recovery_sent'),
        recovery_converted: sum('recovery_converted'),
        recovery_revenue:   sum('recovery_revenue_cents') / 100,
      };
    }

    // Recuperação — acumulado desde o início (contadores globais)
    const [rcSentIc, rcSentAb, rcSentWp, rcConv, rcCents, rcErr] = await Promise.all([
      redis.get('ticto:stats:recovery_sent_ic'),
      redis.get('ticto:stats:recovery_sent_abandoned_cart'),
      redis.get('ticto:stats:recovery_sent_waiting_payment'),
      redis.get('ticto:stats:recovery_converted'),
      redis.get('ticto:stats:recovery_converted_cents'),
      redis.get('ticto:stats:recovery_errors'),
    ]);
    const rcSent = (Number(rcSentIc) || 0) + (Number(rcSentAb) || 0) + (Number(rcSentWp) || 0);

    return res.json({
      generated_at: new Date().toISOString(),
      timezone: 'America/Sao_Paulo',
      days,
      totals: { today: windowTotals(1), d7: windowTotals(7), d30: windowTotals(Math.min(30, daysN)) },
      recovery_lifetime: {
        enabled:   process.env.RECOVERY_ENABLED === 'true',
        sent:      rcSent,
        converted: Number(rcConv) || 0,
        rate:      rcSent > 0 ? Math.round(((Number(rcConv) || 0) / rcSent) * 1000) / 10 : null,
        revenue:   (Number(rcCents) || 0) / 100,
        errors:    Number(rcErr) || 0,
      },
    });
  } catch (e) {
    console.error('[Dash] Erro:', e.message);
    return res.status(500).json({ error: 'Erro ao montar dados do dashboard.' });
  }
});

app.get('/dash', (req, res) => res.sendFile(path.join(__dirname, 'dash.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  // Reprocessa formulários pré-sessão pendentes a cada 10 min.
  setInterval(() => { drainFailedPreSessao().catch(() => {}); }, 10 * 60 * 1000);
  setTimeout(() => { drainFailedPreSessao().catch(() => {}); }, 30 * 1000);
  // Recuperação de checkout: verifica pendências vencidas a cada 5 min.
  setInterval(() => { recoverySweep().catch(() => {}); }, 5 * 60 * 1000);
  setTimeout(() => { recoverySweep().catch(() => {}); }, 60 * 1000);
});
