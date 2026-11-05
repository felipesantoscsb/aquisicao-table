'use strict';
// Pesquisa de mercado (/pesquisa). A página vive aqui; as respostas e o
// relatório vivem no Hub (crm.tableclinic.com.br/admin/pesquisa-mercado).
//
// O navegador nunca fala com o Hub: cada passo passa por aqui, é validado com
// a mesma definição do questionário e segue assinado com o segredo interno
// (hubSync.encaminharPesquisa). Nada de IP, user-agent, nome ou contato é
// repassado ou gravado.

const express = require('express');
const path = require('path');
const survey = require('../../public/pesquisa/survey-def');
const hubSync = require('../hubSync');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'pesquisa');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function shortText(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : null;
}

/**
 * Monta o corpo repassado ao Hub, só com os campos esperados. Devolve
 * { error } quando o pedido já é inválido aqui (não vale a ida ao Hub).
 */
function buildPayload(etapa, b = {}) {
  if (!UUID_RE.test(String(b.response_id || ''))) return { error: 'response_id_invalido' };
  const base = { survey_version: survey.SURVEY_VERSION, response_id: b.response_id };
  if (etapa === 'start') {
    if (b.consent !== true) return { error: 'consentimento_obrigatorio' };
    return { body: { ...base, source: shortText(b.source, 120) } };
  }
  if (etapa === 'answer') {
    const norm = survey.normalizeAnswer(b.question_id, b.answer);
    if (!norm.ok) return { error: norm.error };
    const current = b.current_question_id && survey.BY_ID[b.current_question_id] ? b.current_question_id : null;
    return {
      body: {
        ...base,
        source: shortText(b.source, 120),
        question_id: b.question_id,
        answer: { codes: norm.codes, text: norm.text || '' },
        current_question_id: current,
      },
    };
  }
  return { body: base };
}

function createPesquisaRouter({ encaminhar = hubSync.encaminharPesquisa } = {}) {
  const r = express.Router();

  r.get(['/pesquisa', '/pesquisa/'], (req, res) => {
    noStore(res);
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  for (const etapa of ['start', 'answer', 'complete']) {
    r.post(`/api/pesquisa/${etapa}`, async (req, res) => {
      noStore(res);
      const p = buildPayload(etapa, req.body || {});
      if (p.error) return res.status(400).json({ ok: false, error: p.error });
      try {
        const out = await encaminhar(etapa, p.body);
        // Versão divergente = os dois repos fora de sincronia (deploy no meio do
        // caminho). Vira 503 para a página guardar e tentar de novo.
        if (out.status === 409 && out.body?.error === 'versao_divergente') {
          console.error('[pesquisa] versão divergente do Hub:', out.body.hub_version);
          return res.status(503).json({ ok: false, error: 'tente_novamente' });
        }
        // Só repassa o que é definitivo sobre a RESPOSTA (ok, inválida, já
        // concluída). Hub fora, 5xx, 401 de segredo ou 429 viram 502: a página
        // guarda a resposta e reenvia, em vez de descartar.
        // 404 só é definitivo quando vem do store; 404 sem corpo é a rota que
        // ainda não existe (aquisicao no ar antes do deploy do Hub).
        const definitivo = (out.status >= 200 && out.status < 300) || [400, 409].includes(out.status)
          || (out.status === 404 && out.body?.error === 'participante_inexistente');
        if (!definitivo) {
          console.error(`[pesquisa] Hub respondeu ${out.status} em ${etapa}:`, out.body?.error || '');
          return res.status(502).json({ ok: false, error: 'tente_novamente' });
        }
        return res.status(out.status).json(out.body);
      } catch (e) {
        console.error(`[pesquisa] repasse ${etapa}:`, e.message);
        return res.status(502).json({ ok: false, error: 'tente_novamente' });
      }
    });
  }

  return r;
}

module.exports = { createPesquisaRouter, buildPayload };
