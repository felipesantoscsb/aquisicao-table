const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/quiz-raiz-v2.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');
const ads = readFileSync(join(root, 'docs/ads-raiz-v2-batch-01.md'), 'utf8');

test('raiz-v2 tem rota própria e checkout dedicado', () => {
  assert.match(server, /app\.get\('\/raiz-v2'/);
  assert.match(html, /https:\/\/pay\.cakto\.com\.br\/ai223ee/);
});

test('radar usa as seis dimensões oficiais do prontuário', () => {
  for (const label of [
    'Relação com o corpo', 'Relação com a comida', 'Recursos biopsicossociais',
    'Conhecimento alimentar', 'Consciência e presença', 'Adaptabilidade',
  ]) assert.match(html, new RegExp(label));
  // conta só no conjunto do funil pago; a camada 2 tem o seu, contado abaixo
  const glp1 = html.slice(html.indexOf('let questions=['), html.indexOf('const Q_NURTURE'));
  assert.equal((glp1.match(/tag:'[1-9] ·/g) || []).length, 9);
});

test('mantém Pixel e CAPI com a jornada completa', () => {
  for (const event of ['PageView', 'ViewContent', 'QuizStart', 'Lead', 'CompleteRegistration', 'OfferView', 'InitiateCheckout']) {
    assert.match(html, new RegExp(event));
  }
  assert.match(html, /slug:'raiz-v2'/);
  assert.match(html, /source:'raiz-v2'/);
});

test('v2 não dispara dossiê, SDR ou sequência pós-quiz', () => {
  assert.doesNotMatch(html, /hook\.us2\.make\.com/);
  assert.match(server, /CompleteRegistration' && req\.body\.slug !== 'raiz-v2'/);
  assert.match(html, /não será enviado por WhatsApp/);
});

test('resultado mantém interpolação de nome, estágio e pilares', () => {
  assert.match(html, /lead\.name\.split/);
  assert.match(html, /stageText\[stage\]/);
  assert.match(html, /DIMS\[low\]/);
  assert.match(html, /DIMS\[high\]/);
});

test('primeira pergunta contextualiza medicação sem presumir tratamento', () => {
  assert.match(html, /Se mais de uma servir, escolha a que mais pesa hoje/);
  assert.doesNotMatch(html, /Você não precisa dizer qual medicamento usa/);
  assert.match(html, /'stopped_other'/);
  assert.match(html, /Parei, e nenhuma dessas mudanças me preocupa hoje/);
});

test('resultado fica oculto até a conclusão e a VSL está configurada', () => {
  assert.match(html, /\.page\.result\{display:none/);
  assert.match(html, /\.page\.result\.active\{display:block/);
  assert.match(html, /const VSL_MEDIA_ID\s*=\s*'vjen9pjw56'/);
  assert.match(html, /wistia-player/);
});

test('tipografia de destaque evita a família anterior com f estilizado', () => {
  assert.match(html, /family=Lora/);
  assert.doesNotMatch(html, /Fraunces/);
});

test('documento entrega matriz, doze roteiros e priorização 1A/1B', () => {
  assert.equal((ads.match(/^### [ABC][1-4] —/gm) || []).length, 12);
  assert.match(ads, /Batch 1A/);
  assert.match(ads, /Batch 1B/);
  assert.match(ads, /O que ele nos ensina|se performar, ensina/i);
});

test('a V2 usa pixel próprio e não referencia mais o principal', () => {
  // A V2 roda na conta de anúncios da LIA. Se o pixel principal voltar a
  // aparecer aqui, o sinal dos dois funis se mistura de novo em silêncio.
  assert.doesNotMatch(html, /989971718548782/);
  assert.match(html, /var PIXEL_V2='519946826343805'/);
  assert.match(html, /fbq\('init',PIXEL_V2\)/);
  // Advanced matching e noscript precisam apontar para o mesmo pixel.
  assert.match(html, /fbq\('init',PIXEL_V2,\{em:email/);
  assert.match(html, /facebook\.com\/tr\?id=519946826343805/);
});

test('o CAPI da V2 nunca cai no token do pixel principal', () => {
  assert.match(server, /const PIXEL_RAIZ_V2 = '519946826343805'/);
  assert.match(server, /function ehRaizV2/);
  // Sem o token próprio o evento é PULADO, não redirecionado.
  assert.match(server, /raiz_v2_capi_token_ausente/);
  assert.match(server, /RAIZ_V2_CAPI_TOKEN/);
});

test('ehRaizV2 reconhece o funil por slug, source e content_name', () => {
  // Reproduz a heurística do servidor para travar o contrato dos três campos
  // que as chamadas da página realmente mandam.
  const ehRaizV2 = (body = {}) => [body.slug, body.source, body.content_name, body.funnel]
    .some(v => /raiz-v2/i.test(String(v || '')));
  assert.equal(ehRaizV2({ slug: 'raiz-v2' }), true);                        // CompleteRegistration
  assert.equal(ehRaizV2({ source: 'raiz-v2' }), true);                      // InitiateCheckout
  assert.equal(ehRaizV2({ content_name: 'quiz-lead-raiz-v2' }), true);      // Lead
  assert.equal(ehRaizV2({ slug: 'raiz' }), false);
  assert.equal(ehRaizV2({ content_name: 'InitiateCheckout_Raiz' }), false);
  assert.equal(ehRaizV2({}), false);
});

// ─── Camada 2 (?source=pr_nurture) ───────────────────────────────────────────
// O funil pago de canetas continua sendo o /raiz-v2 puro. Tudo abaixo só liga
// com source=pr_nurture, que é o link do D+3 para quem já fez o quiz 1.

test('camada 2 tem rota própria e não toca o funil pago', () => {
  assert.match(server, /app\.get\('\/raiz-radar'/);
  assert.match(server, /app\.get\('\/raiz-v2'/);
  // as duas rotas servem o mesmo arquivo
  assert.equal((server.match(/'quiz-raiz-v2\.html'/g) || []).length, 2);
  assert.match(html, /location\.pathname\.replace\(\/\\\/\+\$\/,''\)\.toLowerCase\(\) === '\/raiz-radar'/);
  // ?source=pr_nurture segue valendo para links já enviados
  assert.match(html, /\(QS\.get\('source'\) \|\| ''\)\.toLowerCase\(\) === 'pr_nurture'/);
  // hero, oferta e perguntas antigas seguem no arquivo, intactos
  assert.match(html, /<h1 id="heroTitle">E quando a fome <em>voltar\?<\/em><\/h1>/);
  assert.match(html, /https:\/\/pay\.cakto\.com\.br\/ai223ee/);
  // e o que é da camada 2 está condicionado
  assert.match(html, /if\(NURTURE\)aplicarNurtureResultado\(\)/);
  assert.match(html, /!NURTURE&&stage==='never'&&ALT_OPTIONS/);
});

test('camada 2 tem 14 perguntas pontuadas e medicação vira contexto', () => {
  const n = html.slice(html.indexOf('const Q_NURTURE'), html.indexOf('const Q_PERFIL'));
  assert.equal((n.match(/tag:'\d+ ·/g) || []).length, 15);   // 14 pontuadas + contexto
  assert.equal((n.match(/dim:'/g) || []).length, 6);          // um dedicado por pilar
  assert.equal((n.match(/weights:true/g) || []).length, 8);
  assert.equal((n.match(/stage:true/g) || []).length, 1);
  // a de medicação é a única sem pontuação e não abre o quiz
  assert.match(n, /Medicamentos para emagrecimento fazem parte da sua história hoje\?/);
  assert.match(n, /Essa resposta não muda o seu Radar/);
  const posMed = n.indexOf('Medicamentos para emagrecimento');
  assert.ok(posMed > n.length * 0.6, 'medicação deve ficar no fim do questionário');
});

test('perfil do quiz 1 vem do lid, da URL ou da pergunta, e nunca pontua', () => {
  assert.match(server, /app\.get\('\/api\/raiz-v2\/contexto'/);
  assert.match(server, /quiz:perfil:\$\{phone\}/);
  assert.match(html, /const PERFIL_DE_LETRA = \{ E:'emocional', R:'restritiva', S:'sobrevivencia', A:'desconectada' \}/);
  assert.match(html, /if\(q\.perfil\)return;/);           // recompute ignora
  assert.match(html, /perfil:true/);
  for (const p of ['emocional','restritiva','sobrevivencia','desconectada','nenhum']) {
    assert.ok(html.includes(`${p}:'`) || html.includes(`${p}:`), `transição de ${p}`);
  }
});

test('oferta da camada 2 é a Sessão Raiz isolada, sem PR nem livro', () => {
  assert.match(html, /const CHECKOUT_SESSAO_RAIZ_URL = 'https:\/\/pay\.cakto\.com\.br\/ak63ytv_1149729'/);
  assert.match(html, /const PRECO_SESSAO = 67/);
  assert.match(html, /content_name:'Sessão Raiz',currency:'BRL',value:PRECO_SESSAO/);
  // esconde o que é da oferta de R$ 97
  assert.match(html, /\['compBand','journeyBand','priceBand','offerAnchor'\]\.forEach/);
  const oferta = html.slice(html.indexOf('const OFERTA_SESSAO'), html.indexOf('const FAQ_SESSAO'));
  assert.doesNotMatch(oferta, /Protocolo Raiz/);
  assert.doesNotMatch(oferta, /Gordura Não Existe/);
});

test('dado psicológico do funil não vai para a Meta', () => {
  // previous_profile e pilar entram só no payload do nosso endpoint
  const seg = html.slice(html.indexOf('function segmentoInterno'), html.indexOf('function heroNurture'));
  assert.match(seg, /previous_profile/);
  const ic = html.slice(html.indexOf('function checkoutSessao'), html.length);
  const fbqCall = ic.slice(ic.indexOf("fbq('track','InitiateCheckout'"), ic.indexOf('fetch('));
  assert.doesNotMatch(fbqCall, /previous_profile|lowest_pillar|highest_pillar/);
});

test('eventos novos da camada 2 existem e os antigos continuam', () => {
  for (const ev of ['RadarStarted','RadarProgress','RadarCompleted','RadarResultViewed','SessaoRaizOfferViewed']) {
    assert.match(html, new RegExp(ev));
  }
  for (const ev of ['QuizStart','Lead','CompleteRegistration','OfferView','InitiateCheckout','QuizProgress']) {
    assert.match(html, new RegExp(ev));
  }
});
