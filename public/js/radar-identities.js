(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RadarIdentity = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const PILLARS = ['body', 'food', 'resources', 'knowledge', 'awareness', 'adaptability'];
  const DOMAINS = {
    relation: ['body', 'food'],
    compass: ['knowledge', 'awareness'],
    sustain: ['resources', 'adaptability'],
  };
  const DOMAIN_LABELS = {
    relation: 'relação consigo e com a comida',
    compass: 'bússola interna',
    sustain: 'sustentação na vida real',
  };

  const IDENTITIES = {
    mirror: {
      name: 'O Espelho no Comando',
      summary: 'A relação com o corpo muda o tom da conversa antes mesmo de a comida entrar em cena.',
      mechanism: 'Quando o corpo vira medida de valor, uma frustração pequena pode assumir o comando do resto do dia.',
      rupture: 'tirar do espelho o poder de decidir como o restante do dia termina',
    },
    bill: {
      name: 'A Conta Depois do Prato',
      summary: 'O que pesa não termina quando a refeição acaba: volta como culpa, compensação ou sensação de fracasso.',
      mechanism: 'A comida deixa de ser apenas comida e vira uma prova que precisa ser paga depois.',
      rupture: 'interromper a conta que aparece depois de comer e transforma uma escolha em desistência',
    },
    war: {
      name: 'A Guerra que Continua',
      summary: 'Corpo e comida entraram na mesma disputa, e cada tentativa de controle tende a alimentar a próxima cobrança.',
      mechanism: 'Quando se sentir mal com o corpo aperta as regras, e quebrar a regra piora a relação com o corpo, o ciclo se fecha sobre si mesmo.',
      rupture: 'criar uma resposta que não transforme desconforto em mais guerra com o corpo ou com a comida',
    },
    head: {
      name: 'A Cabeça na Frente',
      summary: 'Você tem informação, mas os sinais do corpo chegam tarde demais à decisão.',
      mechanism: 'A cabeça sabe o caminho; o problema é que fome, satisfação e limite só entram na conversa quando o automático já assumiu.',
      rupture: 'diminuir a distância entre saber e perceber, antes que o automático escolha por você',
    },
    distrust: {
      name: 'Sente, mas Não Confia',
      summary: 'Os sinais aparecem, mas parecem insuficientes sem uma regra externa dizendo o que fazer.',
      mechanism: 'Perceber o corpo não vira autonomia quando toda sensação ainda precisa ser validada por uma regra.',
      rupture: 'transformar percepção em uma escolha confiável, sem precisar terceirizar cada decisão',
    },
    compass: {
      name: 'Sem Bússola Própria',
      summary: 'Informação e percepção ainda não formam uma direção segura para a vida real.',
      mechanism: 'Sem uma referência interna disponível, qualquer nova regra parece solução — até o dia em que ela deixa de caber.',
      rupture: 'construir uma referência interna pequena o bastante para ser usada na hora da decisão',
    },
    alone: {
      name: 'Carregando Tudo Sozinha',
      summary: 'Você até encontra formas de se adaptar, mas quase toda sustentação depende de você dar conta.',
      mechanism: 'Jogo de cintura sem apoio vira sobrecarga: funciona por algum tempo, mas cobra caro quando a energia acaba.',
      rupture: 'parar de fazer a mudança depender exclusivamente da sua capacidade de aguentar mais',
    },
    perfect: {
      name: 'O Dia Perfeito',
      summary: 'Existe estrutura quando a semana coopera; o ciclo reaparece quando a vida muda o combinado.',
      mechanism: 'A mudança funciona como plano, mas ainda não aprendeu a sobreviver ao imprevisto sem virar tudo ou nada.',
      rupture: 'ensaiar uma continuação possível justamente no dia em que o plano deixa de caber',
    },
    margin: {
      name: 'A Vida sem Margem',
      summary: 'Falta espaço para cuidar de você e também flexibilidade para continuar quando algo sai do lugar.',
      mechanism: 'Quando rotina e adaptação falham juntas, qualquer mudança exige uma energia que a vida já consumiu.',
      rupture: 'abrir uma margem mínima de cuidado que sobreviva ao cansaço e ao imprevisto',
    },
    relation_compass: {
      name: 'A Cobrança Desliga a Escuta',
      summary: 'A forma como você se cobra e a dificuldade de confiar nos próprios sinais parecem caminhar juntas.',
      mechanism: 'Quanto mais a cobrança aumenta, menos espaço sobra para perceber o que o corpo realmente está pedindo.',
      rupture: 'reduzir a cobrança o suficiente para que os sinais voltem a participar da escolha',
    },
    relation_sustain: {
      name: 'A Vida Aperta, a Culpa Assume',
      summary: 'A rotina perde margem e a relação com corpo e comida transforma essa dificuldade em falha pessoal.',
      mechanism: 'O contexto aperta primeiro; a culpa chega depois e conta a história como se tudo fosse falta de disciplina.',
      rupture: 'separar o que é limite da vida real da culpa que faz você recomeçar se punindo',
    },
    compass_sustain: {
      name: 'Sem Espaço para se Escutar',
      summary: 'A vida exige resposta rápida demais para que conhecimento e percepção consigam orientar a escolha.',
      mechanism: 'Não é apenas não saber ou não perceber: falta margem para usar o que já existe dentro de você.',
      rupture: 'criar um intervalo utilizável entre o que acontece e a resposta automática',
    },
    tightrope: {
      name: 'A Corda Esticada',
      summary: 'Seu Radar parece equilibrado na soma, mas esse equilíbrio depende de forças muito opostas se compensando.',
      mechanism: 'Não existe um único ponto frágil: recursos fortes estão sustentando partes que pedem muito esforço.',
      rupture: 'diminuir a distância entre o que já funciona e o que ainda desaba sob pressão',
    },
    all_effort: {
      name: 'Tudo Pede Esforço',
      summary: 'Seu Radar não aponta um único gargalo porque vários pilares estão pedindo recurso ao mesmo tempo.',
      mechanism: 'Quando tudo custa energia, escolher uma ruptura pequena é mais honesto do que exigir uma transformação completa.',
      rupture: 'produzir uma primeira evidência de mudança sem tentar consertar tudo de uma vez',
    },
    base: {
      name: 'A Base Disponível',
      summary: 'Não apareceu uma fragilidade dominante: existem recursos distribuídos que podem ser organizados a seu favor.',
      mechanism: 'O próximo avanço depende menos de corrigir um ponto quebrado e mais de tornar consistente o que já funciona.',
      rupture: 'transformar recursos que já existem em uma prática que continue disponível na semana difícil',
    },
  };

  function sumDomain(scores, domain) {
    return DOMAINS[domain].reduce((total, pillar) => total + Number(scores[pillar]), 0);
  }

  function subtypeFor(domain, scores) {
    if (domain === 'relation') {
      if (scores.body <= scores.food - 2) return 'mirror';
      if (scores.food <= scores.body - 2) return 'bill';
      return 'war';
    }
    if (domain === 'compass') {
      if (scores.knowledge >= scores.awareness + 2) return 'head';
      if (scores.awareness >= scores.knowledge + 2) return 'distrust';
      return 'compass';
    }
    if (scores.adaptability >= scores.resources + 2) return 'alone';
    if (scores.resources >= scores.adaptability + 2) return 'perfect';
    return 'margin';
  }

  const CONFIRM_MAP = {
    relation: { body: 'mirror', food: 'bill', both: 'war' },
    compass: { head: 'head', distrust: 'distrust', both: 'compass' },
    sustain: { alone: 'alone', perfect: 'perfect', both: 'margin' },
  };

  function confirmedSubtype(domain, numericSubtype, confirmations) {
    const answer = confirmations && confirmations[domain];
    const direct = CONFIRM_MAP[domain][answer];
    if (!direct) return { key: numericSubtype, matched: false, conflict: false, usedTieBreak: false };
    if (direct === numericSubtype) return { key: numericSubtype, matched: true, conflict: false, usedTieBreak: false };
    const coupled = domain === 'relation' ? 'war' : domain === 'compass' ? 'compass' : 'margin';
    if (numericSubtype === coupled) return { key: direct, matched: false, conflict: false, usedTieBreak: true };
    return { key: coupled, matched: false, conflict: true, usedTieBreak: false };
  }

  function classify(scores, confirmations) {
    for (const pillar of PILLARS) {
      if (![1, 2, 4, 5].includes(Number(scores && scores[pillar]))) {
        throw new Error('Radar incompleto ou com pontuação inválida');
      }
    }
    const values = PILLARS.map(pillar => Number(scores[pillar]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const lowCount = values.filter(value => value <= 2).length;
    const domainScores = Object.fromEntries(Object.keys(DOMAINS).map(domain => [domain, sumDomain(scores, domain)]));
    const ordered = Object.entries(domainScores).sort((a, b) => a[1] - b[1]);
    const minDomainScore = ordered[0][1];
    const weakDomains = ordered.filter(([, value]) => value === minDomainScore).map(([domain]) => domain);
    const maxDomainScore = ordered[ordered.length - 1][1];
    const strongDomains = ordered.filter(([, value]) => value === maxDomainScore).map(([domain]) => domain);
    const domainGap = ordered[1][1] - ordered[0][1];
    let key;
    let confirmation = { matched: false, conflict: false, usedTieBreak: false };

    if (max - min <= 1) {
      key = min >= 4 ? 'base' : 'all_effort';
    } else if (weakDomains.length === 3) {
      key = 'tightrope';
    } else if (weakDomains.length === 2) {
      const pair = weakDomains.slice().sort().join('+');
      key = {
        'compass+relation': 'relation_compass',
        'relation+sustain': 'relation_sustain',
        'compass+sustain': 'compass_sustain',
      }[pair];
    } else {
      const domain = weakDomains[0];
      confirmation = confirmedSubtype(domain, subtypeFor(domain, scores), confirmations || {});
      key = confirmation.key;
    }

    let confidence = 'hybrid';
    if (key === 'base' || key === 'all_effort') confidence = 'balanced';
    else if (key === 'tightrope' || weakDomains.length > 1) confidence = 'hybrid';
    else if (confirmation.conflict || domainGap === 1 || confirmation.usedTieBreak) confidence = 'soft';
    else if (domainGap >= 2 && confirmation.matched) confidence = 'confirmed';
    else if (domainGap >= 2) confidence = 'clear';

    const modifier = lowCount === 0 ? 'com uma base distribuída'
      : lowCount === 1 ? 'concentrado em um ponto'
        : lowCount === 2 ? 'em duas frentes'
          : lowCount <= 4 ? 'espalhado pela rotina'
            : 'com pouco espaço de recuperação';
    const confidenceText = {
      confirmed: 'Leitura confirmada pelo desenho e pelas suas respostas de confirmação.',
      clear: 'O desenho mostra um padrão predominante, sem tratar isso como diagnóstico.',
      soft: 'Esta é uma tendência do seu Radar, não um rótulo definitivo.',
      hybrid: 'Mais de um movimento apareceu; por isso a leitura preserva a combinação.',
      balanced: 'Não há um único ponto dominante — e o resultado não força um desempate.',
    }[confidence];

    const strongText = strongDomains.length === 1
      ? `Seu recurso mais disponível está em ${DOMAIN_LABELS[strongDomains[0]]}.`
      : 'Você tem mais de uma fonte de recurso disponível; não seria honesto escolher apenas uma.';
    const weakPillars = key === 'base' ? []
      : [...new Set(weakDomains.flatMap(domain => DOMAINS[domain]))];

    return {
      key,
      ...IDENTITIES[key],
      confidence,
      confidenceText,
      modifier,
      domainScores,
      domainGap,
      weakDomains,
      strongDomains,
      weakPillars,
      strongText,
      lowCount,
      confirmation,
    };
  }

  return { classify, IDENTITIES, DOMAINS, PILLARS };
});
