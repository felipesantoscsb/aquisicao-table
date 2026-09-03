const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('obrigado Evelyn explica ativação humana e dispara Purchase deduplicado',()=>{
  const html=readFileSync(join(__dirname,'../public/Funil/obrigado-evelyn.html'),'utf8');
  assert.match(html,/Evelyn ativa seu acompanhamento na LIA/);
  assert.match(html,/dia e o horário fixos/);
  assert.match(html,/fbq\('track','Purchase',\{value:4800\.00,currency:'BRL'/);
  assert.match(html,/EvelynThankYouView/);
  assert.match(html,/localStorage\.getItem/);
});

test('rota dedicada e fechamento configurável estão presentes',()=>{
  const server=readFileSync(join(__dirname,'../src/server.js'),'utf8');
  assert.match(server,/app\.get\('\/obrigado-evelyn'/);
  assert.match(server,/EVELYN_CHECKOUT_PRODUCT_ID/);
  assert.match(server,/evelyn_won/);
});
