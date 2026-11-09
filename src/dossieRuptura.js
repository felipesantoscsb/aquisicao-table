// Dossiê da Primeira Ruptura: o resultado do /raiz-radar, entregue por
// WhatsApp ~15 min depois do quiz, numa página própria.
//
// Espelha a operação do /raiz (dossiê de 15 min do sdr-table), mas vive aqui,
// no aquisicao-table, por três motivos:
//   1. o Radar NÃO acorda o SDR (ehRaizV2 → sem forwardToSDR, e o sdr-table
//      silencia o Radar desde 22/10). Mandar pelo /webhook/quiz agendaria
//      também a cadência D+1/D+3 do Protocolo Raiz, que é outro produto;
//   2. as notas do Radar já moram neste Redis (radar:<lead.id>);
//   3. o sweep com pendência no Redis sobrevive a redeploy e respeita a janela
//      de horário de verdade — o setTimeout do sdr-table não respeita.
//
// O link leva um token OPACO (pr:dossie:<token> → radarId), nunca o lead.id:
// o lead.id é o `sck` do checkout e aparece em link de atribuição, que vaza.
// Mesmo raciocínio do token do mapa.
//
// Tudo que fala com Redis, Meta ou Hub entra por parâmetro, para o teste rodar
// com dublês sem subir servidor.

const crypto = require('crypto');
const RadarIdentity = require('../public/js/radar-identities.js');
const primeiraRuptura = require('./primeiraRuptura');

const DELAY_MS        = 15 * 60 * 1000;
const TTL_TOKEN       = 60 * 60 * 24 * 180;  // igual ao radar:<id>
const TTL_PENDENTE    = 60 * 60 * 48;        // cobre fim de semana fora da janela
const TTL_JA_ENVIADO  = 60 * 60 * 24 * 7;    // refez o quiz na mesma semana: não reenvia
const TEMPLATE_PADRAO = 'dossie_ruptura';
const BASE_URL        = 'https://www.evelynliu.com.br';
const CHECKOUT_PADRAO = 'https://pay.cakto.com.br/3azm4o3_1219891';

// Só a string "true" liga. Nasce em SOMBRA: nada sai para lead real sem o
// Felipe ligar no Railway depois de o modelo estar aprovado na Meta.
function dossieAtivo(env = process.env) {
  return env.RADAR_DOSSIE_ENABLED === 'true';
}

function primeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  if (!p) return '';
  // Nome em CAIXA ALTA do cadastro vira "Mariana", não "MARIANA".
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

// Rótulo curto da confiança da leitura, para o selo da capa. O texto longo
// (confidenceText) continua vindo do radar-identities, sem reescrever.
const SELO_CONFIANCA = {
  confirmed: 'Leitura confirmada',
  clear:     'Padrão predominante',
  soft:      'Tendência, não rótulo',
  hybrid:    'Padrão combinado',
  balanced:  'Sem um ponto dominante',
};

const CONFIANCA_TEXTO = {
  confirmed: 'Leitura confirmada pelo desenho e pelas suas respostas de confirmação.',
  clear:     'O desenho mostra um padrão predominante, sem tratar isso como diagnóstico.',
  soft:      'Esta é uma tendência do seu Radar, não um rótulo definitivo.',
  hybrid:    'Mais de um movimento apareceu; por isso a leitura preserva a combinação.',
  balanced:  'Não há um único ponto dominante, e o resultado não força um desempate.',
};

/**
 * A identidade que ela leu no resultado do quiz. O front já calculou com as
 * respostas de confirmação e mandou a chave; aqui só se busca o texto. Sem a
 * chave (registro anterior a este deploy), recalcula pelas notas, sem as
 * confirmações — pode cair num subtipo vizinho, mas nunca fica sem nome.
 */
function identidadeDoRegistro(reg = {}) {
  const scores = reg.scores || {};
  let calc = null;
  try { calc = RadarIdentity.classify(scores, {}); } catch { calc = null; }

  const chave = (reg.identity_key && RadarIdentity.IDENTITIES[reg.identity_key])
    ? reg.identity_key : (calc && calc.key) || null;
  if (!chave) return null;

  const base = RadarIdentity.IDENTITIES[chave];
  const confianca = (reg.identity_key === chave && reg.identity_confidence) || (calc && calc.confidence) || 'soft';
  return {
    chave,
    nome:      base.name,
    resumo:    base.summary,
    mecanismo: base.mechanism,
    ruptura:   base.rupture,
    selo:      SELO_CONFIANCA[confianca] || SELO_CONFIANCA.soft,
    confianca_texto: CONFIANCA_TEXTO[confianca] || CONFIANCA_TEXTO.soft,
    recurso:   calc ? calc.strongText : null,
  };
}

/**
 * Link do checkout com a identidade da lead pré-preenchida e o `sck` que
 * amarra a venda ao quiz (mesmos parâmetros do botão do /raiz-radar).
 */
function linkCheckout({ radarId, nome, email, phone } = {}, base = CHECKOUT_PADRAO) {
  const u = new URL(base);
  if (email) u.searchParams.set('email', email);
  const d = String(phone || '').replace(/\D/g, '');
  if (d) u.searchParams.set('phone', '+' + (d.startsWith('55') ? d : '55' + d));
  if (nome) u.searchParams.set('name', nome);
  if (radarId) u.searchParams.set('sck', radarId);
  return u.toString();
}

/**
 * O que a página renderiza. Rota decide o próximo passo:
 *   A → conversa gratuita (pré-consulta) primeiro, a Primeira Ruptura abaixo;
 *   B → os 7 dias e a oferta;
 *   C → igual a B, com a ponte educativa antes dos 7 dias.
 */
function montarDossie({ registro = {}, lead = null, radarId = null } = {}) {
  const scores = registro.scores || primeiraRuptura.SCORES_DEMO;
  const mapa = primeiraRuptura.montarMapa({ nome: registro.nome || null, scores });
  const rota = ['A', 'B', 'C'].includes(String(registro.route || '').toUpperCase())
    ? String(registro.route).toUpperCase() : 'B';

  return {
    nome: primeiroNome(registro.nome) || null,
    rota,
    identidade: identidadeDoRegistro({ ...registro, scores }),
    pilar_foco: mapa.pilar_foco,
    pilar_foco_nome: mapa.pilar_foco_nome,
    nota_max: mapa.nota_max,
    pilares: mapa.pilares,
    dias: mapa.dias.map(d => ({ n: d.n, etapa: d.etapa, titulo: d.titulo, personalizado: d.personalizado })),
    checkout_url: linkCheckout({
      radarId,
      nome: registro.nome || lead?.nome || null,
      email: lead?.email || null,
      phone: registro.phone || lead?.phone || null,
    }),
    // A pré-consulta da rota A leva só o id opaco, igual ao botão do quiz.
    preconsulta_url: radarId ? `/pre-consulta?lid=${encodeURIComponent(radarId)}` : '/pre-consulta',
  };
}

const chaves = {
  token:     (t) => `pr:dossie:${t}`,
  porLead:   (radarId) => `pr:dossie:lead:${radarId}`,
  pendente:  (phone) => `radar:dossie:pending:${phone}`,
  enviado:   (phone) => `radar:dossie:sent:${phone}`,
  enviando:  (phone) => `radar:dossie:sending:${phone}`,
  optout:    (phone) => `recovery:optout:${phone}`,   // a mesma blocklist do SAIR
};

/**
 * Chamado no CompleteRegistration do Radar. Cria o token da página (sempre:
 * a página precisa existir mesmo em sombra, para revisão) e a pendência de
 * envio para daqui a 15 minutos.
 */
async function agendarDossie(redis, { radarId, phone, nome, route } = {}, agora = Date.now()) {
  if (!radarId || !phone) return { agendado: false, motivo: 'sem radarId ou telefone' };

  // Mesmo quiz reenviado (retry do browser) não cria segundo token.
  let token = await redis.get(chaves.porLead(radarId));
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    await redis.set(chaves.token(token), JSON.stringify({ radar_id: radarId, phone, at: new Date(agora).toISOString() }), 'EX', TTL_TOKEN);
    await redis.set(chaves.porLead(radarId), token, 'EX', TTL_TOKEN);
  }

  if (await redis.get(chaves.optout(phone)))  return { agendado: false, token, motivo: 'optout' };
  if (await redis.get(chaves.enviado(phone))) return { agendado: false, token, motivo: 'ja recebeu nos ultimos 7 dias' };

  const pendencia = { phone, nome: nome || null, radar_id: radarId, token, route: route || null, due_at: agora + DELAY_MS, created_at: new Date(agora).toISOString() };
  await redis.set(chaves.pendente(phone), JSON.stringify(pendencia), 'EX', TTL_PENDENTE);
  return { agendado: true, token, due_at: pendencia.due_at };
}

/** Comprou ou pediu a pré-consulta: o dossiê perde o sentido. */
async function cancelarDossie(redis, phone) {
  if (!phone) return false;
  return Boolean(await redis.del(chaves.pendente(phone)));
}

/** Payload do modelo na Cloud API: nome no corpo, token no botão. */
function payloadTemplate({ phone, nome, token, template = TEMPLATE_PADRAO }) {
  return {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: template,
      language: { code: 'pt_BR' },
      components: [
        { type: 'body',   parameters: [{ type: 'text', text: primeiroNome(nome) || 'tudo bem' }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: token }] },
      ],
    },
  };
}

/** Texto aprovado, para o Hub mostrar a mensagem como ela foi lida. */
function textoDoModelo(nome) {
  return [
    `Oi, ${primeiroNome(nome) || 'tudo bem'}. Seu Dossiê do Radar ficou pronto.`,
    '',
    'Ele mostra o nome do ciclo que apareceu nas suas respostas, como ele se fecha e onde o primeiro movimento cabe.',
    '',
    'Leva uns 4 minutos para ler.',
  ].join('\n');
}

/**
 * Varre as pendências vencidas. Fora da janela não faz nada: a pendência
 * espera o próximo sweep dentro do horário (TTL de 48h cobre o fim de semana).
 *
 * deps:
 *   redis           get/set/del/keys
 *   enviar(payload) → resposta da Meta (só chamado com o envio ligado)
 *   registrarNoHub({ ... }) → opcional, fire-and-forget
 *   dentroDoHorario() → boolean
 *   ativo           → boolean (RADAR_DOSSIE_ENABLED)
 *   template        → nome do modelo
 *   agora           → ms
 *   log             → console-like
 */
async function varrerDossies(deps) {
  const { redis, enviar, registrarNoHub, dentroDoHorario, ativo, template = TEMPLATE_PADRAO, agora = Date.now(), log = console } = deps;
  const resultado = { enviados: 0, sombra: 0, descartados: 0, erros: 0 };
  if (!dentroDoHorario()) return resultado;

  const keys = await redis.keys('radar:dossie:pending:*');
  for (const key of keys) {
    let rec = null;
    try {
      const raw = await redis.get(key);
      if (!raw) continue;
      rec = JSON.parse(raw);
      if (agora < rec.due_at) continue;

      if (await redis.get(chaves.optout(rec.phone))) {
        await redis.del(key); resultado.descartados++; continue;
      }

      const payload = payloadTemplate({ phone: rec.phone, nome: rec.nome, token: rec.token, template });

      // Sombra: loga o que sairia UMA vez e encerra a pendência. Deixar
      // pendente faria o mesmo log repetir a cada 5 minutos por 48h.
      if (!ativo) {
        log.log(`[dossie-pr] SOMBRA — nao enviado. payload=${JSON.stringify(payload)} url=${BASE_URL}/dossie-ruptura/${rec.token}`);
        await redis.del(key); resultado.sombra++; continue;
      }

      const lock = await redis.set(chaves.enviando(rec.phone), '1', 'EX', 5 * 60, 'NX');
      if (!lock) continue;

      const resp = await enviar(payload);
      await redis.set(chaves.enviado(rec.phone), new Date(agora).toISOString(), 'EX', TTL_JA_ENVIADO);
      await redis.del(key);
      await redis.del(chaves.enviando(rec.phone));
      resultado.enviados++;
      log.log(`[dossie-pr] enviado: ${rec.phone} token=${rec.token}`);

      if (registrarNoHub) {
        Promise.resolve(registrarNoHub({
          phone: rec.phone,
          nome: rec.nome || 'Lead',
          template_name: template,
          params: [primeiroNome(rec.nome) || 'tudo bem', rec.token],
          provider_message_id: resp?.messages?.[0]?.id || null,
          provider: resp,
          source: 'dossie_ruptura',
          funnel: 'raiz-radar',
          body_text: textoDoModelo(rec.nome),
        })).catch(() => {});
      }
    } catch (e) {
      resultado.erros++;
      log.error(`[dossie-pr] erro no envio: ${e.message}`);
      // Mesmo orçamento da recuperação: erro permanente não re-tenta para sempre.
      try {
        if (rec && key) {
          await redis.del(chaves.enviando(rec.phone));
          rec.attempts = (rec.attempts || 0) + 1;
          if (rec.attempts >= 5) await redis.del(key);
          else await redis.set(key, JSON.stringify(rec), 'KEEPTTL');
        }
      } catch {}
    }
  }
  return resultado;
}

module.exports = {
  DELAY_MS, TEMPLATE_PADRAO, BASE_URL, CHECKOUT_PADRAO,
  dossieAtivo, primeiroNome, identidadeDoRegistro, linkCheckout, montarDossie,
  agendarDossie, cancelarDossie, payloadTemplate, textoDoModelo, varrerDossies, chaves,
};
