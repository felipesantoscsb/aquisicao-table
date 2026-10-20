const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/Funil/obrigado-primeira-ruptura.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

test('a pagina e servida numa rota propria, sem tocar na antiga', () => {
  // Os checkouts dos funis antigos apontam para /obrigado e dizem Protocolo
  // Raiz, que e o nome que aquelas compradoras viram. Trocar aquela pagina
  // quebraria a compra delas para consertar a desta.
  assert.match(server, /app\.get\('\/obrigado-primeira-ruptura'.*'obrigado-primeira-ruptura\.html'/);
  assert.match(server, /app\.get\('\/obrigado',.*'obrigado-protocolo-raiz\.html'/);
});

test('ela chama o produto pelo nome que a cliente comprou', () => {
  assert.match(html, /Bem-vinda à<br><em>Primeira Ruptura\.<\/em>/);
  // "Protocolo Raiz" so pode aparecer no aviso que explica a area de acesso.
  const mencoes = html.match(/Protocolo Raiz/g) || [];
  assert.equal(mencoes.length, 1);
  assert.match(html, /ainda aparece com o nome antigo, Protocolo Raiz/);
});

test('avisa que a area de membros tem outro nome', () => {
  // Ela paga por Primeira Ruptura, recebe e-mail de Protocolo Raiz e entra num
  // dominio protocoloraiz. Sem esse aviso, isso vira ticket de suporte ou
  // pedido de reembolso no momento mais sensivel.
  assert.match(html, /É o mesmo produto que você acabou de comprar/);
  assert.match(html, /protocoloraiz\.ticto\.club/);
});

test('os tres passos preservam a entrega real', () => {
  assert.equal((html.match(/class="passo"/g) || []).length, 3);
  assert.match(html, /12 exercícios psicoemocionais guiados pela Evelyn/);
  assert.match(html, /“Gordura Não Existe” em PDF/);
  assert.match(html, /chega em até 1h por WhatsApp/);
  assert.match(html, /evelynliu\.com\.br\/forms/);
  assert.match(html, /em até 24 horas/);
});

test('segue as regras de comunicacao da Table', () => {
  assert.ok(!/[—–]/.test(html), 'travessao ou meia-risca');
  assert.ok(!/Table Clinic/.test(html), '"Clinic" saiu da marca');
  assert.match(html, /href="\/legal"/, 'privacidade e termos');
  assert.match(html, /Não promete perda de peso nem substitui cuidado médico ou psicológico/);
  assert.match(html, /name="robots" content="noindex"/, 'pagina de pos-compra nao indexa');
});
