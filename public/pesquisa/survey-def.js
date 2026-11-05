/*
 * TABLE CLINIC — Pesquisa sobre emagrecimento, medicamentos e manutenção
 *
 * Este arquivo existe em DOIS repos e tem de ser idêntico byte a byte:
 *   aquisicao-table/public/pesquisa/survey-def.js       (página /pesquisa)
 *   hub-tableclinic/src/services/pesquisaMercado/surveyDef.js (respostas e relatório)
 * O aquisicao manda survey_version a cada passo e o Hub recusa versão
 * diferente. Mudou um? Copie para o outro e suba SURVEY_VERSION.
 *
 * NÃO reescrever perguntas nem alternativas: o texto é o do questionário
 * aprovado. Códigos de alternativa são estáveis (<ID>_<nn>, na ordem do
 * questionário; Q01 usa A–E). Mudou algo? Suba SURVEY_VERSION.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TC_SURVEY = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SURVEY_VERSION = '2026-11-v1';

  // Alternativas "Outro" abrem um campo opcional; alternativas exclusivas
  // (ex.: "Nenhuma dificuldade importante") desmarcam as demais em seleção múltipla.
  var OUTRO = 'Outro';
  var EXCLUSIVE_LABELS = [
    'Ainda não percebi melhorias',
    'Nenhuma dificuldade importante',
    'Ainda não tentei',
  ];

  function single(id, block, text, labels, extra) { return build(id, block, 'single', text, labels, extra); }
  function multi(id, block, text, labels, max, extra) {
    var q = build(id, block, 'multi', text, labels, extra);
    q.max = max || null;
    return q;
  }
  function open(id, block, text, extra) { return build(id, block, 'open', text, [], extra); }

  function build(id, block, type, text, labels, extra) {
    var q = { id: id, block: block, type: type, text: text, options: [], optional: type === 'open' };
    labels.forEach(function (label, i) {
      var code = typeof label === 'object' ? label.code : id + '_' + String(i + 1).padStart(2, '0');
      var text = typeof label === 'object' ? label.label : label;
      var opt = { code: code, label: text };
      if (text === OUTRO) opt.other = true;
      if (type === 'multi' && EXCLUSIVE_LABELS.indexOf(text) !== -1) opt.exclusive = true;
      q.options.push(opt);
    });
    if (extra) Object.keys(extra).forEach(function (k) { q[k] = extra[k]; });
    return q;
  }

  var QUESTIONS = [
    // ── Segmentação ──────────────────────────────────────────────────────────
    single('Q01', 'Q', 'Qual dessas situações melhor descreve sua relação com medicamentos para emagrecer, como Mounjaro ou Wegovy?', [
      { code: 'A', label: 'Uso atualmente.' },
      { code: 'B', label: 'Já usei, mas não uso mais.' },
      { code: 'C', label: 'Nunca usei, mas considero usar.' },
      { code: 'D', label: 'Nunca usei e não considero usar.' },
      { code: 'E', label: 'Prefiro não responder.' },
    ]),

    // ── Bloco A — Usuários atuais ────────────────────────────────────────────
    single('A01', 'A', 'Há quanto tempo você usa o medicamento?', ['Menos de 1 mês', '1 a 3 meses', '3 a 6 meses', '6 a 12 meses', 'Mais de 12 meses']),
    single('A02', 'A', 'O que mais te motivou a começar?', ['Melhorar minha saúde', 'Emagrecer após várias tentativas', 'Controlar a fome', 'Pensar menos em comida', 'Melhorar minha aparência', OUTRO]),
    multi('A03', 'A', 'O que mais melhorou desde que começou?', ['Peso e medidas', 'Controle da fome', 'Menos pensamentos sobre comida', 'Saúde e disposição', 'Relação com a comida', 'Ainda não percebi melhorias', OUTRO], 2, { hint: 'Selecione até duas.' }),
    multi('A04', 'A', 'Mesmo usando o medicamento, qual dificuldade você ainda enfrenta?', ['Comer por motivos emocionais', 'Organizar alimentação e rotina', 'Culpa ou preocupação com comida', 'Medo de recuperar peso', 'Efeitos adversos', 'Nenhuma dificuldade importante', OUTRO], 2, { hint: 'Selecione até duas.' }),
    open('A05', 'A', 'O que você sente que o medicamento ainda não resolveu na sua vida?'),
    single('A06', 'A', 'Você tem acompanhamento nutricional atualmente?', ['Sim, desde antes do medicamento', 'Sim, comecei durante o tratamento', 'Não, mas gostaria', 'Não e não sinto necessidade']),
    single('A07', 'A', 'Mesmo que o medicamento continue funcionando, por qual motivo você buscaria acompanhamento nutricional?', ['Melhorar minha alimentação', 'Trabalhar minha relação com a comida', 'Me preparar para a manutenção', 'Ter orientação individualizada', 'Não buscaria acompanhamento', OUTRO]),
    single('A08', 'A', 'Qual é sua maior preocupação com o futuro?', ['Recuperar o peso', 'Precisar continuar usando', 'Custo do tratamento', 'Voltar a sentir muita fome', 'Não tenho preocupação importante', OUTRO]),
    open('A09', 'A', 'Se você já está emagrecendo, o que justificaria pagar por outro tipo de acompanhamento?'),

    // ── Bloco B — Ex-usuários ────────────────────────────────────────────────
    single('B01', 'B', 'Há quanto tempo interrompeu o uso?', ['Menos de 3 meses', '3 a 6 meses', '6 a 12 meses', 'Mais de 12 meses']),
    single('B02', 'B', 'Por que interrompeu?', ['Atingi meu objetivo', 'Custo', 'Efeitos adversos', 'Orientação médica', 'Resultados abaixo do esperado', 'Dificuldade de acesso', OUTRO]),
    single('B03', 'B', 'O que aconteceu com seu peso depois?', ['Permaneceu aproximadamente estável', 'Recuperei uma parte', 'Recuperei grande parte ou tudo', 'Continuei emagrecendo', 'Ainda é cedo para avaliar', 'Prefiro não responder']),
    single('B04', 'B', 'Qual foi sua maior dificuldade depois de parar?', ['Retorno da fome', 'Pensar mais em comida', 'Manter hábitos e rotina', 'Medo de engordar', 'Não tive dificuldade importante', OUTRO]),
    open('B05', 'B', 'O que você gostaria de ter aprendido antes de interromper o medicamento?'),
    single('B06', 'B', 'Você teve acompanhamento nutricional?', ['Durante e depois', 'Apenas durante', 'Apenas depois', 'Não tive']),
    single('B07', 'B', 'O que teria ajudado mais na manutenção?', ['Um plano alimentar adaptável', 'Apoio para lidar com emoções e alimentação', 'Acompanhamento periódico', 'Orientação médica sobre continuidade ou interrupção', 'Não senti necessidade', OUTRO]),
    single('B08', 'B', 'Hoje, qual é sua maior prioridade?', ['Voltar a emagrecer', 'Manter meu peso', 'Melhorar minha relação com a comida', 'Melhorar minha saúde e rotina', OUTRO]),
    single('B09', 'B', 'Você consideraria investir em acompanhamento voltado à manutenção?', ['Sim', 'Talvez', 'Não']),
    single('B10', 'B', 'Qual é o principal motivo?', ['Não sinto necessidade', 'Custo', 'Não acredito que faria diferença', 'Prefiro resolver por conta própria', OUTRO],
      { showIf: { question: 'B09', anyOf: ['B09_03'] } }),

    // ── Bloco C — Nunca usou, mas considera ──────────────────────────────────
    single('C01', 'C', 'O que mais te atrai na possibilidade de usar?', ['Emagrecer depois de várias tentativas', 'Sentir menos fome', 'Pensar menos em comida', 'Melhorar minha saúde', 'Facilitar o processo de emagrecimento', OUTRO]),
    single('C02', 'C', 'O que mais te impede de começar?', ['Preço', 'Efeitos adversos', 'Medo de recuperar peso', 'Incerteza sobre uso prolongado', 'Não sei se tenho indicação médica', OUTRO]),
    open('C03', 'C', 'O que você espera que o medicamento mude na sua vida, além do peso?'),
    single('C04', 'C', 'O que você acredita que continuaria sendo difícil mesmo emagrecendo com o medicamento?', ['Alimentação emocional', 'Organização dos hábitos', 'Relação com meu corpo', 'Manutenção do peso', 'Não imagino dificuldades adicionais', OUTRO]),
    multi('C05', 'C', 'O que você já tentou para emagrecer?', ['Dietas por conta própria', 'Nutricionista', 'Exercícios físicos', 'Outros tratamentos médicos', 'Programas digitais', 'Ainda não tentei', OUTRO], null, { hint: 'Você pode selecionar mais de uma.' }),
    single('C06', 'C', 'Qual foi sua maior dificuldade nas tentativas anteriores?', ['Conseguir resultados', 'Manter consistência', 'Lidar com fome e vontade de comer', 'Sustentar o peso perdido', 'Adaptar o processo à minha vida', 'Não tive dificuldade importante', 'Não se aplica', OUTRO]),
    single('C07', 'C', 'Em qual momento buscaria acompanhamento nutricional?', ['Antes de iniciar o medicamento', 'Junto com o início', 'Durante, se necessário', 'Na manutenção', 'Não vejo necessidade']),
    open('C08', 'C', 'O que um acompanhamento precisaria oferecer para valer o investimento?'),

    // ── Bloco D — Nunca usou e não considera ─────────────────────────────────
    single('D01', 'D', 'Qual é o principal motivo?', ['Prefiro outras abordagens', 'Tenho receio dos riscos', 'Não acredito que preciso', 'O custo não faz sentido', 'Não quero emagrecer', OUTRO]),
    single('D02', 'D', 'Qual é seu principal objetivo atualmente?', ['Emagrecer', 'Manter meu peso', 'Melhorar minha saúde', 'Melhorar minha relação com a comida', 'Não tenho objetivo relacionado ao peso', OUTRO]),
    single('D03', 'D', 'Qual é sua maior dificuldade?', ['Alimentação emocional', 'Falta de constância', 'Organização da rotina', 'Fome ou vontade de comer', 'Manter resultados', 'Nenhuma dificuldade importante', OUTRO]),
    single('D04', 'D', 'Qual transformação seria mais valiosa para você?', ['Emagrecer de forma sustentável', 'Comer com menos culpa', 'Ter autonomia alimentar', 'Melhorar saúde e disposição', 'Nenhuma dessas', OUTRO]),
    single('D05', 'D', 'Você já fez acompanhamento nutricional?', ['Faço atualmente', 'Já fiz', 'Nunca fiz']),
    open('D06', 'D', 'O que faria um acompanhamento nutricional valer a pena para você?'),
    single('D07', 'D', 'O que mais dificultou manter resultados anteriores?', ['Rotina', 'Restrições difíceis de manter', 'Fome ou vontade de comer', 'Fatores emocionais', 'Não tive dificuldade', 'Nunca tentei emagrecer', OUTRO]),

    // ── Bloco E — Prefere não responder ──────────────────────────────────────
    single('E01', 'E', 'Qual é seu principal objetivo atualmente?', ['Emagrecer', 'Manter peso', 'Melhorar saúde', 'Melhorar relação com a comida', OUTRO]),
    open('E02', 'E', 'Qual é sua maior dificuldade para alcançar esse objetivo?'),
    single('E03', 'E', 'Você já buscou ajuda profissional para isso?', ['Sim, atualmente', 'Sim, anteriormente', 'Nunca', 'Prefiro não responder']),
    single('E04', 'E', 'O que faria um acompanhamento profissional valer a pena para você?', ['Resultados de emagrecimento', 'Apoio para manutenção', 'Melhorar relação com a comida', 'Orientação personalizada', 'Não vejo necessidade', OUTRO]),

    // ── Bloco G — Perguntas comuns ───────────────────────────────────────────
    open('G01', 'G', 'Imagine que você chegou ao peso desejado. O que ainda precisaria mudar para sentir que alcançou seu objetivo?', {
      quickAnswer: { code: 'G01_01', label: 'Nada, atingir o peso seria suficiente' },
    }),
    open('G02', 'G', 'Qual é a maior dificuldade relacionada ao peso ou à alimentação que você gostaria de resolver hoje?'),
    single('G03', 'G', 'Qual benefício mais justificaria investir em acompanhamento profissional?', ['Emagrecer', 'Ter segurança para manter resultados', 'Ter uma relação mais tranquila com a comida', 'Adaptar a alimentação à minha rotina', 'Receber apoio para dificuldades alimentares', 'Nenhum justificaria', OUTRO]),
    single('G04', 'G', 'Em qual momento esse acompanhamento faria mais sentido?', ['Antes de emagrecer', 'Durante o emagrecimento', 'Depois de atingir o peso desejado', 'Quando surgisse uma dificuldade', 'Em nenhum momento']),
    single('G05', 'G', 'Você já pagou por acompanhamento nutricional?', ['Pago atualmente', 'Já paguei anteriormente', 'Nunca paguei']),
    open('G05A', 'G', 'Qual foi o principal motivo para contratar?', { showIf: { question: 'G05', anyOf: ['G05_01', 'G05_02'] } }),
    single('G05B', 'G', 'Por que deixou de continuar?', ['Atingi meu objetivo', 'Custo', 'Não percebi resultados suficientes', 'Não me adaptei ao método', 'Mudanças na rotina', OUTRO],
      { showIf: { question: 'G05', anyOf: ['G05_02'] } }),
    single('G06', 'G', 'Qual dessas situações descreve melhor seu momento atual?', ['Estou procurando acompanhamento', 'Consideraria uma proposta adequada', 'Tenho interesse, mas não posso investir agora', 'Não pretendo contratar']),
    open('G07', 'G', 'O que precisaria existir em um acompanhamento para você sentir que vale o investimento?'),
    single('G08', 'G', 'Se pudesse escolher apenas um resultado além do peso, qual seria?', ['Comer com menos culpa ou ansiedade', 'Ter hábitos que se encaixem na minha vida', 'Sentir confiança para manter resultados', 'Melhorar saúde e disposição', 'Não busco resultado adicional', OUTRO]),

    // ── Perfil e segmentação ─────────────────────────────────────────────────
    single('P01', 'P', 'Qual é sua faixa etária?', ['Menos de 18 anos', '18–24', '25–34', '35–44', '45–54', '55 ou mais', 'Prefiro não responder']),
    single('P02', 'P', 'Qual é seu objetivo principal?', ['Perder peso', 'Manter peso', 'Melhorar saúde', 'Melhorar relação com a comida', OUTRO]),
    single('P03', 'P', 'Como chegou até esta pesquisa?', ['Instagram da Evelyn', 'Instagram da Table Clinic', 'Instagram de outro fundador', 'Compartilhamento de outra pessoa', OUTRO]),
    single('P04', 'P', 'Você já foi paciente da Table Clinic?', ['Sou atualmente', 'Já fui', 'Nunca fui', 'Prefiro não responder']),
    single('P05', 'P', 'Qual faixa de investimento mensal seria viável para um acompanhamento nutricional que atendesse às suas necessidades?', ['Até R$ 150', 'R$ 151–300', 'R$ 301–500', 'R$ 501–800', 'Acima de R$ 800', 'Não investiria atualmente', 'Não sei']),
  ];

  var BY_ID = {};
  QUESTIONS.forEach(function (q, i) { q.order = i; BY_ID[q.id] = q; });

  var SEGMENTS = ['A', 'B', 'C', 'D', 'E'];
  var SEGMENT_LABELS = {
    A: 'Uso atualmente',
    B: 'Já usei, não uso mais',
    C: 'Nunca usei, considero',
    D: 'Nunca usei, não considero',
    E: 'Prefiro não responder',
  };
  // P01 "Menos de 18 anos": encerra sem coletar mais dados.
  var UNDER_18_CODE = 'P01_01';
  var PROFILE_AFTER_AGE = ['P02', 'P03', 'P04', 'P05'];

  function codesOf(answers, qid) {
    var a = answers && answers[qid];
    return a && Array.isArray(a.codes) ? a.codes : [];
  }

  function conditionMet(q, answers) {
    if (!q.showIf) return true;
    var picked = codesOf(answers, q.showIf.question);
    return q.showIf.anyOf.some(function (c) { return picked.indexOf(c) !== -1; });
  }

  /**
   * Caminho de perguntas do participante, dado o que já respondeu.
   * Q01 → bloco do segmento → bloco G → Perfil. Condicionais (B10, G05A,
   * G05B) só entram quando a resposta-gatilho já existe. Sem Q01, o caminho
   * é só Q01. P01 = menor de 18 encerra antes de P02.
   */
  function computePath(answers) {
    var path = ['Q01'];
    var segment = codesOf(answers, 'Q01')[0];
    if (SEGMENTS.indexOf(segment) === -1) return path;
    QUESTIONS.forEach(function (q) {
      if (q.block === segment || q.block === 'G') {
        if (conditionMet(q, answers)) path.push(q.id);
      }
    });
    path.push('P01');
    if (codesOf(answers, 'P01')[0] === UNDER_18_CODE) return path;
    return path.concat(PROFILE_AFTER_AGE);
  }

  function segmentOf(answers) {
    var s = codesOf(answers, 'Q01')[0];
    return SEGMENTS.indexOf(s) !== -1 ? s : null;
  }

  function isUnderage(answers) { return codesOf(answers, 'P01')[0] === UNDER_18_CODE; }

  /** Uma pergunta está respondida (ou pulada, se opcional) para fins de avanço. */
  function isAnswerComplete(q, a) {
    if (!a) return false;
    if (q.type === 'open') return true; // opcional: vazio = pulada
    return Array.isArray(a.codes) && a.codes.length > 0;
  }

  /**
   * Valida e normaliza uma resposta vinda do cliente. Devolve
   * { ok, codes, labels, text, skipped } ou { ok:false, error }.
   */
  function normalizeAnswer(qid, raw) {
    var q = BY_ID[qid];
    if (!q) return { ok: false, error: 'pergunta_desconhecida' };
    raw = raw || {};
    var codes = Array.isArray(raw.codes) ? raw.codes.map(String) : [];
    var text = typeof raw.text === 'string' ? raw.text.trim().slice(0, 4000) : '';
    var valid = q.options.map(function (o) { return o.code; });
    if (q.quickAnswer) valid.push(q.quickAnswer.code);
    for (var i = 0; i < codes.length; i++) {
      if (valid.indexOf(codes[i]) === -1) return { ok: false, error: 'alternativa_invalida' };
    }
    codes = codes.filter(function (c, i) { return codes.indexOf(c) === i; });
    if (q.type === 'single' && codes.length !== 1) return { ok: false, error: 'selecao_unica' };
    if (q.type === 'multi') {
      if (codes.length < 1) return { ok: false, error: 'selecao_vazia' };
      if (q.max && codes.length > q.max) return { ok: false, error: 'selecao_acima_do_maximo' };
      var exclusive = q.options.filter(function (o) { return o.exclusive && codes.indexOf(o.code) !== -1; });
      if (exclusive.length && codes.length > 1) return { ok: false, error: 'alternativa_exclusiva' };
    }
    if (q.type === 'open') {
      if (codes.length > 1) return { ok: false, error: 'selecao_unica' };
      if (codes.length && text) text = ''; // resposta rápida substitui o texto
    } else {
      // texto só existe como complemento de "Outro"
      var hasOther = q.options.some(function (o) { return o.other && codes.indexOf(o.code) !== -1; });
      if (!hasOther) text = '';
    }
    var labels = codes.map(function (c) { return labelOf(qid, c); });
    var skipped = q.type === 'open' && !codes.length && !text;
    return { ok: true, codes: codes, labels: labels, text: text || null, skipped: skipped };
  }

  function labelOf(qid, code) {
    var q = BY_ID[qid];
    if (!q) return '';
    if (q.quickAnswer && q.quickAnswer.code === code) return q.quickAnswer.label;
    for (var i = 0; i < q.options.length; i++) if (q.options[i].code === code) return q.options[i].label;
    return '';
  }

  return {
    SURVEY_VERSION: SURVEY_VERSION,
    QUESTIONS: QUESTIONS,
    BY_ID: BY_ID,
    SEGMENTS: SEGMENTS,
    SEGMENT_LABELS: SEGMENT_LABELS,
    UNDER_18_CODE: UNDER_18_CODE,
    computePath: computePath,
    segmentOf: segmentOf,
    isUnderage: isUnderage,
    isAnswerComplete: isAnswerComplete,
    normalizeAnswer: normalizeAnswer,
    labelOf: labelOf,
  };
});
