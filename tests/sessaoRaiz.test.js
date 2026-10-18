const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/sessao-raiz.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

test('rota própria servindo a página curta', () => {
  assert.match(server, /app\.get\('\/sessao-raiz'/);
  assert.match(server, /'sessao-raiz\.html'/);
});

test('oferta é a conversa, nunca o Protocolo Raiz', () => {
  assert.match(html, /const CHECKOUT_SESSAO_RAIZ_URL = 'https:\/\/pay\.cakto\.com\.br\/ak63ytv_1149729'/);
  assert.match(html, /R\$ 67/);
  const incluso = html.slice(html.indexOf('<ul class="incl">'), html.indexOf('</ul>', html.indexOf('<ul class="incl">')));
  assert.doesNotMatch(incluso, /12 exercícios|aulas em vídeo|Gordura Não Existe/i);
  assert.match(incluso, /Crédito de R\$ 97 caso você siga com um acompanhamento da Table/);
});

test('o crédito aponta para o acompanhamento, não para o Protocolo Raiz', () => {
  // um crédito de R$ 97 num produto de R$ 97 zeraria a entrada do PR
  assert.doesNotMatch(html, /Protocolo Raiz/);
  assert.match(html, /acompanhamento contínuo da Table, os R\$ 67 investidos hoje são convertidos em R\$ 97 de crédito/);
});

test('a sessão é conduzida pela equipe, não pela Evelyn', () => {
  const quem = html.slice(html.indexOf('<!-- 5 · QUEM CONDUZ -->'), html.indexOf('<!-- 6 · CRÉDITO -->'));
  assert.match(quem, /uma das nutricionistas comportamentais da equipe Table/);
  assert.match(quem, /Equipe Table/);
  // a Evelyn só aparece como autora do método, sem foto que sugira atendimento
  assert.doesNotMatch(quem, /<img/);
  assert.match(quem, /método desenvolvido por Evelyn Liu/);
});

test('o botão do topo leva à oferta, não ao checkout', () => {
  assert.match(html, /<button class="btn" data-ver-oferta>/);
  assert.match(html, /id="oferta"/);
  assert.match(html, /getElementById\('oferta'\)\.scrollIntoView/);
  // e não dispara intenção de compra antes de mostrar o preço
  const bloco = html.slice(html.indexOf('data-ver-oferta]'), html.length);
  assert.doesNotMatch(bloco.slice(0, 420), /InitiateCheckout/);
});

test('o benefício é crédito, jamais desconto', () => {
  assert.doesNotMatch(html, /desconto/i);
  assert.ok(html.toLowerCase().split('crédito').length - 1 >= 5, 'crédito precisa aparecer com destaque');
  assert.match(html, /Seu investimento continua com você/);
});

test('promessas que a sessão não cumpre ficam de fora', () => {
  const faq = html.slice(html.indexOf('<div class="faq">'), html.indexOf('</div>', html.indexOf('<div class="faq">')));
  assert.match(faq, /Não\. A sessão não inclui plano alimentar/);
  assert.match(faq, /Não\. A Sessão Raiz é uma conversa individual/);
  // sem contador nem urgência fabricada
  assert.doesNotMatch(html, /restam|últimas vagas|acaba em|contador|setInterval/i);
});

test('tracking do padrão da casa, sem Purchase', () => {
  assert.match(html, /fbq\('init','989971718548782'\)/);        // pixel principal, não o da V2
  assert.match(html, /fbq\('track','ViewContent',\{content_name:'Sessão Raiz'\}/);
  assert.match(html, /SessaoRaizPageViewed/);
  assert.match(html, /fbq\('track','InitiateCheckout',\{content_name:'Sessão Raiz',currency:'BRL',value:67\}/);
  assert.doesNotMatch(html, /'Purchase'|"Purchase"/);
  // source próprio: ehRaizV2 não pode capturar esta página
  assert.match(html, /source:'sessao-raiz'/);
  assert.doesNotMatch(html, /raiz-v2/);
});

test('lid do quiz 1 preenche o checkout sem PII na URL', () => {
  assert.match(html, /\/api\/lead-contexto\?lid=/);
  assert.match(html, /u\.searchParams\.set\('email', contato\.email\)/);
  assert.match(html, /u\.searchParams\.set\('sck', LID\)/);
});

test('design system do quiz 1, para a página não parecer outro produto', () => {
  assert.match(html, /family=Cormorant\+Garamond/);
  assert.match(html, /family=Jost/);
  assert.match(html, /--terra:#B97040/);
  assert.match(html, /--moss:#3D4A35/);
});

// ── Purchase da Sessão Raiz ────────────────────────────────────────────────
// O fallback fixo em 'Protocolo Raiz' fazia qualquer venda sem product_name
// no payload chegar à Meta rotulada como PR — dois produtos de preço e margem
// diferentes somados no mesmo sinal de conversão.
test('o nome do produto vem do checkout, nunca de um fallback fixo', () => {
  assert.match(server, /const PRODUTOS_CAKTO = \[/);
  assert.match(server, /slug: 'ak63ytv',\s*nome: 'Sessão Raiz'/);
  assert.match(server, /function produtoDaCompra/);
  assert.doesNotMatch(server, /content_name: record\.product_name \|\| 'Protocolo Raiz'/);
  assert.match(server, /content_name: produto/);
});

// O Radar roda na conta da LIA, com pixel próprio. Sem o funil gravado no
// lead, a venda dele cairia no pixel do funil principal.
test('a venda vai para o pixel do funil que a originou', () => {
  assert.match(server, /const credCompra = credenciaisCapi\(\{ funnel: _leadFunnel \}\)/);
  assert.match(server, /pixelId: credCompra\.pixelId, accessToken: credCompra\.accessToken/);
  assert.match(server, /sem RAIZ_V2_CAPI_TOKEN — Purchase NÃO enviado/);
});

// Rodando a funcao de verdade, nao casando a string: a escolha de pixel ja
// mudou duas vezes e asserção literal quebra a cada ajuste sem dizer se o
// COMPORTAMENTO continua certo.
test('Radar vai ao pixel principal; /raiz-v2 continua no pixel proprio', () => {
  const trecho = server.slice(server.indexOf('const PIXEL_RAIZ_V2'),
                              server.indexOf('// ─── Rota CAPI'));
  const credenciaisCapi = new Function('process', `${trecho}; return credenciaisCapi;`)(
    { env: { META_PIXEL_ID: 'PRINCIPAL', META_CAPI_TOKEN: 'TOKEN_PRINCIPAL', RAIZ_V2_CAPI_TOKEN: 'TOKEN_V2' } }
  );

  for (const body of [{ slug: 'raiz-radar' }, { source: 'radar-table' }, { funnel: 'raiz-radar' }]) {
    const c = credenciaisCapi(body);
    assert.equal(c.pixelId, 'PRINCIPAL', `Radar caiu no pixel errado: ${JSON.stringify(body)}`);
    assert.equal(c.v2, false);
  }
  // O funil das canetas continua separado.
  const v2 = credenciaisCapi({ slug: 'raiz-v2' });
  assert.notEqual(v2.pixelId, 'PRINCIPAL');
  assert.equal(v2.v2, true);
  // E o funil principal segue onde sempre esteve.
  assert.equal(credenciaisCapi({ slug: 'raiz-cakto' }).pixelId, 'PRINCIPAL');
});

test('o Radar NAO acorda o SDR, mesmo usando o pixel principal', () => {
  // ehRaizV2 decide duas coisas: qual pixel, e se o SDR e chamado. Ao mover o
  // pixel do Radar eu quase liguei a abordagem comercial em quem so concluiu o
  // quiz — que e exatamente o que o desenho proibe.
  assert.match(server, /ehRaizV2\(req\.body\)\) \{\s*\n\s*hubSync\.enviarLeadV2/);
  assert.match(server, /&& !ehRaizV2\(req\.body\)\) \{\s*\n\s*forwardToSDR/);
  // ehRaizV2 continua casando raiz-radar, que e o que mantem o SDR fora.
  const fn = server.slice(server.indexOf('function ehRaizV2'), server.indexOf('function ehRadarTable'));
  assert.match(fn, /raiz-radar\|radar-table/);
});

test('a página de origem do evento acompanha o produto', () => {
  assert.match(server, /produto === 'Sessão Raiz'\s*\n\s*\? 'https:\/\/www\.evelynliu\.com\.br\/sessao-raiz'/);
});

test('existe diagnóstico para saber se a Cakto entrega a venda', () => {
  assert.match(server, /app\.get\('\/api\/dash\/cakto-vendas', requireDashToken/);
  assert.match(server, /por_produto/);
});

// ── Home do domínio (14/10/2026) ───────────────────────────────────────────
// A raiz servia o placeholder do Express — 278 bytes com "Olá, mundo!" — no
// domínio da marca. Todo rastreador que chegava à raiz não achava nem o nome
// da Evelyn.
test('a home não é mais o placeholder do Express', () => {
  const home = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.doesNotMatch(home, /Olá, mundo|Minha Página|Servidor Express/);
  assert.match(home, /Table Clinic/);
  assert.match(home, /Evelyn Liu/);
  assert.ok(home.length > 15000, 'home com conteúdo de verdade');
});

// A home agora é autoral e distinta do site institucional: pode ocupar a raiz
// do domínio da Evelyn sem disputar a canônica da Table.
test('a home autoral tem canônica própria e entra no sitemap', () => {
  const home = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.match(home, /<link rel="canonical" href="https:\/\/www\.evelynliu\.com\.br\/"\/>/);
  assert.match(home, /Nutricionista comportamental, educadora/);
  assert.match(home, /A Table é o principal lugar/);
  const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/www\.evelynliu\.com\.br\/<\/loc>/);
});

test('/raiz-B é um protótipo isolado da etapa final', () => {
  const page = readFileSync(join(root, 'public/raiz-b.html'), 'utf8');
  const server = readFileSync(join(root, 'src/server.js'), 'utf8');
  const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');
  assert.match(server, /app\.get\('\/raiz-B',[\s\S]*'raiz-b\.html'/);
  assert.match(page, /apenas a etapa final · sem quiz, tracking ou checkout ativo/);
  assert.match(page, /name="robots" content="noindex,nofollow"/);
  assert.match(page, /Checkout desativado neste protótipo/);
  assert.match(page, /avaliações da Table no Google/);
  assert.match(page, /Ação da Gracinha · Table/);
  assert.match(page, /images\/Juliana Moreno\.jpg/);
  assert.match(page, /images\/Mockup 3\.jpg/);
  assert.doesNotMatch(page, /fbq\(|gtag\(|InitiateCheckout|\/api\/capi/);
  assert.ok(robots.includes('Disallow: /raiz-B'));
});

test('a home usa os ativos em alta resolução com a proporção real', () => {
  const home = readFileSync(join(root, 'public/index.html'), 'utf8');
  assert.match(home, /evelyn-liu\.png" width="1080" height="1350"/);
  assert.match(home, /Mockup 3\.jpg" width="2324" height="2205"/);
  assert.doesNotMatch(home, /Vestido Verde Olhar amistoso\.jpg/);
  assert.doesNotMatch(home, /Mockup 1\.png/);
});

test('links internos da home existem neste domínio', () => {
  const home = readFileSync(join(root, 'public/index.html'), 'utf8');
  const server = readFileSync(join(root, 'src/server.js'), 'utf8');
  for (const rota of [...home.matchAll(/href="(\/[a-z0-9-]+)"/g)].map(m => m[1])) {
    assert.match(server, new RegExp(`app\\.get\\('${rota}'`), `rota ${rota} não existe no server`);
  }
});

// Sem robots nem sitemap, a descoberta dependia inteiramente de link externo.
test('robots e sitemap existem, com as páginas de funil fora do índice', () => {
  const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');
  assert.match(robots, /Sitemap: https:\/\/www\.evelynliu\.com\.br\/sitemap\.xml/);
  for (const bloqueado of ['/obrigado', '/oferta-', '/dash', '/api/']) {
    assert.ok(robots.includes(`Disallow: ${bloqueado}`), `${bloqueado} deveria ficar fora`);
  }
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot']) assert.match(robots, new RegExp(bot));
});
