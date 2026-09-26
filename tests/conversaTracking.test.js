const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const serverTracking = require('../src/conversaTracking');
const browserTracking = require('../public/js/conversa-tracking');

test('captura UTMs, fbclid, fbp e cria fbc somente quando existe fbclid', () => {
  const now = 1760000000000;
  const captured = browserTracking.captureValues(
    '?utm_source=instagram&utm_medium=bio&utm_campaign=lancamento&utm_content=story&utm_term=nutricao&fbclid=abc123',
    '_fbp=fb.1.1750000000000.123456',
    now
  );
  assert.equal(captured.utm_source, 'instagram');
  assert.equal(captured.utm_content, 'story');
  assert.equal(captured.utm_term, 'nutricao');
  assert.equal(captured.fbp, 'fb.1.1750000000000.123456');
  assert.equal(captured.fbc, `fb.1.${now}.abc123`);

  const absent = browserTracking.captureValues('', '', now);
  assert.deepEqual(absent, {});
  assert.equal(browserTracking.captureValues('?utm_source=bio', '', now).fbc, undefined);
});

test('preserva first-touch sem substituir valores válidos por origem posterior ou vazia', () => {
  const first = { utm_source: 'instagram', utm_campaign: 'primeira' };
  const merged = browserTracking.mergeFirst(first, { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: '' });
  assert.deepEqual(merged, { utm_source: 'instagram', utm_campaign: 'primeira', utm_medium: 'paid' });
});

test('normaliza e aplica SHA-256 somente aos campos de correspondência permitidos', () => {
  const result = serverTracking.normalizeAndHashUserData({
    email: ' EVELYN@EXAMPLE.COM ', phone: '(11) 99999-9999', name: ' Maria da Silva ', externalId: ' Lead-42 ',
  });
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  assert.equal(result.em, hash('evelyn@example.com'));
  assert.equal(result.ph, hash('5511999999999'));
  assert.equal(result.fn, hash('maria'));
  assert.equal(result.ln, hash('silva'));
  assert.equal(result.external_id, hash('lead-42'));
});

test('valida allowlist, event_id, timestamp e atributos opcionais', () => {
  const now = 1760000000;
  const valid = serverTracking.validateLeadTracking({
    event_name: 'Lead', event_id: '12345678-1234-4123-8123-123456789012', event_time: now,
    attribution: { fbp: 'fb.1.1750000000000.123', ignored: 'secret' },
  }, now);
  assert.equal(valid.ok, true);
  assert.equal(valid.attribution.ignored, undefined);

  const invalid = serverTracking.validateLeadTracking({ event_name: 'Purchase', event_id: 'x', event_time: now - 8 * 86400 }, now);
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.errors, ['event_not_allowed', 'invalid_event_id', 'invalid_event_time']);
});

test('logs sanitizados removem PII e payloads arbitrários', () => {
  const sanitized = serverTracking.sanitizeLogRecord({
    event_name: 'Lead', event_id: 'evt_123', success: true,
    email: 'pessoa@example.com', phone: '5511999999999', name: 'Pessoa', ip: '127.0.0.1', user_data: { ph: 'hash' },
  });
  assert.deepEqual(sanitized, { event_name: 'Lead', event_id: 'evt_123', success: true });
});

test('decisão de idempotência diferencia duplicata, retry e retry só da CAPI', () => {
  assert.equal(serverTracking.idempotencyDecision(undefined), 'new');
  assert.equal(serverTracking.idempotencyDecision('processing'), 'processing');
  assert.equal(serverTracking.idempotencyDecision('confirmed'), 'confirmed');
  assert.equal(serverTracking.idempotencyDecision('failed'), 'retry');
  assert.equal(serverTracking.idempotencyDecision('capi_failed'), 'capi_retry');
});

test('formulário propaga um event_id estável e só dispara Lead após sucesso confirmado', () => {
  const html = readFileSync(join(__dirname, '../public/Funil/formulario_captacao_table.html'), 'utf8');
  assert.match(html, /pendingEventId = pendingEventId \|\| ConversaTracking\.createEventId\(\)/);
  assert.match(html, /sessionStorage\.getItem/);
  assert.match(html, /saveSessionValue\('conversa_event_id', pendingEventId\)/);
  assert.match(html, /event_id: eventId/);
  assert.match(html, /if \(!response\.ok \|\| result\.ok !== true\) throw/);
  assert.match(html, /ConversaTracking\.trackLead\(eventId\)/);
  assert.match(html, /if \(isSubmitting\) return/);
  assert.match(html, /catch \(error\)[\s\S]*isSubmitting = false;[\s\S]*return;/);
});

test('conversa reutiliza diretamente o Pixel hardcoded do raiz sem endpoint de configuração', () => {
  const source = readFileSync(join(__dirname, '../public/js/conversa-tracking.js'), 'utf8');
  assert.match(source, /const PIXEL_ID = '989971718548782'/);
  assert.doesNotMatch(source, /api\/tracking\/meta-config/);
  assert.match(source, /installPixel\(PIXEL_ID\)/);
});

test('servidor usa o mesmo event_id na CAPI e exige confirmação real do SDR', () => {
  const source = readFileSync(join(__dirname, '../src/server.js'), 'utf8');
  assert.match(source, /sdrPayload\?\.activated !== true/);
  assert.match(source, /event_id: leadData\.event_id/);
  assert.match(source, /await forwardCaptacaoToSDR\(leadData\)/);
  assert.match(source, /sendConversationLeadCapi\(\{ leadData, req \}\)\.then/);
});

// ── WhatsApp: normalizar não é validar ───────────────────────────────────────
// O formulário prefixa 55 em qualquer coisa. Sem checar tamanho, "1191825378"
// virava "551191825378", passava por todo o sistema e só quebrava na Z-API, na
// hora do primeiro contato — onde o erro era engolido e o lead sumia.

const { readFileSync: lerArquivo } = require('node:fs');
const { join: juntar } = require('node:path');
const paginaConversa = lerArquivo(juntar(__dirname, '..', 'public/Funil/formulario_captacao_table.html'), 'utf8');
const servidor = lerArquivo(juntar(__dirname, '..', 'src/server.js'), 'utf8');

// Mesma regra dos dois lados (página e servidor).
const plausivel = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('55')) d = '55' + d;
  if (d.length !== 12 && d.length !== 13) return false;
  const ddd = Number(d.slice(2, 4));
  return ddd >= 11 && ddd <= 99;
};

test('a regra aceita celular e fixo válidos', () => {
  assert.equal(plausivel('11918253788'), true);      // celular com 9
  assert.equal(plausivel('(11) 91825-3788'), true);  // formatado
  assert.equal(plausivel('5511918253788'), true);    // já com 55
  assert.equal(plausivel('1132223333'), true);       // fixo, 8 dígitos
});

test('a regra recusa o que antes virava lead morto', () => {
  assert.equal(plausivel('919182537889'), false);    // sobrou 1 dígito
  assert.equal(plausivel('918253788'), false);       // sem DDD (9 dígitos)
  assert.equal(plausivel('91825378'), false);        // sem DDD e truncado
  assert.equal(plausivel('11'), false);
  assert.equal(plausivel(''), false);
  assert.equal(plausivel('abc'), false);
});

test('limite conhecido: 12 dígitos continuam passando, de propósito', () => {
  // "1191825378" pode ser fixo de 8 dígitos OU celular antigo sem o 9. Os dois
  // são legítimos, e o sdr-table já soma o 9 quando faltam. Rejeitar aqui
  // quebraria quem hoje é consertado automaticamente — então a regra pega o
  // erro de tamanho grosseiro e deixa este caso passar, conscientemente.
  assert.equal(plausivel('1191825378'), true);
  assert.equal(plausivel('1132223333'), true);
});

test('DDD impossível não passa', () => {
  assert.equal(plausivel('0918253788'), false);
  assert.equal(plausivel('5501918253788'), false);   // DDD 01
});

test('a validação existe na página e no servidor, não só numa ponta', () => {
  assert.match(paginaConversa, /function whatsappValido/);
  // Nos dois momentos: ao avançar da etapa 1 e no envio.
  assert.ok(paginaConversa.split('whatsappValido(').length - 1 >= 3, 'validação usada nos dois pontos');
  assert.match(servidor, /function whatsappPlausivel/);
  assert.match(servidor, /whatsapp_implausivel/);
});

// ── O /conversa não pode dividir evento com o quiz ───────────────────────────
// /raiz, /raiz-cakto, /raiz-vi e /raiz-google disparam 'Lead' no pixel
// 989971718548782. Enquanto o /conversa usava 'Lead' também, o Meta somava os
// quatro funis: a campanha de pré-consulta era creditada por cadastro do quiz
// e otimizava para o público errado.

const trackingJs = lerArquivo(juntar(__dirname, '..', 'public/js/conversa-tracking.js'), 'utf8');

test('o /conversa dispara SubmitApplication, não Lead', () => {
  // Schedule fica reservado para a pré-consulta agendada (funil de 2 passos).
  assert.match(trackingJs, /const CONVERSION_EVENT = 'SubmitApplication'/);
  assert.match(trackingJs, /root\.fbq\('track', CONVERSION_EVENT/);
  assert.doesNotMatch(trackingJs, /fbq\('track', 'Lead'/);
});

test('browser e CAPI usam o MESMO nome de evento, senão o dedup cai', () => {
  const eventoBrowser = trackingJs.match(/const CONVERSION_EVENT = '([A-Za-z]+)'/)[1];
  const eventoServidor = servidor.match(/const CONVERSA_CONVERSION_EVENT = '([A-Za-z]+)'/)[1];
  assert.equal(eventoBrowser, eventoServidor);
  assert.match(servidor, /event_name: CONVERSA_CONVERSION_EVENT/);
});

test('o evento escolhido não é nenhum dos que o /raiz já usa', () => {
  const doRaiz = ['Lead', 'CompleteRegistration', 'InitiateCheckout', 'PageView', 'ViewContent'];
  const escolhido = trackingJs.match(/const CONVERSION_EVENT = '([A-Za-z]+)'/)[1];
  assert.ok(!doRaiz.includes(escolhido), `${escolhido} colide com o funil do quiz`);
});

test('o validador aceita o nome novo e ainda o antigo (página em cache)', () => {
  const val = lerArquivo(juntar(__dirname, '..', 'src/conversaTracking.js'), 'utf8');
  assert.match(val, /ALLOWED_EVENTS = new Set\(\['SubmitApplication', 'Schedule', 'Lead'\]\)/);
});
