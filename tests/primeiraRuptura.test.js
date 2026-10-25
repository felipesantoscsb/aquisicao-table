const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const catalogo = JSON.parse(readFileSync(join(root, 'data/primeira-ruptura.json'), 'utf8'));
const quiz = readFileSync(join(root, 'public/quiz-ascensao-table.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

const PILARES = ['body', 'food', 'resources', 'knowledge', 'awareness', 'adaptability'];

test('a espinha tem sete dias na ordem da dramaturgia', () => {
  const etapas = catalogo.dias.map(d => d.etapa);
  assert.deepEqual(etapas, ['Entender', 'Reconhecer', 'Experimentar', 'Observar', 'Preparar', 'Retornar', 'Consolidar']);
  assert.deepEqual(catalogo.dias.map(d => d.n), [1, 2, 3, 4, 5, 6, 7]);
});

test('todo dia resolve para um audio, em qualquer pilar', () => {
  // Pilar sem entrada no dia de troca deixaria a cliente com um dia vazio num
  // entregavel pago, e so apareceria para quem tirasse aquela nota.
  for (const dia of catalogo.dias) {
    if (dia.audio) { assert.ok(catalogo.intervencoes[dia.audio], `dia ${dia.n}: ${dia.audio} sem verbete`); continue; }
    assert.deepEqual(Object.keys(dia.audio_por_pilar).sort(), [...PILARES].sort(), `dia ${dia.n} nao cobre os seis pilares`);
    for (const code of Object.values(dia.audio_por_pilar)) {
      assert.ok(catalogo.intervencoes[code], `dia ${dia.n}: ${code} sem verbete`);
    }
  }
});

test('todo verbete tem arquivo de audio no repo e texto para a cliente', () => {
  for (const [code, iv] of Object.entries(catalogo.intervencoes)) {
    assert.ok(existsSync(join(root, 'public', iv.arquivo)), `${code}: arquivo ausente (${iv.arquivo})`);
    assert.ok(iv.client_content && iv.client_content.trim().length >= 80, `${code}: client_content curto ou ausente`);
    assert.ok(Number(iv.duracao_s) > 0, `${code}: duracao ausente`);
  }
});

test('nenhum audio aponta para o dominio da LIA', () => {
  // yourlia.tech/audio/interventions/*.mp3 responde 404, e o entregavel e pago:
  // nao pode depender do deploy de outro produto.
  const bruto = JSON.stringify(catalogo.intervencoes);
  assert.doesNotMatch(bruto, /yourlia\.tech|https?:\/\//, 'audio deve ser servido pelo proprio aquisicao-table');
});

test('o catalogo curado nao carrega instrucao de agente', () => {
  // O catalogo da LIA e conversacional: agent_intro_instructions e ordem PARA O
  // AGENTE. Renderizar aquilo faz a cliente ler instrucoes sobre ela mesma.
  const bruto = JSON.stringify(catalogo.intervencoes);
  for (const vazamento of ['agent_intro_instructions', 'agent_followup_instructions', 'Entregue este conteúdo']) {
    assert.doesNotMatch(bruto, new RegExp(vazamento, 'i'), `vazou ${vazamento} do catalogo da LIA`);
  }
});

test('o quiz manda as seis notas e o servidor as persiste', () => {
  // Sem isto a venda chega e nao ha de onde montar o mapa: o lead:{id} e
  // gravado no evento de Lead, que acontece antes e sem os scores.
  assert.match(quiz, /pillar_scores:scores/);
  assert.match(server, /ehRadarTable\(req\.body\)/);
  assert.match(server, /`radar:\$\{radarId\}`/);
  assert.match(server, /req\.body\.quiz_lead_event_id \|\| req\.body\.lead_event_id/);
});

test('as notas do Radar nao vao para a Meta', () => {
  // custom_data leva so content_name e content_category. Pontuacao e dado
  // psicologico sensivel.
  assert.doesNotMatch(server, /custom_data\.(pillar_scores|fit_score|lowest_pillar)/);
});


test('R01 e D02 sairam do elenco de vez', () => {
  // Citavam a LIA na propria narracao ("Se a LIA te mandou isso agora" e
  // "Amanha a LIA vai te perguntar como foi") e nao ha regravacao no caminho
  // critico. Decisao de 19/10: fora, nao "regravar depois".
  assert.equal(catalogo.intervencoes.R01, undefined);
  assert.equal(catalogo.intervencoes.D02, undefined);
  // So o que ela LE. _leia_antes e `origem` sao nota interna e citam a LIA de
  // proposito: dizem de onde a peca veio.
  const visivel = [
    ...catalogo.dias.flatMap(d => [d.titulo, d.descricao]),
    ...Object.values(catalogo.intervencoes).flatMap(iv => [iv.nome, iv.client_content]),
    ...Object.values(catalogo.praticas).flatMap(pr => [pr.nome, pr.client_content, pr.campo, pr.placeholder]),
  ];
  for (const txt of visivel) {
    assert.doesNotMatch(String(txt), /\bLIA\b/, `texto visivel para a cliente cita a LIA: "${txt}"`);
  }
});

test('todo dia entrega audio E pratica escrita', () => {
  // Audio sozinho nao gera transformacao em sete dias: a pratica e o que ela
  // faz, e o que ela escreve vira insumo da sessao individual.
  for (const dia of catalogo.dias) {
    assert.ok(dia.audio || dia.audio_por_pilar, `dia ${dia.n} sem audio`);
    assert.ok(dia.pratica, `dia ${dia.n} sem pratica`);
    assert.ok(catalogo.praticas[dia.pratica], `dia ${dia.n}: pratica ${dia.pratica} sem verbete`);
  }
  assert.equal(new Set(catalogo.dias.map(d => d.pratica)).size, 7, 'pratica repetida entre dias');
});

test('toda pratica pede algo escrito, com rotulo e exemplo', () => {
  for (const [code, pr] of Object.entries(catalogo.praticas)) {
    assert.ok(pr.client_content.trim().length >= 120, `${code}: instrucao curta demais`);
    assert.ok(pr.campo && pr.campo.length > 5, `${code}: sem rotulo de campo`);
    assert.ok(pr.placeholder, `${code}: sem exemplo no campo`);
    assert.ok(['texto', 'exercicio'].includes(pr.tipo), `${code}: tipo invalido`);
  }
});

test('nenhuma pratica cobra resposta a um agente', () => {
  // Os roteiros foram escritos para a LIA empurrar e cobrar no dia seguinte.
  // Aqui e pull: ela escreve na pagina, para si, e releia quando quiser.
  for (const [code, pr] of Object.entries(catalogo.praticas)) {
    assert.doesNotMatch(pr.client_content, /me conta|me responde|manda em áudio|eu te devolvo/i,
      `${code}: sobrou linguagem de conversa com agente`);
  }
});

test('os quinze audios limpos entram todos no elenco', () => {
  const usados = new Set();
  for (const dia of catalogo.dias) {
    if (dia.audio) usados.add(dia.audio);
    else Object.values(dia.audio_por_pilar).forEach(c => usados.add(c));
  }
  assert.equal(usados.size, 15);
  assert.deepEqual([...usados].sort(), Object.keys(catalogo.intervencoes).sort());
});

// ─── O mapa montado ─────────────────────────────────────────────────────────
// O catalogo acima garante que a materia-prima existe. Estes testes garantem
// que ela chega inteira na cliente, que era exatamente o que faltava: o JSON e
// os audios estavam no repo desde 19/10 e ninguem montava nada com eles.

const pr = require('../src/primeiraRuptura');

test('o mapa entrega sete dias, todos com audio e pratica', () => {
  const mapa = pr.montarMapa({ nome: 'Ana Souza', scores: { body: 3, food: 2, resources: 1, knowledge: 3, awareness: 2, adaptability: 3 } });
  assert.equal(mapa.dias.length, 7);
  for (const d of mapa.dias) {
    assert.ok(d.audio, `dia ${d.n} sem audio`);
    assert.ok(d.audio.texto && d.audio.texto.length > 60, `dia ${d.n}: texto do audio curto`);
    assert.ok(d.audio.arquivo.startsWith('/pr/audio/'), `dia ${d.n}: audio fora de /pr/audio`);
    assert.ok(d.pratica, `dia ${d.n} sem pratica`);
    assert.ok(d.pratica.campo, `dia ${d.n}: pratica sem rotulo de campo`);
  }
});

test('o pilar mais fraco muda os dias 2 e 4, e so eles', () => {
  // Sem isto a personalizacao seria decorativa: a cliente veria "escolhido
  // pelas suas respostas" num dia igual para todas.
  const a = pr.montarMapa({ scores: { body: 0, food: 3, resources: 3, knowledge: 3, awareness: 3, adaptability: 3 } });
  const b = pr.montarMapa({ scores: { body: 3, food: 3, resources: 3, knowledge: 3, awareness: 3, adaptability: 0 } });
  assert.equal(a.pilar_foco, 'body');
  assert.equal(b.pilar_foco, 'adaptability');

  const difs = a.dias.filter((d, i) => d.audio.codigo !== b.dias[i].audio.codigo).map(d => d.n);
  assert.deepEqual(difs, [2, 4], `dias que mudaram: ${JSON.stringify(difs)}`);
  for (const d of a.dias) assert.equal(d.personalizado, d.n === 2 || d.n === 4);
});

test('nota ausente nao vira zero nem rouba o foco', () => {
  // `knowledge` sem resposta valendo zero seria o pilar mais fraco e mandaria
  // a cliente para um conteudo que nada no quiz dela justificou.
  assert.equal(pr.pilarMaisFraco({ body: 2, food: 1, knowledge: null, awareness: undefined }), 'food');
  assert.equal(pr.pilarMaisFraco({ body: 2, food: 1, resources: 'nao' }), 'food');
});

test('empate no fundo resolve sempre igual', () => {
  // Mapa que muda entre duas aberturas, sem ela ter feito nada, parece defeito.
  const e = { body: 1, food: 1, resources: 1, knowledge: 1, awareness: 1, adaptability: 1 };
  assert.equal(pr.pilarMaisFraco(e), 'body');
  assert.equal(pr.montarMapa({ scores: e }).dias[1].audio.codigo, pr.montarMapa({ scores: e }).dias[1].audio.codigo);
});

test('sem nota nenhuma o mapa ainda abre inteiro', () => {
  // Compra que nao passou pelo quiz, ou registro expirado. Entregar erro a quem
  // pagou seria pior do que entregar a espinha com audio de exemplo.
  const mapa = pr.montarMapa({ scores: {} });
  assert.equal(mapa.dias.length, 7);
  for (const d of mapa.dias) assert.ok(d.audio, `dia ${d.n} vazio sem notas`);
});

test('o mapa leva a pre-consulta no topo e no fim', () => {
  // Ela nao precisa terminar os sete dias para agendar, e esperar o fim e o que
  // faz a conversa nunca acontecer.
  const page = readFileSync(join(root, 'public/Funil/mapa-primeira-ruptura.html'), 'utf8');
  const links = page.match(/\/obrigado-primeira-ruptura/g) || [];
  assert.ok(links.length >= 2, `so ${links.length} link(s) para a pre-consulta`);
  assert.match(page, /id="ponteTopo"/);
  assert.match(page, /id="ponteFim"/);
});

test('a pratica nao vive so no navegador', () => {
  // Ela reabre o mapa no celular depois de escrever no computador. localStorage
  // nao atravessa aparelho, e o caderno dela sumir entre dois dias do protocolo
  // e perder o proprio exercicio.
  const page = readFileSync(join(root, 'public/Funil/mapa-primeira-ruptura.html'), 'utf8');
  assert.match(page, /\/api\/pr\/pratica/);
  assert.match(server, /app\.post\('\/api\/pr\/pratica'/);
  assert.match(server, /pr:pratica:/);
});

test('as rotas do mapa existem e nao vao para a busca', () => {
  assert.match(server, /app\.get\('\/mapa-primeira-ruptura'/);
  assert.match(server, /app\.get\('\/api\/pr\/mapa'/);
  assert.match(server, /app\.get\('\/api\/pr\/meu-mapa'/);
  // A pagina e entregavel pago: indexada, vaza.
  assert.match(server, /\/mapa-primeira-ruptura'[\s\S]{0,200}noindex/);
});

test('a compra do Radar cria o mapa, e o checkout novo tem nome proprio', () => {
  // Sem o slug cadastrado a venda chegava na Meta com o nome de outro produto.
  assert.match(server, /slug: '3azm4o3'/);
  assert.match(server, /nome: 'A Primeira Ruptura'/);
  assert.match(server, /entregarMapaPrimeiraRuptura\(record, d\)/);
});

test('a URL do mapa nao carrega dado pessoal nem o sck', () => {
  // O sck aparece em link de atribuicao, e link de atribuicao vaza para fora.
  assert.match(server, /crypto\.randomBytes\(16\)\.toString\('hex'\)/);
  assert.match(server, /pr:mapa:lead:/);
  const page = readFileSync(join(root, 'public/Funil/mapa-primeira-ruptura.html'), 'utf8');
  assert.doesNotMatch(page, /[?&](email|nome|name|phone|whats|sck)=/);
});

test('a mensagem sai pela Z-API da satisfacao, com os dois links', () => {
  // Cloud API exigiria template aprovado: ela acabou de pagar e nunca nos
  // escreveu, entao nao ha janela de 24h. Z-API manda texto livre, e por isso
  // os dois links cabem na mesma mensagem.
  // Instancia da SATISFACAO, nao a da Karina: separadas desde 30/09/2026 para
  // manter este trafego sem ligacao com a conta de anuncios.
  assert.match(server, /ZAPI_SATISFACAO_INSTANCE_ID/);
  assert.match(server, /ZAPI_SATISFACAO_CLIENT_TOKEN/);
  // Sem fallback silencioso para o ZAPI_* puro: cair na instancia da Karina
  // sem ninguem ver desfaria a separacao.
  assert.doesNotMatch(server, /process\.env\.ZAPI_INSTANCE_ID/);
  assert.doesNotMatch(server, /process\.env\.ZAPI_CLIENT_TOKEN/);
  assert.match(server, /\/send-text/);
  // Os dois links na mesma mensagem e o pedido explicito: ela agenda a
  // pre-consulta enquanto ainda faz os sete dias.
  assert.match(server, /urlMapa,\n\s+'',\n\s+'A sua conversa individual/);
  assert.match(server, /enviarMapaPorWhatsapp\(\{ phone: record\.phone/);
  // Credencial ausente nao pode derrubar a criacao do mapa.
  assert.match(server, /\[pr-mapa\] SOMBRA/);
  const obrigado = readFileSync(join(root, 'public/Funil/obrigado-primeira-ruptura.html'), 'utf8');
  assert.match(obrigado, /\/api\/pr\/meu-mapa/);
  assert.match(obrigado, /table_radar_lead/);
  // E o Radar precisa guardar a chave, senao a segunda via nao acha nada.
  assert.match(quiz, /localStorage\.setItem\('table_radar_lead'/);
});

// ─── Personalizacao visivel ─────────────────────────────────────────────────

test('o mapa carrega as seis notas, na ordem que desenha o hexagono', () => {
  const m = pr.montarMapa({ scores: { body: 4, food: 2, resources: 1, knowledge: 5, awareness: 3, adaptability: 4 } });
  assert.deepEqual(m.pilares.map(p => p.chave), pr.PILARES);
  assert.deepEqual(m.pilares.map(p => p.nota), [4, 2, 1, 5, 3, 4]);
  assert.equal(m.nota_max, 5);
  // Exatamente um pilar e o foco, e e o da nota mais baixa.
  assert.equal(m.pilares.filter(p => p.foco).length, 1);
  assert.equal(m.pilares.find(p => p.foco).chave, 'resources');
});

test('os nomes e estados sao os mesmos do /raiz-radar', () => {
  // Ela leu estes rotulos no resultado do quiz minutos antes. Vocabulario novo
  // aqui faria o mapa parecer outro produto.
  const quizDims = (quiz.match(/DIMS=\{[^}]*\}/) || [''])[0];
  for (const nome of Object.values(pr.DIMS)) {
    assert.ok(quizDims.includes(nome), `"${nome}" nao existe no DIMS do quiz`);
  }
  assert.equal(pr.estadoDoPilar(1), 'pede muito recurso');
  assert.equal(pr.estadoDoPilar(2), 'pede recurso');
  assert.equal(pr.estadoDoPilar(4), 'recurso disponível');
  assert.ok(quiz.includes("v===1?'pede muito recurso'"), 'o pillarState do quiz mudou — reconciliar com estadoDoPilar');
});

test('o ranking vai do mais apertado para o mais folgado', () => {
  const m = pr.montarMapa({ scores: { body: 4, food: 2, resources: 1, knowledge: 5, awareness: 3, adaptability: 4 } });
  assert.equal(m.ranking[0], 'resources');
  assert.equal(m.ranking[m.ranking.length - 1], 'knowledge');
  const notas = m.ranking.map(c => m.pilares.find(p => p.chave === c).nota);
  assert.deepEqual(notas, [...notas].sort((a, b) => a - b));
});

test('nota ausente vira null, nunca zero, e fica fora do ranking', () => {
  // Zero no grafico desenharia uma ponta encostada no centro e diria a ela que
  // tirou a nota minima numa pergunta que nunca foi respondida.
  const m = pr.montarMapa({ scores: { body: 3, food: null } });
  assert.equal(m.pilares.find(p => p.chave === 'food').nota, null);
  assert.equal(m.pilares.find(p => p.chave === 'food').estado, null);
  assert.deepEqual(m.ranking, ['body']);
});

test('a pagina desenha o radar e nomeia o pilar dela', () => {
  const page = readFileSync(join(root, 'public/Funil/mapa-primeira-ruptura.html'), 'utf8');
  assert.match(page, /function desenharRadar/);
  assert.match(page, /<polygon/);
  assert.match(page, /pilar_foco_nome/);
  // Sem biblioteca de grafico: seis pontos e duas formas nao justificam um pacote.
  assert.doesNotMatch(page, /cdnjs|jsdelivr|unpkg/);
  // O nome dela no titulo.
  assert.match(page, /mapa\.nome\s*\?/);
});

test('o nome do quiz vence o nome do pagador', () => {
  // O da Cakto as vezes e o marido, a mae, ou vem em CAIXA ALTA do cartao.
  assert.match(server, /nomeRadar \|\| ref\.nome \|\| null/);
});

test('a pratica e dela, nao entrega para a sessao', () => {
  // Decisao do Felipe em 22/10/2026: a equipe pode ler o que ela escreve, mas
  // dizer isso a ela transforma o exercicio em dever de casa, e ela passa a
  // escrever para ser avaliada em vez de para se enxergar.
  const page = readFileSync(join(root, 'public/Funil/mapa-primeira-ruptura.html'), 'utf8');
  for (const frase of ['nutricionista lê', 'antes da sua sessão', 'vai para a sessão', 'leva para a sessão']) {
    assert.ok(!page.includes(frase), `a pagina ainda diz "${frase}"`);
  }
  for (const [cod, pr_] of Object.entries(catalogo.praticas)) {
    const t = pr_.client_content.toLowerCase();
    assert.ok(!t.includes('sessão') && !t.includes('sessao'), `pratica ${cod} amarra o que ela escreve a sessao`);
  }
  // A ponte para agendar continua existindo: o que saiu foi a amarra entre o
  // que ela ESCREVE e a consulta, nao o convite para marcar.
  assert.ok((page.match(/\/obrigado-primeira-ruptura/g) || []).length >= 2);
});

// ─── Conferencia das entregas ───────────────────────────────────────────────
// Nasceu de "sairam tres vendas, deu tudo certo?". Ate 25/10 a unica resposta
// estava no log do Railway, que e justamente onde nao da para olhar quando a
// pergunta aparece dias depois.

test('o desfecho do envio fica gravado, nao so no log', () => {
  assert.match(server, /async function marcarEntrega\(token, patch\)/);
  // Os quatro desfechos precisam ser distinguiveis na conferencia. "sombra" e
  // "enviado" saem de um ternario, por isso nao sao procurados como `envio: x`.
  assert.match(server, /envio: r\?\.shadow \? 'sombra' : 'enviado'/);
  assert.match(server, /envio: 'sem_telefone'/);
  assert.match(server, /envio: 'erro'/);
  // E o que nunca foi gravado tem de se declarar como tal, em vez de posar de
  // entrega bem-sucedida.
  assert.match(server, /envio: ref\.envio \|\| 'desconhecido'/);
  // Erro gravado e RELANCADO: engolir aqui transformaria falha em silencio.
  assert.match(server, /marcarEntrega\(token, \{ envio: 'erro'[\s\S]{0,80}throw e;/);
});

test('o diagnostico exige segredo e nao devolve telefone inteiro', () => {
  assert.match(server, /app\.get\('\/api\/pr\/entregas'/);
  assert.match(server, /entregas'[\s\S]{0,1200}status\(401\)/);
  // Mesma regra do diagnostico do inbound: pergunta operacional nao precisa do
  // numero inteiro para ser respondida.
  assert.match(server, /telefone: d\.length > 4 \? `\*\*\*\*\$\{d\.slice\(-4\)\}`/);
  assert.doesNotMatch(server, /entregas'[\s\S]{0,2000}telefone: ref\.phone/);
});

test('o diagnostico separa mapa personalizado de mapa de exemplo', () => {
  // Sem as notas do Radar o mapa ABRE, mas com notas de exemplo — e isso e
  // invisivel para quem recebeu. Tem de aparecer na conferencia.
  assert.match(server, /mapa_personalizado: temNotas/);
  assert.match(server, /sem_notas_do_radar:/);
});

test('a listagem nao confunde o indice reverso com os mapas', () => {
  // pr:mapa:lead:<radarId> tem o mesmo prefixo de pr:mapa:<token> e viraria
  // "mapa" fantasma na contagem.
  assert.match(server, /filter\(k => !k\.startsWith\('pr:mapa:lead:'\)\)/);
});

test('a conferencia aceita um token proprio, alem do segredo interno', () => {
  // O segredo interno tambem autentica /webhook/* e permite ESCRITA no Hub.
  // Esta rota so le e mascara telefone, entao nao exige uma chave desse porte:
  // assim conferir entrega deixa de pedir a chave que move dado.
  assert.match(server, /PR_DIAG_TOKEN/);
  assert.match(server, /\(diag && recebido === diag\) \|\| \(interno && recebido === interno\)/);
  // Variavel ausente nao pode virar porta aberta: sem nenhum dos dois, 401.
  assert.match(server, /const diag = process\.env\.PR_DIAG_TOKEN \|\| null/);
  assert.match(server, /const interno = process\.env\.HUB_WEBHOOK_SECRET \|\| process\.env\.INTERNAL_WEBHOOK_SECRET \|\| null/);
});
