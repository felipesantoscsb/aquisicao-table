/**
 * Jobs automáticos — node-cron
 * Todos os horários em UTC (Railway roda em UTC).
 * BRT = UTC-3, então:
 *   8h BRT  = 11h UTC
 *   9h BRT  = 12h UTC
 *   14h BRT = 17h UTC
 *   18h BRT = 21h UTC
 */
const cron = require('node-cron');
const { pool } = require('./db');
const { sendWhatsapp, fmtDateTimeBR, fmtDateBR } = require('./zapi');

// ── Meta Ads: fetch + parse ───────────────────────────────────

const INSIGHTS_FIELDS = [
  'spend', 'impressions', 'actions', 'action_values', 'purchase_roas',
].join(',');

async function metaFetch(path, params) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return null;
  const qs  = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/v21.0/${path}?${qs}`;
  try {
    const res  = await fetch(url);
    const json = await res.json();
    if (!res.ok) { console.error('[cron/meta]', json.error?.message); return null; }
    return json;
  } catch (e) { console.error('[cron/meta] fetch:', e.message); return null; }
}

function parseMetrics(d) {
  if (!d) return null;
  const spend        = parseFloat(d.spend || 0);
  const actions      = d.actions       || [];
  const actionValues = d.action_values || [];
  const roasArr      = d.purchase_roas || [];
  const purchases    = parseFloat(actions.find(a => a.action_type === 'purchase')?.value        || 0);
  const ic           = parseFloat(actions.find(a => a.action_type === 'initiate_checkout')?.value || 0);
  const pv           = parseFloat(actionValues.find(a => a.action_type === 'purchase')?.value   || 0);
  const roas         = parseFloat(roasArr.find(a => a.action_type === 'omni_purchase')?.value   || 0);
  return {
    spend,
    purchases:   purchases || null,
    cpa:         purchases > 0 ? spend / purchases : null,
    roas:        roas      || null,
    roi:         spend > 0 && pv > 0 ? (pv - spend) / spend * 100 : null,
    ic:          ic        || null,
    costPerIC:   ic > 0   ? spend / ic : null,
  };
}

function num(n, type = 'brl') {
  if (n == null) return '—';
  if (type === 'brl')  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  if (type === 'pct')  return n.toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 }) + '%';
  if (type === 'roas') return n.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + '×';
  return n.toLocaleString('pt-BR');
}

function delta(curr, prev) {
  if (!curr || !prev || prev === 0) return '';
  const d = ((curr - prev) / prev) * 100;
  return ` ${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%`;
}

function buildMetaReport(today, yesterday, hour) {
  const greet = hour < 12 ? '☀️ Bom dia' : hour < 17 ? '🌤 Boa tarde' : '🌙 Boa noite';
  const now   = new Date().toLocaleString('pt-BR', {
    timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit',
  });
  if (!today) return `${greet}! ⚠️ Não foi possível buscar dados do Meta Ads agora.`;
  const t = today, y = yesterday || {};
  return `${greet}! Relatório Meta Ads — ${now}

📊 *HOJE vs ONTEM*

💸 *Gasto:* ${num(t.spend)}${delta(t.spend, y.spend)}  (ontem: ${num(y.spend)})
🛒 *Compras:* ${num(t.purchases,'num')}${delta(t.purchases, y.purchases)}  (ontem: ${num(y.purchases,'num')})
💰 *CPA:* ${num(t.cpa)}  (ontem: ${num(y.cpa)})
📈 *ROAS:* ${num(t.roas,'roas')}  (ontem: ${num(y.roas,'roas')})
💹 *ROI Real:* ${num(t.roi,'pct')}  (ontem: ${num(y.roi,'pct')})
🔖 *Init. Checkout:* ${num(t.ic,'num')}${delta(t.ic, y.ic)}  (ontem: ${num(y.ic,'num')})
🏷 *Custo/IC:* ${num(t.costPerIC)}  (ontem: ${num(y.costPerIC)})

_Table Clinic · Meta Ads Bot_`;
}

// ── Job 1: Relatório Meta Ads — 9h, 14h, 18h BRT ─────────────
async function sendMetaReport() {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accountId || !process.env.META_ADS_ACCESS_TOKEN) {
    console.log('[cron/meta] credenciais não configuradas');
    return;
  }
  const hourBRT = parseInt(new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false,
  }), 10) || 9;

  console.log(`[cron/meta] disparando relatório — ${new Date().toISOString()}`);
  const [todayJson, yestJson] = await Promise.all([
    metaFetch(`act_${accountId}/insights`, { date_preset:'today',     level:'account', fields:INSIGHTS_FIELDS }),
    metaFetch(`act_${accountId}/insights`, { date_preset:'yesterday', level:'account', fields:INSIGHTS_FIELDS }),
  ]);
  const msg = buildMetaReport(parseMetrics(todayJson?.data?.[0]), parseMetrics(yestJson?.data?.[0]), hourBRT);
  await sendWhatsapp('5511918253788', msg);
}

cron.schedule('0 12,17,21 * * *', () => {
  sendMetaReport().catch(e => console.error('[cron/meta]', e.message));
}, { timezone: 'UTC' });

// ── Job 2: Cobranças vencendo amanhã — 8h BRT (11h UTC) ──────
async function checkDueCharges() {
  console.log(`[cron/charges] verificando vencimentos — ${new Date().toISOString()}`);
  try {
    const { rows } = await pool.query(`
      SELECT c.*, p.name AS patient_name
      FROM charges c
      JOIN patients p ON p.id = c.patient_id
      WHERE c.due_date = CURRENT_DATE + INTERVAL '1 day'
        AND c.status = 'pendente'
      ORDER BY p.name
    `);
    if (!rows.length) return;

    const list = rows.map(r =>
      `• ${r.patient_name} — R$ ${parseFloat(r.value||0).toFixed(2).replace('.',',')} (${r.package_type})`
    ).join('\n');

    await sendWhatsapp('5511918253788',
      `💰 Cobranças vencendo amanhã (${fmtDateBR(new Date(Date.now() + 86400000))}):\n\n${list}`
    );
  } catch (e) { console.error('[cron/charges]', e.message); }
}

cron.schedule('0 11 * * *', () => {
  checkDueCharges().catch(e => console.error('[cron/charges]', e.message));
}, { timezone: 'UTC' });

// ── Job 3: Aniversariantes do dia — 8h BRT (11h UTC) ─────────
async function checkBirthdays() {
  console.log(`[cron/birthday] verificando aniversários — ${new Date().toISOString()}`);
  try {
    const { rows } = await pool.query(`
      SELECT p.name, p.birthday, u.nutri_name
      FROM patients p
      LEFT JOIN users u ON u.id = p.nutritionist_id
      WHERE EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY   FROM p.birthday) = EXTRACT(DAY   FROM CURRENT_DATE)
        AND p.clinical_status != 'inativo'
      ORDER BY p.name
    `);
    if (!rows.length) return;

    const list = rows.map(r => `• ${r.name} (${r.nutri_name || '—'})`).join('\n');
    await sendWhatsapp('5511918253788',
      `🎂 Aniversariantes de hoje (${fmtDateBR(new Date())}):\n\n${list}`
    );
  } catch (e) { console.error('[cron/birthday]', e.message); }
}

cron.schedule('0 11 * * *', () => {
  checkBirthdays().catch(e => console.error('[cron/birthday]', e.message));
}, { timezone: 'UTC' });

// ── Job 4: Lembrete de consulta 1 dia antes — 8h BRT ─────────
async function sendAppointmentReminders() {
  console.log(`[cron/reminder] enviando lembretes — ${new Date().toISOString()}`);
  try {
    const { rows } = await pool.query(`
      SELECT ac.start_time,
             p.name AS patient_name, p.phone AS patient_phone,
             u.name AS nutri_name
      FROM appointments_clinical ac
      JOIN patients p ON p.id = ac.patient_id
      LEFT JOIN users u ON u.id = ac.nutritionist_id
      WHERE ac.start_time::date = CURRENT_DATE + INTERVAL '1 day'
        AND ac.status IN ('agendado','confirmado')
        AND p.phone IS NOT NULL
      ORDER BY ac.start_time
    `);
    for (const a of rows) {
      await sendWhatsapp(a.patient_phone,
        `Olá ${a.patient_name}! 🗓️ Lembrete: sua consulta está agendada para amanhã, ` +
        `${fmtDateTimeBR(a.start_time)}. Até lá! 💚`
      );
    }
    console.log(`[cron/reminder] ${rows.length} lembretes enviados`);
  } catch (e) { console.error('[cron/reminder]', e.message); }
}

cron.schedule('0 11 * * *', () => {
  sendAppointmentReminders().catch(e => console.error('[cron/reminder]', e.message));
}, { timezone: 'UTC' });

console.log('[cron] Jobs agendados: Meta 9h/14h/18h BRT | Cobranças+Aniversários+Lembretes 8h BRT');

module.exports = { sendMetaReport, checkDueCharges, checkBirthdays, sendAppointmentReminders };
