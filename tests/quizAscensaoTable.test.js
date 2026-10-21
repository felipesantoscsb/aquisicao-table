const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public/quiz-ascensao-table.html'), 'utf8');
const server = readFileSync(join(root, 'src/server.js'), 'utf8');

test('raiz-radar usa o novo quiz e raiz-v2 preserva o fluxo anterior', () => {
  assert.match(server, /app\.get\('\/raiz-radar'.*'quiz-ascensao-table\.html'/);
  assert.match(server, /app\.get\('\/raiz-v2'.*'quiz-raiz-v2\.html'/);
});

test('quiz mede seis pilares e separa qualificação de leitura educativa', () => {
  for (const label of ['Relação com o corpo','Relação com a comida','Recursos na vida real','Conhecimento alimentar','Consciência e presença','Adaptabilidade']) {
    assert.match(html, new RegExp(label));
  }
  assert.equal((html.match(/dim:'/g) || []).length, 6);
  // Bloco comercial enxugado em 20/10/2026: de seis perguntas para tres. Saem
  // Historico, Impacto e Tentativas, que o Radar ja cobre pelos pilares; ficam
  // as tres que ele NAO ve, e a ordem termina no Objetivo em vez de terminar
  // em dinheiro.
  assert.equal((html.match(/fit:true/g) || []).length, 1);
  assert.equal((html.match(/ready:true/g) || []).length, 2);
  for (const fora of ['Faz quanto tempo que você volta', 'O quanto isso toma da sua vida',
                      'Como costumam terminar as suas tentativas']) {
    assert.ok(!html.includes(fora), `pergunta cortada voltou: ${fora}`);
  }
  assert.match(html, /\{tag:'12 · Objetivo'/, 'o quiz precisa terminar no Objetivo');
  assert.equal((html.match(/confirm:'/g) || []).length, 3);
  assert.match(html, /radar-identities\.js/);
  assert.match(html, /id="identityTitle"/);
  assert.match(html, /RadarIdentity\.classify\(scores,confirmations\)/);
});

test('roteamento tem A, B e C com a rota C mais longa', () => {
  // Reguas recalibradas para a escala nova: fit vem de UMA pergunta (max 3) e
  // prontidao de duas (max 6). Reproduzem a distribuicao antiga, com a rota A
  // em 15,6% contra 15,5%, que e o que protege a capacidade de 20 por semana.
  assert.match(html, /fitScore>=3&&readinessScore>=3\?'A':fitScore>=1\?'B':'C'/);
  assert.match(html, /id="routeA"/);
  assert.match(html, /id="routeBC"/);
  assert.match(html, /class="band paper education-band education-only"/);
  assert.match(html, /\.route-c \.education-only\{display:block\}/);
  assert.match(html, /\.route-b \.education-band\{display:none\}/);
});

test('convite de pré-consulta leva ao formulário, não direto ao SDR', () => {
  // 18/10/2026: o botão disparava o SDR da própria página. Agora passa pelo
  // /pre-consulta, que é o segundo filtro — relato aberto, histórico e
  // disponibilidade — e só de lá o card vai para a Karina.
  assert.match(html, /Pré-consulta Table · online e gratuita/);
  assert.match(html, /id="preconsult"/);
  assert.match(html, /location\.href='\/pre-consulta\?lid='/);
  assert.ok(!/fetch\('\/api\/captacao\/conversa'/.test(html),
    'o quiz voltou a chamar o SDR direto, pulando o segundo filtro');
  // O id vai opaco: telefone em query string seria PII na URL.
  assert.ok(!/lid='\+.*phone/.test(html));
  assert.match(html, /autonomia, acompanhamento Table ou outro cuidado/);
});

test('quem tem fit suficiente VÊ a pré-consulta, mesmo sem prontidão', () => {
  // Antes, routeA e routeBC eram mutuamente exclusivos: quem caía em B nunca
  // via a conversa gratuita, e era ali que a lead qualificada e cautelosa
  // morria.
  assert.match(html, /const CORTE_PRE_CONSULTA=1/);
  assert.match(html, /convidada=fitScore>=CORTE_PRE_CONSULTA/);
  assert.match(html, /\$\('routeA'\)\.hidden=!convidada/);
});

test('tracking identifica a rota publicada sem misturar pixels', () => {
  assert.match(html, /slug:'raiz-radar'/);
  assert.match(html, /source:'raiz-radar'/);
  assert.match(server, /raiz-v2\|raiz-radar\|radar-table/);
  assert.match(server, /CompleteRegistration' && ehRaizV2\(req\.body\)/);
});

test('rotas B e C oferecem A Primeira Ruptura por R$ 127', () => {
  assert.match(html, /A Primeira Ruptura/);
  assert.match(html, /R\$ 127/);
  assert.match(html, /https:\/\/pay\.cakto\.com\.br\/3azm4o3_1219891/);
  assert.match(html, /Um mapa pessoal que mostra por onde começar/);
  assert.match(html, /Um exercício prático por dia, em texto e áudio/);
});

test('resultado sustenta promessa, autoridade e prova social visual', () => {
  assert.match(html, /Não voltar ao mesmo ciclo é outra/);
  assert.match(html, /O desenho que sustenta esta leitura/);
  assert.match(html, /o nome não veio de uma nota isolada/);
  assert.match(html, /Evelyn Liu é nutricionista comportamental/);
  assert.match(html, /CRN-3 70082/);
  for (const image of ['evelyn-liu.png','Juliana Moreno.jpg','Adriana.jpg','Iracema.jpg']) {
    assert.match(html, new RegExp(image.replace('.', '\\.')));
  }
  assert.match(html, /Relatos de experiências individuais/);
});

test('pré-consulta vende clareza sem antecipar tentativa de venda', () => {
  const routeA = html.slice(html.indexOf('<div id="routeA"'), html.indexOf('<div id="routeBC"'));
  assert.doesNotMatch(routeA, /oferta|vender/i);
  assert.doesNotMatch(html, /isso não é uma oferta/i);
  assert.match(routeA, /começar pelo ponto certo/);
  assert.match(routeA, /Quero marcar minha conversa/);
});

test('carregamento ganhou dois segundos e comunica progresso', () => {
  assert.match(html, /setTimeout\(\(\)=>\{clearInterval\(loadingTimer\);complete\(\)\},3350\)/);
  assert.match(html, /Identificando a dinâmica entre eles/);
  assert.match(html, /Traduzindo o desenho em uma história/);
});

test('prévia das rotas só funciona em localhost e não envia formulário', () => {
  assert.match(html, /location\.hostname==='127\.0\.0\.1'\|\|location\.hostname==='localhost'/);
  assert.match(html, /\['A','B','C'\]\.includes\(previewRoute\)/);
  assert.match(html, /get\('identity'\)/);
  assert.match(html, /RadarIdentity\.PREVIEW_CASES\[requestedIdentity\]/);
});

test('segmentos sensíveis não entram nos eventos Meta', () => {
  const routeEvent = html.match(/trackCustom\('RouteResultViewed'[^\n]+/)[0];
  assert.doesNotMatch(routeEvent, /fitScore|readinessScore|scores|low|high/);
  const checkoutPixel = html.match(/fbq\('track','InitiateCheckout'[^;]+/)[0];
  assert.doesNotMatch(checkoutPixel, /route|fitScore|readinessScore|scores/);
});

test('rota e scores seguem apenas para mensuração interna no Hub', () => {
  const hub = readFileSync(join(root, 'src/hubSync.js'), 'utf8');
  for (const field of ['commercial_route','fit_score','readiness_score','lowest_pillar','highest_pillar','identity_key','identity_confidence']) {
    assert.match(hub, new RegExp(field));
  }
  const capiExtraction = server.slice(server.indexOf("app.post('/api/capi'"), server.indexOf("app.post('/api/capi/initiate-checkout'"));
  assert.match(capiExtraction, /profileName, scores,[\s\S]*são ignorados intencionalmente/);
});

// Um splice ruim duplicou o documento inteiro de #quiz em diante e aninhou a
// copia dentro de #result. Como getElementById pega sempre o primeiro, os CTAs
// ficaram na copia morta: a pagina de resultado rodou SEM nenhum botao. Nada
// quebrava, nada gritava no console — so nao convertia.
test('estrutura do quiz nao tem id duplicado', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const vistos = new Set();
  const repetidos = [...new Set(ids.filter(id => vistos.has(id) || (vistos.add(id), false)))];
  assert.deepEqual(repetidos, [], `ids duplicados: ${repetidos.join(', ')}`);
});

test('as paginas do funil existem uma unica vez', () => {
  for (const id of ['intro', 'quiz', 'respiro', 'capture', 'loading', 'result']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `#${id} duplicado`);
  }
  assert.equal((html.match(/<section class="page/g) || []).length, 6);
});

test('os dois CTAs ficam dentro da pagina de resultado', () => {
  const resultado = html.slice(html.indexOf('<section class="page result" id="result">'));
  const fim = resultado.indexOf('\n</section>');
  const dentro = resultado.slice(0, fim);
  for (const id of ['routeA', 'routeBC', 'preconsult', 'checkout']) {
    assert.ok(dentro.includes(`id="${id}"`), `#${id} ficou fora de #result`);
  }
});

test('o preview local combina com a regua de corte da pre-consulta', () => {
  // O convite olha fitScore, nao a rota. Preview que forca a rota sem mexer no
  // score mostra uma tela sem CTA nenhum e parece funil quebrado.
  assert.match(html, /fitScore=previewRoute==='A'\?3:previewRoute==='B'\?2:0/);
  assert.match(html, /const CORTE_PRE_CONSULTA=1;/);
});

test('atribuicao de primeiro toque viaja junto com a lead', () => {
  assert.match(html, /attribution:persistAttribution\(\)/);
  assert.match(html, /table_attr_first/);
  assert.doesNotMatch(html, /function utm\(\)/, 'utm() morta deve sair');
});

test('a linha fina da caixa escura nao herda a cor das bandas claras', () => {
  // .page.result .paper .fine (0,3,0) vencia .route-a-box .fine (0,2,0) e
  // pintava o texto de --muted sobre o verde: 2,58 de contraste.
  assert.match(html, /\.page\.result \.route-a-box \.fine\{color:#91a397\}/);
});

test('a prova do Google nao quantifica e manda ver todas no proprio Google', () => {
  // Dizer "15 avaliacoes" faz 15 parecer o total da clinica, que e muito
  // menos do que ela tem. Sem numero, e o "ver todas" aponta para a fonte.
  assert.equal((html.match(/class="google-card"/g) || []).length, 6);
  // Cortadas em 20/10. Duas prometiam resultado na voz de terceiro ("a melhor
  // forma de emagrecer", "resultados duradouros") e o aviso de rodape nao
  // autoriza a curadoria a destacar promessa. As outras saem por voz fora da
  // marca, nome masculino numa pagina escrita para ela, e sobrenome da
  // fundadora, que le como parente mesmo sem ser.
  for (const cortada of ['Eliete Mariani', 'Bruna Chahud', 'Jamayra Araújo', 'Kelly Liu']) {
    assert.ok(!html.includes(cortada), `${cortada} voltou para a prova social`);
  }
  assert.doesNotMatch(html, /\d+ avaliações reais no Google/);
  assert.doesNotMatch(html, /Ver todas as \d+ avaliações/);
  assert.doesNotMatch(html, /id="verAvaliacoes"/, 'o expansor na pagina saiu');
  assert.match(html, /<span>Avaliações no Google<\/span>/);
  assert.match(html, /id="verNoGoogle"[^>]*google\.com\/maps/);
  assert.match(html, />Ver todas as avaliações no Google →<\/a>/);
  // No mobile vira carrossel, como as fotos: 15 empilhadas eram quase cinco
  // telas de depoimento antes do CTA.
  assert.match(html, /@media\(max-width:720px\)\{\.google-grid\{display:flex;overflow-x:auto/);
});

test('as fotos da prova social sao quadradas', () => {
  // aspect-ratio so governa quando um eixo e auto; o atributo height="800" do
  // HTML dava altura definida e as fotos renderizavam 230x800.
  assert.match(html, /\.proof-card img\{width:100%;height:auto;aspect-ratio:1\/1/);
});

test('na rota B o botao da pre-consulta leva para a oferta, nao para o formulario', () => {
  assert.match(html, /if\(route!=='A'\)\{trackCustom\('PreConsultToOffer'\);\$\('routeBC'\)\.scrollIntoView/);
  assert.match(html, /<span class="so-rota-b">Ver o que vem na Primeira Ruptura ↓<\/span>/);
});

test('o FAQ cobre objecao, reembolso e o limite do que a Table faz', () => {
  assert.equal((html.match(/<details/g) || []).length, 7);
  assert.match(html, /Isso é mais uma dieta\?/);
  assert.match(html, /devolvemos os R\$ 127/);
  assert.match(html, /E se o que eu vivo for mais pesado do que isso\?/);
  // As duas perguntas de oferta nao aparecem para quem caiu na rota A, que
  // nem ve a Primeira Ruptura.
  assert.equal((html.match(/<details class="so-oferta">/g) || []).length, 2);
  assert.match(html, /body:not\(\.route-a\) \.so-oferta\{display:block\}/);
});

test('a rota B apresenta a pre-consulta como entregavel, nao como brinde', () => {
  // Anunciar "gratuita" logo acima da oferta de R$97 que ja a inclui tira a
  // razao de comprar. Em A ela segue sendo a porta de entrada gratuita.
  assert.match(html, /<span class="so-rota-a">Pré-consulta Table · online e gratuita<\/span>/);
  assert.match(html, /<span class="so-rota-b">Conversa individual · incluída na Primeira Ruptura<\/span>/);
  assert.doesNotMatch(html, /<span class="so-rota-b">[^<]*gratuit/i, 'rota B nao pode dizer gratuita');
  assert.match(html, /\.so-rota-b\{display:none\}/);
  assert.match(html, /body\.route-b \.so-rota-a\{display:none\}/);
  assert.match(html, /body\.route-b \.so-rota-b\{display:inline\}/);
});

test('a headline da caixa de pre-consulta nao herda a cor das bandas claras', () => {
  // .page.result .band:not(.dark) h3 vale 0,4,1 e vencia .route-a-box h3
  // (0,2,1): a promessa saia cor de pinho sobre caixa cor de pinho, contraste
  // 1,0. Eram 97px de vazio no lugar do titulo da oferta gratuita.
  assert.match(html, /\.page\.result \.band \.route-a-box h3\{color:#fff\}/);
});

test('rotas de revisao servem o quiz com noindex', () => {
  assert.match(server, /app\.get\(\['\/raiz-radar-a', '\/raiz-radar-b', '\/raiz-radar-c'\]/);
  assert.match(server, /X-Robots-Tag', 'noindex, nofollow/);
});

test('a revisao nao toca no pixel', () => {
  // Um PageView de revisao entra no mesmo dataset do funil e suja a otimizacao.
  assert.match(html, /var PREVIEW_ROTA=\(location\.pathname\.match\(\/\^\\\/raiz-radar-\(\[abc\]\)/);
  assert.match(html, /if\(!PREVIEW_ROTA\)\{\s*fbq\('init',PIXEL_V2\);/);
  assert.match(html, /function trackCustom\(name,data=\{\}\)\{if\(PREVIEW_ROTA\)return;/);
  assert.match(html, /function checkout\(cupom\)\{const id=eventId\('ic'\);if\(!PREVIEW_ROTA\)\{/);
});

test('o noscript aponta para o mesmo pixel do script', () => {
  const doScript = html.match(/var PIXEL_V2='(\d+)'/)[1];
  const doNoscript = html.match(/facebook\.com\/tr\?id=(\d+)&ev=PageView&noscript=1/)[1];
  assert.equal(doNoscript, doScript);
});

test('a identidade e sua ruptura entram no convite de cada rota', () => {
  // Aposta principal da revisao de copy: o convite servia para qualquer pessoa
  // que terminasse o quiz. Repetindo em texto o que ela acabou de ler sobre
  // si, deixa de parecer script e passa a parecer consequencia.
  assert.match(html, /id="conviteCorpo"/);
  assert.match(html, /id="conviteConversa"/);
  assert.match(html, /id="pontseC"/);
  assert.match(html, /O padrão “\$\{identity\.name\}” mostra por onde a conversa precisa começar/);
  // Corpos diferentes por rota: afirmar urgencia que a B nao demonstrou
  // contradiz a oferta logo abaixo.
  assert.match(html, /: `O padrão “\$\{identity\.name\}” já mostrou o primeiro movimento/);
  assert.match(html, /\$\{identity\.rupture\}/);
});

test('a copy nao volta a usar as formulas e os nomes derrubados', () => {
  assert.doesNotMatch(html, /Sessão Raiz/, 'nome que a cliente nunca viu nesta pagina');
  assert.doesNotMatch(html, /Descubra/, 'formula generica de quiz');
  assert.doesNotMatch(html, /transtorno/i, 'palavra vetada na comunicacao');
  // Pre-consulta so pode existir na rota A: e o unico nome que aquela rota ve.
  assert.equal((html.match(/Pré-consulta/g) || []).length, 1);
  assert.match(html, /so-rota-a">Pré-consulta Table · online e gratuita/);
});

test('video nao aparece como entregavel enquanto o banco nao tiver nenhum', () => {
  // Decisao de 19/10: o banco tem 20 audios, 16 exercicios e 10 textos, e zero
  // videos. Prometer video na oferta e vender o que nao existe.
  assert.doesNotMatch(html, /Vídeos de Evelyn/);
  assert.doesNotMatch(html, /<li>[^<]*[Vv]ídeo[^<]*<\/li>/);
});

test('a promessa do hero bate com o numero real de perguntas', () => {
  // A estrutura real e 6 pilares + 3 confirmações + 6 perguntas comerciais.
  assert.equal((html.match(/\{tag:'/g) || []).length, 12);
  assert.match(html, /<ul class="custo"><li>gratuito<\/li><li>12 perguntas de múltipla escolha<\/li><li>3 minutos<\/li><li>sem cadastro<\/li><\/ul>/);
  // Centralizado: com quatro itens a quebra a esquerda deixava a ultima linha
  // solta e torta. Centralizado, a quebra vira simetria.
  assert.match(html, /\.custo\{[^}]*justify-content:center/);
  assert.doesNotMatch(html, /Seis perguntas sobre corpo/, 'o hero nao pode prometer seis');
  // O numero aparece UMA vez na primeira tela, na linha de custo sob o botao,
  // que e onde ele vira informacao em vez de aviso. Dize-lo tambem no
  // subtitulo era redundancia na dobra, que e o espaco mais caro da pagina.
  assert.doesNotMatch(html.slice(0, html.indexOf('id="quiz"')), /Doze perguntas/);
  assert.equal((html.slice(0, html.indexOf('id="quiz"')).match(/12 perguntas/g) || []).length, 1);
  // A marca aparece uma vez na primeira linha: o logo ancora, o eyebrow diz
  // so o produto. "TABLE" ao lado de "Radar Table" era a mesma palavra duas
  // vezes no mesmo olhar.
  // Topo so com o logo, centralizado: era o unico elemento fora do eixo, com
  // pilula, botao, bullets e cartoes todos centrados.
  assert.match(html, /<div class="top"><div class="brand">TABLE<\/div><\/div>/);
  assert.match(html, /\.top\{display:flex;justify-content:center/);
  assert.doesNotMatch(html, /class="tagline"/);
  // O slogan virou citacao assinada, dentro do bloco de prova.
  assert.doesNotMatch(html, /Para a fome que a comida não resolve/);
  assert.doesNotMatch(html, /Radar · gratuito/);
  // Rosto, citacao, credencial e nota num bloco so: deixa de ser assinatura
  // solta e vira prova social com quem assina, o que diz, e quem confirma.
  assert.match(html, /<div class="prova"><img src="\/images\/evelyn-avatar\.jpg"/);
  assert.match(html, /<p class="citacao-evelyn">“Cuidamos da fome que a comida não resolve\.”<\/p>/);
  assert.match(html, /<p class="selo"><span class="estrelas">★★★★★<\/span> <b>5,0<\/b> no Google, de quem é cliente<\/p><\/div><\/div>/);
  // A nota e a ultima linha do bloco, separada por um filete.
  assert.match(html, /\.selo\{margin:12px 0 0;padding-top:12px;border-top:1px solid var\(--line\)/);
  // Botao, custo, selo e bullets centralizados.
  assert.match(html, /\.hero \.btn\{margin-top:30px;display:flex;margin-left:auto;margin-right:auto\}/);
  assert.match(html, /\.hero \.descobre\{text-align:center\}/);
  assert.match(html, /\.hero \.promise span\{text-align:center\}/);
});

test('o hero abre na frase que reconhece, nao no lugar-comum', () => {
  // "Começar na segunda" e clichê de anuncio de dieta e gastava a primeira
  // linha do subtitulo, que e a que mais custa atencao.
  assert.doesNotMatch(html, /Começar na segunda você já sabe/);
  assert.match(html, /<p class="hero-copy">O que nunca ficou claro é em que ponto a vida aperta/);
  assert.match(html, /três perguntas confirmam como esses pilares se relacionam/);
  assert.match(html, /As seis finais apontam um próximo passo/);
});

test('a rota C ganha uma ponte antes da oferta', () => {
  assert.match(html, /class="ponte-c"/);
  assert.match(html, /body\.route-c \.ponte-c\{display:block\}/);
});

test('A Primeira Ruptura custa R$ 127 e so ela', () => {
  // O endpoint de InitiateCheckout atende oito paginas. Um valor global
  // reportaria 127 para o Protocolo Raiz dos funis antigos, que segue a 97.
  // O parcelado e o numero grande: em compra por impulso no celular, 13,12
  // decide mais que 127. O a vista fica logo abaixo, sem sumir.
  assert.match(html, /<div class="price">12x <b>R\$ 13,12<\/b><\/div>/);
  assert.match(html, /<p class="avista">ou <b>R\$ 127<\/b> à vista · Pix ou cartão<\/p>/);
  assert.match(html, /content_name:'A Primeira Ruptura',currency:'BRL',value:127/);
  assert.doesNotMatch(html, /R\$ 97/, 'sobrou preco antigo na pagina');
  assert.match(server, /function valorDaOferta\(body = \{\}\) \{\s*if \(ehRadarTable\(body\)\) return 127;/);
  assert.match(server, /return 97;\s*\}/, 'os funis antigos continuam em 97 por padrao');
  assert.doesNotMatch(server, /custom_data\.value = 97/);
});

test('o checkout do Radar e o novo, e so o do Radar mudou', () => {
  assert.match(html, /pay\.cakto\.com\.br\/3azm4o3_1219891/);
  assert.doesNotMatch(html, /ai223ee/);
  // Na Cakto o webhook e por produto: checkout novo sem webhook cadastrado
  // significa venda entrando e nenhum Purchase chegando.
});

test('a garantia vale durante os sete dias, nao depois', () => {
  assert.match(html, /Se em qualquer dia dos 7 não fizer sentido/);
  assert.doesNotMatch(html, /Faça a primeira semana inteira/);
  assert.equal((html.match(/devolvemos os R\$ 127/g) || []).length, 2, 'oferta e FAQ precisam concordar');
});

test('a Acao da Gracinha nao e descrita como memorial da avo', () => {
  // A Gracinha e a mulher de uma das fotos, por quem a acao comecou.
  assert.doesNotMatch(html, /em memória da avó/);
  assert.match(html, /leva o nome da mulher por quem ela começou/);
});

test('o credito de R$ 100 aparece junto do preco, uma linha so', () => {
  // Justifica o aumento de 97 para 127 sem virar secao: a pagina promete nas
  // rotas A e B que ninguem vai vender nada para ela.
  assert.match(html, /<p class="credito">Se depois você seguir com um acompanhamento Table, <b>R\$ 100 voltam como crédito<\/b>\.<\/p>/);
  assert.equal((html.match(/R\$ 100/g) || []).length, 1, 'uma mencao basta');
  // DEPENDENCIA: as nove paginas de plano ainda concedem R$ 48,50 e R$ 97. A
  // virada precisa acontecer antes da primeira pre-consulta converter, senao
  // a cliente le a promessa aqui e outro numero la.
});

test('a versao da pagina acompanha a arquitetura de identidades', () => {
  // O Codex instrumentou o funil carimbando `page_version` em cada evento. Se
  // a constante nao sobe junto com uma reescrita de copy, os dados de antes e
  // depois entram no mesmo balde e a mudanca vira immensuravel.
  assert.match(html, /RADAR_PAGE_VERSION='radar-2026-10-20-identities-v1'/);
});

test('a pagina nao usa "Clinic" em texto nenhum', () => {
  // Decisao de 20/10/2026: a marca na pagina e Table. A unica ocorrencia
  // permitida e dentro da URL do Google Maps, que e o nome cadastrado la e
  // quebra o link do perfil de avaliacoes se mudar.
  const semUrl = html.replace(/https:\/\/www\.google\.com\/maps[^"']*/g, '');
  assert.ok(!semUrl.includes('Clinic'), 'sobrou "Clinic" fora da URL do Maps');
  assert.match(html, /maps\/place\/Table\+Clinic/, 'a URL do Maps precisa continuar intacta');
  assert.match(html, /fundadora da Table\./);
  assert.match(html, /© Table · Evelyn Liu/);
});

test('a pagina linka a politica de privacidade nos tres momentos que importam', () => {
  // O /legal existe e e LGPD desde maio/2026, e TODOS os outros quizzes do
  // repo linkavam. O Radar era o unico funil sem o link, coletando nome,
  // e-mail e WhatsApp e disparando pixel e CAPI.
  assert.equal((html.match(/href="\/legal"/g) || []).length, 3);
  // O que pesa juridicamente: no ponto de coleta, antes de ela enviar.
  assert.match(html, /Ao continuar, você concorda com a <a href="\/legal"[^>]*>Política de Privacidade e os Termos de Uso<\/a>/);
  // E onde se procura por reflexo: abertura e rodape.
  assert.match(html, /não são usadas para personalizar anúncios\. <a href="\/legal"/);
  assert.match(html, /Nutrição comportamental · <a href="\/legal"/);
  for (const m of html.match(/<a href="\/legal"[^>]*>/g) || []) {
    assert.match(m, /target="_blank"/, 'nao pode tirar a lead do quiz no meio');
    assert.match(m, /rel="noopener"/);
  }
});

test('o aviso legal do hero e legivel sobre o bege', () => {
  // #91a397 foi desenhado para fundo escuro e dava 2,03 de contraste sobre o
  // bege do hero. Passou a importar quando o link de privacidade entrou
  // nessa linha: aviso legal ilegivel e pior do que nao ter.
  assert.match(html, /\.hero \.fine\{color:#5a655e\}/);
});

test('o QUESTIONS continua sendo um array valido depois do corte', () => {
  // A primeira tentativa de reordenar quebrou a pagina inteira: a pergunta que
  // era a ultima nao tinha virgula final e foi parar no meio. Teste de regex
  // nao pega isso, so o parse pega.
  const i = html.indexOf('const QUESTIONS');
  const trecho = html.slice(i, html.indexOf('\n];', i) + 2);
  const arr = eval('(' + trecho.slice(trecho.indexOf('[')) + ')');
  assert.equal(arr.length, 12);
  assert.deepEqual(arr.map(q => q.tag.split(' · ')[1]).slice(9),
    ['Disponibilidade', 'Investimento', 'Objetivo'], 'o bloco comercial termina no Objetivo');
  assert.equal(arr.filter(q => q.fit).length, 1);
  assert.equal(arr.filter(q => q.ready).length, 2);
  // Toda pergunta precisa de opcoes, senao a tela trava sem botao.
  for (const q of arr) assert.ok(Array.isArray(q.options) && q.options.length >= 2, q.tag);
});

test('o retrato da Evelyn usa o recorte proprio, nao o thumbnail', () => {
  // A foto antiga tinha 160x240, corpo inteiro, rosto minusculo. Ampliar
  // aquilo borrava. evelyn-avatar.jpg e um recorte de 320x320 feito a partir
  // do retrato de 530x1047, enquadrado no rosto.
  assert.match(html, /<img src="\/images\/evelyn-avatar\.jpg" width="320" height="320" alt="Evelyn Liu">/);
  assert.doesNotMatch(html, /Vestido Verde Olhar amistoso/);
  assert.match(html, /\.prova img\{width:68px;height:68px/);
});

test('cada rota recebe a sua mini VSL, e nenhuma trava o CTA', () => {
  // Rota A: o video explica a conversa. B e C: explica os sete dias.
  assert.match(html, /<p id="conviteConversa"><\/p><div class="vsl so-rota-a"><wistia-player media-id="8mtci512mj"/);
  assert.match(html, /<div class="vsl"><wistia-player media-id="ajd9oltmv3"[\s\S]{0,180}<div class="offer">/);
  assert.equal((html.match(/<wistia-player/g) || []).length, 2);
  // O runtime do Wistia carrega UMA vez no head: os dois embeds compartilham.
  assert.equal((html.match(/fast\.wistia\.com\/player\.js/g) || []).length, 1);
  assert.match(html, /embed\/8mtci512mj\.js/);
  assert.match(html, /embed\/ajd9oltmv3\.js/);
  // Largura limitada: 9:16 em largura total viraria um poste de 1280px.
  assert.match(html, /\.vsl\{margin:30px auto 0;max-width:330px\}/);
});

test('a lead ve UM video, nunca dois', () => {
  // Na rota B a caixa da pre-consulta tambem aparece. Sem escopo, a lead de B
  // veria os dois videos, e o primeiro fala de uma conversa gratuita que ali e
  // entregavel do produto pago.
  assert.match(html, /<div class="vsl so-rota-a"><wistia-player media-id="8mtci512mj"/);
  assert.match(html, /body\.route-b \.so-rota-a\{display:none\}/);
});

test('o painel de resgate so existe nas rotas B e C', () => {
  // Na rota A o proximo passo e uma conversa gratuita: nao ha o que descontar.
  assert.match(html, /if\(route==='A'[\s\S]{0,30}\) return;/);
  assert.match(html, /id="resgate" hidden/);
});

test('o resgate nao usa pressao falsa', () => {
  // O cupom nao expira, entao contagem regressiva seria mentira. A urgencia
  // que existe de verdade e a da dor.
  assert.match(html, /O ciclo não fica esperando você decidir\. Amanhã ele recomeça do mesmo jeito\./);
  // So o texto que ELA le: o comentario do codigo explica justamente por que
  // nao ha expiracao, e varrer o arquivo inteiro acusaria a propria nota.
  const painel = html.slice(html.indexOf('id="resgate"'), html.indexOf('</aside>'));
  for (const proibido of ['últimas vagas', 'expira', 'acaba em', 'restam', 'tempo limitado']) {
    assert.ok(!painel.toLowerCase().includes(proibido), `pressao falsa: ${proibido}`);
  }
  // Nao bloqueia a tela nem trava a rolagem.
  assert.doesNotMatch(html, /\.resgate[^}]*overflow:hidden/);
  assert.match(html, /\.resgate\{position:fixed/);
});

test('o cupom nao depende de acertar o parametro da Cakto', () => {
  // O nome do parametro nao esta confirmado na documentacao deles. Por isso o
  // codigo e copiavel e fica visivel: se o param falhar, ela cola no checkout
  // em vez de pagar cheio sem perceber.
  assert.match(html, /<button type="button" class="cupom" id="resgateCodigo">TABLE15<\/button>/);
  assert.match(html, /await navigator\.clipboard\.writeText\(CUPOM\.codigo\)/);
  assert.match(html, /\$\('resgateIr'\)\.onclick=async\(\)=>\{[\s\S]{0,90}await copiar\(\); checkout\(true\);/);
  // Falha de clipboard nao pode impedir a navegacao.
  assert.match(html, /catch\(e\)\{ return false; \}/);
});

test('o gatilho observa o botao, nao o bloco da rota', () => {
  // routeBC e alto demais: um threshold nele nunca dispara num celular.
  assert.match(html, /\},\{threshold:\.6\}\)\.observe\(\$\('checkout'\)\)/);
  assert.match(html, /const RESGATE_SEG=20;/);
  // Clicar no checkout cancela o resgate.
  assert.match(html, /\$\('checkout'\)\.addEventListener\('click',\(\)=>\{ disparado=true;/);
});

test('o desconto bate com o preco', () => {
  assert.match(html, /CUPOM=\{codigo:'TABLE15',percentual:15/);
  assert.match(html, /const preco=127\*\(1-CUPOM\.percentual\/100\)/);
});
