(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapaLiaEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '2026-08-24.1';
  const AXES = {
    overload: {
      short: 'sobrecarga',
      title: 'O contexto pode estar chegando antes da escolha',
      trigger: 'um dia exigente ou com pouca margem',
      thought: 'resolver isso depois parece mais possível do que parar agora',
      action: 'a decisão acontece no automático',
      after: 'vem a sensação de ter se afastado do que queria',
      insight: 'Talvez o ponto mais útil não seja cobrar uma escolha melhor, e sim criar margem alguns minutos antes.',
    },
    soothing: {
      short: 'alívio emocional',
      title: 'A comida pode estar ocupando uma função de alívio',
      trigger: 'uma emoção que pede saída rápida',
      thought: 'comer parece oferecer uma pausa imediata',
      action: 'o alívio vira a prioridade daquele momento',
      after: 'a emoção diminui por instantes, mas o desconforto pode voltar',
      insight: 'Quando a função é aliviar, informação sobre alimentação costuma ser pouco. A intervenção precisa entrar antes do impulso ganhar velocidade.',
    },
    rigidity: {
      short: 'rigidez',
      title: 'Uma regra rígida pode estar alimentando o ciclo',
      trigger: 'uma saída do plano ou do que parecia certo',
      thought: 'se não foi perfeito, o dia parece perdido',
      action: 'a flexibilidade diminui e o movimento fica mais extremo',
      after: 'surge a promessa de compensar ou recomeçar',
      insight: 'Talvez o avanço aqui venha menos de apertar as regras e mais de impedir que um episódio decida o restante do dia.',
    },
    restriction: {
      short: 'controle e restrição',
      title: 'O controle pode estar produzindo o efeito contrário',
      trigger: 'uma fase de muita vigilância ou contenção',
      thought: 'certos alimentos passam a carregar urgência e valor demais',
      action: 'quando há acesso, fica mais difícil perceber o suficiente',
      after: 'a resposta costuma ser aumentar o controle outra vez',
      insight: 'Se a restrição aumenta a urgência, endurecer o plano pode manter o problema. Regularidade e permissão precisam entrar na leitura.',
    },
    automaticity: {
      short: 'piloto automático',
      title: 'O padrão pode estar acontecendo rápido demais para ser percebido',
      trigger: 'uma rotina conhecida, um lugar ou horário recorrente',
      thought: 'a ação começa antes de uma decisão consciente',
      action: 'o comportamento segue uma sequência já treinada',
      after: 'só depois fica claro o que aconteceu',
      insight: 'O primeiro ganho não precisa ser impedir. Pode ser aprender a notar o começo do ciclo alguns minutos mais cedo.',
    },
    selfcriticism: {
      short: 'autocrítica',
      title: 'A cobrança pode estar dificultando a reparação',
      trigger: 'uma escolha interpretada como falha',
      thought: 'a conversa interna fica dura e definitiva',
      action: 'cuidar de si perde espaço para punir ou desistir',
      after: 'a culpa reforça a sensação de distância do objetivo',
      insight: 'Autocrítica parece correção, mas frequentemente reduz a capacidade de fazer a próxima escolha possível.',
    },
    disconnection: {
      short: 'desconexão dos sinais',
      title: 'Os sinais do corpo podem estar ficando em segundo plano',
      trigger: 'pressa, distração ou muitas decisões externas',
      thought: 'horário, regra ou disponibilidade falam mais alto',
      action: 'fome, saciedade e necessidade são percebidas tarde',
      after: 'fica difícil entender o que realmente teria ajudado',
      insight: 'Antes de mudar o que comer, pode ser mais potente recuperar pequenos pontos de contato com fome, energia e satisfação.',
    },
  };

  function option(id, label, weights) { return { id, label, weights }; }
  const QUESTIONS = [
    { id: 'moment', stage: 'seed', prompt: 'Em qual momento costuma ficar mais difícil cuidar da alimentação?', options: [
      option('night', 'No fim do dia ou à noite', { overload: 2, automaticity: 1 }),
      option('emotion', 'Quando alguma emoção aperta', { soothing: 3 }),
      option('offplan', 'Quando saio do que tinha planejado', { rigidity: 2, selfcriticism: 1 }),
      option('busy', 'Quando o dia fica corrido e sem estrutura', { overload: 2, disconnection: 1 }),
    ]},
    { id: 'first_move', stage: 'seed', prompt: 'Quando isso começa, o que mais se parece com o seu movimento?', options: [
      option('fast', 'Percebo quando já estou fazendo', { automaticity: 3 }),
      option('relief', 'Procuro alguma coisa que me dê alívio', { soothing: 3 }),
      option('giveup', 'Penso “agora já foi” e largo o restante', { rigidity: 3 }),
      option('postpone', 'Vou adiando até ficar difícil decidir bem', { overload: 2, disconnection: 2 }),
    ]},
    { id: 'aftermath', stage: 'seed', prompt: 'E depois, qual reação aparece com mais frequência?', options: [
      option('compensate', 'Quero compensar ou controlar mais', { restriction: 3, rigidity: 1 }),
      option('guilt', 'Me cobro e fico remoendo', { selfcriticism: 3 }),
      option('confused', 'Fico sem entender por que aconteceu', { automaticity: 2, disconnection: 2 }),
      option('repeat', 'Sinto alívio, mas o ciclo volta em outro momento', { soothing: 2, overload: 1 }),
    ]},

    { id: 'overload_detail', axis: 'overload', prompt: 'Nos dias mais exigentes, o que costuma faltar primeiro?', options: [
      option('time', 'Tempo para parar e escolher', { overload: 3 }),
      option('energy', 'Energia para sustentar mais uma decisão', { overload: 3, automaticity: 1 }),
      option('structure', 'Alguma estrutura mínima para o dia', { overload: 2, disconnection: 2 }),
      option('support', 'Um jeito de descarregar o que acumulou', { overload: 2, soothing: 1 }),
    ]},
    { id: 'soothing_detail', axis: 'soothing', prompt: 'O que a comida parece oferecer naquele instante?', options: [
      option('pause', 'Uma pausa', { soothing: 3, overload: 1 }),
      option('comfort', 'Conforto ou acolhimento', { soothing: 3 }),
      option('reward', 'Uma recompensa depois de aguentar muito', { soothing: 2, overload: 2 }),
      option('numb', 'Um jeito de não pensar por alguns minutos', { soothing: 3, automaticity: 1 }),
    ]},
    { id: 'rigidity_detail', axis: 'rigidity', prompt: 'Quando algo sai do planejado, qual pensamento chega mais perto?', options: [
      option('lostday', '“O dia já está perdido”', { rigidity: 3 }),
      option('restart', '“Amanhã eu recomeço direito”', { rigidity: 3, restriction: 1 }),
      option('cant', '“Eu nunca consigo manter”', { rigidity: 2, selfcriticism: 2 }),
      option('fix', '“Preciso corrigir isso rápido”', { rigidity: 2, restriction: 2 }),
    ]},
    { id: 'restriction_detail', axis: 'restriction', prompt: 'Quando tenta retomar o controle, o que mais acontece?', options: [
      option('cut', 'Corto alimentos ou refeições', { restriction: 3 }),
      option('rules', 'Crio regras mais apertadas', { restriction: 3, rigidity: 1 }),
      option('hold', 'Seguro o máximo que consigo', { restriction: 3 }),
      option('track', 'Passo a vigiar cada escolha', { restriction: 2, selfcriticism: 1 }),
    ]},
    { id: 'automaticity_detail', axis: 'automaticity', prompt: 'Em que ponto você costuma perceber o que está acontecendo?', options: [
      option('before', 'Um pouco antes, mas já parece difícil mudar', { automaticity: 2, soothing: 1 }),
      option('during', 'No meio', { automaticity: 3 }),
      option('after', 'Só depois', { automaticity: 3, disconnection: 1 }),
      option('varies', 'Depende muito do ambiente ou do horário', { automaticity: 2, overload: 1 }),
    ]},
    { id: 'selfcriticism_detail', axis: 'selfcriticism', prompt: 'Como costuma ser a conversa com você mesma depois?', options: [
      option('harsh', 'Dura e cheia de cobrança', { selfcriticism: 3 }),
      option('comparison', 'Comparo com como eu deveria estar', { selfcriticism: 3, rigidity: 1 }),
      option('avoid', 'Evito pensar e sigo o dia', { selfcriticism: 1, automaticity: 2 }),
      option('repair', 'Tento reparar, mas sem saber por onde', { selfcriticism: 2, disconnection: 1 }),
    ]},
    { id: 'disconnection_detail', axis: 'disconnection', prompt: 'O que mais dificulta perceber do que você precisa?', options: [
      option('screen', 'Como distraída ou fazendo outra coisa', { disconnection: 3, automaticity: 1 }),
      option('late', 'Percebo fome ou cansaço tarde demais', { disconnection: 3, overload: 1 }),
      option('external', 'Sigo mais regras do que sinais', { disconnection: 3, restriction: 1 }),
      option('unclear', 'Os sinais parecem confusos', { disconnection: 3 }),
    ]},

    { id: 'permission', stage: 'differentiate', prompt: 'Quando um alimento parece “proibido”, o que tende a acontecer?', options: [
      option('urgent', 'Ele fica mais presente na minha cabeça', { restriction: 3 }),
      option('allin', 'Quando como, parece que preciso aproveitar', { restriction: 2, rigidity: 2 }),
      option('neutral', 'Não muda muito para mim', { disconnection: 1 }),
      option('no_forbidden', 'Não costumo dividir alimentos assim', { overload: 1, soothing: 1 }),
    ]},
    { id: 'repair', stage: 'differentiate', prompt: 'Depois de um momento difícil, o que ajudaria mais a próxima escolha?', options: [
      option('small', 'Uma ação pequena e concreta', { overload: 2, selfcriticism: 1 }),
      option('understand', 'Entender o que disparou aquilo', { automaticity: 2, soothing: 1 }),
      option('flex', 'Sair do tudo ou nada', { rigidity: 3 }),
      option('regular', 'Voltar a uma rotina possível, sem compensar', { restriction: 3 }),
    ]},
    { id: 'need', stage: 'differentiate', prompt: 'Se esse padrão pudesse mudar um pouco, o que faria mais diferença agora?', options: [
      option('anticipate', 'Perceber antes de chegar no limite', { overload: 2, automaticity: 2 }),
      option('choice', 'Ter mais espaço para escolher', { disconnection: 2, automaticity: 1 }),
      option('peace', 'Diminuir culpa e conflito', { selfcriticism: 2, rigidity: 1 }),
      option('steady', 'Ter mais constância sem radicalizar', { restriction: 2, rigidity: 2 }),
    ]},
  ];

  const byId = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

  function scoreAnswers(answers) {
    const scores = Object.fromEntries(Object.keys(AXES).map(k => [k, 0]));
    (answers || []).forEach(a => {
      const q = byId[a.question_id];
      const o = q && q.options.find(x => x.id === a.option_id);
      if (!o) return;
      Object.entries(o.weights || {}).forEach(([axis, value]) => { scores[axis] += value; });
    });
    return scores;
  }

  function rankedAxes(answers) {
    const scores = scoreAnswers(answers);
    return Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b));
  }

  function nextQuestion(answers) {
    const answered = new Set((answers || []).map(a => a.question_id));
    const seed = QUESTIONS.find(q => q.stage === 'seed' && !answered.has(q.id));
    if (seed) return seed;
    if ((answers || []).length >= 9) return null;

    const ranking = rankedAxes(answers);
    const axisQuestion = ranking
      .map(axis => QUESTIONS.find(q => q.axis === axis && !answered.has(q.id)))
      .find(Boolean);
    if (axisQuestion && (answers || []).length < 7) return axisQuestion;

    return QUESTIONS.find(q => q.stage === 'differentiate' && !answered.has(q.id))
      || QUESTIONS.find(q => q.axis && !answered.has(q.id))
      || null;
  }

  function interpolation(answers) {
    const axis = rankedAxes(answers)[0];
    const data = AXES[axis];
    return `Uma possibilidade está aparecendo: ${data.trigger} pode estar deixando ${data.action}. Vamos conferir mais um pouco antes de fechar essa hipótese.`;
  }

  function buildResult(answers) {
    const ranking = rankedAxes(answers);
    const primary = ranking[0];
    const secondary = ranking.find(a => a !== primary) || ranking[1];
    const p = AXES[primary];
    const s = AXES[secondary];
    return {
      primary_axis: primary,
      secondary_axis: secondary,
      eyebrow: 'Sua hipótese inicial',
      title: p.title,
      summary: `Pelas respostas que você escolheu, uma hipótese é que ${p.trigger} abra o ciclo. Nesse contexto, ${p.thought}; então ${p.action}. ${p.after.charAt(0).toUpperCase() + p.after.slice(1)}.`,
      nuance: `Também apareceu um sinal de ${s.short}. Ele pode reforçar o ciclo, mas só o acompanhamento ao longo dos dias mostra quando isso realmente acontece.`,
      insight: p.insight,
      cycle: [p.trigger, p.thought, p.action, p.after],
    };
  }

  return { VERSION, AXES, QUESTIONS, scoreAnswers, rankedAxes, nextQuestion, interpolation, buildResult };
});
