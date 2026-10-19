const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const catalogo = JSON.parse(readFileSync(join(root, 'data/primeira-ruptura.json'), 'utf8'));
const quiz = readFileSync(join(root, 'public/quiz-ascensao-table.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

const PILARES = ['body', 'food', 'resources', 'knowledge', 'awareness', 'adaptability'];

test('a espinha tem sete dias na ordem da dramaturgia', () => {
  const etapas = catalogo.dias.map(d => d.etapa);
  assert.deepEqual(etapas, ['Entender', 'Reconhecer', 'Experimentar', 'Observar', 'Preparar', 'Retornar', 'Consolidar']);
  assert.deepEqual(catalogo.dias.map(d => d.n), [1, 2, 3, 4, 5, 6, 7]);
});

test('todo dia resolve para um audio, em qualquer pilar', () => {
  // Pilar sem entrada no dia de troca deixaria a cliente com um dia vazio num
  // entregavel pago, e so apareceria para quem tirasse aquela nota.
  for (const dia of catalogo.dias) {
    if (dia.audio) { assert.ok(catalogo.intervencoes[dia.audio], `dia ${dia.n}: ${dia.audio} sem verbete`); continue; }
    assert.deepEqual(Object.keys(dia.audio_por_pilar).sort(), [...PILARES].sort(), `dia ${dia.n} nao cobre os seis pilares`);
    for (const code of Object.values(dia.audio_por_pilar)) {
      assert.ok(catalogo.intervencoes[code], `dia ${dia.n}: ${code} sem verbete`);
    }
  }
});

test('todo verbete tem arquivo de audio no repo e texto para a cliente', () => {
  for (const [code, iv] of Object.entries(catalogo.intervencoes)) {
    assert.ok(existsSync(join(root, 'public', iv.arquivo)), `${code}: arquivo ausente (${iv.arquivo})`);
    assert.ok(iv.client_content && iv.client_content.trim().length >= 80, `${code}: client_content curto ou ausente`);
    assert.ok(Number(iv.duracao_s) > 0, `${code}: duracao ausente`);
  }
});

test('nenhum audio aponta para o dominio da LIA', () => {
  // yourlia.tech/audio/interventions/*.mp3 responde 404, e o entregavel e pago:
  // nao pode depender do deploy de outro produto.
  const bruto = JSON.stringify(catalogo.intervencoes);
  assert.doesNotMatch(bruto, /yourlia\.tech|https?:\/\//, 'audio deve ser servido pelo proprio aquisicao-table');
});

test('o catalogo curado nao carrega instrucao de agente', () => {
  // O catalogo da LIA e conversacional: agent_intro_instructions e ordem PARA O
  // AGENTE. Renderizar aquilo faz a cliente ler instrucoes sobre ela mesma.
  const bruto = JSON.stringify(catalogo.intervencoes);
  for (const vazamento of ['agent_intro_instructions', 'agent_followup_instructions', 'Entregue este conteúdo']) {
    assert.doesNotMatch(bruto, new RegExp(vazamento, 'i'), `vazou ${vazamento} do catalogo da LIA`);
  }
});

test('o quiz manda as seis notas e o servidor as persiste', () => {
  // Sem isto a venda chega e nao ha de onde montar o mapa: o lead:{id} e
  // gravado no evento de Lead, que acontece antes e sem os scores.
  assert.match(quiz, /pillar_scores:scores/);
  assert.match(server, /ehRadarTable\(req\.body\)/);
  assert.match(server, /`radar:\$\{radarId\}`/);
  assert.match(server, /req\.body\.quiz_lead_event_id \|\| req\.body\.lead_event_id/);
});

test('as notas do Radar nao vao para a Meta', () => {
  // custom_data leva so content_name e content_category. Pontuacao e dado
  // psicologico sensivel.
  assert.doesNotMatch(server, /custom_data\.(pillar_scores|fit_score|lowest_pillar)/);
});


test('R01 e D02 sairam do elenco de vez', () => {
  // Citavam a LIA na propria narracao ("Se a LIA te mandou isso agora" e
  // "Amanha a LIA vai te perguntar como foi") e nao ha regravacao no caminho
  // critico. Decisao de 19/10: fora, nao "regravar depois".
  assert.equal(catalogo.intervencoes.R01, undefined);
  assert.equal(catalogo.intervencoes.D02, undefined);
  // So o que ela LE. _leia_antes e `origem` sao nota interna e citam a LIA de
  // proposito: dizem de onde a peca veio.
  const visivel = [
    ...catalogo.dias.flatMap(d => [d.titulo, d.descricao]),
    ...Object.values(catalogo.intervencoes).flatMap(iv => [iv.nome, iv.client_content]),
    ...Object.values(catalogo.praticas).flatMap(pr => [pr.nome, pr.client_content, pr.campo, pr.placeholder]),
  ];
  for (const txt of visivel) {
    assert.doesNotMatch(String(txt), /\bLIA\b/, `texto visivel para a cliente cita a LIA: "${txt}"`);
  }
});

test('todo dia entrega audio E pratica escrita', () => {
  // Audio sozinho nao gera transformacao em sete dias: a pratica e o que ela
  // faz, e o que ela escreve vira insumo da sessao individual.
  for (const dia of catalogo.dias) {
    assert.ok(dia.audio || dia.audio_por_pilar, `dia ${dia.n} sem audio`);
    assert.ok(dia.pratica, `dia ${dia.n} sem pratica`);
    assert.ok(catalogo.praticas[dia.pratica], `dia ${dia.n}: pratica ${dia.pratica} sem verbete`);
  }
  assert.equal(new Set(catalogo.dias.map(d => d.pratica)).size, 7, 'pratica repetida entre dias');
});

test('toda pratica pede algo escrito, com rotulo e exemplo', () => {
  for (const [code, pr] of Object.entries(catalogo.praticas)) {
    assert.ok(pr.client_content.trim().length >= 120, `${code}: instrucao curta demais`);
    assert.ok(pr.campo && pr.campo.length > 5, `${code}: sem rotulo de campo`);
    assert.ok(pr.placeholder, `${code}: sem exemplo no campo`);
    assert.ok(['texto', 'exercicio'].includes(pr.tipo), `${code}: tipo invalido`);
  }
});

test('nenhuma pratica cobra resposta a um agente', () => {
  // Os roteiros foram escritos para a LIA empurrar e cobrar no dia seguinte.
  // Aqui e pull: ela escreve na pagina e a nutri le antes da sessao.
  for (const [code, pr] of Object.entries(catalogo.praticas)) {
    assert.doesNotMatch(pr.client_content, /me conta|me responde|manda em áudio|eu te devolvo/i,
      `${code}: sobrou linguagem de conversa com agente`);
  }
});

test('os quinze audios limpos entram todos no elenco', () => {
  const usados = new Set();
  for (const dia of catalogo.dias) {
    if (dia.audio) usados.add(dia.audio);
    else Object.values(dia.audio_por_pilar).forEach(c => usados.add(c));
  }
  assert.equal(usados.size, 15);
  assert.deepEqual([...usados].sort(), Object.keys(catalogo.intervencoes).sort());
});
