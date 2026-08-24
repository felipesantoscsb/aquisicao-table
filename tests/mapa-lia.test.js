const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = require('../public/js/mapa-lia-engine.js');

test('começa pelas três perguntas-base na ordem prevista', () => {
  const answers = [];
  assert.equal(engine.nextQuestion(answers).id, 'moment');
  answers.push({ question_id: 'moment', option_id: 'emotion' });
  assert.equal(engine.nextQuestion(answers).id, 'first_move');
  answers.push({ question_id: 'first_move', option_id: 'relief' });
  assert.equal(engine.nextQuestion(answers).id, 'aftermath');
});

test('aprofunda o sinal predominante sem exigir respostas opcionais', () => {
  const answers = [
    { question_id: 'moment', option_id: 'emotion' },
    { question_id: 'first_move', option_id: 'relief' },
    { question_id: 'aftermath', option_id: 'repeat' },
  ];
  assert.equal(engine.nextQuestion(answers).id, 'soothing_detail');
  const result = engine.buildResult(answers);
  assert.equal(result.primary_axis, 'soothing');
  assert.match(result.summary, /uma hipótese/i);
});

test('encerra com no máximo nove escolhas', () => {
  const answers = [];
  while (answers.length < 9) {
    const question = engine.nextQuestion(answers);
    assert.ok(question, `pergunta ${answers.length + 1} deveria existir`);
    answers.push({ question_id: question.id, option_id: question.options[0].id });
  }
  assert.equal(engine.nextQuestion(answers), null);
  assert.equal(new Set(answers.map(a => a.question_id)).size, 9);
});

test('resultado sempre explicita hipótese e ciclo completo', () => {
  const result = engine.buildResult([
    { question_id: 'moment', option_id: 'offplan' },
    { question_id: 'first_move', option_id: 'giveup' },
    { question_id: 'aftermath', option_id: 'compensate' },
  ]);
  assert.equal(result.cycle.length, 4);
  assert.match(result.eyebrow, /hipótese/i);
  assert.doesNotMatch(result.summary, /diagn[oó]stico/i);
});

test('página e API são isoladas do perfil e das automações do Raiz', () => {
  const server = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../public/mapa-lia.html'), 'utf8');
  assert.match(server, /app\.get\('\/mapa-lia'/);
  assert.match(server, /process\.env\.LIA_PIXEL_ID/);
  assert.doesNotMatch(html, /\/api\/capi(?:['"/])/);
  assert.doesNotMatch(html, /quiz:perfil|SDR|recovery:pending/);
  assert.match(html, /hipótese de reflexão, não um diagnóstico/i);
});
