const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const quiz = read('public/quiz-ascensao-table.html');
const form = read('public/Funil/formulario-pre-consulta-v2.html');
const server = read('src/server.js');
const sync = read('src/hubSync.js');

test('Radar envia todas as etapas necessárias para medir conversão', () => {
  for (const event of ['page_view','quiz_started','question_answered','capture_viewed','lead_submitted','result_viewed','preconsult_started','checkout_started']) {
    assert.match(quiz, new RegExp(`radarEvent\\('${event}'`));
  }
  assert.match(form, /radarEvent\('preconsult_requested'\)/);
  assert.match(quiz, /question_number:answered/);
});

test('telemetria usa sessão opaca, primeiro toque e não manda respostas ou PII', () => {
  assert.match(quiz, /sessionStorage\.getItem\(RADAR_SESSION_KEY\)/);
  assert.match(quiz, /persistAttribution\(\)\.first/);
  const telemetry = quiz.slice(quiz.indexOf('function radarEvent('), quiz.indexOf('function start('));
  assert.doesNotMatch(telemetry, /\b(name|email|phone|whats|answers|value)\b/);
  assert.match(telemetry, /location\.hostname==='localhost'/);
});

test('backend filtra o payload e assina o encaminhamento para o Hub', () => {
  assert.match(server, /app\.post\('\/api\/radar-event'/);
  assert.match(server, /RADAR_EVENT_NAMES/);
  assert.match(server, /hubSync\.enviarRadarEvento/);
  assert.match(sync, /'\/webhook\/radar-event'/);
  const endpoint = server.slice(server.indexOf("app.post('/api/radar-event'"), server.indexOf("app.post('/api/capi'"));
  assert.doesNotMatch(endpoint, /\b(nome|email|phone|whats|answers)\b/);
});

test('pedido de pré-consulta só conta depois da confirmação do formulário', () => {
  const success = form.indexOf("if(!r.ok || !d.ok) throw");
  const event = form.indexOf("radarEvent('preconsult_requested')");
  assert.ok(success >= 0 && event > success);
});
