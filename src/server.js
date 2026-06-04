require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────

// Redirect non-www → www (301)
app.use((req, res, next) => {
  if (req.headers.host === 'evelynliu.com.br') {
    return res.redirect(301, `https://www.evelynliu.com.br${req.originalUrl}`);
  }
  next();
});

// Lê o body das requisições JSON
app.use(express.json());

// CORS — permite que o quiz em evelynliu.com.br chame este endpoint
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve os arquivos estáticos da pasta public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Rotas do funil ───────────────────────────────────────────────────────────

const funil = path.join(__dirname, '..', 'public', 'Funil');
const pub   = path.join(__dirname, '..', 'public');

app.get('/raiz',       (req, res) => res.sendFile(path.join(pub,   'quiz.html')));
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
    lead_event_id,
    event_source_url,
  } = req.body;

  // Credenciais via variáveis de ambiente
  const PIXEL_ID    = process.env.META_PIXEL_ID;
  const CAPI_TOKEN  = process.env.META_CAPI_TOKEN;

  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.error('[CAPI] META_PIXEL_ID ou META_CAPI_TOKEN não configurados.');
    return res.status(500).json({ ok: false, error: 'Credenciais da Meta não configuradas no servidor.' });
  }

  // ── Monta user_data ─────────────────────────────────────────────────────────

  const phoneNormalized = normalizePhone(whats);     // com DDI 55
  const emailHashed     = sha256(email);             // para external_id também

  const user_data = {
    // Campos hasheados (SHA-256, lowercase + trim)
    em: emailHashed,
    ph: sha256(phoneNormalized),
    fn: sha256(firstName(nome)),
    external_id: emailHashed,                        // reutiliza hash do email

    // Campos em texto puro (não hashear — Meta exige assim)
    client_ip_address: getClientIp(req),
    client_user_agent: req.headers['user-agent'] || null,
  };

  // fbc e fbp só incluídos se existirem (texto puro, nunca hashear)
  if (fbc) user_data.fbc = fbc;
  if (fbp) user_data.fbp = fbp;

  // Remove chaves com valor null para não poluir o payload
  Object.keys(user_data).forEach(k => {
    if (user_data[k] === null || user_data[k] === undefined) {
      delete user_data[k];
    }
  });

  // ── Monta o evento ───────────────────────────────────────────────────────────

  const event = {
    event_name:        'Lead',
    event_time:        Math.floor(Date.now() / 1000),   // timestamp unix em segundos
    action_source:     'website',
    event_source_url:  event_source_url || 'https://evelynliu.com.br/quiz',
    event_id:          lead_event_id || null,            // deduplicação com pixel browser
    user_data,
  };

  // Remove event_id se não veio (evita enviar null)
  if (!event.event_id) delete event.event_id;

  // ── Chama a API da Meta ──────────────────────────────────────────────────────

  const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;

  const metaPayload = {
    data: [event],
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

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
