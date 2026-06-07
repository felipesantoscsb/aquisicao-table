const express = require('express');
const router = express.Router();
const { authApiMiddleware } = require('../auth');

// ── Helpers de API ────────────────────────────────────────────────────────────

async function metaFetch(path, params) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const qs = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/v21.0/${path}?${qs}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Meta API error ${res.status}`);
  return json;
}

/**
 * Atualiza uma entidade da Meta (campanha/adset/ad) via POST form-encoded.
 * A Meta Graph API exige que params de update venham no body como
 * application/x-www-form-urlencoded — não como query string sem body,
 * e não como JSON.
 */
async function metaPatch(entityId, params) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const formBody = new URLSearchParams({ ...params, access_token: token });
  const url = `https://graph.facebook.com/v21.0/${entityId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody.toString(),
  });
  const json = await res.json();
  // Meta pode retornar HTTP 200 mas com campo "error" — checar ambos
  if (json.error) {
    console.error(`[meta-patch] Erro completo da Meta:`, JSON.stringify(json.error, null, 2));
    throw new Error(json.error.message || 'Meta API error');
  }
  if (!res.ok) throw new Error(`Meta API error ${res.status}`);
  return json;
}

/**
 * Faz POST para criar recurso (ex: /copies).
 * access_token vai na QUERY STRING — a Meta NÃO aceita access_token
 * dentro do JSON body (comportamento diferente do form-encoded).
 */
async function metaPost(path, body) {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  const qs = new URLSearchParams({ access_token: token });
  const url = `https://graph.facebook.com/v21.0/${path}?${qs}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), // sem access_token aqui
  });
  const json = await res.json();
  if (json.error) {
    console.error(`[meta-post] Erro completo da Meta:`, JSON.stringify(json.error, null, 2));
    throw new Error(json.error.message || 'Meta API error');
  }
  if (!res.ok) throw new Error(`Meta API error ${res.status}`);
  return json;
}

// ── Budget helper ─────────────────────────────────────────────────────────────

function parseBudget(entity) {
  if (entity.daily_budget && parseFloat(entity.daily_budget) > 0) {
    return { type: 'daily', amount: parseFloat(entity.daily_budget) / 100 };
  }
  if (entity.lifetime_budget && parseFloat(entity.lifetime_budget) > 0) {
    return { type: 'lifetime', amount: parseFloat(entity.lifetime_budget) / 100 };
  }
  return null;
}

// ── Cache: campanhas (status + orçamento) — TTL 5 min ─────────────────────────

let campaignInfoCache = { data: null, at: 0 };

async function getCampaignInfo() {
  if (campaignInfoCache.data && Date.now() - campaignInfoCache.at < 5 * 60 * 1000) {
    return campaignInfoCache.data;
  }
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const json = await metaFetch(`act_${accountId}/campaigns`, {
    fields: 'id,status,daily_budget,lifetime_budget',
    limit: 200,
  });
  const map = {};
  for (const c of json.data || []) {
    map[c.id] = { status: c.status, budget: parseBudget(c) };
  }
  campaignInfoCache = { data: map, at: Date.now() };
  return map;
}

// ── Cache: adsets (status + orçamento) — TTL 5 min ───────────────────────────

let adsetInfoCache = { data: null, at: 0 };

async function getAdsetInfo() {
  if (adsetInfoCache.data && Date.now() - adsetInfoCache.at < 5 * 60 * 1000) {
    return adsetInfoCache.data;
  }
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const json = await metaFetch(`act_${accountId}/adsets`, {
    fields: 'id,status,daily_budget,lifetime_budget,campaign_id',
    limit: 200,
  });
  const map = {};
  for (const a of json.data || []) {
    map[a.id] = { status: a.status, budget: parseBudget(a), campaignId: a.campaign_id };
  }
  adsetInfoCache = { data: map, at: Date.now() };
  return map;
}

function invalidateCaches() {
  campaignInfoCache = { data: null, at: 0 };
  adsetInfoCache    = { data: null, at: 0 };
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

// Campos de insights — inclui frequência, video_play_actions para Hook Rate
const INSIGHTS_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpm', 'frequency',
  'actions', 'action_values', 'cost_per_action_type', 'purchase_roas',
  'video_play_actions',
].join(',');

const VALID_LEVELS = ['account', 'campaign', 'adset', 'ad'];

// ── Parsing de insight ─────────────────────────────────────────────────────────

/** Busca o valor de um action_type no array, tentando variantes em ordem. */
function findAction(arr, ...types) {
  for (const type of types) {
    const found = arr.find(a => a.action_type === type);
    if (found) return parseFloat(found.value || 0);
  }
  return 0;
}

function parseInsight(d) {
  if (!d) return null;

  const spend       = parseFloat(d.spend       || 0);
  const impressions = parseFloat(d.impressions || 0);
  const frequency   = parseFloat(d.frequency   || 0);
  const ctr         = parseFloat(d.ctr         || 0);
  const cpm         = parseFloat(d.cpm         || 0);

  const actions      = d.actions           || [];
  const actionValues = d.action_values      || [];
  const videoPlays   = d.video_play_actions || [];

  // Ações padrão
  const leads            = findAction(actions, 'lead');
  const purchases        = findAction(actions, 'purchase');
  const linkClicks       = findAction(actions, 'link_click');
  const landingPageViews = findAction(actions, 'landing_page_view');
  const initiateCheckout = findAction(actions, 'initiate_checkout');

  // Eventos customizados do pixel (testa variantes offsite / onsite)
  const quizView = findAction(actions,
    'offsite_conversion.fb_pixel_custom.QuizView',
    'onsite_conversion.fb_pixel_custom.QuizView'
  );
  const quizCompleted = findAction(actions,
    'offsite_conversion.fb_pixel_custom.QuizCompleted',
    'onsite_conversion.fb_pixel_custom.QuizCompleted'
  );

  const roasArr = d.purchase_roas || [];
  const roas    = parseFloat(roasArr.find(a => a.action_type === 'omni_purchase')?.value || 0) || null;

  const purchaseValue = parseFloat(actionValues.find(a => a.action_type === 'purchase')?.value || 0) || null;

  // Hook Rate = visualizações 3s / impressões × 100
  const threeSecViews = parseFloat(videoPlays.find(a => a.action_type === 'video_view')?.value || 0);
  const hookRate = impressions > 0 && threeSecViews > 0
    ? (threeSecViews / impressions) * 100
    : null;

  return {
    spend,
    impressions:             impressions      || null,
    frequency:               frequency        || null,
    ctr:                     ctr              || null,
    cpm:                     cpm              || null,
    leads:                   leads            || null,
    cpl:                     leads      > 0   ? spend / leads            : null,
    purchases:               purchases        || null,
    cpa:                     purchases  > 0   ? spend / purchases         : null,
    roas,
    purchaseValue,
    linkClicks:              linkClicks       || null,
    landingPageViews:        landingPageViews || null,
    initiateCheckout:        initiateCheckout || null,
    costPerInitiateCheckout: initiateCheckout > 0 ? spend / initiateCheckout : null,
    quizView:                quizView         || null,
    quizCompleted:           quizCompleted    || null,
    hookRate,
  };
}

// ── GET /api/meta-insights ────────────────────────────────────────────────────

router.get('/meta-insights', authApiMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sem permissão' });

  const period = req.query.period || 'today';
  const level  = req.query.level  || 'campaign';
  const preset = PERIOD_MAP[period];

  if (!preset)                       return res.status(400).json({ error: `period inválido. Use: ${Object.keys(PERIOD_MAP).join(', ')}` });
  if (!VALID_LEVELS.includes(level)) return res.status(400).json({ error: `level inválido. Use: ${VALID_LEVELS.join(', ')}` });

  const token     = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) return res.status(500).json({ error: 'META_ADS_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurados.' });

  try {
    const baseParams = { date_preset: preset, limit: 200 };

    // Overview sempre em nível de conta
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

      // Promises paralelas — adsets só quando necessário
      const promises = [
        metaFetch(`act_${accountId}/insights`, { ...baseParams, level, fields: levelFields }),
        getCampaignInfo(),
      ];
      if (level === 'adset' || level === 'ad') promises.push(getAdsetInfo());

      const [rowsJson, campaignInfo, adsetInfo] = await Promise.all(promises);

      rows = (rowsJson.data || []).map(d => {
        let status, budget;

        if (level === 'campaign') {
          const ci = campaignInfo[d.campaign_id] || {};
          status = ci.status || 'UNKNOWN';
          budget = ci.budget || null;
        } else if (level === 'adset') {
          const ai = (adsetInfo || {})[d.adset_id] || {};
          status = ai.status || 'UNKNOWN';
          // Se adset não tem orçamento próprio (CBO), usa da campanha
          budget = ai.budget || campaignInfo[d.campaign_id]?.budget || null;
        } else {
          // ad — usa status da campanha (sem cache de ads para simplificar)
          status = campaignInfo[d.campaign_id]?.status || 'UNKNOWN';
          budget = null;
        }

        const base = {
          campaignId:   d.campaign_id,
          campaignName: d.campaign_name,
          status,
          budget,
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
      }).sort((a, b) => (b.spend || 0) - (a.spend || 0));
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
    console.log(`[meta-action] Chamando metaPatch: entity_id=${entity_id} status=${action}`);
    await metaPatch(entity_id, { status: action });
    invalidateCaches();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meta-action] Falha:', err.message);
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
    const amountCents = String(Math.round(Number(amount)));
    console.log(`[meta-budget] Chamando metaPatch: entity_id=${entity_id} ${field}=${amountCents}`);
    await metaPatch(entity_id, { [field]: amountCents });
    invalidateCaches();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[meta-budget] Falha:', err.message);
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
    // O parâmetro correto é status_list (array), não status.
    // Para adsets, campaign_id é obrigatório — buscamos do cache.
    const copyBody = {
      status_list: ['PAUSED'],
      deep_copy: true,
    };

    if (entity_type === 'adset') {
      const adsets = await getAdsetInfo();
      const adset  = adsets[entity_id];
      if (!adset?.campaignId) {
        return res.status(400).json({ ok: false, error: 'Não foi possível determinar a campanha pai do conjunto.' });
      }
      copyBody.campaign_id = adset.campaignId;
    }

    console.log(`[meta-duplicate] body enviado:`, JSON.stringify(copyBody));

    const json = await metaPost(`${entity_id}/copies`, copyBody);
    const newId = json.copied_campaign_id || json.copied_adset_id || json.id;
    return res.json({ ok: true, new_id: newId });
  } catch (err) {
    console.error('[meta-duplicate] erro:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
