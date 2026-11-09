const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const dr = require('../src/dossieRuptura');
const server = readFileSync(join(__dirname, '..', 'src/server.js'), 'utf8');
const pagina = readFileSync(join(__dirname, '..', 'public/Funil/dossie-ruptura.html'), 'utf8');

// Redis de mentira: só o que o módulo usa.
function fakeRedis() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async set(k, v, ...args) {
      if (args.includes('NX') && m.has(k)) return null;
      m.set(k, v); return 'OK';
    },
    async del(k) { return m.delete(k) ? 1 : 0; },
    async keys(p) { const pre = p.replace('*', ''); return [...m.keys()].filter(k => k.startsWith(pre)); },
  };
}
const silencioso = { log() {}, error() {} };
const REG = {
  nome: 'MARIANA SILVA', route: 'B', phone: '5511999990000',
  identity_key: 'bill', identity_confidence: 'clear',
  scores: { body: 2, food: 1, resources: 4, knowledge: 4, awareness: 2, adaptability: 5 },
};

test('agenda com token opaco, 15 min depois, sem expor o id da lead', async () => {
  const r = fakeRedis();
  const t0 = 1_000_000;
  const a = await dr.agendarDossie(r, { radarId: 'lead_abc', phone: '5511999990000', nome: 'Mariana', route: 'B' }, t0);
  assert.equal(a.agendado, true);
  assert.match(a.token, /^[0-9a-f]{32}$/);
  assert.equal(a.due_at, t0 + 15 * 60 * 1000);
  assert.equal(JSON.parse(await r.get(`pr:dossie:${a.token}`)).radar_id, 'lead_abc');
  assert.ok(!a.token.includes('lead_abc'));
});

test('mesmo quiz reenviado reaproveita o token', async () => {
  const r = fakeRedis();
  const a = await dr.agendarDossie(r, { radarId: 'x', phone: '5511' });
  const b = await dr.agendarDossie(r, { radarId: 'x', phone: '5511' });
  assert.equal(a.token, b.token);
});

test('optout e envio recente não agendam, mas a página continua existindo', async () => {
  const r = fakeRedis();
  await r.set('recovery:optout:5511', 'x');
  const a = await dr.agendarDossie(r, { radarId: 'y', phone: '5511' });
  assert.equal(a.agendado, false);
  assert.ok(await r.get(`pr:dossie:${a.token}`));
  const r2 = fakeRedis();
  await r2.set('radar:dossie:sent:5522', 'x');
  assert.equal((await dr.agendarDossie(r2, { radarId: 'z', phone: '5522' })).agendado, false);
});

test('sweep em sombra não envia, loga uma vez e encerra a pendência', async () => {
  const r = fakeRedis();
  await dr.agendarDossie(r, { radarId: 'l1', phone: '5511', nome: 'Ana' }, 0);
  let chamadas = 0;
  const res = await dr.varrerDossies({ redis: r, enviar: async () => { chamadas++; }, dentroDoHorario: () => true, ativo: false, agora: dr.DELAY_MS + 1, log: silencioso });
  assert.equal(chamadas, 0);
  assert.equal(res.sombra, 1);
  assert.equal(await r.get('radar:dossie:pending:5511'), null);
});

test('sweep ligado envia o modelo com nome no corpo e token no botão, e registra no Hub', async () => {
  const r = fakeRedis();
  const { token } = await dr.agendarDossie(r, { radarId: 'l2', phone: '5511', nome: 'JOANA dark' }, 0);
  const enviados = [], hub = [];
  const res = await dr.varrerDossies({
    redis: r, ativo: true, dentroDoHorario: () => true, agora: dr.DELAY_MS + 1, log: silencioso,
    enviar: async (p) => { enviados.push(p); return { messages: [{ id: 'wamid.1' }] }; },
    registrarNoHub: async (p) => { hub.push(p); },
  });
  assert.equal(res.enviados, 1);
  const tpl = enviados[0].template;
  assert.equal(tpl.name, 'dossie_ruptura');
  assert.equal(tpl.components[0].parameters[0].text, 'Joana');
  assert.equal(tpl.components[1].parameters[0].text, token);
  assert.ok(await r.get('radar:dossie:sent:5511'));
  await new Promise(s => setImmediate(s));
  assert.equal(hub[0].template_name, 'dossie_ruptura');
  assert.equal(hub[0].provider_message_id, 'wamid.1');
  assert.match(hub[0].body_text, /Seu Dossiê do Radar ficou pronto/);
});

test('antes de 15 min, fora da janela, comprou ou optout: nada sai', async () => {
  const r = fakeRedis();
  await dr.agendarDossie(r, { radarId: 'l3', phone: '5533' }, 0);
  const enviar = async () => { throw new Error('não devia enviar'); };
  const base = { redis: r, enviar, ativo: true, log: silencioso };
  assert.equal((await dr.varrerDossies({ ...base, dentroDoHorario: () => true, agora: 1000 })).enviados, 0);
  assert.equal((await dr.varrerDossies({ ...base, dentroDoHorario: () => false, agora: dr.DELAY_MS + 1 })).enviados, 0);
  assert.ok(await r.get('radar:dossie:pending:5533'), 'fora da janela a pendência espera');
  assert.equal(await dr.cancelarDossie(r, '5533'), true);   // compra / pré-consulta
  await dr.agendarDossie(r, { radarId: 'l4', phone: '5544' }, 0);
  await r.set('recovery:optout:5544', 'x');
  const res = await dr.varrerDossies({ ...base, dentroDoHorario: () => true, agora: dr.DELAY_MS + 1 });
  assert.equal(res.descartados, 1);
});

test('erro da Meta re-tenta até 5 vezes e depois descarta', async () => {
  const r = fakeRedis();
  await dr.agendarDossie(r, { radarId: 'l5', phone: '5555' }, 0);
  const deps = { redis: r, ativo: true, dentroDoHorario: () => true, agora: dr.DELAY_MS + 1, log: silencioso, enviar: async () => { throw new Error('132001'); } };
  for (let i = 0; i < 4; i++) await dr.varrerDossies(deps);
  assert.ok(await r.get('radar:dossie:pending:5555'));
  await dr.varrerDossies(deps);
  assert.equal(await r.get('radar:dossie:pending:5555'), null);
});

test('dossiê mostra a identidade que ela leu e marca o pilar mais apertado', () => {
  const d = dr.montarDossie({ registro: REG, lead: { email: 'm@x.com' }, radarId: 'lead_1' });
  assert.equal(d.nome, 'Mariana');
  assert.equal(d.rota, 'B');
  assert.equal(d.identidade.nome, 'A Conta Depois do Prato');
  assert.equal(d.identidade.selo, 'Padrão predominante');
  assert.equal(d.pilar_foco, 'food');
  assert.equal(d.dias.length, 7);
  assert.deepEqual(d.dias.filter(x => x.personalizado).map(x => x.n), [2, 4]);
  const u = new URL(d.checkout_url);
  assert.equal(u.origin + u.pathname, 'https://pay.cakto.com.br/3azm4o3_1219891');
  assert.equal(u.searchParams.get('sck'), 'lead_1');
  assert.equal(u.searchParams.get('phone'), '+5511999990000');
  assert.equal(u.searchParams.get('email'), 'm@x.com');
  assert.equal(d.preconsulta_url, '/pre-consulta?lid=lead_1');
});

test('registro sem identity_key (anterior ao deploy) ainda ganha nome', () => {
  const { identity_key, identity_confidence, ...antigo } = REG;
  const d = dr.montarDossie({ registro: antigo });
  assert.ok(d.identidade && d.identidade.nome);
});

test('rota inválida cai em B', () => {
  assert.equal(dr.montarDossie({ registro: { ...REG, route: 'Z' } }).rota, 'B');
});

test('página: token opaco na URL, sem PageView novo, IC com funnel do Radar', () => {
  assert.match(pagina, /dossie_token:token/);
  assert.match(pagina, /funnel:'raiz-radar'/);
  assert.match(pagina, /InitiateCheckout_DossieRuptura/);
  assert.doesNotMatch(pagina, /fbq\('track','PageView'/);
  assert.doesNotMatch(pagina, /fbq\('track','ViewContent'/);
});

// ── Recuperação de checkout da Primeira Ruptura ─────────────────────────────

test('IC do Radar e do dossiê recuperam pelo canal radar, não pelo Ticto do PR', () => {
  const fn = server.slice(server.indexOf('function recoveryProviderDoIC'), server.indexOf('function recoveryChannel(rec)'));
  const recoveryProviderDoIC = new Function(`${fn}; return recoveryProviderDoIC;`)();
  assert.equal(recoveryProviderDoIC('raiz-radar'), 'radar');
  assert.equal(recoveryProviderDoIC('dossie-ruptura'), 'radar');
  assert.equal(recoveryProviderDoIC('raiz-cakto'), 'cakto');
  assert.equal(recoveryProviderDoIC('raiz-vi'), 'cakto');
  assert.equal(recoveryProviderDoIC(''), 'ticto');
  assert.match(server, /provider: recoveryProviderDoIC\(src\)/);
});

test('canal radar: modelo e oferta próprios, e nasce em sombra', () => {
  assert.match(server, /WHATSAPP_RECOVERY_TEMPLATE_RADAR \|\| 'recuperacao_checkout_ruptura'/);
  assert.match(server, /const RADAR_CAKTO_PATH = '3azm4o3_1219891';/);
  assert.match(server, /process\.env\.RADAR_RECOVERY_ENABLED === 'true'/);
  assert.match(server, /recoveryEnabled\(\) && \(rec\.provider !== 'radar' \|\| radarRecoveryEnabled\(\)\)/);
});

test('pix do checkout do Radar recupera pelo canal radar', () => {
  assert.match(server, /String\(d\.checkoutUrl \|\| ''\)\.includes\(RADAR_CAKTO_PATH\.split\('_'\)\[0\]\) \? 'radar' : 'cakto'/);
});

test('dossiê nasce em sombra e é cancelado por compra, pré-consulta e SAIR', () => {
  assert.equal(dr.dossieAtivo({}), false);
  assert.equal(dr.dossieAtivo({ RADAR_DOSSIE_ENABLED: '1' }), false);
  assert.equal(dr.dossieAtivo({ RADAR_DOSSIE_ENABLED: 'true' }), true);
  assert.match(server, /dossieRuptura\.cancelarDossie\(getRedis\(\), record\.phone\)/);
  assert.match(server, /dossieRuptura\.cancelarDossie\(getRedis\(\), telefone\)/);
  assert.match(server, /redisDel\(`radar:dossie:pending:\$\{from\}`\)/);
});
