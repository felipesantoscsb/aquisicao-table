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

test('os dois audios com LIA na narracao estao marcados para regravar', () => {
  // Conferido roteiro a roteiro em LIA-roteiros.pdf: 15 dos 17 entram como
  // estao, porque o brief mandava o audio nunca se apresentar (quem
  // apresentava era a LIA). R01 abre citando a LIA e D02 fecha prometendo um
  // follow-up de 24h que aqui nao existe — sao resquicios do modelo push.
  assert.ok(catalogo.intervencoes.R01.regravar, 'R01 cita a LIA na primeira frase');
  assert.ok(catalogo.intervencoes.D02.regravar, 'D02 promete follow-up da LIA na ultima frase');
  const limpos = Object.entries(catalogo.intervencoes).filter(([, iv]) => !iv.regravar);
  assert.equal(limpos.length, 15);
});

test('nada marcado para regravar entra num dia universal sem alternativa', () => {
  // R01 e o dia 3, que toda compradora ouve. Enquanto nao for regravado, isso
  // precisa estar visivel — nao pode ir ao ar por esquecimento.
  const universaisPendentes = catalogo.dias
    .filter(d => d.audio && catalogo.intervencoes[d.audio].regravar)
    .map(d => `dia ${d.n} (${d.audio})`);
  assert.deepEqual(universaisPendentes, ['dia 3 (R01)'],
    'mudou o elenco: revisar quais pendencias atingem todas as compradoras');
});
