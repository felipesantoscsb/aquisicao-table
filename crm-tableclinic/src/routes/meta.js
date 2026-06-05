const express = require('express');
const router = express.Router();
const { authApiMiddleware } = require('../auth');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function metaFetch(path, params) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const qs = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/v21.0/${path}?${qs}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

async function metaPatch(entityId, params) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const qs = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/v21.0/${entityId}?${qs}`;
  const res = await fetch(url, { method: 'POST' }); // Meta usa POST para updates
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

async function metaPost(path, body) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/v21.0/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

// ── Cache de status de campanhas (5 min TTL) ──────────────────────────────────
let campaignsCache = { data: null, at: 0 };

async function getCampaignStatuses() {
  if (campaignsCache.data && Date.now() - campaignsCache.at < 5 * 60 * 1000) {
    return campaignsCache.data;
  }
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const json = await metaFetch(`act_${accountId}/campaigns`, {
    fields: 'id,status',
    limit: 200,
  });
  const map = {};
  for (const c of json.data || []) map[c.id] = c.status;
  campaignsCache = { data: map, at: Date.now() };
  return map;
}

// ── Mapeamento de períodos ─────────────────────────────────────────────────────
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

const VALID_LEVELS = ['account', 'campaign', 'adset', 'ad'];

// ── Parsing de insight ─────────────────────────────────────────────────────────
function parseInsight(d) {
  if (!d) return null;
  const spend        = parseFloat(d.spend || 0);
  const ctr          = parseFloat(d.ctr   || 0);
  const cpm          = parseFloat(d.cpm   || 0);
  const actions      = d.actions       || [];
  const actionValues = d.action_values  || [];

  const leads     = parseFloat(actions.find(a => a.action_type === 'lead')?.value     || 0);
  const purchases = parseFloat(actions.find(a => a.action_type === 'purchase')?.value || 0);

  const roasArr = d.purchase_roas || [];
  const roas    = parseFloat(roasArr.find(a => a.action_type === 'omni_purchase')?.value || 0);

  // Valores monetários dos eventos de conversão
  const purchaseValue        = parseFloat(actionValues.find(a => a.action_type === 'purchase')?.value         || 0);
  const initiateCheckoutValue = parseFloat(actionValues.find(a => a.action_type === 'initiate_checkout')?.value || 0);

  return {
    spend,
    leads,
    cpl:                  leads     > 0 ? spend / leads     : null,
    ctr,
    cpm,
    purchases,
    cpa:                  purchases > 0 ? spend / purchases : null,
    roas:                 roas      || null,
    purchaseValue:        purchaseValue        || null,
    initiateCheckoutValue: initiateCheckoutValue || null,
  };
}

// ── GET /api/meta-insights ────────────────────────────────────────────────────
router.get('/meta-insights', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });

  const period = req.query.period || 'today';
  const level  = req.query.level  || 'campaign';
  const preset = PERIOD_MAP[period];

  if (!preset)                      return res.status(400).json({ error: `period inválido. Use: ${Object.keys(PERIOD_MAP).join(', ')}` });
  if (!VALID_LEVELS.includes(level)) return res.status(400).json({ error: `level inválido. Use: ${VALID_LEVELS.join(', ')}` });

  const token     = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) return res.status(500).json({ error: 'META_ADS_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurados.' });

  try {
    const baseParams = { date_preset: preset, limit: 200 };

    const overviewJson = await metaFetch(`act_${accountId}/insights`, {
      ...baseParams, level: 'account', fields: INSIGHTS_FIELDS,
    });
    const overview = parseInsight(overviewJson.data?.[0]);

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

// ── POST /api/meta-action — pausar ou ativar ──────────────────────────────────
router.post('/meta-action', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Sem permissão' });

  const { entity_type, entity_id, action } = req.body || {};

  if (!['campaign', 'adset', 'ad'].includes(entity_type)) return res.status(400).json({ ok: false, error: 'entity_type inválido.' });
  if (!entity_id)                                          return res.status(400).json({ ok: false, error: 'entity_id obrigatório.' });
  if (!['ACTIVE', 'PAUSED'].includes(action))              return res.status(400).json({ ok: false, error: 'action inválida. Use ACTIVE ou PAUSED.' });

  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'Token não configurado.' });

  console.log(`[meta-action] ${new Date().toISOString()} | ${entity_type} ${entity_id} → ${action}`);

  try {
    await metaPatch(entity_id, { status: action });
    campaignsCache = { data: null, at: 0 };
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meta-action] erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/meta-budget — atualizar orçamento ───────────────────────────────
router.post('/meta-budget', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Sem permissão' });

  const { entity_type, entity_id, budget_type, amount } = req.body || {};

  if (!['campaign', 'adset'].includes(entity_type))    return res.status(400).json({ ok: false, error: 'entity_type deve ser campaign ou adset.' });
  if (!entity_id)                                       return res.status(400).json({ ok: false, error: 'entity_id obrigatório.' });
  if (!['daily', 'lifetime'].includes(budget_type))    return res.status(400).json({ ok: false, error: 'budget_type deve ser daily ou lifetime.' });
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

// ── POST /api/meta-duplicate — duplicar campanha ou conjunto ──────────────────
router.post('/meta-duplicate', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Sem permissão' });

  const { entity_type, entity_id } = req.body || {};

  if (!['campaign', 'adset'].includes(entity_type)) return res.status(400).json({ ok: false, error: 'entity_type deve ser campaign ou adset.' });
  if (!entity_id)                                    return res.status(400).json({ ok: false, error: 'entity_id obrigatório.' });

  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: 'Token não configurado.' });

  console.log(`[meta-duplicate] ${new Date().toISOString()} | ${entity_type} ${entity_id}`);

  try {
    const json = await metaPost(`${entity_id}/copies`, { status: 'PAUSED', deep_copy: true });
    const newId = json.copied_campaign_id || json.copied_adset_id || json.id;
    return res.json({ ok: true, new_id: newId });
  } catch (err) {
    console.error('[meta-duplicate] erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
