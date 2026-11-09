// A ponte entre o Radar e o formulário da pré-consulta.
//
// O /forms é preenchido DEPOIS da compra, vem das páginas de obrigado e não
// recebe `lid` nenhum. O resultado do Radar, por sua vez, fica em
// `radar:<radarId>` — indexado pelo id que vira `sck` no checkout. Resultado:
// as seis notas existiam e nunca chegavam ao card.
//
// Em 09/11/2026 isso virou um índice reverso por telefone, e foi ELE que
// permitiu encurtar o formulário de 13 para 7 campos: `rotina`, `objetivo` e
// `padrao_abandono` são perguntas que o Radar já faz (Q3/Q10, Q12 e Q6).
//
// Se este arquivo quebrar, o corte do formulário virou perda de informação.

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const fonte = readFileSync(join(__dirname, '..', 'src/server.js'), 'utf8');

function recortaFuncao(txt, nome) {
  const ini = txt.search(new RegExp(`(async )?function ${nome}\\(`));
  assert.notEqual(ini, -1, `função ${nome} não encontrada`);
  let prof = 0;
  for (let j = txt.indexOf('{', ini); j < txt.length; j++) {
    if (txt[j] === '{') prof++;
    else if (txt[j] === '}' && --prof === 0) return txt.slice(ini, j + 1);
  }
  throw new Error(`fechamento de ${nome} não encontrado`);
}

const phoneKey = new Function(`${recortaFuncao(fonte, 'phoneKey')} return phoneKey;`)();

/** Monta attachRadarDoQuiz com um Redis falso e o phoneKey real. */
function montaAttach(mapa, { erro = false } = {}) {
  const lidos = [];
  const redisGet = async (k) => {
    lidos.push(k);
    if (erro) throw new Error('Stream isn\'t writeable');
    return Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : null;
  };
  const fn = new Function('redisGet', 'phoneKey', `
    ${recortaFuncao(fonte, 'attachRadarDoQuiz')}
    return attachRadarDoQuiz;
  `)(redisGet, phoneKey);
  return { attach: fn, lidos };
}

// ─── phoneKey ────────────────────────────────────────────────────────────────

test('phoneKey é a mesma regra do pr_phone_key do Hub: 55 + DDD + 8 finais', () => {
  assert.equal(phoneKey('11980829196'), '551180829196');
  assert.equal(phoneKey('(11) 98082-9196'), '551180829196');
  assert.equal(phoneKey('5511980829196'), '551180829196');
  assert.equal(phoneKey('+55 11 98082-9196'), '551180829196');
});

test('phoneKey colapsa o 9º dígito — é esse o ponto', () => {
  // A mesma pessoa digita com o 9 no quiz e sem no formulário. Com comparação
  // exata de string a ponte quebrava em silêncio: nenhum erro, só um card sem
  // as notas e seis perguntas repetidas sem necessidade.
  assert.equal(phoneKey('11980829196'), phoneKey('1180829196'));
  assert.equal(phoneKey('5511980829196'), phoneKey('551180829196'));
});

test('phoneKey não confunde DDD 55 com código do país', () => {
  // Santa Maria/RS: 55 999887766 já parece ter país e ficaria sem DDD.
  assert.equal(phoneKey('55999887766'), '5555' + '99887766');
});

test('phoneKey devolve null no que não dá para casar', () => {
  for (const v of [null, undefined, '', '   ', 'abc', '123', '5511']) {
    assert.equal(phoneKey(v), null, `deveria ser null: ${JSON.stringify(v)}`);
  }
});

// ─── attachRadarDoQuiz ───────────────────────────────────────────────────────

const REGISTRO = {
  scores: { body: 3, food: 1, resources: 2, knowledge: 5, awareness: 4, adaptability: 2 },
  route: 'A', fit_score: 3, readiness_score: 3,
  lowest_pillar: 'food', highest_pillar: 'knowledge',
  nome: 'Ana', phone: '5511980829196', at: '2026-11-01T10:00:00.000Z',
};

test('acha o Radar pelo telefone e anexa as notas ao payload', async () => {
  const { attach, lidos } = montaAttach({
    'radar:phone:551180829196': 'lead_abc',
    'radar:lead_abc': JSON.stringify(REGISTRO),
  });
  const out = await attach({ telefone: '5511980829196' });
  assert.deepEqual(out.radar.scores, REGISTRO.scores);
  assert.equal(out.radar.route, 'A');
  assert.equal(out.radar.lowest_pillar, 'food');
  assert.equal(out.radar.highest_pillar, 'knowledge');
  assert.deepEqual(lidos, ['radar:phone:551180829196', 'radar:lead_abc']);
});

test('acha mesmo quando o formulário veio sem o 9º dígito', async () => {
  const { attach } = montaAttach({
    'radar:phone:551180829196': 'lead_abc',
    'radar:lead_abc': JSON.stringify(REGISTRO),
  });
  const out = await attach({ telefone: '1180829196' });
  assert.equal(out.radar.lowest_pillar, 'food');
});

test('sem Radar o payload sai intacto e SEM a chave radar', async () => {
  // Chave ausente não pode virar `radar: {}`: o Hub testa a existência para
  // decidir se monta as linhas, e objeto vazio renderizaria rótulo oco.
  const { attach } = montaAttach({});
  const out = await attach({ telefone: '5511980829196', nome: 'Ana' });
  assert.equal('radar' in out, false);
  assert.equal(out.nome, 'Ana');
});

test('índice aponta para registro que expirou: não inventa nada', async () => {
  // O índice e o registro têm o mesmo TTL, mas são gravações independentes —
  // uma pode falhar sozinha.
  const { attach } = montaAttach({ 'radar:phone:551180829196': 'lead_abc' });
  const out = await attach({ telefone: '5511980829196' });
  assert.equal('radar' in out, false);
});

test('registro sem notas é ignorado', async () => {
  const { attach } = montaAttach({
    'radar:phone:551180829196': 'lead_abc',
    'radar:lead_abc': JSON.stringify({ route: 'A', scores: null }),
  });
  const out = await attach({ telefone: '5511980829196' });
  assert.equal('radar' in out, false);
});

test('JSON corrompido não derruba o envio do formulário', async () => {
  const { attach } = montaAttach({
    'radar:phone:551180829196': 'lead_abc',
    'radar:lead_abc': '{quebrado',
  });
  const out = await attach({ telefone: '5511980829196', nome: 'Ana' });
  assert.equal(out.nome, 'Ana');
  assert.equal('radar' in out, false);
});

test('Redis fora do ar NUNCA bloqueia o formulário', async () => {
  // A resposta da lead vale mais que o enriquecimento. Já perdemos respostas
  // por depender de um repasse.
  const { attach } = montaAttach({}, { erro: true });
  const out = await attach({ telefone: '5511980829196', nome: 'Ana' });
  assert.equal(out.nome, 'Ana');
  assert.equal('radar' in out, false);
});

test('telefone impossível não chega a consultar o Redis', async () => {
  const { attach, lidos } = montaAttach({});
  await attach({ telefone: 'abc' });
  assert.deepEqual(lidos, []);
});

// ─── fiação ──────────────────────────────────────────────────────────────────

test('o índice reverso é gravado junto com o resultado do Radar', () => {
  assert.match(fonte, /radar:phone:\$\{chaveTel\}/);
  assert.match(fonte, /const chaveTel = phoneKey\(registro\.phone\)/);
  // Mesmo TTL do registro: índice vivo apontando para registro morto não serve.
  const bloco = fonte.slice(fonte.indexOf('[radar-persist]'));
  assert.match(bloco, /radar:phone:[^]*?'EX', 60 \* 60 \* 24 \* 180/);
});

test('a rota do formulário chama o attach do Radar', () => {
  assert.match(fonte, /await attachRadarDoQuiz\(\s*await attachPerfilDoQuiz\(normalizePreSessaoPayload/);
});

test('normalize preserva o radar para o reenvio do drain', () => {
  // `pre_sessao:failed:*` guarda o payload JÁ enriquecido. Normalizar sem esta
  // linha descartaria o Radar justamente na tentativa que deu certo.
  assert.match(fonte, /radar: body\.radar \|\| null/);
});

test('o quiz:perfil continua por normalizePhone — não foi reindexado', () => {
  // Trocar a regra lá orfanaria 180 dias de chaves já gravadas de uma vez.
  assert.match(fonte, /quiz:perfil:\$\{payload\.telefone\}/);
  assert.match(fonte, /quiz:perfil:\$\{perfilPhone\}/);
});

// ─── o formulário encurtado ──────────────────────────────────────────────────

const form = readFileSync(join(__dirname, '..', 'public/Funil/formulario-pre-sessao.html'), 'utf8');

test('o formulário ficou com 7 campos', () => {
  const nomes = [...form.matchAll(/name="([^"]+)"/g)].map(m => m[1])
    .filter(n => n !== 'viewport' && n !== 'robots');
  assert.deepEqual([...new Set(nomes)].sort(),
    ['dificuldade_hoje', 'historico', 'horario', 'nome', 'observacoes', 'saude', 'telefone']);
});

test('os 6 campos cortados não existem mais como input', () => {
  for (const n of ['sentimento_inicial', 'padrao_abandono', 'saude_outro', 'objetivo', 'uma_coisa', 'rotina']) {
    assert.doesNotMatch(form, new RegExp(`name="${n}"`), `${n} ainda está no formulário`);
    assert.doesNotMatch(form, new RegExp(`data\\.get(All)?\\('${n}'\\)`), `${n} ainda vai no payload`);
  }
});

test('sobrou UMA redação obrigatória, não três', () => {
  // Era o pior atrito do formulário: quem acabou de pagar tinha de escrever
  // três textos livres, dois obrigatórios e sobre quase a mesma coisa
  // (`dificuldade_hoje` e `uma_coisa`).
  const obrigatorias = [...form.matchAll(/<textarea[^>]*required/g)];
  assert.equal(obrigatorias.length, 1);
  assert.match(form, /name="dificuldade_hoje"[^>]*required/);
});

test('nenhuma seção ficou sem campo', () => {
  // O bloco "Seu objetivo" perdeu os dois campos de uma vez e viraria um
  // título solto entre dois divisores.
  assert.doesNotMatch(form, /Seu <em>objetivo<\/em>/);
  assert.doesNotMatch(form, /BLOCO 4: OBJETIVO/);
  // E o bloco 5 não pode mais se chamar "Rotina".
  assert.doesNotMatch(form, /<em>Rotina<\/em> e disponibilidade/);
  assert.match(form, /<em>Disponibilidade<\/em>/);
});

test('a saída de emergência pelo WhatsApp não cita campo que não existe', () => {
  const bloco = form.slice(form.indexOf('Saída de emergência'), form.indexOf('errorEl.innerHTML'));
  assert.doesNotMatch(bloco, /payload\.objetivo/);
  assert.match(bloco, /payload\.dificuldade_hoje/);
});
