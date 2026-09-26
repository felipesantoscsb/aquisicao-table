const crypto = require('crypto');

// 'SubmitApplication' e o evento do /conversa desde 26/09/2026 (ver conversa-tracking.js:
// 'Lead' se misturava com o do quiz no mesmo pixel). 'Lead' fica aceito porque
// pagina em cache no browser continua mandando o nome antigo por um tempo.
const ALLOWED_EVENTS = new Set(['SubmitApplication', 'Schedule', 'Lead']);
const ATTRIBUTION_FIELDS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'fbp', 'fbc', 'captured_at',
]);

function cleanString(value, maxLength = 200) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || null;
}

function normalizeEmail(value) {
  return cleanString(value, 254)?.toLowerCase() || null;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function normalizeName(value) {
  return cleanString(value, 120)?.toLowerCase().replace(/\s+/g, ' ') || null;
}

function sha256(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeAndHashUserData({ email, phone, name, externalId } = {}) {
  const normalizedName = normalizeName(name);
  const parts = normalizedName ? normalizedName.split(' ') : [];
  const userData = {
    em: sha256(normalizeEmail(email)),
    ph: sha256(normalizePhone(phone)),
    fn: sha256(parts[0] || null),
    ln: sha256(parts.length > 1 ? parts[parts.length - 1] : null),
    external_id: sha256(cleanString(externalId, 254)?.toLowerCase() || null),
  };
  return Object.fromEntries(Object.entries(userData).filter(([, value]) => value));
}

function isValidEventId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

function isValidFbp(value) {
  return typeof value === 'string' && /^fb\.1\.\d{10,16}\.[A-Za-z0-9._-]{1,200}$/.test(value);
}

function isValidFbc(value) {
  return typeof value === 'string' && /^fb\.1\.\d{10,16}\.[A-Za-z0-9._-]{1,500}$/.test(value);
}

function sanitizeAttribution(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!ATTRIBUTION_FIELDS.has(key)) continue;
    if (key === 'captured_at') {
      const timestamp = Number(raw);
      if (Number.isFinite(timestamp) && timestamp > 0) result[key] = Math.floor(timestamp);
      continue;
    }
    const cleaned = cleanString(raw, key === 'fbc' ? 550 : 250);
    if (!cleaned) continue;
    if (key === 'fbp' && !isValidFbp(cleaned)) continue;
    if (key === 'fbc' && !isValidFbc(cleaned)) continue;
    result[key] = cleaned;
  }
  return result;
}

function validateLeadTracking(body = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
  const errors = [];
  const eventName = body.event_name || 'Lead';
  if (!ALLOWED_EVENTS.has(eventName)) errors.push('event_not_allowed');
  if (!isValidEventId(body.event_id)) errors.push('invalid_event_id');

  const eventTime = Number(body.event_time);
  if (!Number.isInteger(eventTime) || eventTime < nowSeconds - 7 * 86400 || eventTime > nowSeconds + 300) {
    errors.push('invalid_event_time');
  }

  const attribution = sanitizeAttribution(body.attribution);
  return { ok: errors.length === 0, errors, eventName, eventTime, attribution };
}

function sanitizeLogRecord(record = {}) {
  const allowed = new Set([
    'event_name', 'event_id', 'time', 'environment', 'success', 'meta_status',
    'fbtrace_id', 'match_fields', 'validation_reason', 'attempt', 'idempotency',
  ]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => allowed.has(key)));
}

function idempotencyDecision(currentState) {
  if (!currentState) return 'new';
  if (currentState === 'failed') return 'retry';
  if (currentState === 'capi_failed') return 'capi_retry';
  return currentState;
}

module.exports = {
  ALLOWED_EVENTS,
  cleanString,
  normalizeEmail,
  normalizePhone,
  normalizeName,
  sha256,
  normalizeAndHashUserData,
  isValidEventId,
  isValidFbp,
  isValidFbc,
  sanitizeAttribution,
  validateLeadTracking,
  sanitizeLogRecord,
  idempotencyDecision,
};
