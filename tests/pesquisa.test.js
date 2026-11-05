const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const S = require('../public/pesquisa/survey-def');
const { createPesquisaRouter, buildPayload } = require('../src/pesquisa/routes');
const express = require('express');

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'public/pesquisa/index.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

const a = (codes, text) => ({ codes, text: text || null });
const ids = (block) => S.QUESTIONS.filter((q) => q.block === block).map((q) => q.id);

test('estrutura do questionário: IDs na ordem e Q01 com códigos A–E', () => {
  assert.equal(S.QUESTIONS.length, 54);
  assert.deepEqual(ids('A'), ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09']);
  assert.deepEqual(ids('B'), ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10']);
  assert.deepEqual(ids('C'), ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08']);
  assert.deepEqual(ids('D'), ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07']);
  assert.deepEqual(ids('E'), ['E01', 'E02', 'E03', 'E04']);
  assert.deepEqual(ids('G'), ['G01', 'G02', 'G03', 'G04', 'G05', 'G05A', 'G05B', 'G06', 'G07', 'G08']);
  assert.deepEqual(ids('P'), ['P01', 'P02', 'P03', 'P04', 'P05']);
  assert.deepEqual(S.BY_ID.Q01.options.map((o) => o.code), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(S.BY_ID.A03.max, 2);
  assert.equal(S.BY_ID.A04.max, 2);
  assert.equal(S.BY_ID.C05.type, 'multi');
  assert.equal(S.BY_ID.C05.max, null);
  const codes = new Set();
  for (const q of S.QUESTIONS) for (const o of q.options) { assert.ok(!codes.has(o.code), o.code); codes.add(o.code); }
});

test('cada segmento vê só o próprio bloco, depois G e Perfil', () => {
  for (const seg of S.SEGMENTS) {
    const path = S.computePath({ Q01: a([seg]) });
    const blocks = new Set(path.map((id) => S.BY_ID[id].block));
    for (const other of S.SEGMENTS) if (other !== seg) assert.ok(!blocks.has(other), `${seg} viu bloco ${other}`);
    assert.equal(path[0], 'Q01');
    assert.deepEqual(path.slice(-5), ['P01', 'P02', 'P03', 'P04', 'P05']);
    assert.ok(path.indexOf('G01') > path.indexOf(ids(seg).at(-1) === 'B10' ? 'B09' : ids(seg).at(-1)));
  }
  assert.deepEqual(S.computePath({}), ['Q01']);
});

test('condicionais: B10 só com B09=Não; G05A/G05B conforme G05', () => {
  assert.ok(!S.computePath({ Q01: a(['B']) }).includes('B10'));
  assert.ok(!S.computePath({ Q01: a(['B']), B09: a(['B09_02']) }).includes('B10'));
  assert.ok(S.computePath({ Q01: a(['B']), B09: a(['B09_03']) }).includes('B10'));
  const g = (code) => S.computePath({ Q01: a(['D']), G05: a([code]) });
  assert.ok(g('G05_01').includes('G05A') && !g('G05_01').includes('G05B'));
  assert.ok(g('G05_02').includes('G05A') && g('G05_02').includes('G05B'));
  assert.ok(!g('G05_03').includes('G05A') && !g('G05_03').includes('G05B'));
});

test('menor de 18 encerra no P01', () => {
  const path = S.computePath({ Q01: a(['E']), P01: a([S.UNDER_18_CODE]) });
  assert.equal(path.at(-1), 'P01');
  assert.ok(S.isUnderage({ P01: a(['P01_01']) }));
});

test('validação de respostas', () => {
  assert.equal(S.normalizeAnswer('A03', { codes: ['A03_01', 'A03_02', 'A03_03'] }).error, 'selecao_acima_do_maximo');
  assert.equal(S.normalizeAnswer('A03', { codes: ['A03_06', 'A03_01'] }).error, 'alternativa_exclusiva');
  assert.equal(S.normalizeAnswer('Q01', { codes: ['A', 'B'] }).error, 'selecao_unica');
  assert.equal(S.normalizeAnswer('Q01', { codes: ['X'] }).error, 'alternativa_invalida');
  assert.equal(S.normalizeAnswer('ZZZ', {}).error, 'pergunta_desconhecida');
  const outro = S.normalizeAnswer('A02', { codes: ['A02_06'], text: '  indicação  ' });
  assert.deepEqual([outro.labels, outro.text], [['Outro'], 'indicação']);
  assert.equal(S.normalizeAnswer('A02', { codes: ['A02_01'], text: 'sobra' }).text, null);
  assert.equal(S.normalizeAnswer('A05', { codes: [], text: '' }).skipped, true);
  const quick = S.normalizeAnswer('G01', { codes: ['G01_01'], text: 'ignorado' });
  assert.deepEqual([quick.labels, quick.text, quick.skipped], [['Nada, atingir o peso seria suficiente'], null, false]);
  const multi = S.normalizeAnswer('C05', { codes: ['C05_01', 'C05_02', 'C05_03', 'C05_05'] });
  assert.ok(multi.ok);
});

test('privacidade: sem pixel, sem coleta de contato, consentimento antes do início', () => {
  assert.doesNotMatch(page, /fbq\(|gtag\(|googletagmanager|connect\.facebook|tiktok|clarity|hotjar/i);
  assert.doesNotMatch(page, /type="(email|tel)"|telefone\s*\*|name="(nome|email|phone)"/i);
  assert.match(page, /id="consent"/);
  assert.match(page, /consent: true/);
  assert.match(page, /noindex/);
});

test('textos de abertura e encerramento do questionário', () => {
  assert.match(page, /Emagrecer é só uma parte da <em>história\.<\/em>/);
  assert.match(page, /O Mounjaro mudou a conversa sobre emagrecimento\. Mas queremos entender algo maior: o que realmente importa para você nessa jornada\?/);
  assert.match(page, /A pesquisa é anônima e leva aproximadamente 5 minutos\./);
  assert.match(page, />Quero participar</);
  assert.match(page, /Obrigada por compartilhar sua <em>perspectiva\.<\/em>/);
  assert.match(page, /Sua participação é muito importante para nós\./);
  assert.match(page, /class="sign">Table Clinic</);
});

test('rotas montadas no server antes do static', () => {
  const mount = server.indexOf("require('./pesquisa/routes').createPesquisaRouter()");
  assert.ok(mount > 0 && mount < server.indexOf('app.use(express.static('));
});

const RID = '20204e43-46eb-4a65-8a06-581e4e94bdf5';

test('repasse ao Hub: só campos esperados, validados aqui', () => {
  assert.equal(buildPayload('start', { response_id: 'x', consent: true }).error, 'response_id_invalido');
  assert.equal(buildPayload('start', { response_id: RID }).error, 'consentimento_obrigatorio');
  assert.equal(buildPayload('answer', { response_id: RID, question_id: 'A03', answer: { codes: ['A03_01', 'A03_02', 'A03_03'] } }).error, 'selecao_acima_do_maximo');
  const ok = buildPayload('answer', { response_id: RID, question_id: 'A02', answer: { codes: ['A02_06'], text: 'x' }, current_question_id: 'A03', ip: '1.2.3.4', email: 'a@b' });
  assert.deepEqual(Object.keys(ok.body).sort(), ['answer', 'current_question_id', 'question_id', 'response_id', 'source', 'survey_version']);
  assert.equal(ok.body.survey_version, S.SURVEY_VERSION);
});

async function withServer(encaminhar, fn) {
  const app = express();
  app.use(express.json());
  app.use(createPesquisaRouter({ encaminhar }));
  const srv = app.listen(0);
  try { await fn(`http://127.0.0.1:${srv.address().port}`); } finally { srv.close(); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('repasse: Hub fora, 401 ou versão divergente viram retry; erro da resposta é repassado', async () => {
  const startBody = { response_id: RID, consent: true };
  const casos = [
    [{ status: 200, body: { ok: true } }, 200],
    [{ status: 409, body: { error: 'pesquisa_ja_concluida' } }, 409],
    [{ status: 409, body: { error: 'versao_divergente' } }, 503],
    [{ status: 401, body: { error: 'Não autorizado' } }, 502],
    [{ status: 500, body: {} }, 502],
    [{ status: 404, body: {} }, 502], // rota do Hub ainda não publicada
    [{ status: 404, body: { error: 'participante_inexistente' } }, 404],
  ];
  for (const [hub, esperado] of casos) {
    await withServer(async () => hub, async (base) => {
      assert.equal((await post(base + '/api/pesquisa/start', startBody)).status, esperado, JSON.stringify(hub));
    });
  }
  let chamado = false;
  await withServer(async () => { chamado = true; throw new Error('ECONNREFUSED'); }, async (base) => {
    assert.equal((await post(base + '/api/pesquisa/start', startBody)).status, 502);
    assert.equal((await post(base + '/api/pesquisa/answer', { response_id: RID, question_id: 'Q01', answer: { codes: ['Z'] } })).status, 400);
  });
  assert.ok(chamado);
});

test('tela final: WhatsApp com a frase da pesquisa e o núcleo que o SDR casa', () => {
  const m = page.match(/var WHATSAPP_URL = '([^']+)'/);
  assert.ok(m, 'link do WhatsApp na página');
  const url = new URL(m[1]);
  assert.equal(url.origin + url.pathname, 'https://wa.me/5511963934151');
  const texto = url.searchParams.get('text');
  assert.equal(texto, 'Oi! Vim pela pesquisa e quero saber mais sobre o acompanhamento da Table Clinic');
  // núcleo literal do matcher do inbound (sdr-table/src/inbound/entry.js)
  assert.match(texto.toLowerCase(), /quero saber mais sobre o acompanhamento da table clinic/);
  // nada da participação vai junto na mensagem
  assert.doesNotMatch(m[1], /rid|response|state\./i);
});
