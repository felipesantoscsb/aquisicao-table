// Envio ao Hub (crm.tableclinic.com.br) de dois dados que ele precisa guardar
// de forma permanente — aqui eles vivem no Redis com TTL:
//   1. compras e reembolsos (Ticto e Cakto) → /webhook/pr-purchase
//   2. contato de quem fez o quiz V2        → /webhook/quiz-v2-lead
//
// Regra do módulo: NUNCA interferir no fluxo que chamou. Tudo é fire-and-forget,
// sem throw para fora, e o que falhar vai para uma fila de retry no Redis.
// Mesmo segredo e mesmo domínio do webhook de pré-sessão.

const RETRY_KEY = 'hub:sync:retry';

function base() {
  return (process.env.HUB_BASE_URL || 'https://crm.tableclinic.com.br').replace(/\/$/, '');
}
function secret() {
  return process.env.HUB_WEBHOOK_SECRET || process.env.INTERNAL_WEBHOOK_SECRET || null;
}

async function post(path, body) {
  const s = secret();
  if (!s) throw new Error('HUB_WEBHOOK_SECRET não configurado');
  const r = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': s },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Hub ${path} HTTP ${r.status}`);
  return r.json().catch(() => ({}));
}

function enviar(getRedis, path, body, rotulo) {
  post(path, body).catch(async (e) => {
    console.error(`[hubSync] ${rotulo}:`, e.message, '— vai para o retry');
    try {
      const redis = getRedis();
      await redis.rpush(RETRY_KEY, JSON.stringify({ path, body, at: Date.now() }));
      await redis.expire(RETRY_KEY, 7 * 24 * 3600);
    } catch {}
  });
}

/** Reenvia o que falhou. Chamado periodicamente. */
async function drenarRetry(getRedis) {
  let redis; try { redis = getRedis(); } catch { return; }
  for (let i = 0; i < 200; i++) {
    const raw = await redis.lpop(RETRY_KEY).catch(() => null);
    if (!raw) return;
    let item; try { item = JSON.parse(raw); } catch { continue; }
    try { await post(item.path, item.body); }
    catch (e) {
      await redis.rpush(RETRY_KEY, raw).catch(() => {});
      console.error('[hubSync] retry ainda falhando:', e.message);
      return; // Hub fora: tenta de novo no próximo ciclo
    }
  }
}

/** Registro de compra (formato dos registros ticto:purchase / cakto:purchase). */
function purchasePayload(provider, rec, extra = {}) {
  return {
    provider,
    transaction_id: rec.transaction_id,
    status: rec.status,
    phone: rec.phone || null,
    email: rec.email || null,
    name: extra.name || null,
    sck: rec.src_lead_id || null,
    offer_id: rec.offer_id ?? null,
    offer_name: rec.offer_name || null,
    product_name: rec.product_name || null,
    value: rec.value ?? null,
    purchased_at: rec.created_at || null,
    evelyn_product: extra.evelyn_product === true,
    source: extra.source || 'webhook',
  };
}

function notificarCompra(getRedis, provider, rec, extra) {
  try {
    const p = purchasePayload(provider, rec, extra);
    if (!p.transaction_id || !p.status) return;
    enviar(getRedis, '/webhook/pr-purchase', p, `compra ${provider} ${p.transaction_id}`);
  } catch (e) { console.error('[hubSync] compra:', e.message); }
}

function enviarLeadV2(getRedis, body) {
  try {
    if (!body || !body.whats || !body.nome) return;
    enviar(getRedis, '/webhook/quiz-v2-lead', {
      nome: body.nome, email: body.email || null, whats: body.whats,
      sck: body.quiz_lead_event_id || null,
    }, 'lead V2');
  } catch (e) { console.error('[hubSync] lead V2:', e.message); }
}

async function scanChaves(redis, pattern) {
  const out = [];
  let cursor = '0';
  do {
    const [c, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
    cursor = c; out.push(...keys);
  } while (cursor !== '0');
  return out;
}

/**
 * Carga única do que ainda está no Redis (90 dias). Roda uma vez por versão,
 * travada por SET NX; se o Hub falhar, solta a trava para tentar no próximo boot.
 */
async function backfillCompras(getRedis, { isEvelyn } = {}) {
  const FLAG = 'hub:sync:backfill:v1';
  let redis; try { redis = getRedis(); } catch { return; }
  const ok = await redis.set(FLAG, new Date().toISOString(), 'NX').catch(() => null);
  if (ok !== 'OK') return;
  try {
    const lote = [];
    for (const [provider, pattern] of [['ticto', 'ticto:purchase:*'], ['cakto', 'cakto:purchase:*']]) {
      for (const k of await scanChaves(redis, pattern)) {
        const raw = await redis.get(k).catch(() => null);
        if (!raw) continue;
        let rec; try { rec = JSON.parse(raw); } catch { continue; }
        const nome = rec.raw_payload?.customer?.name || null;
        lote.push(purchasePayload(provider, { ...rec, status: provider === 'cakto' ? 'purchase_approved' : rec.status }, {
          name: nome, source: 'backfill',
          evelyn_product: isEvelyn ? isEvelyn(rec.offer_id, rec.product_name) : false,
        }));
      }
    }
    let gravadas = 0;
    for (let i = 0; i < lote.length; i += 200) {
      const r = await post('/webhook/pr-purchase', { purchases: lote.slice(i, i + 200) });
      gravadas += r.gravadas || 0;
    }
    console.log(`[hubSync] backfill de compras: ${lote.length} lidas, ${gravadas} gravadas no Hub`);
  } catch (e) {
    console.error('[hubSync] backfill falhou, tenta no próximo boot:', e.message);
    await redis.del(FLAG).catch(() => {});
  }
}

/** Opt-out (SAIR) registrado aqui também vale para os disparos do Hub. */
function enviarOptOut(getRedis, phone) {
  try {
    if (!phone) return;
    enviar(getRedis, '/webhook/optout', { phones: [phone] }, 'opt-out');
  } catch (e) { console.error('[hubSync] opt-out:', e.message); }
}

/** Carga única da lista de SAIR que já existe no Redis. */
async function backfillOptOuts(getRedis) {
  const FLAG = 'hub:sync:backfill-optout:v1';
  let redis; try { redis = getRedis(); } catch { return; }
  const ok = await redis.set(FLAG, new Date().toISOString(), 'NX').catch(() => null);
  if (ok !== 'OK') return;
  try {
    const phones = (await scanChaves(redis, 'recovery:optout:*')).map(k => k.split(':').pop()).filter(Boolean);
    for (let i = 0; i < phones.length; i += 500) await post('/webhook/optout', { phones: phones.slice(i, i + 500) });
    console.log(`[hubSync] backfill de opt-outs: ${phones.length} enviados ao Hub`);
  } catch (e) {
    console.error('[hubSync] backfill de opt-outs falhou, tenta no próximo boot:', e.message);
    await redis.del(FLAG).catch(() => {});
  }
}

module.exports = { notificarCompra, enviarLeadV2, enviarOptOut, drenarRetry, backfillCompras, backfillOptOuts, purchasePayload };
