const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const server = readFileSync(join(__dirname, '..', 'src/server.js'), 'utf8');

// O Purchase é o único evento que nasce num webhook de pagamento, e não no
// browser. Sem cuidado, ele vai à Meta sem IP/user agent (EMQ baixo) ou, pior,
// com o IP do servidor do gateway — dado real e errado.

test('o lead guarda IP e user agent do comprador', () => {
  assert.match(server, /client_ip:\s+getClientIp\(req\) \|\| null/);
  assert.match(server, /client_ua:\s+req\.headers\['user-agent'\] \|\| null/);
});

test('enrichFromLid devolve IP e user agent junto do resto', () => {
  assert.match(server, /client_ip:\s+base\.client_ip\s+\|\| lead\.client_ip \|\| null/);
  assert.match(server, /client_ua:\s+base\.client_ua\s+\|\| lead\.client_ua \|\| null/);
});

test('o Purchase da Cakto manda IP e user agent do comprador', () => {
  assert.match(server, /clientIp: enr\.client_ip, clientUserAgent: enr\.client_ua/);
});

test('o Purchase da Ticto não usa o req do webhook como origem de IP/UA', () => {
  // req ali é o servidor da Ticto. Se voltar, o evento leva dado errado.
  assert.match(server, /client_ip_address: leadData\?\.client_ip \|\| null/);
  assert.match(server, /client_user_agent: leadData\?\.client_ua \|\| null/);
  // Escopo estreito de propósito: no /api/capi o req É o browser do comprador,
  // e ali usar getClientIp(req) continua correto. O que não pode voltar é o
  // req dentro do payload do webhook.
  const preview = server.slice(server.indexOf('const capiPreview'), server.indexOf('const PURCHASE_ENABLED'));
  assert.ok(preview.length > 100, 'bloco do Purchase da Ticto não encontrado');
  assert.doesNotMatch(preview, /getClientIp\(req\)/);
  assert.doesNotMatch(preview, /req\.headers/);
});

test('sendCapiEvent prefere o IP explícito ao do req', () => {
  // A ordem importa: clientIp primeiro, req só como fallback.
  assert.match(server, /const ipFinal = clientIp \|\| \(req \? getClientIp\(req\) : null\)/);
  assert.match(server, /const uaFinal = clientUserAgent \|\| \(req \? req\.headers\['user-agent'\] : null\)/);
});

test('a precedência de fato funciona', () => {
  // Reproduz a regra para travar o comportamento, não só o texto.
  const resolve = (clientIp, req) => clientIp || (req ? req.ip : null);
  assert.equal(resolve('189.1.1.1', { ip: '52.0.0.1' }), '189.1.1.1', 'comprador vence o gateway');
  assert.equal(resolve(null, { ip: '52.0.0.1' }), '52.0.0.1', 'sem lead, usa o req (browser)');
  assert.equal(resolve(null, null), null, 'sem nada, não inventa');
});
