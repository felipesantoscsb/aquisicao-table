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
