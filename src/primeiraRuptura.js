// Monta o mapa de 7 dias da Primeira Ruptura a partir das notas do Radar.
//
// O catalogo (data/primeira-ruptura.json) e a espinha: 7 dias na ordem da
// dramaturgia, cada um com um audio e uma pratica escrita. Dois dias (2 e 4)
// trocam o audio conforme o pilar mais fraco da cliente — e e so isso que
// personaliza. O resto e igual para todas, de proposito: a dramaturgia dos
// sete dias nao muda, o que muda e onde ela aperta.
//
// Tudo aqui e funcao pura. A unica dependencia e o JSON, para que o teste
// possa montar mapas de notas inventadas sem subir servidor nem Redis.

const CATALOGO = require('../data/primeira-ruptura.json');

// Ordem fixa. Vale como desempate: com notas empatadas no fundo, o pilar que
// vem primeiro aqui ganha. Sem isso o mapa da mesma cliente mudaria entre duas
// aberturas, e ela veria conteudo diferente sem ter feito nada.
const PILARES = ['body', 'food', 'resources', 'knowledge', 'awareness', 'adaptability'];

// Copiados do /raiz-radar de proposito. Ela acabou de ler estes nomes e estes
// estados no resultado do quiz; inventar vocabulario novo aqui faria o mapa
// parecer outro produto e quebraria o fio da metodologia.
const DIMS = {
  body: 'Relação com o corpo',
  food: 'Relação com a comida',
  resources: 'Recursos na vida real',
  knowledge: 'Conhecimento alimentar',
  awareness: 'Consciência e presença',
  adaptability: 'Adaptabilidade',
};

// Rotulo curto, so para as pontas do grafico: o nome inteiro nao cabe num
// hexagono em tela de celular.
const CURTO = {
  body: 'Corpo', food: 'Comida', resources: 'Recursos',
  knowledge: 'Conhecimento', awareness: 'Presença', adaptability: 'Adaptação',
};

const NOTA_MAX = 5;

/**
 * Mesma escada do /raiz-radar, inclusive onde ela e estranha: 3 cai no mesmo
 * rotulo que 5. Esta copiado assim de proposito — divergir faria o mapa
 * contradizer o resultado que ela leu minutos antes. Se for corrigido la,
 * corrigir aqui junto.
 */
function estadoDoPilar(v) {
  return v === 1 ? 'pede muito recurso'
    : v === 2 ? 'pede recurso'
    : v === 4 ? 'recurso disponível'
    : 'recurso forte';
}

/**
 * O pilar em que ela esta pior. E ele que escolhe o audio dos dias 2 e 4.
 *
 * Nota ausente ou nao numerica e IGNORADA, nao tratada como zero: pilar sem
 * resposta viraria "o mais fraco" e roubaria o foco do mapa.
 */
function pilarMaisFraco(scores = {}) {
  let escolhido = null;
  let menor = Infinity;
  for (const p of PILARES) {
    const bruto = scores[p];
    // `Number(null)` e `Number('')` dao 0, que passa no isFinite — e zero ganha
    // de qualquer nota real. Por isso o descarte vem ANTES da conversao.
    if (bruto === null || bruto === undefined || bruto === '') continue;
    const n = Number(bruto);
    if (!Number.isFinite(n)) continue;
    if (n < menor) { menor = n; escolhido = p; }
  }
  // Sem nenhuma nota legivel, o mapa ainda tem de existir. `body` e o primeiro
  // da ordem canonica, e os dias 2 e 4 cobrem os seis pilares, entao nao ha
  // dia vazio. Quem chamou decide se avisa.
  return escolhido || PILARES[0];
}

/** Resolve o codigo do audio do dia, fixo ou por pilar. */
function audioDoDia(dia, pilar) {
  return dia.audio || (dia.audio_por_pilar || {})[pilar] || null;
}

/**
 * Mapa pronto para renderizar. Devolve o conteudo que ELA le (`client_content`),
 * nunca instrucao de agente — essa e a diferenca entre este catalogo e o da LIA,
 * e esta escrita no `_leia_antes` do JSON.
 */
function montarMapa({ nome = null, scores = {} } = {}) {
  const pilar = pilarMaisFraco(scores);

  const dias = CATALOGO.dias.map(dia => {
    const codAudio = audioDoDia(dia, pilar);
    const iv = codAudio ? CATALOGO.intervencoes[codAudio] : null;
    const pr = dia.pratica ? CATALOGO.praticas[dia.pratica] : null;

    return {
      n:         dia.n,
      etapa:     dia.etapa,
      titulo:    dia.titulo,
      descricao: dia.descricao,
      // `personalizado` diz se ESTE dia mudou por causa das notas dela. A pagina
      // usa para marcar o dia; sem isso a personalizacao fica invisivel e a
      // cliente nao tem como perceber que o mapa e dela.
      personalizado: Boolean(dia.audio_por_pilar),
      audio: iv ? {
        codigo:    codAudio,
        nome:      iv.nome,
        arquivo:   iv.arquivo,
        duracao_s: Number(iv.duracao_s) || null,
        texto:     iv.client_content,
      } : null,
      pratica: pr ? {
        codigo:      dia.pratica,
        nome:        pr.nome,
        texto:       pr.client_content,
        campo:       pr.campo,
        placeholder: pr.placeholder || '',
      } : null,
    };
  });

  // As seis notas, na ordem canonica — e essa ordem que desenha o hexagono.
  // Nota ausente vira null e NAO zero: o grafico precisa saber a diferenca
  // entre "ela tirou zero" e "nao temos essa resposta".
  const pilares = PILARES.map(p => {
    const bruto = scores[p];
    const nota = (bruto === null || bruto === undefined || bruto === '' || !Number.isFinite(Number(bruto)))
      ? null : Number(bruto);
    return {
      chave:  p,
      nome:   DIMS[p],
      curto:  CURTO[p],
      nota,
      estado: nota === null ? null : estadoDoPilar(nota),
      foco:   p === pilar,
    };
  });

  return {
    nome,
    pilar_foco: pilar,
    pilar_foco_nome: DIMS[pilar],
    nota_max: NOTA_MAX,
    pilares,
    // Do mais apertado para o mais folgado: e nessa ordem que a leitura faz
    // sentido, porque o mapa inteiro foi montado a partir do primeiro.
    ranking: pilares.filter(p => p.nota !== null).sort((a, b) => a.nota - b.nota).map(p => p.chave),
    dias,
  };
}

/**
 * Notas de exemplo para a rota de revisao. Deixa `resources` no fundo para que
 * os dias 2 e 4 caiam num audio que existe e a estrutura apareca inteira.
 */
const SCORES_DEMO = { body: 3, food: 2, resources: 1, knowledge: 3, awareness: 2, adaptability: 3 };

module.exports = { montarMapa, pilarMaisFraco, audioDoDia, estadoDoPilar, PILARES, DIMS, CURTO, NOTA_MAX, SCORES_DEMO, CATALOGO };
