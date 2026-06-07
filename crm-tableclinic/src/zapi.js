/**
 * Módulo ZAPI compartilhado — envio de WhatsApp
 * Usado por: jornadas.js, pipeline.js, appointments_clinical.js, cron.js
 */

async function sendWhatsapp(phone, message) {
  const base       = process.env.ZAPI_BASE_URL    || 'https://api.z-api.io';
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token      = process.env.ZAPI_TOKEN;

  if (!instanceId || !token) {
    console.log(`[ZAPI] Não configurada — mensagem para ${phone} pulada`);
    return;
  }
  if (!phone) {
    console.log('[ZAPI] Número não informado — mensagem pulada');
    return;
  }

  const url = `${base}/instances/${instanceId}/token/${token}/send-text`;
  try {
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, message }),
    });
    const text = await res.text();
    console.log(`[ZAPI] → ${phone} status=${res.status} | ${text.substring(0, 100)}`);
  } catch (err) {
    console.error(`[ZAPI] Erro ao enviar para ${phone}:`, err.message);
  }
}

/**
 * Formata uma data/hora em pt-BR para uso em mensagens WhatsApp.
 * Aceita string ISO, objeto Date ou string de data.
 */
function fmtDateTimeBR(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return String(dt);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateBR(dt) {
  if (!dt) return '—';
  const d = new Date(dt + 'T12:00:00');
  if (isNaN(d)) return String(dt);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

module.exports = { sendWhatsapp, fmtDateTimeBR, fmtDateBR };
