const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const server = readFileSync(join(__dirname, '..', 'src/server.js'), 'utf8');

const sendRecovery = server.slice(
  server.indexOf('async function sendRecoveryMessage(rec)'),
  server.indexOf('async function registerRecoveryTemplateInHub'),
);

test('recuperação sai pela Cloud API, não mais pelo SDR/Z-API', () => {
  assert.match(sendRecovery, /graph\.facebook\.com\/v21\.0\/\$\{PHONE_ID\}\/messages/);
  // o caminho antigo caía em 404 silencioso; não pode voltar
  assert.doesNotMatch(server, /SDR_RECOVERY_URL|SDR_RECOVERY_TOKEN/);
});

test('envia como template — lead de checkout não tem janela de 24h', () => {
  assert.match(sendRecovery, /type: 'template'/);
  assert.match(sendRecovery, /language: \{ code: 'pt_BR' \}/);
  assert.doesNotMatch(sendRecovery, /type: 'text'[^]*body: \{/);
});

test('template Cakto é o cadastrado e o Hub registra o mesmo nome', () => {
  assert.match(server, /WHATSAPP_RECOVERY_TEMPLATE_CAKTO \|\| 'recuperacao_checkout_cakto'/);
  // um único seletor: o Hub registra exatamente o que foi enviado
  assert.match(server, /const templateName = recoveryTemplateName\(rec\);/);
  const inicioHub = server.indexOf('async function registerRecoveryTemplateInHub');
  const hub = server.slice(inicioHub, server.indexOf('function dentroDoHorarioEnvio()', inicioHub));
  assert.doesNotMatch(hub, /WHATSAPP_RECOVERY_TEMPLATE_CAKTO/);
});

test('botão leva corpo e sufixo de URL nos índices certos', () => {
  assert.match(sendRecovery, /type: 'body',\s+parameters: \[\{ type: 'text', text: firstName\(rec\.name\)/);
  assert.match(sendRecovery, /type: 'button', sub_type: 'url', index: '0'/);
});

test('sufixo do botão casa com o exemplo aprovado (path/?query)', () => {
  const canais = server.slice(
    server.indexOf('const RECOVERY_CHANNELS = {'),
    server.indexOf('function recoveryChannel(rec)'),
  );
  assert.match(canais, /qs\.replace\('\?', '\/\?'\)/);
  assert.match(canais, /'https:\/\/pay\.cakto\.com\.br\/'/);
});

test('base e sufixo do botão saem sempre do mesmo provider', () => {
  const canais = server.slice(
    server.indexOf('const RECOVERY_CHANNELS = {'),
    server.indexOf('function recoveryChannel(rec)'),
  );
  // cakto usa link cakto; ticto usa link ticto — nunca cruzado
  const cakto = canais.slice(canais.indexOf('cakto: {'), canais.indexOf('ticto: {'));
  const ticto = canais.slice(canais.indexOf('ticto: {'));
  assert.match(cakto, /buildCaktoCheckoutSuffix/);
  assert.doesNotMatch(cakto, /checkout\.ticto\.app/);
  assert.match(ticto, /checkout\.ticto\.app/);
  assert.doesNotMatch(ticto, /buildCaktoCheckoutSuffix/);
  // pix vivo precisa preservar a URL do evento, senão o pix morre
  const btn = server.slice(server.indexOf('function recoveryButtonSuffix(rec)'));
  assert.match(btn.slice(0, 400), /rec\.pix_url\.startsWith\(base\)/);
});

test('sem credencial cai em sombra em vez de estourar', () => {
  assert.match(sendRecovery, /if \(!ENABLED \|\| !TOKEN \|\| !PHONE_ID\)/);
  assert.match(sendRecovery, /return \{ shadow: true \}/);
});

test('envio real é o padrão, mas RECOVERY_ENABLED=false ainda derruba', () => {
  assert.match(server, /function recoveryEnabled\(\) \{\s*return process\.env\.RECOVERY_ENABLED !== 'false';/);
  // nenhum ponto pode voltar a exigir a env ligada explicitamente
  assert.doesNotMatch(server, /RECOVERY_ENABLED === 'true'/);
});
