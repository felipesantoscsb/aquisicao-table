const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lp = fs.readFileSync(path.join(root, 'public/lia-es.html'), 'utf8');
const thanks = fs.readFileSync(path.join(root, 'public/obrigado-lia-es.html'), 'utf8');
const legal = fs.readFileSync(path.join(root, 'public/legal-es.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

test('rotas comerciais Espanha são isoladas das páginas brasileiras', () => {
  assert.match(server, /app\.get\('\/lia-es'/);
  assert.match(server, /app\.get\('\/obrigado-lia-es'/);
  assert.match(server, /app\.get\('\/legal-es'/);
  assert.match(server, /app\.post\('\/api\/lia-es\/onboard'/);
});

test('LP explicita oferta, WhatsApp, autoridade honesta e limites', () => {
  assert.match(lp, /19,90 €<\/span><small>\/mes/);
  assert.match(lp, /100 %<\/b> por WhatsApp/);
  assert.match(lp, /Más de 50 intervenciones propias/);
  assert.match(lp, /No son 5\.000 usuarias de LIA/);
  assert.match(lp, /no sustituye atención médica, psicológica o nutricional/i);
  assert.match(lp, /CHECKOUT_URL=''/);
  assert.match(lp, /href="\/legal-es"/);
});

test('onboarding ES é curto, tem uma aberta opcional e não ativa pt-BR', () => {
  assert.equal((thanks.match(/<textarea/g) || []).length, 1);
  assert.match(thanks, /Opcional/);
  assert.match(thanks, /\/api\/lia-es\/onboard/);
  assert.match(thanks, /href="\/legal-es"/);
  assert.doesNotMatch(thanks, /\/api\/lia\/onboard/);
  assert.match(server, /status: 'stored_for_activation'/);
});

test('legal ES cobre privacidade, IA, consumo e direitos europeus', () => {
  assert.match(legal, /Agencia Española de Protección de Datos/);
  assert.match(legal, /transferencias internacionales/i);
  assert.match(legal, /inteligencia artificial/i);
  assert.match(legal, /cancelar futuras renovaciones/i);
  assert.match(legal, /cookies o tecnologías publicitarias no esenciales/i);
});

test('contexto internacional é persistido explicitamente', () => {
  for (const token of ["locale: 'es-ES'", "market: 'ES'", "language: 'es'", "timezone: 'Europe/Madrid'", "currency: 'EUR'"]) assert.ok(server.includes(token), token);
});

test('bateria de anúncios contém 80 peças e manifest', () => {
  const dir = path.join(root, 'public/ads-lia-es/final');
  const pngs = fs.readdirSync(dir).filter(x => x.endsWith('.png'));
  assert.equal(pngs.length, 80);
  assert.ok(fs.existsSync(path.join(root, 'public/ads-lia-es/manifest.csv')));
});
