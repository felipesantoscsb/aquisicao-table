const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../public/js/mapa-lia-engine.js');
const product = require('../public/js/lia-product-config.js');

const PERSONAS = {
  alivio_emocional: ['emotion','relief','comfort','anxiety','guilt','same_feeling','criticism','before'],
  sobrecarga_noturna: ['night','postpone','energy','many_decisions','fast','exhausted','same_context','timing'],
  tudo_ou_nada: ['offplan','giveup','lost_day','rules','perfect','control','more_rules','after'],
  piloto_automatico: ['night','fast','after','kitchen','unclear','continue','same_context','before'],
  culpa_compensacao: ['offplan','giveup','fix','skip','forbidden','guilt','compensation','after'],
  rotina_sem_estrutura: ['busy','postpone','structure','variable','screen','promise','same_context','timing'],
  emocao_com_repeticao: ['emotion','relief','numb','mixed','repeat','unpredictable','criticism','helped'],
  corpo_percebido_tarde: ['busy','fast','during','work','hungry','guilt','same_context','before'],
};

function runPersona(preferences) {
  const answers = [], path = [], mids = [];
  while (answers.length < engine.MAX_ANSWERS) {
    const question = engine.nextQuestion(answers);
    assert.ok(question, `faltou pergunta na posição ${answers.length + 1}`);
    path.push(question.id);
    const option = preferences.map((id) => question.options.find((o) => o.id === id)).find(Boolean)
      || question.options[0];
    answers.push({ question_id: question.id, option_id: option.id });
    if (answers.length === 3 || answers.length === 6) mids.push(engine.midanswer(answers).text);
  }
  return { answers, path, mids, artifact: engine.buildArtifact(answers), narrative: engine.buildNarrative(answers) };
}

test('oito personas percorrem caminhos realmente diferentes', () => {
  const runs = Object.values(PERSONAS).map(runPersona);
  const paths = new Set(runs.map((r) => r.path.join('>')));
  const branches = new Set(runs.map((r) => r.artifact.branch));
  assert.ok(paths.size >= 4, `só ${paths.size} jornadas distintas`);
  assert.ok(branches.size >= 4, `só ${branches.size} branches distintas`);
  runs.forEach((run) => assert.equal(run.answers.length, 8));
});

test('midanswers citam respostas específicas e variam entre personas', () => {
  const runs = Object.values(PERSONAS).map(runPersona);
  const firstMids = new Set(runs.map((r) => r.mids[0]));
  assert.ok(firstMids.size >= 6);
  runs.forEach((run) => {
    assert.match(run.mids[0], /duas coisas ficaram lado a lado/i);
    assert.match(run.mids[0], /hipótese/i);
  });
});

test('resultado é carta, não relatório ou intervenção entregue', () => {
  const runs = Object.values(PERSONAS).map(runPersona);
  const hypotheses = new Set(runs.map((r) => r.narrative.hypothesis));
  assert.ok(hypotheses.size >= 5);
  runs.forEach((run) => {
    assert.equal(run.narrative.points.length, 3);
    assert.match(run.narrative.intro, /não (?:é )?um diagnóstico/i);
    assert.match(run.narrative.hypothesis, /hipótese/i);
    assert.match(run.narrative.closing, /leitura para aqui de propósito/i);
    assert.ok(run.artifact.recommended_intervention_id);
  });
});

test('artefato contém sinais, conexões, ciclo, confiança e recomendação revalidável', () => {
  const { artifact } = runPersona(PERSONAS.culpa_compensacao);
  assert.equal(artifact.map_version, engine.VERSION);
  assert.ok(artifact.signals.length >= 6);
  assert.ok(artifact.connections.length >= 2);
  assert.ok(artifact.possible_cycle.length >= 3);
  assert.ok(artifact.confidence >= 0 && artifact.confidence <= 1);
  assert.equal(artifact.primary_mechanism, 'compensation');
  assert.equal(artifact.recommended_intervention_id, 'D03');
  assert.match(artifact.recommended_intervention_id, /^[A-Z]\d{2}$/);
  assert.ok(artifact.recommended_intervention_reason.length > 30);
});

test('debug expõe decisão e motivo sem alterar o artefato', () => {
  const run = runPersona(PERSONAS.piloto_automatico);
  const decision = engine.nextDecision(run.answers);
  assert.ok(decision.reason);
  assert.ok(engine.mechanismScores(run.answers).automaticity > 0);
  assert.equal(engine.buildArtifact(run.answers).map_version, run.artifact.map_version);
});

test('preços, checkouts, trial e Pixel têm uma única fonte pública', () => {
  const lia = fs.readFileSync(path.join(__dirname, '../public/lia.html'), 'utf8');
  const thanks = fs.readFileSync(path.join(__dirname, '../public/obrigado-lia.html'), 'utf8');
  const map = fs.readFileSync(path.join(__dirname, '../public/mapa-lia.html'), 'utf8');
  [lia, thanks, map].forEach((html) => assert.match(html, /lia-product-config\.js/));
  assert.equal(product.TRIAL_DAYS, 7);
  assert.match(product.PRICING.monthly.checkout, /ticto\.app/);
  assert.match(product.PIXEL_ID, /^\d+$/);
  assert.equal(product.INTERVENTION_LIBRARY.active, 26);
  assert.equal(product.INTERVENTION_LIBRARY.total, 29);
  assert.equal(product.INTERVENTION_LIBRARY.plannedLabel, 'mais de 50');
  assert.deepEqual(product.INTERVENTION_LIBRARY.formats, ['Áudio', 'Texto', 'Exercício guiado']);
});

test('tracking canônico existe e não envia respostas diretamente à Meta', () => {
  const server = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  const map = fs.readFileSync(path.join(__dirname, '../public/mapa-lia.html'), 'utf8');
  for (const event of ['map_started','question_answered','branch_changed','midanswer_shown','map_completed','result_viewed','cta_clicked','checkout_started','trial_started','first_intervention_unlocked','first_intervention_locked_view','first_intervention_unlock','library_section_view','timeline_view','evelyn_section_view','whatsapp_section_view','whatsapp_demo_view','faq_section_view','faq_opened']) {
    assert.match(server, new RegExp(event));
  }
  assert.doesNotMatch(map, /fbq\([^\n]+answers|fbq\([^\n]+signals|fbq\([^\n]+mechanism/);
  assert.match(server, /sanitizeMapaArtifact/);
});

test('reposicionamento vende metodologia, biblioteca e acompanhamento sem promessas inexistentes', () => {
  const lia = fs.readFileSync(path.join(__dirname, '../public/lia.html'), 'utf8');
  const map = fs.readFileSync(path.join(__dirname, '../public/mapa-lia.html'), 'utf8');
  for (const html of [lia, map]) {
    assert.match(html, /Biblioteca de Intervenções/);
    assert.match(html, /Evelyn Liu/);
    assert.match(html, /acompanhamento/i);
  }
  assert.match(lia, /mais de 50 intervenções/i);
  assert.match(map, /data-library-planned/);
  assert.doesNotMatch(lia + map, /beta 1|já ativas|26 ativas/i);
  assert.doesNotMatch(map, /🎥|vídeos/i);
  assert.match(map, /Deixe a LIA conduzir sua primeira intervenção/);
  assert.match(map, /lia-evelyn-carta\.jpg/);
  assert.match(map, /100% pelo WhatsApp/);
  assert.match(map, /Sem baixar aplicativo/);
  assert.match(map, /id="whatsappDemo"/);
  assert.match(map, /id="faqSection"/);
  assert.match(map, /Sua semana com a LIA/);
});

test('/raiz permanece isolado e o Mapa não aciona automações legadas', () => {
  const server = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8');
  const map = fs.readFileSync(path.join(__dirname, '../public/mapa-lia.html'), 'utf8');
  assert.match(server, /app\.get\('\/raiz'.*quiz-cakto\.html/);
  assert.match(server, /app\.get\('\/mapa-lia'/);
  assert.doesNotMatch(map, /\/api\/capi(?:['"/])|quiz:perfil|SDR|recovery:pending/);
  assert.match(engine.buildNarrative(runPersona(PERSONAS.sobrecarga_noturna).answers).intro, /não (?:é )?um diagnóstico/i);
});
