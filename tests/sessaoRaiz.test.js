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
