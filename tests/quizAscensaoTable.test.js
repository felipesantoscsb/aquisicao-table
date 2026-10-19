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

test('convite de pré-consulta leva ao formulário, não direto ao SDR', () => {
  // 18/10/2026: o botão disparava o SDR da própria página. Agora passa pelo
  // /pre-consulta, que é o segundo filtro — relato aberto, histórico e
  // disponibilidade — e só de lá o card vai para a Karina.
  assert.match(html, /Pré-consulta Table · online e gratuita/);
  assert.match(html, /id="preconsult"/);
  assert.match(html, /location\.href='\/pre-consulta\?lid='/);
  assert.ok(!/fetch\('\/api\/captacao\/conversa'/.test(html),
    'o quiz voltou a chamar o SDR direto, pulando o segundo filtro');
  // O id vai opaco: telefone em query string seria PII na URL.
  assert.ok(!/lid='\+.*phone/.test(html));
  assert.match(html, /autonomia, acompanhamento Table ou outro cuidado/);
});

test('quem tem fit suficiente VÊ a pré-consulta, mesmo sem prontidão', () => {
  // Antes, routeA e routeBC eram mutuamente exclusivos: quem caía em B nunca
  // via a conversa gratuita, e era ali que a lead qualificada e cautelosa
  // morria.
  assert.match(html, /const CORTE_PRE_CONSULTA=5/);
  assert.match(html, /convidada=fitScore>=CORTE_PRE_CONSULTA/);
  assert.match(html, /\$\('routeA'\)\.hidden=!convidada/);
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
  assert.match(html, /Um mapa pessoal que mostra onde começar/);
  assert.match(html, /intervenção prática por dia, durante 7 dias/);
});

test('resultado sustenta promessa, autoridade e prova social visual', () => {
  assert.match(html, /Não voltar ao mesmo ciclo é outra/);
  assert.match(html, /o seu ciclo começa antes da comida/);
  assert.match(html, /Evelyn Liu é nutricionista comportamental/);
  assert.match(html, /CRN-3 70082/);
  for (const image of ['evelyn-liu.png','Juliana Moreno.jpg','Adriana.jpg','Iracema.jpg']) {
    assert.match(html, new RegExp(image.replace('.', '\\.')));
  }
  assert.match(html, /Relatos de experiências individuais/);
});

test('pré-consulta vende clareza sem antecipar tentativa de venda', () => {
  const routeA = html.slice(html.indexOf('<div id="routeA"'), html.indexOf('<div id="routeBC"'));
  assert.doesNotMatch(routeA, /oferta|vender/i);
  assert.doesNotMatch(html, /isso não é uma oferta/i);
  assert.match(routeA, /começar pelo ponto certo/);
  assert.match(routeA, /Quero descobrir meu próximo passo/);
});

test('carregamento ganhou dois segundos e comunica progresso', () => {
  assert.match(html, /setTimeout\(\(\)=>\{clearInterval\(loadingTimer\);complete\(\)\},3350\)/);
  assert.match(html, /Identificando o ponto que mantém o ciclo/);
  assert.match(html, /Preparando seu próximo passo/);
});

test('prévia das rotas só funciona em localhost e não envia formulário', () => {
  assert.match(html, /location\.hostname==='127\.0\.0\.1'\|\|location\.hostname==='localhost'/);
  assert.match(html, /\['A','B','C'\]\.includes\(previewRoute\)/);
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

// Um splice ruim duplicou o documento inteiro de #quiz em diante e aninhou a
// copia dentro de #result. Como getElementById pega sempre o primeiro, os CTAs
// ficaram na copia morta: a pagina de resultado rodou SEM nenhum botao. Nada
// quebrava, nada gritava no console — so nao convertia.
test('estrutura do quiz nao tem id duplicado', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const vistos = new Set();
  const repetidos = [...new Set(ids.filter(id => vistos.has(id) || (vistos.add(id), false)))];
  assert.deepEqual(repetidos, [], `ids duplicados: ${repetidos.join(', ')}`);
});

test('as paginas do funil existem uma unica vez', () => {
  for (const id of ['intro', 'quiz', 'respiro', 'capture', 'loading', 'result']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `#${id} duplicado`);
  }
  assert.equal((html.match(/<section class="page/g) || []).length, 6);
});

test('os dois CTAs ficam dentro da pagina de resultado', () => {
  const resultado = html.slice(html.indexOf('<section class="page result" id="result">'));
  const fim = resultado.indexOf('\n</section>');
  const dentro = resultado.slice(0, fim);
  for (const id of ['routeA', 'routeBC', 'preconsult', 'checkout']) {
    assert.ok(dentro.includes(`id="${id}"`), `#${id} ficou fora de #result`);
  }
});

test('o preview local combina com a regua de corte da pre-consulta', () => {
  // O convite olha fitScore, nao a rota. Preview que forca a rota sem mexer no
  // score mostra uma tela sem CTA nenhum e parece funil quebrado.
  assert.match(html, /fitScore=previewRoute==='A'\?8:previewRoute==='B'\?5:2/);
  assert.match(html, /const CORTE_PRE_CONSULTA=5;/);
});

test('atribuicao de primeiro toque viaja junto com a lead', () => {
  assert.match(html, /attribution:persistAttribution\(\)/);
  assert.match(html, /table_attr_first/);
  assert.doesNotMatch(html, /function utm\(\)/, 'utm() morta deve sair');
});

test('a linha fina da caixa escura nao herda a cor das bandas claras', () => {
  // .page.result .paper .fine (0,3,0) vencia .route-a-box .fine (0,2,0) e
  // pintava o texto de --muted sobre o verde: 2,58 de contraste.
  assert.match(html, /\.page\.result \.route-a-box \.fine\{color:#91a397\}/);
});

test('a prova do Google colapsa em 6 e expande por botao', () => {
  // 15 avaliacoes empilhadas davam 4.068px no mobile, quase cinco telas antes
  // do CTA. Colapsar em 6 mantem a prova e devolve 1.355px.
  assert.equal((html.match(/class="google-card"/g) || []).length, 15);
  assert.match(html, /\.google-grid:not\(\.aberto\) \.google-card:nth-child\(n\+7\)\{display:none\}/);
  assert.match(html, /id="verAvaliacoes" aria-expanded="false" aria-controls="googleGrid"/);
  assert.match(html, /\$\('verAvaliacoes'\)\.onclick/);
  assert.match(html, /id="googleGrid"/);
});
