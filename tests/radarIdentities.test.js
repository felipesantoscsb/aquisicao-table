const test = require('node:test');
const assert = require('node:assert/strict');
const RadarIdentity = require('../public/js/radar-identities');

const score = (body, food, resources, knowledge, awareness, adaptability) =>
  ({ body, food, resources, knowledge, awareness, adaptability });

test('recusa Radar incompleto ou com notas que o quiz não produz', () => {
  assert.throws(() => RadarIdentity.classify(score(1, 2, 3, 4, 5, 1)), /pontuação inválida/);
  assert.throws(() => RadarIdentity.classify({ body: 1 }), /pontuação inválida/);
});

test('gráficos equilibrados não recebem um falso ponto dominante', () => {
  assert.equal(RadarIdentity.classify(score(4, 5, 4, 5, 4, 5)).key, 'base');
  assert.equal(RadarIdentity.classify(score(1, 2, 1, 2, 1, 2)).key, 'all_effort');
});

test('assimetria dentro do domínio produz identidades contrastantes', () => {
  assert.equal(RadarIdentity.classify(score(1, 5, 5, 5, 5, 5), { relation: 'body' }).key, 'mirror');
  assert.equal(RadarIdentity.classify(score(5, 1, 5, 5, 5, 5), { relation: 'food' }).key, 'bill');
  assert.equal(RadarIdentity.classify(score(5, 5, 5, 5, 1, 5), { compass: 'head' }).key, 'head');
  assert.equal(RadarIdentity.classify(score(5, 5, 5, 1, 5, 5), { compass: 'distrust' }).key, 'distrust');
  assert.equal(RadarIdentity.classify(score(5, 5, 1, 5, 5, 5), { sustain: 'alone' }).key, 'alone');
  assert.equal(RadarIdentity.classify(score(5, 5, 5, 5, 5, 1), { sustain: 'perfect' }).key, 'perfect');
});

test('empates entre domínios preservam híbridos e extremos compensados', () => {
  assert.equal(RadarIdentity.classify(score(1, 2, 1, 5, 5, 2)).key, 'relation_sustain');
  assert.equal(RadarIdentity.classify(score(1, 5, 1, 1, 5, 5)).key, 'tightrope');
});

test('confirmação contraditória torna a leitura acoplada e suave', () => {
  const result = RadarIdentity.classify(score(1, 5, 5, 5, 5, 5), { relation: 'food' });
  assert.equal(result.key, 'war');
  assert.equal(result.confidence, 'soft');
  assert.equal(result.confirmation.conflict, true);
});

test('todas as 4.096 configurações possíveis têm classificação determinística', () => {
  const values = [1, 2, 4, 5];
  let total = 0;
  for (const body of values) for (const food of values) for (const resources of values)
    for (const knowledge of values) for (const awareness of values) for (const adaptability of values) {
      const input = score(body, food, resources, knowledge, awareness, adaptability);
      const first = RadarIdentity.classify(input, {});
      const second = RadarIdentity.classify(input, {});
      assert.ok(RadarIdentity.IDENTITIES[first.key], `identidade ausente: ${first.key}`);
      assert.equal(second.key, first.key);
      assert.deepEqual(second.weakDomains, first.weakDomains);
      total++;
    }
  assert.equal(total, 4096);
});

test('cada link editorial simula exatamente a identidade pedida', () => {
  assert.equal(Object.keys(RadarIdentity.PREVIEW_CASES).length, 15);
  for (const [key, example] of Object.entries(RadarIdentity.PREVIEW_CASES)) {
    assert.equal(RadarIdentity.classify(example.scores, example.confirmations).key, key, key);
  }
});

test('nenhum texto de identidade usa travessao', () => {
  // Regra de comunicacao da Table: travessao denuncia texto gerado. No sdr a
  // limpeza e feita no codigo; aqui o conteudo e estatico, entao e o teste
  // que segura.
  const fonte = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../public/js/radar-identities.js'), 'utf8');
  assert.ok(!/[—–]/.test(fonte), 'travessao ou meia-risca no arquivo de identidades');
});
