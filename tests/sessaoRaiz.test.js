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
  // o PR só aparece como destino do crédito, nunca como item entregue
  const incluso = html.slice(html.indexOf('<ul class="incl">'), html.indexOf('</ul>', html.indexOf('<ul class="incl">')));
  assert.doesNotMatch(incluso, /12 exercícios|aulas em vídeo|Gordura Não Existe/i);
  assert.match(incluso, /Crédito de R\$ 97 caso você continue pelo Protocolo Raiz/);
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
