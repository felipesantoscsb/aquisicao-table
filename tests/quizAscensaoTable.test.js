const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/quiz-ascensao-table.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

test('raiz-radar usa o novo quiz e raiz-v2 preserva o fluxo anterior', () => {
  assert.match(server, /app\.get\('\/raiz-radar'.*'quiz-ascensao-table\.html'/);
  assert.match(server, /app\.get\('\/raiz-v2'.*'quiz-raiz-v2\.html'/);
});

test('quiz mede seis pilares e separa qualificação de leitura educativa', () => {
  for (const label of ['Relação com o corpo','Relação com a comida','Recursos na vida real','Conhecimento alimentar','Consciência e presença','Adaptabilidade']) {
    assert.match(html, new RegExp(label));
  }
  assert.equal((html.match(/dim:'/g) || []).length, 6);
  assert.equal((html.match(/fit:true/g) || []).length, 4);
  assert.equal((html.match(/ready:true/g) || []).length, 2);
});

test('roteamento tem A, B e C com a rota C mais longa', () => {
  assert.match(html, /fitScore>=7&&readinessScore>=4\?'A':fitScore>=5\?'B':'C'/);
  assert.match(html, /id="routeA"/);
  assert.match(html, /id="routeBC"/);
  assert.match(html, /class="band paper education-band education-only"/);
  assert.match(html, /\.route-c \.education-only\{display:block\}/);
  assert.match(html, /\.route-b \.education-band\{display:none\}/);
});

test('rota A solicita pré-consulta gratuita e envia ao SDR só no clique', () => {
  assert.match(html, /pré-consulta gratuita/);
  assert.match(html, /id="preconsult"/);
  assert.match(html, /fetch\('\/api\/captacao\/conversa'/);
  assert.match(html, /source:'radar_table_rota_a'/);
  assert.match(html, /autonomia, acompanhamento Table ou outro cuidado/);
});

test('tracking identifica a rota publicada sem misturar pixels', () => {
  assert.match(html, /slug:'raiz-radar'/);
  assert.match(html, /source:'raiz-radar'/);
  assert.match(server, /raiz-v2\|raiz-radar\|radar-table/);
  assert.match(server, /CompleteRegistration' && ehRaizV2\(req\.body\)/);
});

test('rotas B e C oferecem A Primeira Ruptura por R$ 97', () => {
  assert.match(html, /A Primeira Ruptura/);
  assert.match(html, /R\$ 97/);
  assert.match(html, /https:\/\/pay\.cakto\.com\.br\/ai223ee/);
  assert.match(html, /Mapa HTML personalizado/);
  assert.match(html, /Caminho prático de 7 dias/);
});

test('segmentos sensíveis não entram nos eventos Meta', () => {
  const routeEvent = html.match(/trackCustom\('RouteResultViewed'[^\n]+/)[0];
  assert.doesNotMatch(routeEvent, /fitScore|readinessScore|scores|low|high/);
  const checkoutPixel = html.match(/fbq\('track','InitiateCheckout'[^;]+/)[0];
  assert.doesNotMatch(checkoutPixel, /route|fitScore|readinessScore|scores/);
});

test('rota e scores seguem apenas para mensuração interna no Hub', () => {
  const hub = readFileSync(join(root, 'src/hubSync.js'), 'utf8');
  for (const field of ['commercial_route','fit_score','readiness_score','lowest_pillar','highest_pillar']) {
    assert.match(hub, new RegExp(field));
  }
  const capiExtraction = server.slice(server.indexOf("app.post('/api/capi'"), server.indexOf("app.post('/api/capi/initiate-checkout'"));
  assert.match(capiExtraction, /profileName, scores,[\s\S]*são ignorados intencionalmente/);
});
