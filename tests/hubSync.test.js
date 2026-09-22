const test = require('node:test');
const assert = require('node:assert/strict');
const hub = require('../src/hubSync');

function fakeRedis() {
  const lists = {}; const kv = {};
  return {
    lists, kv,
    rpush: async (k, v) => { (lists[k] ||= []).push(v); },
    lpop: async (k) => (lists[k] || []).shift() || null,
    expire: async () => 1,
    set: async (k, v, nx) => { if (nx === 'NX' && k in kv) return null; kv[k] = v; return 'OK'; },
    del: async (k) => { delete kv[k]; },
    get: async (k) => kv[k] ?? null,
    scan: async (_c, _m, pattern) => ['0', Object.keys(kv).filter(k => k.startsWith(pattern.replace('*', '')))],
  };
}
const tick = () => new Promise(r => setImmediate(r));

test('compra vai ao Hub com o formato esperado', async () => {
  process.env.HUB_WEBHOOK_SECRET = 's';
  const chamadas = [];
  global.fetch = async (url, o) => { chamadas.push({ url, body: JSON.parse(o.body), h: o.headers }); return { ok: true, json: async () => ({}) }; };
  hub.notificarCompra(() => fakeRedis(), 'ticto', { transaction_id: 'h1', status: 'authorized', phone: '5511918253788', src_lead_id: 'lead_x', offer_id: 156277, product_name: 'Protocolo Raiz', value: 97 }, { name: 'Ana' });
  await tick(); await tick();
  assert.equal(chamadas.length, 1);
  assert.match(chamadas[0].url, /\/webhook\/pr-purchase$/);
  assert.equal(chamadas[0].h['x-webhook-secret'], 's');
  assert.equal(chamadas[0].body.sck, 'lead_x');
  assert.equal(chamadas[0].body.offer_id, 156277);
});

test('falha no Hub não lança e vai para o retry; drenar reenvia', async () => {
  process.env.HUB_WEBHOOK_SECRET = 's';
  const r = fakeRedis();
  global.fetch = async () => ({ ok: false, status: 502 });
  assert.doesNotThrow(() => hub.enviarLeadV2(() => r, { nome: 'Ana', whats: '11918253788', quiz_lead_event_id: 'lead_1' }));
  await new Promise(res => setTimeout(res, 10));
  assert.equal(r.lists['hub:sync:retry'].length, 1);
  let enviados = 0;
  global.fetch = async () => { enviados++; return { ok: true, json: async () => ({}) }; };
  await hub.drenarRetry(() => r);
  assert.equal(enviados, 1);
  assert.equal(r.lists['hub:sync:retry'].length, 0);
});

test('lead V2 sem telefone não é enviada', async () => {
  let n = 0; global.fetch = async () => { n++; return { ok: true, json: async () => ({}) }; };
  hub.enviarLeadV2(() => fakeRedis(), { nome: 'Ana' });
  await tick();
  assert.equal(n, 0);
});

test('backfill roda uma vez e solta a trava se o Hub falhar', async () => {
  process.env.HUB_WEBHOOK_SECRET = 's';
  const r = fakeRedis();
  r.kv['ticto:purchase:h1'] = JSON.stringify({ transaction_id: 'h1', status: 'authorized', phone: '5511918253788', created_at: '2026-09-01T10:00:00Z' });
  r.kv['cakto:purchase:c1'] = JSON.stringify({ transaction_id: 'c1', status: 'paid', email: 'a@b.com' });
  global.fetch = async () => ({ ok: false, status: 500 });
  await hub.backfillCompras(() => r);
  assert.equal(r.kv['hub:sync:backfill:v1'], undefined, 'trava liberada após falha');
  const lotes = [];
  global.fetch = async (_u, o) => { lotes.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ gravadas: 2 }) }; };
  await hub.backfillCompras(() => r);
  assert.equal(lotes[0].purchases.length, 2);
  assert.equal(lotes[0].purchases.find(p => p.provider === 'cakto').status, 'purchase_approved');
  await hub.backfillCompras(() => r);
  assert.equal(lotes.length, 1, 'não roda de novo');
});
