const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('obrigado Evelyn explica ativação humana e NÃO toca a Meta',()=>{
  const html=readFileSync(join(__dirname,'../public/Funil/obrigado-evelyn.html'),'utf8');
  assert.match(html,/Evelyn ativa seu acompanhamento na LIA/);
  assert.match(html,/dia e o horário fixos/);
  // Pixel removido em 17/10/2026: só venda de Protocolo Raiz bate no Meta.
  // Esta página é acompanhamento direto, não PR.
  assert.ok(!/fbq\(/.test(html),'pixel voltou para a página da Evelyn');
  assert.ok(!/fbevents|facebook\.com\/tr/.test(html),'carregador do pixel voltou');
});

test('rota dedicada e fechamento configurável estão presentes',()=>{
  const server=readFileSync(join(__dirname,'../src/server.js'),'utf8');
  assert.match(server,/app\.get\('\/obrigado-evelyn'/);
  assert.match(server,/EVELYN_CHECKOUT_PRODUCT_ID/);
  assert.match(server,/evelyn_won/);
});
