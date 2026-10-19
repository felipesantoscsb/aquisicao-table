const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const dir = join(root, 'public/Ofertas');
const prPages = readdirSync(dir).filter(f => f.includes('-pr-'));

// Credito unico de R$ 100 em qualquer plano, desde 20/10/2026. Antes era 50%
// no Essential (R$ 48,50) e 100% do Protocolo Raiz nos outros (R$ 97,00), o
// que amarrava o desconto ao preco do produto de entrada — e ele mudou.
const ESPERADO = {
  essential: { vista: 'R$ 798,00',   parcela: 'R$82,53'   },
  premium:   { vista: 'R$ 1.398,00', parcela: 'R$ 144,58' },
  elite:     { vista: 'R$ 2.300,00', parcela: 'R$ 237,86' },
};

test('as nove paginas com credito existem', () => {
  assert.equal(prPages.length, 9, '3 tiers x 3 nutris');
});

test('cada plano mostra o preco com credito de R$ 100 aplicado', () => {
  for (const arq of prPages) {
    const tier = Object.keys(ESPERADO).find(t => arq.includes(t));
    const html = readFileSync(join(dir, arq), 'utf8');
    assert.ok(html.includes(ESPERADO[tier].vista), `${arq}: falta ${ESPERADO[tier].vista}`);
    assert.ok(html.includes(ESPERADO[tier].parcela), `${arq}: falta a parcela ${ESPERADO[tier].parcela}`);
  }
});

test('nenhum valor do credito antigo sobrou', () => {
  for (const arq of prPages) {
    const html = readFileSync(join(dir, arq), 'utf8');
    for (const velho of ['R$48,50', '- R$ 97,00', 'R$ 849,50', 'R$ 1.401,00', 'R$ 2.303,00',
                         '50% do valor', 'volta integralmente']) {
      assert.ok(!html.includes(velho), `${arq}: sobrou "${velho}"`);
    }
  }
});

test('a conta do credito fecha em cada tier', () => {
  // Preco cheio menos 100 tem que dar o preco com credito, senao a pagina
  // mostra uma subtracao errada para quem le os dois numeros.
  const cheio = { essential: 898.0, premium: 1498.0, elite: 2400.0 };
  for (const [tier, { vista }] of Object.entries(ESPERADO)) {
    const n = Number(vista.replace('R$ ', '').replace(/\./g, '').replace(',', '.'));
    assert.equal(n, cheio[tier] - 100, `${tier}: ${cheio[tier]} - 100 != ${n}`);
  }
});

test('a Sessao Raiz reporta o proprio valor, nao o do Protocolo Raiz', () => {
  // A pagina mandava value:67 desde sempre; o servidor descartava e fixava 97.
  const server = readFileSync(join(root, 'src/server.js'), 'utf8');
  assert.match(server, /if \(String\(body\.source \|\| ''\) === 'sessao-raiz'\) return 67;/);
  assert.match(readFileSync(join(root, 'public/sessao-raiz.html'), 'utf8'), /value:67,source:'sessao-raiz'/);
});
