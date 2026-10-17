// Só venda de Protocolo Raiz bate no Meta (decisão do Felipe, 17/10/2026).
//
// Upsell (planos de acompanhamento e Evelyn) foi silenciado dos dois lados:
// pixel nas páginas de obrigado e CAPI do webhook da InfinitePay.
//
// O motivo não foi só volume. O Purchase do upsell não tinha e-mail nem
// telefone com hash — a Meta casava por IP, que é grosseiro, e foi assim que
// uma venda grudou num anúncio PAUSADO. Além disso o evento da página não
// tinha eventID, então não deduplicava com o do CAPI: a mesma venda contava
// duas vezes, e cada recarga da página gerava mais uma.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const funil = (f) => ler(path.join('public/Funil', f));

const UPSELL = [
  'obrigado-essential.html', 'obrigado-premium.html', 'obrigado-elite.html',
  'obrigado-essential-pr.html', 'obrigado-premium-pr.html', 'obrigado-elite-pr.html',
  'obrigado-evelyn.html',
];

test('nenhuma página de obrigado de upsell toca a Meta', () => {
  for (const f of UPSELL) {
    const html = funil(f);
    assert.ok(!/fbq\(/.test(html), `${f} voltou a ter fbq`);
    assert.ok(!/fbevents\.js/.test(html), `${f} ainda carrega o pixel`);
    assert.ok(!/facebook\.com\/tr/.test(html), `${f} ainda tem o noscript do pixel`);
  }
});

test('a página do Protocolo Raiz segue sendo a exceção, e ela não mudou', () => {
  // O PR não dispara pelo navegador: entra por Cakto e Ticto, no servidor.
  const pr = funil('obrigado-protocolo-raiz.html');
  assert.ok(!/fbq\(/.test(pr), 'o PR nunca teve pixel nesta página; se apareceu, foi engano');
});

test('o webhook da InfinitePay responde, mas não envia nada', () => {
  const server = ler('src/server.js');
  const rota = server.slice(server.indexOf("app.post('/api/purchase'"));
  const fim = rota.indexOf('\napp.');
  const corpo = rota.slice(0, fim > 0 ? fim : 2000);

  assert.ok(!/graph\.facebook\.com/.test(corpo), 'voltou a chamar a Meta');
  assert.ok(!/META_CAPI_TOKEN|META_PIXEL_ID/.test(corpo), 'voltou a montar credencial');
  // Precisa seguir respondendo 200: a InfinitePay reenvia se não responder.
  assert.match(corpo, /res\.json\(\{ ok: true/);
  assert.match(corpo, /enviado_meta: false/);
  // E o log continua, que é a trilha da conciliação.
  assert.match(corpo, /console\.log\(/);
});

test('só os caminhos do PR seguem mandando Purchase', () => {
  const server = ler('src/server.js');
  const envios = server.match(/event(_n|N)ame:\s*'Purchase'/g) || [];
  assert.equal(envios.length, 2, `esperado 2 (Ticto e Cakto), achei ${envios.length}`);

  // E o Cakto só vende produto do funil do PR — se entrar plano ali, este
  // teste cai e a regra precisa de filtro por produto.
  const produtos = server.slice(server.indexOf('PRODUTOS_CAKTO = ['));
  const nomes = (produtos.slice(0, 300).match(/nome: '([^']+)'/g) || []).join(' ');
  assert.match(nomes, /Protocolo Raiz/);
  assert.match(nomes, /Sessão Raiz/);
  assert.ok(!/Essential|Premium|Elite|Evelyn/.test(nomes),
    'a Cakto passou a vender upsell: o envio de Purchase precisa filtrar por produto');
});
