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

test('primeira pergunta contextualiza medicação sem presumir tratamento', () => {
  assert.match(html, /Se mais de uma servir, escolha a que mais pesa hoje/);
  assert.doesNotMatch(html, /Você não precisa dizer qual medicamento usa/);
  assert.match(html, /'stopped_other'/);
  assert.match(html, /Parei, e nenhuma dessas mudanças me preocupa hoje/);
});

test('resultado fica oculto até a conclusão e a VSL está configurada', () => {
  assert.match(html, /\.page\.result\{display:none/);
  assert.match(html, /\.page\.result\.active\{display:block/);
  assert.match(html, /const VSL_MEDIA_ID\s*=\s*'vjen9pjw56'/);
  assert.match(html, /wistia-player/);
});

test('tipografia de destaque evita a família anterior com f estilizado', () => {
  assert.match(html, /family=Lora/);
  assert.doesNotMatch(html, /Fraunces/);
});

test('documento entrega matriz, doze roteiros e priorização 1A/1B', () => {
  assert.equal((ads.match(/^### [ABC][1-4] —/gm) || []).length, 12);
  assert.match(ads, /Batch 1A/);
  assert.match(ads, /Batch 1B/);
  assert.match(ads, /O que ele nos ensina|se performar, ensina/i);
});

test('a V2 usa pixel próprio e não referencia mais o principal', () => {
  // A V2 roda na conta de anúncios da LIA. Se o pixel principal voltar a
  // aparecer aqui, o sinal dos dois funis se mistura de novo em silêncio.
  assert.doesNotMatch(html, /989971718548782/);
  assert.match(html, /var PIXEL_V2='519946826343805'/);
  assert.match(html, /fbq\('init',PIXEL_V2\)/);
  // Advanced matching e noscript precisam apontar para o mesmo pixel.
  assert.match(html, /fbq\('init',PIXEL_V2,\{em:email/);
  assert.match(html, /facebook\.com\/tr\?id=519946826343805/);
});

test('o CAPI da V2 nunca cai no token do pixel principal', () => {
  assert.match(server, /const PIXEL_RAIZ_V2 = '519946826343805'/);
  assert.match(server, /function ehRaizV2/);
  // Sem o token próprio o evento é PULADO, não redirecionado.
  assert.match(server, /raiz_v2_capi_token_ausente/);
  assert.match(server, /RAIZ_V2_CAPI_TOKEN/);
});

test('ehRaizV2 reconhece o funil por slug, source e content_name', () => {
  // Reproduz a heurística do servidor para travar o contrato dos três campos
  // que as chamadas da página realmente mandam.
  const ehRaizV2 = (body = {}) => [body.slug, body.source, body.content_name, body.funnel]
    .some(v => /raiz-v2/i.test(String(v || '')));
  assert.equal(ehRaizV2({ slug: 'raiz-v2' }), true);                        // CompleteRegistration
  assert.equal(ehRaizV2({ source: 'raiz-v2' }), true);                      // InitiateCheckout
  assert.equal(ehRaizV2({ content_name: 'quiz-lead-raiz-v2' }), true);      // Lead
  assert.equal(ehRaizV2({ slug: 'raiz' }), false);
  assert.equal(ehRaizV2({ content_name: 'InitiateCheckout_Raiz' }), false);
  assert.equal(ehRaizV2({}), false);
});
