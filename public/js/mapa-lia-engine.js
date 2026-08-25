(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapaLiaEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2026-08-24.4';
  var MAX_ANSWERS = 8;
  var MECHANISMS = {
    overload: { label: 'sobrecarga e pouca margem' },
    emotional_relief: { label: 'busca de alívio' },
    rigidity: { label: 'rigidez e tudo ou nada' },
    automaticity: { label: 'piloto automático' },
    disconnection: { label: 'sinais percebidos tarde' },
    self_criticism: { label: 'autocrítica depois do episódio' },
    compensation: { label: 'culpa seguida de compensação' },
  };

  function sig(id, label, kind, mechanism, weight) {
    return { id:id, label:label, kind:kind, mechanism:mechanism, weight:weight || 1 };
  }
  function opt(id, label, reflection, signals) {
    return { id:id, label:label, reflection:reflection, signals:signals };
  }
  function q(id, branch, prompt, options) {
    return { id:id, branch:branch || null, prompt:prompt, options:options };
  }

  var QUESTIONS = [
    q('moment', null, 'Pra começar por uma cena real: quando costuma ficar mais difícil cuidar da alimentação?', [
      opt('night','No fim do dia ou à noite','os momentos mais difíceis costumam chegar no fim do dia',[sig('end_day','fim do dia ou noite','context','overload',3)]),
      opt('emotion','Quando alguma emoção aperta','uma emoção mais intensa costuma marcar o começo',[sig('emotion_pressure','emoção apertando','context','emotional_relief',3)]),
      opt('offplan','Quando saio do que tinha planejado','o ciclo costuma começar quando algo sai do planejado',[sig('plan_rupture','saída do planejado','context','rigidity',3)]),
      opt('busy','Quando o dia fica corrido e sem estrutura','dias corridos e sem estrutura parecem deixar pouca margem',[sig('busy_day','dia corrido e sem estrutura','context','overload',3),sig('low_structure','pouca estrutura','context','disconnection',1)]),
    ]),
    q('first_move', null, 'Quando essa cena começa, qual movimento chega mais perto do que acontece?', [
      opt('relief','Procuro alguma coisa que me dê alívio','a comida pode aparecer como uma forma rápida de aliviar',[sig('relief_search','busca de alívio','function','emotional_relief',4)]),
      opt('fast','Percebo quando já estou fazendo','a percepção costuma chegar quando o movimento já começou',[sig('late_awareness','percepção tardia','behavior','automaticity',4)]),
      opt('giveup','Penso “agora já foi” e largo o restante','uma saída do plano pode virar a sensação de que o restante já foi perdido',[sig('all_or_nothing','pensamento de tudo ou nada','cognition','rigidity',4)]),
      opt('postpone','Vou adiando até ficar difícil decidir bem','as decisões podem ser adiadas até restar pouca energia',[sig('decision_fatigue','decisões acumuladas','behavior','overload',3),sig('late_need','necessidade percebida tarde','body','disconnection',1)]),
    ]),

    q('emotion_need','emotional_relief','Naquele instante, o que a comida parece oferecer?',[
      opt('pause','Uma pausa','o que parece fazer falta é uma pausa',[sig('need_pause','necessidade de pausa','need','emotional_relief',3)]),
      opt('comfort','Conforto ou acolhimento','a busca parece se aproximar de conforto ou acolhimento',[sig('need_comfort','busca de conforto','need','emotional_relief',3)]),
      opt('reward','Uma recompensa depois de aguentar muito','o alimento pode ganhar o lugar de recompensa depois de um dia exigente',[sig('reward_after_effort','recompensa depois de esforço','function','emotional_relief',2),sig('accumulated_effort','esforço acumulado','context','overload',2)]),
      opt('numb','Um jeito de não pensar por alguns minutos','por alguns minutos, não pensar parece ser parte do alívio',[sig('need_numb','desejo de desligar','need','emotional_relief',3),sig('disengage','desligamento','behavior','automaticity',1)]),
    ]),
    q('emotion_before','emotional_relief','Pouco antes, o que costuma estar mais presente?',[
      opt('anxiety','Ansiedade ou inquietação','ansiedade ou inquietação aparecem pouco antes',[sig('anxiety','ansiedade ou inquietação','antecedent','emotional_relief',3)]),
      opt('frustration','Frustração ou decepção','frustração ou decepção parecem preparar o terreno',[sig('frustration','frustração ou decepção','antecedent','emotional_relief',3)]),
      opt('lonely','Solidão ou sensação de estar sem apoio','a sensação de estar sem apoio aparece antes',[sig('loneliness','solidão ou pouco apoio','antecedent','emotional_relief',3)]),
      opt('mixed','É difícil separar uma emoção só','as emoções chegam misturadas e difíceis de nomear',[sig('mixed_emotions','emoções misturadas','antecedent','disconnection',2),sig('emotion_pressure','emoção apertando','context','emotional_relief',1)]),
    ]),
    q('emotion_after','emotional_relief','Depois desse alívio mais imediato, o que costuma ficar?',[
      opt('guilt','Culpa ou cobrança','o alívio pode ser seguido por culpa ou cobrança',[sig('guilt','culpa depois','consequence','self_criticism',3)]),
      opt('repeat','O incômodo volta e dá vontade de repetir','o incômodo pode voltar e reacender o movimento',[sig('short_relief','alívio curto','consequence','emotional_relief',2),sig('repeat_urge','vontade de repetir','response','automaticity',2)]),
      opt('compensate','Vontade de compensar depois','depois aparece uma tentativa de compensar',[sig('compensation','tentativa de compensação','response','compensation',4)]),
      opt('unclear','Só fico confusa com o que aconteceu','fica difícil entender a sequência depois que passa',[sig('post_confusion','confusão depois','consequence','disconnection',3)]),
    ]),
    q('emotion_pattern','emotional_relief','Isso costuma acontecer de um jeito previsível?',[
      opt('same_time','Sim, em horários parecidos','o horário parece fazer parte da repetição',[sig('time_pattern','horário recorrente','context','automaticity',2)]),
      opt('same_feeling','Sim, quando a mesma emoção aparece','a mesma emoção parece reabrir a sequência',[sig('emotion_pattern','emoção recorrente','context','emotional_relief',3)]),
      opt('unpredictable','Parece imprevisível','a repetição ainda parece difícil de antecipar',[sig('unpredictable','padrão ainda pouco previsível','context','disconnection',2)]),
      opt('varies','Muda bastante conforme o dia','o contexto do dia parece mudar a forma do ciclo',[sig('context_variation','variação conforme o dia','context','overload',1)]),
    ]),

    q('load_missing','overload','Nos dias mais exigentes, o que parece faltar primeiro?',[
      opt('time','Tempo para parar','falta tempo para fazer uma pausa antes de decidir',[sig('low_time','pouco tempo para si','need','overload',3)]),
      opt('energy','Energia para mais uma decisão','a energia para decidir parece acabar antes do dia',[sig('low_energy','cansaço e pouca energia','body','overload',3)]),
      opt('structure','Uma estrutura mínima','uma estrutura mínima se perde ao longo do dia',[sig('low_structure','pouca estrutura','context','disconnection',3)]),
      opt('space','Um espaço que seja meu','parece faltar um espaço de cuidado que seja só seu',[sig('low_personal_space','pouco espaço para si','need','overload',3)]),
    ]),
    q('load_day','overload','Como o dia costuma chegar até esse momento?',[
      opt('no_break','Quase sem pausas','o dia chega ali quase sem pausas',[sig('no_breaks','dia quase sem pausas','context','overload',3)]),
      opt('little_food','Com poucas refeições ou comendo pouco','o corpo pode chegar depois de muitas horas ou pouca comida',[sig('long_gap','muitas horas sem comer','body','disconnection',3)]),
      opt('many_decisions','Com decisões e demandas acumuladas','decisões e demandas se acumulam antes do momento difícil',[sig('decision_load','decisões acumuladas','context','overload',3)]),
      opt('variable','Cada dia de um jeito','a falta de previsibilidade parece pesar',[sig('unstable_routine','rotina pouco previsível','context','overload',2)]),
    ]),
    q('load_mode','overload','Quando finalmente come, como isso costuma acontecer?',[
      opt('standing','Em pé ou direto da embalagem','comer em pé ou direto da embalagem aparece na cena',[sig('unstructured_eating','comer sem estrutura','behavior','automaticity',3)]),
      opt('screen','Fazendo outra coisa ao mesmo tempo','a refeição divide espaço com tela, trabalho ou outra tarefa',[sig('distracted_eating','comer com distração','behavior','automaticity',3)]),
      opt('fast','Muito rápido','a velocidade deixa pouco tempo para perceber o que acontece',[sig('fast_eating','comer rápido','behavior','automaticity',3)]),
      opt('searching','Procurando várias coisas','há uma busca que demora a encontrar satisfação',[sig('search_satisfaction','busca por satisfação','behavior','disconnection',2)]),
    ]),
    q('load_after','overload','Quando passa, qual reação costuma aparecer?',[
      opt('guilt','Me cobro','a cobrança chega depois de um dia que já exigiu muito',[sig('guilt','culpa depois','consequence','self_criticism',3)]),
      opt('compensate','Quero compensar','o próximo movimento tende a ser compensar',[sig('compensation','tentativa de compensação','response','compensation',4)]),
      opt('promise','Prometo organizar tudo amanhã','surge a promessa de que amanhã será totalmente diferente',[sig('restart_promise','promessa de recomeço','response','rigidity',3)]),
      opt('exhausted','Só sigo ainda mais cansada','o ciclo termina aumentando o cansaço',[sig('more_exhaustion','mais cansaço depois','consequence','overload',2)]),
    ]),

    q('rule_thought','rigidity','Quando algo sai do planejado, qual pensamento chega mais perto?',[
      opt('lost_day','“O dia já está perdido”','uma escolha pode parecer capaz de definir o dia inteiro',[sig('lost_day','dia percebido como perdido','cognition','rigidity',4)]),
      opt('restart','“Amanhã começo direito”','o recomeço perfeito fica sempre colocado no dia seguinte',[sig('restart_promise','promessa de recomeço','cognition','rigidity',3)]),
      opt('never','“Eu nunca consigo manter”','uma situação vira uma conclusão maior sobre sua capacidade',[sig('global_self_judgment','conclusão dura sobre si','cognition','self_criticism',3)]),
      opt('fix','“Preciso corrigir isso rápido”','aparece urgência para corrigir o que aconteceu',[sig('urgent_fix','urgência para corrigir','cognition','compensation',3)]),
    ]),
    q('rule_response','rigidity','E como você costuma tentar corrigir?',[
      opt('skip','Pulo ou reduzo a próxima refeição','a reparação pode virar redução da próxima refeição',[sig('meal_restriction','redução da próxima refeição','response','compensation',4)]),
      opt('rules','Crio regras mais apertadas','a resposta costuma ser apertar ainda mais as regras',[sig('stricter_rules','regras mais apertadas','response','rigidity',4)]),
      opt('exercise','Penso em compensar com exercício','o exercício pode ganhar função de compensação',[sig('exercise_compensation','exercício como compensação','response','compensation',4)]),
      opt('giveup','Desisto por um tempo','a cobrança pode terminar em afastamento do cuidado',[sig('care_abandonment','afastamento do cuidado','response','self_criticism',3)]),
    ]),
    q('rule_origin','rigidity','Hoje, como as regras aparecem na sua alimentação?',[
      opt('forbidden','Tenho alimentos que considero proibidos','alguns alimentos ainda ocupam o lugar de proibidos',[sig('forbidden_food','alimentos proibidos','cognition','rigidity',3)]),
      opt('perfect','Tento seguir tudo perfeitamente','o cuidado parece precisar ser perfeito para contar',[sig('perfection_rule','regra de perfeição','cognition','rigidity',4)]),
      opt('tracking','Vigio cada escolha','muita energia é usada para vigiar as escolhas',[sig('food_monitoring','vigilância constante','behavior','rigidity',3)]),
      opt('few','Não tenho muitas regras claras','as regras não parecem ser o centro da questão',[sig('few_rules','poucas regras explícitas','context','disconnection',1)]),
    ]),
    q('rule_after','rigidity','No dia seguinte, o que tende a acontecer?',[
      opt('control','Começo mais controlada','o dia seguinte começa com mais controle',[sig('control_restart','recomeço com controle','response','rigidity',3)]),
      opt('repeat','O ciclo se repete','a tentativa de correção não parece encerrar a repetição',[sig('cycle_repeat','ciclo se repete','consequence','compensation',3)]),
      opt('guilt','Continuo me culpando','a culpa atravessa para o dia seguinte',[sig('lasting_guilt','culpa prolongada','consequence','self_criticism',3)]),
      opt('normal','Consigo seguir normalmente','às vezes você consegue voltar sem transformar o episódio',[sig('normal_return','retorno sem compensação','protective','self_criticism',1)]),
    ]),

    q('auto_notice','automaticity','Em que ponto você costuma perceber o que está acontecendo?',[
      opt('before','Um pouco antes','às vezes existe um pequeno aviso antes',[sig('early_notice','pequeno aviso antes','protective','automaticity',1)]),
      opt('during','No meio','a percepção costuma aparecer no meio da sequência',[sig('mid_awareness','percepção no meio','behavior','automaticity',3)]),
      opt('after','Só depois','o ciclo costuma ficar visível apenas depois',[sig('after_awareness','percepção só depois','behavior','automaticity',4)]),
      opt('varies','Depende muito do dia','o momento da percepção varia com o contexto',[sig('variable_awareness','percepção variável','behavior','disconnection',2)]),
    ]),
    q('auto_place','automaticity','Onde ou em qual situação isso mais acontece?',[
      opt('kitchen','Na cozinha, em pé','a cozinha e o comer em pé aparecem como parte da sequência',[sig('kitchen_cue','cozinha como pista','context','automaticity',3)]),
      opt('sofa','No sofá ou vendo algo','sofá e tela parecem funcionar como pistas conhecidas',[sig('screen_cue','sofá ou tela como pista','context','automaticity',3)]),
      opt('work','Enquanto trabalho','trabalho e alimentação acontecem ao mesmo tempo',[sig('work_eating','comer trabalhando','context','automaticity',3)]),
      opt('varied','Em lugares diferentes','o lugar muda, então outra pista pode estar conduzindo',[sig('no_place_pattern','sem lugar único','context','disconnection',2)]),
    ]),
    q('auto_body','automaticity','Como estavam os sinais do corpo antes?',[
      opt('hungry','Já estava com bastante fome','a fome já estava alta quando a percepção chegou',[sig('high_hunger','fome já elevada','body','disconnection',3)]),
      opt('tired','Muito cansada','o cansaço estava presente antes',[sig('low_energy','cansaço e pouca energia','body','overload',3)]),
      opt('unclear','Não sei dizer','os sinais do corpo ainda parecem pouco nítidos',[sig('unclear_body','sinais do corpo pouco nítidos','body','disconnection',3)]),
      opt('not_hungry','Não parecia ser fome','a fome não parecia ser a necessidade principal',[sig('non_hunger_need','necessidade diferente de fome','body','emotional_relief',2)]),
    ]),
    q('auto_after','automaticity','Quando percebe, qual é a primeira reação?',[
      opt('stop','Às vezes consigo parar e observar','em alguns momentos, perceber já cria um pouco de espaço',[sig('pause_capacity','capacidade de pausar','protective','automaticity',1)]),
      opt('continue','Continuo porque já comecei','começar pode ser interpretado como motivo para continuar',[sig('continue_after_start','continuar porque começou','cognition','rigidity',3)]),
      opt('guilt','Me culpo','a percepção vem acompanhada de culpa',[sig('guilt','culpa depois','consequence','self_criticism',3)]),
      opt('compensate','Penso em compensar','a percepção aciona uma tentativa de compensação',[sig('compensation','tentativa de compensação','response','compensation',4)]),
    ]),

    q('verification', 'verification','Só para conferir a conexão: o que mais costuma manter esse ciclo de um dia para o outro?',[
      opt('compensation','Tentar compensar depois','a compensação pode preparar a próxima repetição',[sig('compensation','tentativa de compensação','response','compensation',3)]),
      opt('criticism','A forma como me trato depois','a autocrítica pode dificultar o retorno ao cuidado',[sig('guilt','culpa e autocrítica','consequence','self_criticism',3)]),
      opt('same_context','O mesmo horário ou contexto voltar','o mesmo contexto reaparece antes de haver outra alternativa',[sig('context_repeat','contexto recorrente','context','automaticity',3)]),
      opt('more_rules','Criar novas regras','novas regras podem devolver força ao tudo ou nada',[sig('stricter_rules','regras mais apertadas','response','rigidity',3)]),
    ]),
    q('observation', 'closing','Se a LIA pudesse observar uma coisa com você nos próximos dias, qual seria mais útil entender?',[
      opt('before','O que acontece minutos antes','vale observar os minutos anteriores ao movimento',[sig('observe_before','interesse no que vem antes','goal','automaticity',1)]),
      opt('timing','Por que certos horários pesam mais','vale observar a repetição dos horários difíceis',[sig('observe_time','interesse no padrão de horário','goal','overload',1)]),
      opt('after','O que faz a culpa virar outro ciclo','vale observar o que acontece depois da culpa',[sig('observe_after','interesse na manutenção','goal','compensation',1)]),
      opt('helped','O que já ajudou alguma vez','vale observar também as exceções e o que já funcionou',[sig('observe_protection','interesse no que ajuda','goal','self_criticism',1)]),
    ]),
  ];

  var QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(function (x) { return [x.id, x]; }));
  var BRANCH_ORDER = {
    emotional_relief:['emotion_need','emotion_before','emotion_after','emotion_pattern'],
    overload:['load_missing','load_day','load_mode','load_after'],
    rigidity:['rule_thought','rule_response','rule_origin','rule_after'],
    automaticity:['auto_notice','auto_place','auto_body','auto_after'],
  };

  function answerDetails(answers) {
    return (answers || []).map(function (a) {
      var question = QUESTION_BY_ID[a.question_id];
      var option = question && question.options.find(function (o) { return o.id === a.option_id; });
      return option ? { question:question, option:option } : null;
    }).filter(Boolean);
  }

  function buildSignals(answers) {
    var grouped = {};
    answerDetails(answers).forEach(function (item) {
      item.option.signals.forEach(function (signal) {
        if (!grouped[signal.id]) grouped[signal.id] = { id:signal.id, label:signal.label, kind:signal.kind, mechanism:signal.mechanism, score:0, evidence:[] };
        grouped[signal.id].score += signal.weight;
        grouped[signal.id].evidence.push({ question_id:item.question.id, option_id:item.option.id, text:item.option.label });
      });
    });
    return Object.values(grouped).sort(function (a,b) { return b.score-a.score || a.id.localeCompare(b.id); });
  }

  function mechanismScores(answers) {
    var scores = Object.fromEntries(Object.keys(MECHANISMS).map(function (k) { return [k,0]; }));
    buildSignals(answers).forEach(function (s) { scores[s.mechanism] = (scores[s.mechanism] || 0) + s.score; });
    return scores;
  }

  function rankedMechanisms(answers) {
    var scores = mechanismScores(answers);
    return Object.keys(scores).sort(function (a,b) { return scores[b]-scores[a] || a.localeCompare(b); });
  }

  function currentBranch(answers) {
    var scores = mechanismScores(answers);
    var branchScores = {
      emotional_relief:scores.emotional_relief,
      overload:scores.overload + scores.disconnection * .25,
      rigidity:scores.rigidity + scores.compensation * .25 + scores.self_criticism * .15,
      automaticity:scores.automaticity + scores.disconnection * .35,
    };
    return Object.keys(branchScores).sort(function (a,b) { return branchScores[b]-branchScores[a] || a.localeCompare(b); })[0];
  }

  function nextDecision(answers) {
    var used = new Set((answers || []).map(function (a) { return a.question_id; }));
    if (!used.has('moment')) return { question:QUESTION_BY_ID.moment, branch:'opening', reason:'A leitura começa situando uma cena concreta.' };
    if (!used.has('first_move')) return { question:QUESTION_BY_ID.first_move, branch:currentBranch(answers), reason:'Depois do contexto, precisamos identificar o primeiro movimento percebido.' };
    if ((answers || []).length >= MAX_ANSWERS) return { question:null, branch:currentBranch(answers), reason:'A leitura já tem contexto, movimento, consequência e manutenção suficientes.' };

    var branch = currentBranch(answers);
    var branchQuestion = (BRANCH_ORDER[branch] || []).map(function (id) { return QUESTION_BY_ID[id]; }).find(function (x) { return !used.has(x.id); });
    if ((answers || []).length < 6 && branchQuestion) {
      return { question:branchQuestion, branch:branch, reason:'Os sinais mais fortes até aqui pedem aprofundamento em ' + MECHANISMS[branch].label + '.' };
    }
    if (!used.has('verification')) return { question:QUESTION_BY_ID.verification, branch:'verification', reason:'Agora precisamos testar o que pode manter a repetição, sem tratar a hipótese como fato.' };
    if (!used.has('observation')) return { question:QUESTION_BY_ID.observation, branch:'closing', reason:'A última resposta define o que vale observar no acompanhamento, sem entregar uma intervenção.' };
    return { question:null, branch:branch, reason:'Leitura concluída.' };
  }

  function nextQuestion(answers) { return nextDecision(answers).question; }

  function buildConnections(answers) {
    var signals = buildSignals(answers);
    function best(kinds) { return signals.find(function (s) { return kinds.includes(s.kind); }); }
    var context = best(['context','antecedent','body']);
    var movement = best(['function','behavior','need','cognition']);
    var consequence = best(['consequence']);
    var response = best(['response']);
    var out = [];
    function connect(id, from, to, hedge) {
      if (!from || !to || from.id === to.id) return;
      out.push({ id:id, from:from.id, to:to.id, summary:hedge + ' “' + from.label + '” e “' + to.label + '” estejam ligados.', evidence:[].concat(from.evidence,to.evidence).slice(0,3) });
    }
    connect('context_to_movement',context,movement,'Até aqui, parece possível que');
    connect('movement_to_consequence',movement,consequence,'Vale observar se');
    connect('consequence_to_response',consequence,response,'Uma hipótese é que');
    connect('response_to_context',response,context,'Essa resposta pode ajudar a recriar');
    return out;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function midanswer(answers) {
    var details = answerDetails(answers);
    var a = details[Math.max(0, details.length-2)];
    var b = details[details.length-1];
    var next = nextDecision(answers);
    // O beat do meio é o momento "ela está me lendo". Antes era um parágrafo
    // único e denso — cansava a leitura. Agora é uma sequência de linhas
    // curtas (como a LIA falando por partes), cada uma uma ideia só. O texto
    // continua disponível como fallback pra quem consumir só `text`.
    var beats = details.length <= 3
      ? ['Duas coisas ficaram lado a lado.', cap(a.option.reflection) + '.', cap(b.option.reflection) + '.', 'Se essa ligação for real, ela explica bastante coisa.', 'Ainda é hipótese.']
      : ['A sequência ficou mais nítida.', cap(a.option.reflection) + '.', cap(b.option.reflection) + '.', 'Falta a última peça: o que faz isso se repetir.'];
    return { text: beats.join(' '), beats: beats, evidence: [a.question.id,b.question.id], branch: next.branch };
  }


  var MECHANISM_READINGS = {
    overload: 'o que derruba o seu cuidado não parece ser falta de controle. É um dia que termina sem sobrar nada pra você. Quando não existe margem, a comida vira o único momento que é seu.',
    emotional_relief: 'a comida parece estar fazendo um trabalho que não é dela: virou o caminho mais curto até algum alívio. O que pede atenção não é o que você come. É do que você está precisando na hora em que come.',
    rigidity: 'a regra pode estar pesando mais que a comida. Quando o plano quebra, o pensamento de que \u201cjá foi\u201d derruba o resto do dia. Não é o desvio que custa caro, é o tudo ou nada que vem depois dele.',
    automaticity: 'boa parte da sequência parece acontecer antes de você chegar: mesmos lugares, mesmos horários, as mesmas pistas. Você não decide mal. Você está chegando tarde na decisão.',
    disconnection: 'os sinais parecem chegar tarde ou misturados: fome, cansaço e emoção falando ao mesmo tempo. Isso não é falta de disciplina. É sinal sem nitidez.',
    self_criticism: 'o que mais sustenta o ciclo talvez não seja o que você come, e sim a dureza com que você se trata depois. É ela que torna o voltar mais difícil do que o sair.',
    compensation: 'o motor do ciclo pode não ser o episódio, e sim o que vem depois dele. Compensar prepara a próxima repetição. É por isso que apertar mais nunca resolveu.',
  };

  // Usado na seção de oferta (mapa-lia.html) e no /l/:id (server.js, via
  // require deste mesmo arquivo) — fonte única, pra não haver duas versões
  // do mesmo texto por mecanismo em lugares diferentes.
  var MICRO_URGENCY = {
    overload: 'Dias cheios não avisam quando vão terminar sem sobrar nada pra você — e é nesse ponto que o ciclo mais aparece. Sem um espaço reservado antes desse momento, ele tende a se repetir na próxima semana parecida.',
    emotional_relief: 'Enquanto a comida continuar sendo o caminho mais curto até o alívio, ela vai seguir sendo escolhida — não por falta de força, mas porque ainda é o que funciona mais rápido. Mudar isso pede um caminho alternativo pronto antes da próxima vez.',
    rigidity: 'O primeiro deslize não é o que custa caro — é o que vem depois dele. Sem trabalhar esse tudo-ou-nada, a próxima quebra de regra tende a puxar o mesmo efeito em cascata de sempre.',
    automaticity: 'Esse tipo de sequência tende a se repetir enquanto as pistas que a disparam continuarem passando despercebidas. Reconhecê-las a tempo é o que muda o ponto em que você entra na decisão.',
    disconnection: 'Quando fome, cansaço e emoção chegam misturados, fica fácil confundir um pelo outro — e essa confusão tende a se repetir até que os sinais fiquem mais nítidos.',
    self_criticism: 'A dureza que vem depois do episódio costuma pesar mais que o episódio em si, e é ela que dificulta o retorno. Sem mudar essa parte, o ciclo de culpa tende a se manter do mesmo tamanho.',
    compensation: 'Compensar um episódio tende a preparar o próximo — é assim que o ciclo se sustenta. Apertar mais não resolveu até aqui, e dificilmente vai resolver sozinho daqui pra frente.',
  };

  var INTERVENTIONS = {
    emotional_relief:{ id:'R05', name:'Dez minutos antes de decidir', format:'Conversa guiada', duration:'2 minutos', description:'Uma intervenção breve para criar espaço entre a urgência e a decisão.' },
    overload:{ id:'O02', name:'Mapa do seu fim de dia', format:'Exercício guiado', duration:'3 minutos', description:'Uma leitura mais próxima do horário em que demandas, cansaço e decisões se acumulam.' },
    rigidity:{ id:'O06', name:'Confirmar o padrão', format:'Conversa guiada', duration:'2 minutos', description:'Uma conversa para testar a hipótese sem transformar uma primeira leitura em verdade.' },
    automaticity:{ id:'O04', name:'Onde acontece', format:'Exercício guiado', duration:'2 minutos', description:'Uma observação das pistas que podem iniciar a sequência antes da percepção.' },
    compensation:{ id:'D03', name:'A próxima refeição normal', format:'Conversa guiada', duration:'2 minutos', description:'Uma intervenção para o ponto em que culpa e tentativa de compensação começam a se alimentar.' },
    self_criticism:{ id:'O06', name:'Confirmar o padrão', format:'Conversa guiada', duration:'2 minutos', description:'Uma conversa para separar o que foi relatado das conclusões duras que aparecem depois.' },
    disconnection:{ id:'O04', name:'Onde acontece', format:'Exercício guiado', duration:'2 minutos', description:'Uma observação das pistas que costumam passar despercebidas na rotina.' },
  };

  function buildArtifact(answers) {
    var signals = buildSignals(answers);
    var connections = buildConnections(answers);
    var ranking = rankedMechanisms(answers);
    var scores = mechanismScores(answers);
    var primary = ranking[0], secondary = ranking[1];
    if (scores.compensation >= 4) primary = 'compensation';
    var total = Object.values(scores).reduce(function (a,b) { return a+b; },0) || 1;
    var confidence = Math.min(.88, Math.max(.45, .42 + (answers.length/MAX_ANSWERS)*.25 + (scores[primary]/total)*.25));
    var byKind = function (kinds) { return signals.filter(function (s) { return kinds.includes(s.kind); }).slice(0,3); };
    var context = byKind(['context','antecedent','body']);
    var movement = byKind(['function','need','behavior','cognition']).slice(0,2);
    var consequence = byKind(['consequence']);
    var response = byKind(['response']);
    var nodes = [
      { id:'reported', label:'Você relatou principalmente', items:context.map(function(s){return s.label;}) },
      { id:'movement', label:'O movimento que pode vir depois', items:movement.map(function(s){return s.label;}) },
      { id:'after', label:'O que costuma ficar', items:consequence.map(function(s){return s.label;}) },
      { id:'maintenance', label:'O que pode manter a repetição', items:response.map(function(s){return s.label;}) },
    ].filter(function (n) { return n.items.length; });
    var intervention = INTERVENTIONS[primary] || INTERVENTIONS[secondary] || INTERVENTIONS.automaticity;
    return {
      map_version:VERSION,
      answers:answerDetails(answers).map(function (d) { return { question_id:d.question.id, question:d.question.prompt, option_id:d.option.id, answer:d.option.label }; }),
      signals:signals,
      connections:connections,
      primary_mechanism:primary,
      secondary_mechanism:secondary,
      confidence:Number(confidence.toFixed(2)),
      possible_cycle:nodes,
      recommended_intervention_id:intervention.id,
      recommended_intervention_name:intervention.name,
      recommended_intervention_format:intervention.format,
      recommended_intervention_duration:intervention.duration,
      recommended_intervention_reason:intervention.description,
      branch:currentBranch(answers),
      next_question_reason:nextDecision(answers).reason,
    };
  }

  function buildNarrative(answers) {
    var artifact = buildArtifact(answers);
    var details = answerDetails(answers);
    function pick(index, fallback) { return details[index] ? details[index].option.reflection : fallback; }
    var connections = artifact.connections;
    // Regra de tom: a honestidade fica CONCENTRADA (intro diz "não é
    // diagnóstico", hipótese diz "hipótese", fechamento explica o porquê).
    // Os pontos em si afirmam o que as respostas mostraram — sem cada frase
    // se retratar no final, o que diluía a leitura inteira.
    var points = [
      { number:'01', title:'A cena em que isso começa', text:'Você contou que ' + pick(0,'o contexto ainda precisa ser observado') + '. É ali que vale olhar primeiro: não pro prato, pra cena.' },
      { number:'02', title:'O movimento que aparece junto', text:'Também apareceu que ' + pick(1,'o primeiro movimento ainda não está claro') + '. ' + (connections[0] ? connections[0].summary : 'Essas duas partes parecem se encontrar sempre no mesmo ponto.') },
      { number:'03', title:'O que pode manter a repetição', text:(connections[2]
        ? connections[2].summary
        : 'No fechamento, apareceu que ' + pick(6,'o depois ainda merece atenção') + '.') + ' Esse é o elo que costuma passar despercebido, e é onde uma mudança pequena rende mais.' },
    ];
    var reading = MECHANISM_READINGS[artifact.primary_mechanism] || MECHANISMS[artifact.primary_mechanism].label + ' parece participar da repetição.';
    return {
      intro:'Este mapa foi montado com as suas respostas. Não é um diagnóstico, é um ponto de partida. Vem ver o que apareceu.',
      points:points,
      hypothesis:'Pelo que você contou, uma hipótese ganhou força: ' + reading + ' O acompanhamento dos momentos reais é o que confirma ou corrige essa leitura.',
      closing:'A leitura para aqui de propósito. Transformar isso em mais uma regra seria repetir o ciclo. O próximo passo não é decidir mais, é observar melhor acompanhada.',
      artifact:artifact,
    };
  }

  return {
    VERSION:VERSION, MAX_ANSWERS:MAX_ANSWERS, QUESTIONS:QUESTIONS, MECHANISMS:MECHANISMS, MICRO_URGENCY:MICRO_URGENCY,
    nextQuestion:nextQuestion, nextDecision:nextDecision, currentBranch:currentBranch,
    buildSignals:buildSignals, buildConnections:buildConnections, mechanismScores:mechanismScores,
    midanswer:midanswer, interpolation:function(a){return midanswer(a).text;},
    buildArtifact:buildArtifact, buildNarrative:buildNarrative,
    buildResult:function(a){var n=buildNarrative(a);return Object.assign({},n.artifact,{eyebrow:'Sua primeira leitura',title:'A LIA começou a conectar o que você contou',summary:n.hypothesis,cycle:n.artifact.possible_cycle.map(function(x){return x.items.join(', ')}),insight:n.closing,nuance:n.intro});},
  };
});
