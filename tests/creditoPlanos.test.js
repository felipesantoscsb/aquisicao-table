const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const dir = join(root, 'public/Ofertas');
const prPages = readdirSync(dir).filter(f => f.includes('-pr-'));

// Estado ATUAL, no ar, com lead acessando. O credito unico de R$ 100 esta
// decidido mas NAO aplicado: a virada precisa ser deliberada, nao um efeito
// colateral de outra mudanca. Estes testes guardam o que esta publicado.
//
// Quando a chave virar, os valores sao:
//   Essential  R$ 798,00   12x R$ 82,53
//   Premium    R$ 1.398,00 12x R$ 144,58
//   Elite      R$ 2.300,00 12x R$ 237,86
// A parcela sai do fator embutido nas proprias paginas (1,241018), que bate
// nos tres tiers ate a quarta casa. Conferir uma contra a tabela do gateway.
const NO_AR = {
  essential: { vista: 'R$ 849,50',   parcela: 'R$87,85'   },
  premium:   { vista: 'R$ 1.401,00', parcela: 'R$ 144,89' },
  elite:     { vista: 'R$ 2.303,00', parcela: 'R$ 238,18' },
};

test('as nove paginas com credito existem', () => {
  assert.equal(prPages.length, 9, '3 tiers x 3 nutris');
});

test('os precos publicados nao mudam por acidente', () => {
  for (const arq of prPages) {
    const tier = Object.keys(NO_AR).find(t => arq.includes(t));
    const html = readFileSync(join(dir, arq), 'utf8');
    assert.ok(html.includes(NO_AR[tier].vista), `${arq}: preco publicado mudou`);
    assert.ok(html.includes(NO_AR[tier].parcela), `${arq}: parcela publicada mudou`);
  }
});

test('o credito de R$ 100 ainda nao foi aplicado em nenhuma das nove', () => {
  // Se este teste falhar, a virada aconteceu: atualize NO_AR junto.
  for (const arq of prPages) {
    const html = readFileSync(join(dir, arq), 'utf8');
    assert.ok(!html.includes('R$ 100,00'), `${arq}: credito novo entrou sem a virada combinada`);
  }
});

test('a Sessao Raiz reporta o proprio valor, nao o do Protocolo Raiz', () => {
  // A pagina mandava value:67 desde sempre; o servidor descartava e fixava 97.
  const server = readFileSync(join(root, 'src/server.js'), 'utf8');
  assert.match(server, /if \(String\(body\.source \|\| ''\) === 'sessao-raiz'\) return 67;/);
  assert.match(readFileSync(join(root, 'public/sessao-raiz.html'), 'utf8'), /value:67,source:'sessao-raiz'/);
});
