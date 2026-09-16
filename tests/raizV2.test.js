const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/quiz-raiz-v2.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');
const ads = readFileSync(join(root, 'docs/ads-raiz-v2-batch-01.md'), 'utf8');

test('raiz-v2 tem rota própria e checkout dedicado', () => {
  assert.match(server, /app\.get\('\/raiz-v2'/);
  assert.match(html, /https:\/\/pay\.cakto\.com\.br\/ai223ee/);
});

test('radar usa as seis dimensões oficiais do prontuário', () => {
  for (const label of [
    'Relação com o corpo', 'Relação com a comida', 'Recursos biopsicossociais',
    'Conhecimento alimentar', 'Consciência e presença', 'Adaptabilidade',
  ]) assert.match(html, new RegExp(label));
  assert.equal((html.match(/tag:'[1-9] ·/g) || []).length, 9);
});

test('mantém Pixel e CAPI com a jornada completa', () => {
  for (const event of ['PageView', 'ViewContent', 'QuizStart', 'Lead', 'CompleteRegistration', 'OfferView', 'InitiateCheckout']) {
    assert.match(html, new RegExp(event));
  }
  assert.match(html, /slug:'raiz-v2'/);
  assert.match(html, /source:'raiz-v2'/);
});

test('v2 não dispara dossiê, SDR ou sequência pós-quiz', () => {
  assert.doesNotMatch(html, /hook\.us2\.make\.com/);
  assert.match(server, /CompleteRegistration' && req\.body\.slug !== 'raiz-v2'/);
  assert.match(html, /não será enviado por WhatsApp/);
});

test('resultado mantém interpolação de nome, estágio e pilares', () => {
  assert.match(html, /lead\.name\.split/);
  assert.match(html, /stageText\[stage\]/);
  assert.match(html, /DIMS\[low\]/);
  assert.match(html, /DIMS\[high\]/);
});

test('documento entrega matriz, doze roteiros e priorização 1A/1B', () => {
  assert.equal((ads.match(/^### [ABC][1-4] —/gm) || []).length, 12);
  assert.match(ads, /Batch 1A/);
  assert.match(ads, /Batch 1B/);
  assert.match(ads, /O que ele nos ensina|se performar, ensina/i);
});
