require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────

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
app.get('/obrigado',   (req, res) => res.sendFile(path.join(funil, 'obrigado-protocolo-raiz.html')));
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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
