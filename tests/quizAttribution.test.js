const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/quiz-cakto.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

// Reexecuta o bloco de atribuição do quiz num DOM falso, para testar a regra
// de primeiro/último toque de verdade em vez de só procurar texto no arquivo.
function carregarAtribuicao({ search = '', cookie = '' } = {}) {
  const trecho = html.slice(
    html.indexOf("const ATTR_KEYS = ["),
    html.indexOf('try { persistAttribution(); } catch(e){}'),
  );
  const jar = { value: cookie };
  const sandbox = {
    window: { location: { search } },
    document: {
      get cookie() { return jar.value; },
      set cookie(v) {
        const [pair] = v.split(';');
        const i = pair.indexOf('=');
        const nome = pair.slice(0, i);
        const resto = jar.value.split('; ').filter(c => c && !c.startsWith(nome + '='));
        resto.push(pair);
        jar.value = resto.join('; ');
      },
    },
    URLSearchParams,
    getCookie(name) {
      const m = jar.value.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return m ? m[2] : null;
    },
  };
  const fn = new Function('window', 'document', 'URLSearchParams', 'getCookie',
    trecho + '\nreturn { persistAttribution, attrFromUrl };');
  return { api: fn(sandbox.window, sandbox.document, URLSearchParams, sandbox.getCookie), jar };
}

test('captura utm_content e utm_term do link do anúncio', () => {
  const { api } = carregarAtribuicao({ search: '?utm_content=RAIZ_S41_CEREBRO_TALKINGHEAD_V01&utm_term=120254867693720450' });
  const r = api.persistAttribution();
  assert.equal(r.latest.utm_content, 'RAIZ_S41_CEREBRO_TALKINGHEAD_V01');
  assert.equal(r.latest.utm_term, '120254867693720450');
  assert.ok(r.latest.captured_at > 0);
});

test('primeiro toque NÃO é sobrescrito por uma visita posterior', () => {
  const primeiro = carregarAtribuicao({ search: '?utm_content=ANUNCIO_A' });
  primeiro.api.persistAttribution();
  const cookies = primeiro.jar.value;

  const segundo = carregarAtribuicao({ search: '?utm_content=ANUNCIO_B', cookie: cookies });
  const r = segundo.api.persistAttribution();
  assert.equal(r.first.utm_content, 'ANUNCIO_A', 'primeiro toque tem de sobreviver');
  assert.equal(r.latest.utm_content, 'ANUNCIO_B', 'último toque tem de refletir a visita atual');
});

test('visita sem utm preserva o que já havia — não zera a atribuição', () => {
  const primeiro = carregarAtribuicao({ search: '?utm_content=ANUNCIO_A' });
  primeiro.api.persistAttribution();
  const direto = carregarAtribuicao({ search: '', cookie: primeiro.jar.value });
  const r = direto.api.persistAttribution();
  assert.equal(r.first.utm_content, 'ANUNCIO_A');
  assert.equal(r.latest.utm_content, 'ANUNCIO_A');
});

test('sem utm nenhuma e sem cookie, devolve vazio sem quebrar', () => {
  const { api } = carregarAtribuicao({ search: '' });
  const r = api.persistAttribution();
  assert.deepEqual(r.first, {});
  assert.deepEqual(r.latest, {});
});

test('usa os mesmos cookies do /conversa — primeiro toque cruza os funis', () => {
  const conversa = readFileSync(join(root, 'public/js/conversa-tracking.js'), 'utf8');
  for (const nome of ['table_attr_first', 'table_attr_latest']) {
    assert.ok(html.includes(nome), `quiz deve usar ${nome}`);
    assert.ok(conversa.includes(nome), `/conversa deve usar ${nome}`);
  }
});

test('atribuição vai junto do Lead e é gravada no registro da lead', () => {
  assert.match(html, /attribution: persistAttribution\(\)/);
  assert.match(server, /attribution:   req\.body\.attribution \|\| null,/);
  // tem de ficar no leadRecord, que é o que o webhook de compra lê pelo sck
  const rec = server.slice(server.indexOf('const leadRecord = {'), server.indexOf('saved_at:      new Date().toISOString(),'));
  assert.match(rec, /attribution/);
});

test('atribuição não é enviada para a Meta junto do evento', () => {
  // utm não é dado sensível, mas o payload da Meta é montado a partir de uma
  // lista explícita; atribuição entrou como dado nosso, não como parâmetro de evento.
  const capi = server.slice(server.indexOf("app.post('/api/capi'"), server.indexOf('const leadRecord = {'));
  assert.doesNotMatch(capi, /custom_data[^]{0,400}attribution/);
});

test('atribuição nunca derruba a captura da lead', () => {
  // Regressão: persistAttribution() é chamada DENTRO do submitCapture. Sem
  // blindagem, um ambiente sem cookie/URLSearchParams fazia o fetch do Lead
  // nem acontecer — perder lead para medir anúncio é o pior dos dois mundos.
  const trecho = html.slice(
    html.indexOf('const ATTR_KEYS = ['),
    html.indexOf('try { persistAttribution(); } catch(e){}'),
  );
  const fn = new Function('window', 'document', 'URLSearchParams', 'getCookie',
    trecho + '\nreturn persistAttribution;');
  // ambiente hostil: tudo quebra
  const hostil = fn(
    { get location() { throw new Error('sem location'); } },
    { get cookie() { throw new Error('sem cookie'); }, set cookie(v) { throw new Error('sem cookie'); } },
    function () { throw new Error('sem URLSearchParams'); },
    function () { throw new Error('sem getCookie'); },
  );
  assert.doesNotThrow(() => hostil());
  assert.deepEqual(hostil(), { first: {}, latest: {} });
});
