# -*- coding: utf-8 -*-
"""Gera o ebook 'A Cor de Cada Pessoa' em HTML print-ready (fixed-layout)."""
import html, os

# (key, Nome, hex, dark?, codigo, essencia, [ficha3], retrato, emoji, fecho_tail)
COLORS = {
"azul":("Azul","#5E82AE",1,"paz · presença","A presença que desacelera você.",
 ["Aparece quando o mundo está barulhento demais.","O presente dela: um lugar pra pousar.","Cuidado quando confundem a calma dela com falta de intensidade."],
 "A pessoa azul te traz calma. Não necessariamente resolve tudo — mas só de estar perto, desacelera você. É uma presença que não exige performance, não te apressa, não te faz se explicar o tempo todo. Ela não entra na sua vida com intensidade caótica: entra com constância. É quem você procura quando tudo está demais, quando a cabeça está cheia, quando o corpo está cansado. E muitas vezes nem precisa dizer muito — porque tem gente que acolhe no silêncio, que organiza sem controlar, que sustenta sem invadir. A pessoa azul é segurança emocional. É o lugar onde você pode pousar. E isso é raro: num mundo acelerado, cheio de estímulos, ter alguém que te regula e te acalma é um vínculo profundo. Talvez valha se perguntar também: você tem sido essa pessoa pra alguém? Porque esse tipo de relação nasce tanto do que a gente recebe quanto do que oferece.",
 "💙","Algumas presenças acalmam sem dizer nada — e merecem ser lembradas."),
"azul_glacial":("Azul Glacial","#A9C6DB",0,"paz · profundidade calma","A calma que age em silêncio.",
 ["Aparece quando você precisa de firmeza silenciosa.","O presente dela: profundidade e constância.","Cuidado quando acham que reserva é frieza."],
 "À primeira vista, a pessoa azul glacial pode parecer distante. Não porque seja fria — mas porque nem todo mundo tem acesso à profundidade dela. Ela não fala muito sobre o que sente: demonstra. No jeito de se fazer presente, no silêncio que acolhe, na mensagem que chega exatamente quando você precisava. Não é intensa nas palavras; é constante nas atitudes. Enquanto muita gente faz questão de ser vista, a pessoa azul glacial faz questão de enxergar — percebe quando o seu sorriso está diferente, quando o “tá tudo bem” não convence. Tem uma calma rara: no meio do caos, não aumenta o barulho, ela diminui a tempestade. É como um lago cristalino — de longe se vê só a superfície, mas quem tem coragem de se aproximar descobre uma profundidade difícil de explicar. E talvez esse seja o maior presente dela: fazer você sentir segurança.",
 "💙","Quem ama em silêncio raramente ouve o quanto importa. Diga."),
"azul_ardosia":("Azul-Ardósia","#48586A",1,"paz · base","A base que sustenta sem aparecer.",
 ["Aparece quando tudo está prestes a desabar.","O presente dela: a base que segura sem aparecer.","Cuidado quando esquecem de cuidar de quem cuida."],
 "Ela provavelmente não é a pessoa mais expansiva da sala, nem a mais barulhenta. Mas tem uma característica rara: presença. A pessoa azul-ardósia não ocupa o ambiente — ela sustenta o ambiente. Não sente necessidade de preencher todos os silêncios, porque entende que algumas das conversas mais importantes acontecem justamente neles. Ela escuta pra compreender, não pra responder — e, hoje em dia, isso é uma das formas mais profundas de amor. Dificilmente faz promessas grandiosas; prefere estar presente. Aparece quando ninguém vê, lembra do detalhe que passou despercebido, pergunta como você está e espera a resposta. Faz você sentir que não precisa performar pra ser amado. Talvez por isso quase nunca percebamos o quanto ela é importante enquanto está por perto: porque ela não faz barulho, faz base. E são as bases que passam despercebidas — até o dia em que deixam de existir.",
 "💙","As bases só são notadas quando somem. Note a sua antes disso."),
"turquesa":("Turquesa","#38B2A8",0,"paz · leveza","Leveza que não vira superficialidade.",
 ["Aparece quando você precisa de paz sem perder liberdade.","O presente dela: acolher sem prender.","Cuidado quando tomam a leveza dela por descompromisso."],
 "A pessoa turquesa traz leveza sem ser superficial. Ela consegue acalmar o caos sem fingir que ele não existe, te escutar sem tentar consertar tudo, respeitar os seus silêncios tanto quanto celebra as suas palavras. Ela não invade — acolhe. Não te empurra pra ser alguém diferente; ela te lembra de quem você é. É aquela presença que faz você respirar mais fundo, que transmite paz sem precisar dar conselhos, que oferece liberdade sem abandonar. A pessoa turquesa entende que amar não é prender, é permanecer. Num mundo que exige pressa, desempenho e perfeição, ela é um raro lembrete de que você não precisa merecer afeto pra recebê-lo. Ela é porto, mas também horizonte. É conforto, mas também coragem.",
 "💙","Ela é porto e horizonte ao mesmo tempo. Diga que você percebeu."),
"verde_menta":("Verde-Menta","#9CE0C4",0,"paz · alívio","O alívio de respirar de novo.",
 ["Aparece quando você esqueceu como respirar.","O presente dela: leveza que não foge da realidade.","Cuidado quando pensam que leveza é falta de profundidade."],
 "A pessoa verde-menta não chega fazendo barulho — chega trazendo alívio. Como abrir a janela depois de um dia inteiro num ambiente fechado, como respirar fundo depois de muito tempo prendendo o ar. Ela tem o efeito raro de fazer a vida parecer menos pesada. Não te faz esquecer dos problemas, mas te lembra que eles não são maiores que você. Perto dela, a ansiedade desacelera, a pressa perde a força, e você sente que pode simplesmente existir. Ela não exige versões perfeitas: não espera que você esteja sempre sorrindo nem que tenha todas as respostas. Acolhe quem você é, inclusive nos dias em que você nem consegue gostar de si mesmo. Tem o dom de trazer leveza sem superficialidade — conversa sobre coisas profundas sem tornar tudo mais pesado, faz você rir no meio do caos sem fingir que o caos não existe. Porque algumas pessoas aceleram o nosso coração; a verde-menta faz o contrário: devolve o ritmo que a vida às vezes faz a gente perder.",
 "💚","Quem te ajuda a respirar merece saber que faz isso por você."),
"branco":("Branco","#EDEBE4",0,"paz · luz","A paz que entra como luz.",
 ["Aparece quando o caos precisa de silêncio.","O presente dela: paz e verdade sem máscara.","Cuidado quando confundem serenidade com ausência."],
 "A pessoa branca chega sem fazer barulho, mas muda completamente o ambiente dentro de você. Não precisa ser a mais engraçada nem a mais intensa: a presença dela, sozinha, já acalma o caos. Ela te encontra nas versões mais cansadas de si mesmo e, ainda assim, escolhe ficar. Transforma silêncio em conforto, e não em vazio. Nunca força espaço na sua vida — mas, de alguma forma, se torna indispensável. É paz sem ser distante, cuidado sem exagero, amor que não sufoca nem cobra. Ela fala a verdade com carinho e está ao seu lado sem máscaras nem interesses. É alguém em quem você confia de olhos fechados, porque sabe que vai encontrar compreensão, lealdade e serenidade. Porque algumas pessoas entram na nossa vida como tempestade. Mas a pessoa branca entra como luz: calma, silenciosa e impossível de esquecer.",
 "🤍","Algumas pessoas entram como luz. Diga a ela que iluminou você."),
"amarelo":("Amarelo","#F4C948",0,"calor · segurança","A pessoa com quem você não precisa se editar.",
 ["Aparece quando você precisa ser inteiro, sem editar.","O presente dela: sustentar sem julgar.","Cuidado quando recebem tudo e raramente são ouvidas de volta."],
 "A pessoa amarela é aquela para quem você pode contar tudo — sem filtro, sem edição, sem medo de julgamento. Não te interrompe com respostas prontas, não te mede, não te diminui. Ela sustenta você inteiro, inclusive nas partes que você ainda não sabe como organizar. E isso é raro, porque a maioria das relações funciona dentro de recortes: você mostra o que é aceitável, o que é bonito, o que é fácil de acolher. A pessoa amarela não precisa dessa versão — ela te encontra no bruto. Nos dias em que você não está bem. Nos pensamentos que você não teria coragem de dizer em voz alta pra mais ninguém. E ela fica. Não necessariamente pra resolver, mas pra sustentar. E sustentar alguém é uma forma muito profunda de amor: exige presença sem controle, escuta sem julgamento, cuidado sem invasão. A pessoa amarela não te salva — ela te lembra que você não está sozinho. E, às vezes, isso é tudo. Mas há um segundo lado nessa cor: você também é a pessoa amarela de alguém? Esse tipo de vínculo não se constrói só em receber — se constrói em oferecer o mesmo espaço.",
 "💛","Vínculos assim não são óbvios — e merecem ser reconhecidos."),
"marrom":("Marrom","#6E4B36",1,"calor · lar","O cheiro de lar em pessoa.",
 ["Aparece quando você precisa de chão.","O presente dela: pertencimento e permanência.","Cuidado quando acham que quem sempre fica nunca vai embora."],
 "A pessoa marrom tem cheiro de lar. Ela faz o mundo parecer menos pesado só por estar perto. Não costuma ser a mais intensa nem a que chama atenção — mas é ela quem permanece, quem fica quando o resto vai embora. É abrigo nos dias difíceis, o abraço que descansa a alma, aquela sensação rara de pertencimento que quase ninguém consegue causar. A pessoa marrom conhece as suas bagunças emocionais e, ainda assim, escolhe sentar ao seu lado no meio delas — sem pressa, sem julgamento, sem fazer você se sentir demais. Tem algo nela que lembra calma depois da chuva, café quente em dia frio, casa acesa à noite. Ela não ama de forma barulhenta: ama permanecendo, nos detalhes, na constância. E talvez seja isso que a torne tão especial — num mundo cheio de conexões rápidas, ela faz você sentir que finalmente encontrou um lugar seguro pra ficar.",
 "🤎","Um lugar seguro pra ficar é raro. Diga a ela que ela é o seu."),
"cafe_com_leite":("Café com Leite","#C4A17B",0,"calor · aconchego","O aconchego do simples.",
 ["Aparece nos dias comuns, que ela torna bons.","O presente dela: descanso e aconchego.","Cuidado quando o simples é tratado como pouco."],
 "A pessoa café com leite talvez nunca tenha sido a mais chamativa. Mas, se um dia ela faltar, você percebe na hora. Ela tem o dom de transformar o comum em aconchego — de fazer você sentir que pode descansar, que não precisa provar nada, que pode simplesmente ser. Não é feita de grandes discursos, e sim de pequenos gestos: perguntar se você chegou bem, lembrar do seu café preferido, mandar mensagem quando sente que você está diferente, aparecer sem alarde. Ela faz da casa um lar, da conversa um abraço, do silêncio um lugar seguro. Não tenta impressionar ninguém, porque a beleza dela está na simplicidade. Ela não acelera a vida — desacelera o seu coração. Depois de algumas horas com ela, é como se você tivesse descansado. Num mundo que valoriza o extraordinário, a pessoa café com leite lembra que a maior parte da felicidade mora no cotidiano — e que o afeto mais profundo quase sempre é o mais simples.",
 "☕","O afeto mais profundo costuma ser o mais simples. Não deixe passar."),
"caramelo":("Caramelo","#C57B3C",0,"calor · doçura madura","A doçura que amadureceu na dor.",
 ["Aparece quando você precisa baixar a guarda.","O presente dela: calor que não cobra nada.","Cuidado quando aquece todo mundo e esquece de si."],
 "Tem gente que chega fazendo barulho; a pessoa caramelo chega trazendo calor. Ela tem um jeito de acolher que não se ensina: você senta do lado dela e, sem perceber, abaixa a guarda. Com ela, você não sente que precisa ser mais bonito, mais inteligente ou mais interessante — só sente que pode ser você. A doçura dela é madura: ela não é doce porque nunca sofreu, e sim porque escolheu não endurecer, mesmo depois das dores que viveu. Conhece o peso da vida e, justamente por isso, faz questão de aliviar a dos outros. Escuta sem interromper, abraça sem sufocar, aconselha sem julgar, ama sem tentar moldar. Tem o dom de aquecer os ambientes — não porque fale alto, mas porque faz as pessoas se sentirem pertencentes. Talvez o maior presente da pessoa caramelo seja esse: você sai de perto dela melhor do que chegou. A vida continua igual, mas você já não se sente tão sozinho pra enfrentá-la.",
 "🍮","Quem faz você sair melhor do que chegou merece ouvir isso."),
"ocre":("Ocre","#C4892C",0,"calor · permanência","O amor que se prova permanecendo.",
 ["Aparece quando todo mundo já foi embora.","O presente dela: estabilidade e raiz.","Cuidado quando quem é chão pros outros esquece que também merece chão."],
 "A pessoa ocre não chega tentando impressionar — chega fazendo você se sentir em casa. Não precisa ser o centro da conversa pra transformar um ambiente, porque a força dela nunca esteve no brilho: sempre esteve na constância. Ela tem algo raro — permanece. Permanece quando a novidade passa, quando a fase boa acaba, quando a vida fica difícil. Entende que amar alguém não é estar presente só nos dias leves, e sim escolher continuar quando o entusiasmo já não faz o trabalho sozinho. Talvez por isso seja confundida com simplicidade, mas existe uma profundidade enorme nas coisas que permanecem: uma árvore centenária não impressiona pelas flores, e sim pelas raízes. A pessoa ocre é feita de raízes. Ela oferece estabilidade num mundo que vive correndo, e lembra que o maior gesto de amor, às vezes, é simplesmente continuar — continuar ligando, aparecendo, perguntando como você está, escolhendo você mesmo quando seria mais fácil desaparecer.",
 "🌾","Quem é chão pros outros também merece um chão. Seja o dela."),
"amarelo_manteiga":("Amarelo-Manteiga","#F0D488",0,"calor · delicadeza","A força que mora na delicadeza.",
 ["Aparece nos gestos pequenos do dia a dia.","O presente dela: cuidado que não faz alarde.","Cuidado quando a delicadeza é lida como fraqueza."],
 "A pessoa amarelo-manteiga não entra nos lugares como um raio de sol — entra como a luz da manhã: suave, silenciosa, preenchendo o ambiente sem que a gente perceba. Não costuma ser a mais barulhenta nem a que chama atenção primeiro. Mas, com o tempo, você percebe que ela se tornou uma das pessoas mais importantes da sua vida — porque existe algo muito especial em quem oferece conforto sem fazer alarde. Ela sabe ouvir, respeitar os silêncios, permanecer quando não há palavras certas pra dizer. Perto dela, você não sente a obrigação de parecer bem o tempo todo: pode chegar cansado, confuso, vulnerável, e ainda assim se sentir aceito. Ela entende que cuidado não está só nos grandes gestos — está na mensagem perguntando se você chegou bem, na lembrança de um detalhe que você comentou meses atrás, no café do jeito que você gosta. Num mundo que associa força a dureza, ela lembra que existe uma força imensa na delicadeza. E por isso a falta dela é tão sentida: algumas pessoas não ocupam espaço, elas aquecem o espaço.",
 "💛","Algumas pessoas não ocupam espaço — aquecem o espaço. Agradeça a sua."),
"amarelo_champagne":("Amarelo Champagne","#EADFB4",0,"calor · elegância","A luz elegante que não ofusca ninguém.",
 ["Aparece iluminando sem roubar a cena.","O presente dela: elegância que celebra o outro.","Cuidado quando só notam a diferença quando ela some."],
 "Sabe aquelas pessoas que não precisam ser as mais barulhentas da sala pra serem lembradas? A pessoa amarelo champagne é assim. Ela não chama atenção pelo excesso — chama pela presença. Tem uma luz elegante: não ofusca ninguém pra brilhar, pelo contrário, ilumina quem está por perto. Chega e o ambiente parece respirar mais leve. Não precisa ter resposta pra tudo, mas de alguma forma faz você acreditar que tudo vai ficar bem. Celebra as suas conquistas como se fossem dela, vibra sem inveja, aplaude sem competir. Tem um jeito delicado de enxergar beleza nas pequenas coisas — um café demorado, um pôr do sol, uma mensagem inesperada, uma conversa que cura. Não faz questão de ser o centro das atenções, mas, curiosamente, é quando ela vai embora que todos percebem o quanto fazia diferença. Ela tem maturidade pra acolher sem controlar, gentileza sem ingenuidade, leveza sem superficialidade. É uma luz discreta, daquelas que aquecem mais do que brilham. E talvez o maior presente dela seja fazer você se sentir visto.",
 "🥂","Não espere ela ir embora pra perceber a diferença que ela faz."),
"rosa":("Rosa","#E597AD",0,"calor · afeto leve","O afeto que faz o amor parecer leve.",
 ["Aparece nos detalhes que ninguém mais vê.","O presente dela: um amor que é leve e fica.","Cuidado quando tomam a doçura dela por fraqueza."],
 "A pessoa rosa faz o amor parecer leve — sem jogos, sem medo, sem a necessidade de provar nada o tempo inteiro. Ela chega devagar, mas quando você percebe já mora nos detalhes da sua vida: nas conversas bobas que viram as suas favoritas, nos cuidados pequenos que ninguém vê, no jeito de transformar um dia comum em algo bonito. Tem uma doçura difícil de explicar — não porque seja frágil, mas porque escolhe amar com delicadeza num mundo que endureceu tanta gente. Ela te abraça sem tocar, entende mudanças no seu silêncio, faz você se sentir querido até nos dias em que você não consegue gostar de si mesmo. E o mais bonito é que ela nunca precisa forçar intensidade — a presença dela já transborda carinho. A pessoa rosa é conforto, é afeto tranquilo, é aquele tipo raro de conexão que faz o coração desacelerar em vez de doer. Porque algumas pessoas chegam pra virar memória; a pessoa rosa chega pra virar sentimento permanente.",
 "🩷","Algumas pessoas viram sentimento permanente. Diga isso à sua."),
"rosa_bebe":("Rosa Bebê","#F3C4D1",0,"calor · gentileza","A gentileza como forma de força.",
 ["Aparece escolhendo carinho onde caberia aspereza.","O presente dela: gentileza que desarma.","Cuidado quando gentileza é confundida com ingenuidade."],
 "A pessoa rosa bebê não chega tentando ocupar espaço — chega fazendo o mundo parecer um pouco mais leve. Existe nela uma delicadeza que não é fragilidade: é força sem agressividade, firmeza sem dureza. Alguém que escolhe o carinho quando seria mais fácil responder com aspereza. Ela faz você lembrar que ainda existem pessoas boas — daquelas que tratam o garçom com respeito, que agradecem, que pedem licença, que olham nos olhos quando perguntam se está tudo bem. Ela não espalha gentileza porque a vida sempre foi gentil com ela; espalha porque decidiu não devolver ao mundo a dureza que um dia recebeu. Perto dela, você percebe que nem toda conversa precisa terminar em discussão, nem toda diferença precisa virar conflito. Ela tem o dom de fazer as pessoas baixarem a guarda, porque nunca parece estar competindo. Cuida dos detalhes — lembra do seu doce preferido, manda mensagem sem motivo, abraça um pouco mais demorado — e faz tudo isso sem esperar reconhecimento. Porque algumas pessoas impressionam pela intensidade; a rosa bebê transforma pela delicadeza.",
 "🌸","A delicadeza parece pequena, mas muda o dia de alguém. Talvez o dela hoje."),
"vermelho":("Vermelho","#CE3F39",1,"movimento · intensidade","A intensidade que te tira do lugar.",
 ["Aparece nos momentos de virada.","O presente dela: coragem e movimento.","Cuidado quando a intensidade vira demais pra fase que você vive."],
 "A pessoa vermelha é aquela que te tira do lugar — nem sempre com calma, nem sempre com suavidade, mas com intensidade. É quem te provoca, quem te atravessa, quem não te deixa confortável por muito tempo no mesmo lugar. Ela não é neutra na sua vida: acende coisas em você. Às vezes coragem, às vezes desejo, às vezes até desconforto — mas sempre movimento. Porque ela não te permite ficar anestesiado. Te lembra da sua potência mesmo quando você duvida dela, te confronta quando você está se escondendo, te chama pra vida quando você está se acomodando. E isso pode ser lindo, mas também desafiador, porque a pessoa vermelha nem sempre vem com leveza — às vezes vem com verdade demais, presença demais, e nem todo mundo está pronto pra isso o tempo todo. Mas há algo muito valioso nesse vínculo: a pessoa vermelha não te deixa pequeno. Ela não aceita a sua versão reduzida. Costuma aparecer nos momentos de virada, quando você precisava de impulso, de coragem, de ruptura. Ela não é sobre conforto — é sobre transformação.",
 "❤️","Quem não te deixa pequeno é raro. Diga a ela que ela te move."),
"laranja":("Laranja","#E6712B",0,"movimento · leveza viva","A leveza que te devolve à vida.",
 ["Aparece quando o dia ficou pesado demais.","O presente dela: leveza que não exige esforço.","Cuidado quando acham que quem alegra nunca precisa de colo."],
 "A pessoa laranja te devolve leveza. É quem te faz rir quando você nem estava com vontade, quem te puxa de volta pra vida quando tudo começa a pesar demais. Ela não chega com profundidade intensa nem com grandes reflexões — chega com presença leve, espontaneidade, alegria, aquele tipo de energia que não exige esforço pra acontecer. A pessoa laranja não te cobra: não espera que você esteja perfeito, resolvido, bem o tempo todo. Ela só te encontra onde você está e, de algum jeito, faz aquilo ficar mais leve. É quem transforma um dia comum em algo bom, quem cria memórias sem precisar de grandes acontecimentos, quem te lembra que viver também pode ser simples. E isso é muito necessário, porque no meio de tanta responsabilidade e profundidade a gente também precisa de respiro, de alguém que traga cor, movimento leve, sorriso sem esforço. A pessoa laranja não resolve tudo — mas ela muda o clima. E, às vezes, isso já é suficiente pra você conseguir continuar.",
 "🧡","Quem te faz rir nos dias pesados também tem dias pesados. Cuide dela."),
"coral":("Coral","#FF7A67",0,"movimento · esperança","A prova de que a leveza ainda existe.",
 ["Aparece quando tudo parecia cinza.","O presente dela: fôlego pra continuar.","Cuidado quando quem espalha esperança também se cansa em silêncio."],
 "A pessoa coral faz a gente acreditar que a leveza ainda existe — não porque nunca sofreu, mas porque decidiu não deixar que a dor fosse a única coisa que ela ofereceria ao mundo. Ela chega e, sem perceber, muda o clima do ambiente. Faz você rir quando já tinha esquecido como, faz voltar a sonhar quando a esperança estava cansada. Depois de uma conversa com ela, os problemas não desapareceram, mas já não parecem do mesmo tamanho — e isso é um presente raro. A pessoa coral não invade: ela aquece. Não força alegria: devolve fôlego. Talvez ela nunca tenha percebido que, pra muita gente, foi a prova de que ainda valia a pena acreditar nas pessoas. Porque existem encontros que não mudam a nossa história de uma vez — apenas devolvem a coragem de continuar escrevendo.",
 "🪸","Ela te devolveu o fôlego sem saber. Conte a ela."),
"dourado":("Dourado","#D4AF37",0,"movimento · brilho raro","O brilho raro que aquece quem ama.",
 ["Aparece iluminando o que estava apagado.","O presente dela: fazer você lembrar do próprio valor.","Cuidado quando brilha pros outros e ninguém ilumina de volta."],
 "A pessoa dourada parece rara desde o primeiro instante — como se o mundo tivesse cores comuns e ela carregasse um brilho que ninguém consegue copiar. Ela não passa pela sua vida sem deixar marca: ilumina lugares em você que estavam apagados há muito tempo e, sem perceber, faz você voltar a sentir vontade da vida. Não é perfeita, mas existe algo nela que aquece — no jeito de falar, de olhar, de permanecer. É quem te lembra do seu valor nos dias em que você esquece, quem celebra as suas pequenas vitórias como se fossem gigantes, quem transforma momentos simples em memórias impossíveis de abandonar. Tem gente que chega e faz barulho; a pessoa dourada chega e faz diferença. Porque ela não ilumina só os dias bons — também fica nas fases escuras, segurando a sua mão enquanto você tenta se reencontrar. E talvez seja isso que a torne tão rara: o brilho dela nunca foi sobre aparecer, sempre foi sobre aquecer quem ama.",
 "✨","O brilho dela é pra aquecer, não pra aparecer. Diga que você sentiu."),
"prata":("Prata","#B9C0C7",0,"movimento · espelho","O espelho sereno que te clareia.",
 ["Aparece quando você precisa se enxergar com nitidez.","O presente dela: sabedoria calma, sem julgamento.","Cuidado quando acham que serenidade é falta de intensidade."],
 "Se o dourado aquece, a pessoa prata clareia. Ela não chega pra ofuscar você — chega pra te devolver a você mesmo, com mais nitidez. É aquela presença madura que, sem dar sermão, faz você enxergar o que já sabia mas não estava vendo. A pessoa prata escuta antes de opinar. Pesa antes de falar. E quando fala, tem o peso raro de quem não desperdiça palavra. Ela não compete com o seu brilho — ela reflete, organiza, acalma. Tem uma elegância que não vem da aparência, e sim da forma serena como atravessa as coisas. Perto dela, as suas ideias confusas encontram contorno; as suas decisões difíceis encontram clareza. Ela não te diz o que fazer. Ela te ajuda a se ouvir. E talvez seja por isso que a presença dela seja tão valiosa: num mundo barulhento, cheio de gente querendo aparecer, a pessoa prata é o espelho calmo onde você finalmente consegue se ver.",
 "🤍","Nem todo mundo te dá respostas — alguns te ajudam a se enxergar. Agradeça."),
"verde":("Verde","#4C9857",0,"crescimento · raiz","Quem cresce junto com você.",
 ["Aparece no meio dos seus processos.","O presente dela: crescer ao seu lado sem te apressar.","Cuidado quando confundem apoio com obrigação de sustentar sempre."],
 "A pessoa verde cresce com você. Não é sobre intensidade imediata nem grandes viradas — é sobre constância. É quem te acompanha nos processos, respeita o seu tempo, não te apressa mas também não te deixa estagnar. A presença dela muitas vezes é silenciosa, mas profundamente transformadora: ela não precisa te empurrar, ela te sustenta enquanto você se constrói. É quem te vê em fases diferentes e continua — quando você está confuso, quando você está mudando, quando você ainda não chegou mas já não é mais quem era. A pessoa verde não exige que você esteja pronto; ela entende que crescer é bagunçado, que envolve tentativa, erro, pausa, recomeço. Ela te incentiva sem te pressionar, te apoia sem te invadir, te ajuda a expandir sem fazer você se perder de si. E isso é raro, porque nem todo mundo sabe estar ao lado de alguém em transformação. Ela não quer a sua versão final: valoriza quem você está se tornando. Por isso esse tipo de vínculo cria raízes profundas, firmes, sustentáveis — porque crescer junto é uma das formas mais bonitas de permanecer.",
 "💚","Crescer junto é uma forma de permanecer. Diga a quem cresce com você."),
"verde_abacate":("Verde Abacate","#9CB55E",0,"crescimento · florescer","Quem faz a sua vida florescer.",
 ["Aparece quando você duvida do próprio potencial.","O presente dela: acreditar até você acreditar.","Cuidado quando cuida do florescer dos outros e esquece do próprio."],
 "Tem pessoas que parecem nascer com o dom de fazer a vida florescer — a pessoa verde abacate é assim. Ela chega e, sem perceber, desperta o melhor das pessoas. Acredita em você antes mesmo de você acreditar em si, enxerga potencial onde todo mundo só vê insegurança. Tem um jeito leve de incentivar: não empurra, cultiva. É alguém que respeita o tempo das sementes, que entende que nem toda fase é de flores e que às vezes é preciso apenas continuar regando. A pessoa verde abacate transmite uma sensação de vida — quando você conversa com ela, sai com vontade de começar de novo, de tentar mais uma vez, de não desistir de quem você pode se tornar. Ela não vive presa ao passado nem tem pressa pelo futuro: sabe encontrar beleza no processo. Tem esperança sem ser ingênua, otimismo sem ignorar a realidade. Sabe que crescer dói e, por isso, escolhe permanecer por perto enquanto você cresce. Talvez esse seja o maior presente dela: ela não quer que você dependa dela, ela quer ver você florescer — e comemora como se fosse conquista dela também.",
 "🥑","Ela acreditou antes de você. Deixe que ela saiba disso."),
"verde_e_amarelo":("Verde e Amarelo","#5CA544",0,"crescimento · fé no outro","Quem acredita até você acreditar.",
 ["Aparece quando você esquece a própria força.","O presente dela: abrigo que também é solo fértil.","Cuidado quando confundem incentivo com cobrança."],
 "A pessoa verde e amarelo não tenta viver por você — ela faz você lembrar que é capaz de viver por si mesmo. Não resolve todos os seus problemas, mas faz você acreditar que eles podem ser enfrentados. Ela enxerga em você versões que você ainda não consegue enxergar e, mesmo quando você duvida de si, continua acreditando. Tem um jeito bonito de cuidar: acolhe quando é preciso descansar, mas também incentiva quando chega a hora de seguir em frente, porque sabe que amor não é prender, é ajudar o outro a florescer. Perto dela, você sente que pode errar, recomeçar, mudar de ideia, crescer — porque ela nunca usa o seu passado como sentença, ela olha pra quem você ainda pode se tornar. Comemora as suas conquistas como se fossem dela, mas também permanece quando ninguém está aplaudindo. Não aparece só nos dias bons: segura a sua mão nos dias em que você esquece a própria força. Porque algumas pessoas são abrigo — e existem aquelas que, além de abrigo, também são solo fértil. É nelas que a gente aprende, aos poucos, a florescer.",
 "💛","Ela é abrigo e solo fértil. Agradeça por ter florescido ao lado dela."),
"verde_pinho":("Verde-Pinho","#2C4B39",1,"crescimento · constância","Quem faz da constância uma forma de amar.",
 ["Aparece justamente quando fica difícil.","O presente dela: permanência que dá segurança.","Cuidado quando tratam a presença dela como garantida."],
 "Vivemos num mundo onde tudo muda muito rápido — as pessoas mudam de ideia, de planos, de prioridades, algumas até de afeto. Mas, de vez em quando, a vida nos presenteia com alguém diferente: alguém que permanece. A pessoa verde-pinho não aparece só nos dias bons. Ela também está nos dias comuns, nos dias confusos, nos dias em que você não tem nada de interessante pra contar. Ela não te ama pelos seus melhores momentos — te ama também quando você está cansado, perdido, sem saber o que fazer da própria vida. E existe algo profundamente curativo em saber que alguém não vai embora ao conhecer as suas imperfeições. Ela não promete que nunca vai errar; ela só faz uma coisa cada vez mais rara: permanece. Num tempo em que muitos desistem na primeira dificuldade, ela escolhe construir, conversar, ficar. Por isso a presença dela transmite tanta segurança — você nunca precisa se perguntar se ela vai estar ali quando a vida ficar difícil. A pessoa verde-pinho fez da constância uma forma de amar.",
 "🌲","A permanência dela te faz sentir seguro. Diga que você percebe."),
"verde_pistache":("Verde-Pistache","#BCD59B",0,"crescimento · leveza corajosa","A leveza que teve coragem de não endurecer.",
 ["Aparece trazendo frescor onde havia só paredes.","O presente dela: leveza que teve coragem de não endurecer.","Cuidado quando ninguém percebe o esforço por trás do sorriso."],
 "A pessoa verde-pistache tem algo raro: carrega leveza, mas não superficialidade; alegria, mas não ingenuidade; doçura, mas não fragilidade. Porque a verdadeira leveza não nasce da ausência de problemas — nasce da forma como escolhemos atravessá-los. Ela já conheceu dias difíceis, mas não permitiu que a dureza da vida endurecesse também o seu coração. Continua acreditando nas pessoas, encontrando motivos pra sorrir, oferecendo gentileza num mundo que nem sempre a devolve — e isso exige coragem. Perto dela, você sente que pode respirar mais fundo, não porque ela resolve os seus problemas, mas porque te faz lembrar que você é maior do que eles. Ela tem o dom de trazer frescor pra vida dos outros: abre janelas onde você só via paredes, encontra possibilidades onde você só via preocupação. Não ignora a realidade, apenas se recusa a viver aprisionada por ela. E o mais bonito é que faz tudo isso sem perceber, sem precisar ser a protagonista, sem precisar de aplausos. Ela simplesmente espalha luz por onde passa.",
 "🌱","Existe coragem por trás daquele sorriso leve. Reconheça a dela."),
"roxo":("Roxo","#7A4C9E",1,"profundidade · conexão","A conexão que se sente antes de entender.",
 ["Aparece com uma conexão que dispensa explicação.","O presente dela: profundidade que revela você.","Cuidado quando intensidade demais nem sempre cabe na rotina."],
 "A pessoa roxa é aquela que você não consegue explicar completamente — e talvez essa seja uma das coisas mais bonitas sobre ela. Não é sobre tempo, frequência ou lógica: é sobre conexão. Uma conexão que você sente antes mesmo de entender. Com ela, a conversa aprofunda rápido, o silêncio não é estranho, existe uma sensação de “eu te reconheço” mesmo sem história suficiente pra isso. A pessoa roxa não é comum na vida: não aparece em grande quantidade e muitas vezes nem permanece de forma linear. Mas, quando existe, marca — porque acessa lugares seus que nem todo mundo alcança, partes mais profundas, mais sensíveis, mais verdadeiras. E nem sempre é confortável, porque esse tipo de conexão também revela, traz consciência, amplia percepção: às vezes você sai de uma conversa com ela diferente de como entrou, e nem sempre dá pra explicar o porquê. Mas você sabe que algo mudou. A pessoa roxa não é sobre rotina, é sobre intensidade emocional e profundidade. É um vínculo que não precisa de validação externa, que não precisa ser entendido por todo mundo. Porque quem vive, sente.",
 "💜","Conexões que dispensam explicação são raras. Diga que a sua marcou."),
"lilas":("Lilás","#B49AD6",0,"profundidade · abrigo","O abrigo que acredita em você.",
 ["Aparece quando tudo parece confuso.","O presente dela: acreditar em você quando você não consegue.","Cuidado quando quem é abrigo raramente é abrigada."],
 "Todo mundo deveria ter uma pessoa lilás na vida. Ela é aquela que traz calma quando tudo parece confuso, que acredita em você quando nem você acredita. Comemora as suas vitórias como se fossem dela e permanece por perto quando as coisas não estão dando certo. A pessoa lilás não precisa falar o tempo todo — às vezes ajuda apenas estando presente. Ela não te julga pelos seus erros, não compete com as suas conquistas e não desaparece quando você mais precisa. É abrigo, é conforto, é segurança. É aquela pessoa que, só de lembrar, já faz o coração ficar mais leve. Num mundo cheio de pressa, críticas e cobranças, encontrar uma pessoa lilás é encontrar um lugar onde você pode simplesmente ser quem é. E se você tem alguém assim, não espere uma ocasião especial pra demonstrar gratidão — algumas pessoas são tão raras que merecem saber o quanto são importantes.",
 "🪻","Algumas pessoas são raras demais pra não saberem o quanto importam."),
"ameixa":("Ameixa","#6C3A5A",1,"profundidade · sensibilidade","Quem sente o mundo fundo demais.",
 ["Aparece percebendo o que ninguém mais percebe.","O presente dela: fazer o outro se sentir profundamente compreendido.","Cuidado quando escuta todo mundo e quase nunca é escutada."],
 "A pessoa ameixa é daquelas que você nunca entende completamente — e talvez essa seja uma das coisas mais bonitas sobre ela. Ela carrega uma profundidade que não faz questão de explicar. Ri alto, mas sente fundo. Consegue ser leve sem ser superficial, forte sem precisar endurecer. Aprendeu que nem tudo precisa ser dito pra ser verdadeiro, e por isso não disputa atenção: conquista confiança. É o tipo de pessoa que faz você querer contar coisas que nunca planejou contar — não porque faz muitas perguntas, mas porque, perto dela, você sente que será acolhido, e não julgado. Tem uma sensibilidade rara: percebe quando o seu “tá tudo bem” significa o contrário, lembra do que você disse meses atrás, repara no detalhe que ninguém viu, cuida das pessoas de um jeito tão silencioso que às vezes elas nem percebem. Mas existe um preço em sentir o mundo com tanta intensidade: quase sempre a pessoa ameixa oferece aos outros a compreensão que ela mesma gostaria de receber. Escuta mais do que é escutada, acolhe mais do que é acolhida, e continua acreditando nas pessoas mesmo depois de já ter se decepcionado. Talvez por isso seja tão inesquecível — porque deixa marcas onde passa.",
 "🫐","Quem faz todo mundo se sentir compreendido também precisa ser compreendido."),
"indigo":("Índigo","#454592",1,"profundidade · intuição","Quem sabe sem você precisar dizer.",
 ["Aparece quando você não tem palavras pro que sente.","O presente dela: ser lido e compreendido sem esforço.","Cuidado quando sente tanto o outro que esquece de si."],
 "A pessoa índigo sente antes de entender. Ela percebe a mudança no seu tom antes de você terminar a frase. Nota o “tô bem” que não convence. Repara na ausência que você achou que ninguém ia perceber. Não é adivinhação — é uma sensibilidade rara, uma escuta que vai além das palavras. Com ela, você não precisa explicar tudo, porque ela já leu o que estava embaixo. E existe um alívio enorme em ser compreendido sem ter que traduzir a dor em palavras certas. A pessoa índigo tem uma profundidade quase silenciosa: ela não anuncia o que percebe, só ajusta a presença de acordo. Chega mais perto quando sente que você precisa. Recua quando sente que você quer espaço. É intuição virada cuidado. Mas quem sente o mundo com tanta intensidade também carrega um peso: a pessoa índigo costuma enxergar todo mundo, e nem sempre é enxergada de volta. Por isso, quando você perceber que ela te leu mais uma vez, não deixe passar. Diga a ela que, dessa vez, foi você quem viu.",
 "💙","Quem passa a vida lendo os outros também merece ser lido. Leia a sua."),
"preto":("Preto","#1C1C22",1,"profundidade · enigma","O enigma que magnetiza — e respeita limites.",
 ["Aparece quando você precisa de densidade, não de ruído.","O presente dela: profundidade e fronteira, um amor que não se dilui.","Cuidado quando confundem o mistério dela com distância."],
 "A pessoa preta não se entrega no primeiro encontro. E é justamente isso que te atrai. Num mundo onde todo mundo mostra tudo o tempo todo, ela guarda — não por frieza, mas porque entende que profundidade não se escancara, se revela. Ela tem limites. Sabe dizer não. Não se dobra pra caber onde não deveria. E há algo profundamente magnético em quem não precisa da sua aprovação pra ser inteiro. A pessoa preta não ilumina o ambiente fazendo barulho; ela muda o ambiente pela densidade do que carrega. Quem olha de fora vê só a superfície escura, elegante, um pouco inacessível. Mas quem tem coragem de se aproximar descobre uma intensidade rara — e a sensação de estar diante de alguém que não se explica pra qualquer um. A pessoa preta não é sobre mistério vazio. É sobre a força de quem se conhece o bastante pra não ter pressa de ser entendido. E, quando ela escolhe você pra entrar, isso não é pouco. É das coisas mais raras que existem.",
 "🖤","Ser escolhido pra entrar é raro demais pra não reconhecer."),
"vinho":("Vinho","#7A2138",1,"profundidade · amor maduro","O amor maduro, intenso e contido.",
 ["Aparece quando o afeto para de precisar de prova.","O presente dela: intensidade que virou cuidado, fogo que aprendeu a durar.","Cuidado quando confundem contenção com esfriamento."],
 "A pessoa vinho ama com intensidade — mas não com descontrole. É o que acontece quando o vermelho amadurece: o desejo não some, ele se aprofunda; o fogo não apaga, ele aprende a se sustentar. Ela não precisa gritar o que sente, porque o que sente tem densidade demais pra caber em gritos. É um amor que envelheceu bem. Que já passou pela fase da urgência e chegou na fase da escolha: a pessoa vinho fica não porque não sabe viver sem você, mas porque, sabendo, escolhe você mesmo assim. Tem uma sofisticação nesse tipo de vínculo — ele não se entrega fácil, não se banaliza, não se reparte com todo mundo. É reservado, quase secreto, como as coisas verdadeiramente valiosas. Perto da pessoa vinho, você sente que está diante de um afeto que tem raiz e tempo, não pressa e fogo de palha. E talvez seja essa a beleza mais rara dela: num mundo de conexões rápidas e intensidades descartáveis, ela oferece um amor que amadurece — e, como todo vinho bom, fica melhor com os anos.",
 "🍷","Alguns amores não gritam — eles envelhecem bem. Diga isso enquanto o tempo passa."),
"ferrugem":("Ferrugem","#A85832",1,"cura · cicatriz","Quem transformou cicatriz em abrigo.",
 ["Aparece quando você acha que precisa fingir que está bem.","O presente dela: transformar cicatriz em acolhimento.","Cuidado quando quem acolhe a dor dos outros esconde a própria."],
 "Existe um tipo de pessoa que, por muito tempo, teve vergonha das próprias marcas. Achava que precisava esconder o que viveu — as decepções, os erros, as perdas, as cicatrizes — até perceber que apagar a própria história também era apagar a pessoa que ela se tornou. A pessoa ferrugem não tem uma vida perfeita; ela tem uma vida verdadeira. Não fala das próprias dores pra chamar atenção — fala porque sabe que alguém pode respirar aliviado ao descobrir que não está sozinho. Não esconde as cicatrizes, porque elas deixaram de ser motivo de vergonha e passaram a ser prova de que ela sobreviveu. E talvez o mais admirável nela seja isto: ela nunca faz você sentir que precisa parecer forte. Perto dela, você entende que ser humano não é ter uma vida sem rachaduras — é ter coragem de continuar mesmo depois delas. A pessoa ferrugem transformou as próprias cicatrizes num lugar de acolhimento pra outras pessoas. Às vezes, a marca que ela tentou esconder por tantos anos foi exatamente o lugar onde outra pessoa encontrou esperança.",
 "🍁","A marca que ela quase escondeu virou esperança pra alguém. Talvez pra você."),
"barro_molhado":("Barro Molhado","#8A6850",1,"cura · recomeço","A vida que volta depois da tempestade.",
 ["Aparece depois da tempestade.","O presente dela: devolver vida ao que parecia perdido.","Cuidado quando acham que quem se recupera não precisa de colo."],
 "Existe um cheiro que só aparece depois da chuva — o cheiro da terra respirando de novo. A pessoa barro molhado tem esse mesmo efeito. Ela chega depois das tempestades, não pra apagar a dor, mas pra lembrar que a vida continua capaz de florescer. Não é feita de frases prontas nem tenta te convencer de que “vai dar tudo certo”: ela simplesmente permanece — e, às vezes, é exatamente disso que a gente precisa. A pessoa barro molhado conhece o peso das próprias cicatrizes, e por isso nunca diminui a dor de ninguém. Escuta sem apressar a cura, abraça sem exigir que você fique bem, respeita o tempo de cada recomeço. Tem uma força silenciosa, daquelas que não fazem barulho mas sustentam. Ela lembra a terra depois da chuva: pode ter enfrentado ventos fortes, pode ter sido encharcada pelas tempestades, mas continua fértil, continua capaz de dar vida. Talvez esse seja o maior presente dela: fazer você acreditar que o sofrimento não precisa ser o capítulo final da história, que ainda existe espaço pra recomeços, que ainda existe beleza depois das perdas.",
 "🌧️","Ela devolveu vida ao que parecia perdido. Não deixe de agradecer."),
"laranja_por_do_sol":("Laranja Pôr do Sol","#F08E49",0,"cura · descanso","Quem desacelera o seu coração.",
 ["Aparece no fim do dia difícil.","O presente dela: presença que desacelera o coração.","Cuidado quando deixamos pra dizer o quanto importa só depois."],
 "Tem gente que entra na nossa vida como um nascer do sol — chega trazendo energia, movimento, novos começos. Mas tem gente que é pôr do sol. A pessoa laranja pôr do sol é quem desacelera o nosso coração. Não precisa resolver os seus problemas pra fazer você se sentir melhor: oferece presença em vez de respostas, faz você respirar mais fundo só por estar por perto. É aquela pessoa que faz o mundo parecer menos pesado, que não exige que você esteja bem o tempo todo, que conhece os seus silêncios e não tenta preenchê-los a qualquer custo. Comemora as suas vitórias sem inveja, segura a sua mão nas derrotas sem pena, e lembra quem você é quando você mesmo esquece. Ela ilumina sem ofuscar, aquece sem invadir, não faz barulho pra demonstrar amor — está presente nos detalhes: numa mensagem inesperada, num abraço demorado, num “chegou em casa?”. É um amor que não chama atenção pela intensidade, mas pela constância. E o mais curioso é que, muitas vezes, essas pessoas nem imaginam o quanto são importantes. Às vezes, tudo o que alguém precisa hoje é descobrir que é o lugar de paz na vida de outra pessoa.",
 "🌅","Talvez ela não saiba que é o seu lugar de paz. Conte hoje, não depois."),
"arco_iris":("Arco-Íris","#7A4C9E",1,"todas as cores · síntese","A pessoa que é todas as cores.",
 ["Aparece quando a vida estava cinza.","O presente dela: aceitar você inteiro, em todas as cores.","Cuidado quando quem colore todo mundo também tem dias sem cor."],
 "A pessoa arco-íris chegou trazendo cor pra partes da sua vida que estavam cinzas há tempo demais. Ela não cabe em uma definição só: em alguns dias é paz, em outros intensidade; às vezes caos, às vezes abrigo. Mas em todas as versões ela faz você sentir a vida de verdade. Tem o dom raro de transformar momentos simples em memórias enormes — de fazer você rir quando queria sumir, de aparecer exatamente quando o mundo parece pesado demais. Carrega luz, mas também profundidade: consegue entender as suas dores sem fazer delas o centro de tudo. E talvez por isso, perto dela, você nunca precise esconder quem realmente é. A pessoa arco-íris te aceita inteiro — nas suas fases bonitas, nas confusas, nas quebradas também. E o mais especial é que, mesmo tendo mil cores dentro de si, ela nunca faz você se sentir perdido. Pelo contrário: faz você se sentir visto. Porque algumas pessoas passam pela nossa vida deixando marcas. Mas a pessoa arco-íris deixa transformação. Talvez ela seja, no fundo, o que este livro inteiro tentou dizer: que ninguém cabe numa cor só — e que amar é reconhecer todas as cores que alguém tem.",
 "🌈","Ninguém cabe numa cor só. Diga a ela que você enxergou todas."),
}

PARTS = [
 ("Parte I","As cores que te dão paz","Existem pessoas que não resolvem a sua vida — elas a acalmam. Estas são as cores do porto seguro: as presenças que desaceleram você, que sustentam sem invadir, que fazem do silêncio um lugar onde se pode, finalmente, descansar.",
  ["azul","azul_glacial","azul_ardosia","turquesa","verde_menta","branco"]),
 ("Parte II","As cores que te aquecem","Há um tipo de amor que não chama atenção pela intensidade, e sim pelo aconchego. São as cores do lar: as pessoas que te acolhem no bruto, que amam nos detalhes, que fazem qualquer lugar parecer casa.",
  ["amarelo","marrom","cafe_com_leite","caramelo","ocre","amarelo_manteiga","amarelo_champagne","rosa","rosa_bebe"]),
 ("Parte III","As cores que te movem","Nem toda pessoa chega pra te acalmar. Algumas chegam pra te acender. São as cores da coragem e da transformação: as presenças que não te deixam pequeno, que te tiram do lugar, que iluminam o que estava apagado.",
  ["vermelho","laranja","coral","dourado","prata"]),
 ("Parte IV","As cores que te fazem crescer","Existem pessoas ao lado de quem a gente floresce. São as cores da raiz e do processo: as que respeitam o seu tempo, acreditam antes de você acreditar, e permanecem enquanto você se torna.",
  ["verde","verde_abacate","verde_e_amarelo","verde_pinho","verde_pistache"]),
 ("Parte V","As cores que te tocam fundo","Algumas conexões não se explicam — se sentem. São as cores da profundidade e do mistério: as presenças que te leem sem palavras, que revelam partes suas que ninguém mais alcança, e que marcam pra sempre.",
  ["roxo","lilas","ameixa","indigo","preto","vinho"]),
 ("Parte VI","As cores que curam","Há pessoas que chegam depois da tempestade. São as cores da cicatriz e do recomeço: as que transformaram a própria dor em abrigo, e que fazem você acreditar que ainda existe vida depois das perdas.",
  ["ferrugem","barro_molhado","laranja_por_do_sol"]),
 ("Encerramento","A cor que é todas as cores","","",),
]

def esc(s): return html.escape(s, quote=False)

# ordem linear de todas as cores (p/ capa, sumário e pontinhos)
ORDER = []
for _p in PARTS:
    if _p[0]=="Encerramento": ORDER.append("arco_iris")
    else: ORDER += _p[3]

def dots_strip(keys, size=7, gap=4):
    d = "".join(f'<span style="width:{size}px;height:{size}px;border-radius:50%;background:{COLORS[k][1]};display:inline-block"></span>' for k in keys)
    return f'<div style="display:flex;flex-wrap:wrap;gap:{gap}px;align-items:center">{d}</div>'

def swatch_page(idx, c):
    key, (nome,hexv,dark,codigo,ess,ficha,retrato,emoji,fecho) = c
    ink = "#ffffff" if dark else "#1a1a1a"
    dim = "rgba(255,255,255,.62)" if dark else "rgba(0,0,0,.55)"
    return f'''
<section class="page swatch" style="background:{hexv};color:{ink};box-shadow:0 0 0 5mm {hexv}">
  <div class="s-top" style="color:{dim}">{esc(codigo)}</div>
  <div class="s-num" style="color:{dim}">{idx:02d}</div>
  <div class="s-mid">
    <div class="s-emoji">{emoji}</div>
    <h1 class="s-name">{esc(nome)}</h1>
    <p class="s-ess">{esc(ess)}</p>
  </div>
  <div class="s-foot" style="color:{dim}">A Cor de Cada Pessoa</div>
</section>'''

def text_page(idx, c):
    key, (nome,hexv,dark,codigo,ess,ficha,retrato,emoji,fecho) = c
    fichahtml = "".join(f"<li>{esc(f)}</li>" for f in ficha)
    # fonte adaptativa: textos longos encolhem pra caber numa página
    n = len(retrato)
    rcls = "retrato"
    if n > 1500: rcls += " r-xs"
    elif n > 1300: rcls += " r-sm"
    return f'''
<section class="page text">
  <div class="t-head">
    <span class="t-dot" style="background:{hexv}"></span>
    <span class="t-name">{esc(nome)}</span>
  </div>
  <div class="ficha">
    <div class="ficha-label">Ficha</div>
    <ul>{fichahtml}</ul>
  </div>
  <div class="{rcls}">{esc(retrato)}</div>
  <div class="fecho" style="border-color:{hexv}">
    <p class="fecho-q">Você já pensou em quem é a sua pessoa {esc(nome.lower())}?</p>
    <p class="fecho-a">Faça um print desta página e mande pra ela. {esc(fecho)} {emoji}</p>
  </div>
</section>'''

# build body
chapters_idx = 0
body = []

# COVER
body.append(f'''
<section class="page cover">
  <div class="cover-spectrum"></div>
  <div class="cover-kicker">Evelyn Liu</div>
  <h1 class="cover-title">A Cor de<br>Cada Pessoa</h1>
  <p class="cover-sub">O que as cores revelam sobre as pessoas que passam pela sua vida</p>
  <div class="cover-dots">{dots_strip(ORDER, size=9, gap=6)}</div>
  <div class="cover-foot">35 cores · 35 retratos afetivos</div>
</section>''')

# INTRO / DISCLAIMER
body.append('''
<section class="page front">
  <h2 class="front-h">Antes de começar</h2>
  <p>Este livro nasceu de uma pergunta simples que viralizou: <em>quem é a sua pessoa amarela?</em> De repente, milhares de pessoas estavam dando nome a vínculos que sentiam mas nunca souberam explicar. Uma amiga que é calma. Um amor que é intenso. Alguém que é, inteiro, o seu lar.</p>
  <p>É sobre isso aqui. Cada cor é um jeito de amar, de estar, de marcar a vida de alguém. Você vai se reconhecer em algumas — e vai reconhecer, em outras, as pessoas que você ama.</p>
  <p class="front-disc"><strong>Um aviso honesto:</strong> isto não é ciência. Não há estudo que prove que existe “gente amarela” ou “gente roxa”. Pense nas cores como um horóscopo dos afetos — uma linguagem pra enxergar e nomear o que a gente sente, mas nem sempre consegue dizer. Se ressoar, é porque falou de algo verdadeiro em você. Se não ressoar, tudo bem: nem toda cor é sua.</p>
</section>''')

# HOW TO
body.append('''
<section class="page front">
  <h2 class="front-h">Como ler este livro</h2>
  <p>Você não precisa ler na ordem. Pode procurar a cor de alguém específico, ou folhear até uma te parar.</p>
  <p>Cada cor tem três partes: uma <strong>essência</strong> — a cor em uma frase; uma <strong>ficha</strong> — quando ela aparece, o que ela oferece, e o cuidado que ela pede; e um <strong>retrato</strong>, pra ler devagar.</p>
  <p>No fim de cada cor existe um convite. Quando um retrato fizer você pensar em alguém — <strong>faça um print daquela página e mande pra pessoa.</strong> A gente passa tempo demais sentindo gratidão em silêncio e tempo de menos dizendo. Este livro é, também, uma desculpa pra dizer.</p>
  <p class="front-sign">Com carinho,<br>Evelyn Liu</p>
</section>''')

# SUMÁRIO — todas as cores agrupadas por parte, com bolinha da cor
toc_rows = []
_ci = 0
for _p in PARTS:
    if _p[0]=="Encerramento":
        _p_keys=["arco_iris"]; _p_title=_p[1]
    else:
        _p_keys=_p[3]; _p_title=_p[1]
    items=""
    for k in _p_keys:
        _ci+=1
        nome=COLORS[k][0]; hexv=COLORS[k][1]
        items+=f'<li><span class="toc-dot" style="background:{hexv}"></span><span class="toc-name">{esc(nome)}</span><span class="toc-num">{_ci:02d}</span></li>'
    toc_rows.append(f'<div class="toc-part"><div class="toc-part-h">{esc(_p[0])} · {esc(_p_title)}</div><ul>{items}</ul></div>')
body.append(f'''
<section class="page toc">
  <h2 class="front-h">As cores</h2>
  <div class="toc-grid">{''.join(toc_rows)}</div>
</section>''')

for part in PARTS:
    if part[0]=="Encerramento":
        pnum,ptitle,pblurb = part[0],part[1],part[2]
        body.append(f'''
<section class="page divider">
  <div class="div-num">{esc(pnum)}</div>
  <h2 class="div-title">{esc(ptitle)}</h2>
</section>''')
        chapters_idx += 1
        body.append(swatch_page(chapters_idx, ("arco_iris",COLORS["arco_iris"])))
        body.append(text_page(chapters_idx, ("arco_iris",COLORS["arco_iris"])))
        continue
    pnum,ptitle,pblurb,keys = part
    body.append(f'''
<section class="page divider">
  <div class="div-num">{esc(pnum)}</div>
  <h2 class="div-title">{esc(ptitle)}</h2>
  <p class="div-blurb">{esc(pblurb)}</p>
  <div class="div-dots">{dots_strip(keys, size=10, gap=7)}</div>
</section>''')
    for k in keys:
        chapters_idx += 1
        body.append(swatch_page(chapters_idx, (k,COLORS[k])))
        body.append(text_page(chapters_idx, (k,COLORS[k])))

# CLOSING
body.append('''
<section class="page closing">
  <div class="cover-spectrum"></div>
  <p class="close-big">Some cor à vida de alguém hoje.</p>
  <p class="close-sm">Escolha uma pessoa. Escolha a cor dela. E diga.<br>Porque ninguém deveria descobrir tarde demais que foi importante.</p>
  <div class="close-sign">Evelyn Liu · A Cor de Cada Pessoa</div>
</section>''')

CSS = '''
@page { size: 148mm 210mm; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
:root{ --serif:"Baskerville","Palatino Linotype","Palatino","Georgia",serif;
       --display:"Didot","Bodoni 72","Baskerville","Georgia",serif;
       --sans:"Avenir Next","Avenir","Helvetica Neue",Arial,sans-serif; --ink:#20202a; }
html,body{ font-family:var(--serif); color:var(--ink); }
.page{ width:148mm; height:210mm; padding:20mm 18mm; position:relative; overflow:visible;
       page-break-after:always; display:flex; flex-direction:column; }
/* SANGRIA: preenchimento da cor 5mm alem da borda, cortado no aparo, mata o fio branco */
.cover, .divider, .closing{ box-shadow:0 0 0 5mm #12121a; }
/* páginas de texto SEMPRE 1 folha; o script de auto-ajuste encolhe a fonte p/ caber */
.text{ height:210mm; overflow:hidden; padding:15mm 18mm; }
/* COVER */
.cover{ background:#12121a; color:#f5f2ea; justify-content:center; }
.cover-spectrum{ position:absolute; left:0; right:0; top:0; height:10mm;
  background:linear-gradient(90deg,#CE3F39,#E6712B,#D4AF37,#4C9857,#38B2A8,#5E82AE,#7A4C9E,#E597AD); }
.cover-kicker{ position:absolute; top:16mm; left:18mm; font-family:var(--sans); font-size:10pt; letter-spacing:.35em; text-transform:uppercase; color:#a9a49b; }
.cover-title{ font-family:var(--display); font-weight:400; font-size:44pt; line-height:1.02; letter-spacing:.005em; }
.cover-sub{ font-style:italic; font-size:14pt; color:#cfc9bf; margin-top:8mm; max-width:80%; line-height:1.4; }
.cover-dots{ position:absolute; bottom:26mm; left:18mm; right:18mm; }
.cover-foot{ position:absolute; bottom:16mm; left:18mm; font-family:var(--sans); font-size:9.5pt; letter-spacing:.25em; text-transform:uppercase; color:#7d786f; }
/* SUMÁRIO */
.toc{ justify-content:flex-start; }
.toc .front-h{ margin-bottom:7mm; }
.toc-grid{ column-count:2; column-gap:9mm; }
.toc-part{ break-inside:avoid; margin-bottom:5mm; }
.toc-part-h{ font-family:var(--sans); font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase; color:#b06a3f; margin-bottom:2mm; font-weight:600; }
.toc-part ul{ list-style:none; }
.toc-part li{ display:flex; align-items:center; gap:2.5mm; padding:1mm 0; font-size:10pt; }
.toc-dot{ width:3mm; height:3mm; border-radius:50%; flex:0 0 auto; }
.toc-name{ flex:1; }
.toc-num{ font-family:var(--sans); font-size:8pt; color:#b8b2a6; }
/* FRONT MATTER */
.front{ justify-content:center; }
.front-h{ font-weight:400; font-size:22pt; margin-bottom:8mm; letter-spacing:-.01em; }
.front p{ font-size:12pt; line-height:1.62; margin-bottom:5mm; color:#33333f; }
.front em{ font-style:italic; }
.front-disc{ font-size:10.5pt; color:#5a5a66; border-top:1px solid #e2ddd4; padding-top:5mm; margin-top:2mm; }
.front-sign{ font-style:italic; color:#5a5a66; margin-top:4mm; }
/* DIVIDER */
.divider{ background:#12121a; color:#f5f2ea; justify-content:center; }
.div-num{ font-family:var(--sans); font-size:10pt; letter-spacing:.3em; text-transform:uppercase; color:#9a958c; margin-bottom:6mm; }
.div-title{ font-family:var(--display); font-weight:400; font-size:31pt; line-height:1.08; }
.div-blurb{ font-style:italic; font-size:12.5pt; color:#cfc9bf; margin-top:7mm; line-height:1.55; max-width:92%; }
.div-dots{ margin-top:9mm; }
/* SWATCH */
.swatch{ justify-content:space-between; }
.s-top{ font-family:var(--sans); font-size:9.5pt; letter-spacing:.25em; text-transform:uppercase; }
.s-num{ position:absolute; top:20mm; right:18mm; font-family:var(--sans); font-size:11pt; letter-spacing:.15em; }
.s-mid{ margin-top:auto; margin-bottom:auto; }
.s-emoji{ font-size:26pt; margin-bottom:6mm; }
.s-name{ font-family:var(--display); font-weight:400; font-size:39pt; line-height:1; letter-spacing:.005em; }
.s-ess{ font-style:italic; font-size:15pt; line-height:1.35; margin-top:6mm; max-width:80%; }
.s-foot{ font-family:var(--sans); font-size:8.5pt; letter-spacing:.28em; text-transform:uppercase; }
/* TEXT */
.text{ justify-content:flex-start; }
.t-head{ display:flex; align-items:center; gap:3mm; margin-bottom:7mm; }
.t-dot{ width:5mm; height:5mm; border-radius:50%; display:inline-block; }
.t-name{ font-family:var(--sans); font-size:10pt; letter-spacing:.2em; text-transform:uppercase; color:#6a6a76; }
.ficha{ background:#f6f3ec; border-radius:4mm; padding:5mm 6mm; margin-bottom:6mm; }
.ficha-label{ font-family:var(--sans); font-size:8.5pt; letter-spacing:.25em; text-transform:uppercase; color:#9a958c; margin-bottom:2.5mm; }
.ficha ul{ list-style:none; }
.ficha li{ font-size:10.5pt; line-height:1.45; padding-left:5mm; position:relative; margin-bottom:1.5mm; color:#3a3a46; }
.ficha li::before{ content:"·"; position:absolute; left:1mm; color:#b8b2a6; font-weight:700; }
.retrato{ font-size:11.2pt; line-height:1.6; text-align:justify; color:#26262e; }
.retrato.r-sm{ font-size:10.4pt; line-height:1.5; }
.retrato.r-xs{ font-size:9.7pt; line-height:1.44; }
.fecho{ margin-top:6mm; border-left:3px solid; padding:3mm 0 3mm 5mm; }
.fecho-q{ font-style:italic; font-size:11.5pt; margin-bottom:2mm; }
.fecho-a{ font-size:10.5pt; line-height:1.5; color:#4a4a56; }
/* CLOSING */
.closing{ background:#12121a; color:#f5f2ea; justify-content:center; text-align:center; align-items:center; }
.close-big{ font-size:26pt; line-height:1.15; max-width:85%; }
.close-sm{ font-style:italic; font-size:12pt; color:#cfc9bf; margin-top:7mm; line-height:1.6; max-width:80%; }
.close-sign{ position:absolute; bottom:16mm; left:0; right:0; font-family:var(--sans); font-size:8.5pt; letter-spacing:.25em; text-transform:uppercase; color:#7d786f; }
'''

FIT_JS = '''
<script>
/* Auto-ajuste: garante que retrato + ficha + fecho caibam numa unica pagina.
   Encolhe so a fonte do retrato (com passo fino) ate parar de transbordar. */
(function(){
  function fit(){
    document.querySelectorAll('.text').forEach(function(sec){
      var r=sec.querySelector('.retrato'); if(!r) return;
      var px=parseFloat(getComputedStyle(r).fontSize);
      var lh=1.6, guard=0, FLOOR=11.0; // ~8.25pt piso
      while(sec.scrollHeight>sec.clientHeight+1 && px>FLOOR && guard<80){
        px-=0.4; lh=Math.max(1.36, lh-0.006);
        r.style.fontSize=px.toFixed(2)+'px'; r.style.lineHeight=lh.toFixed(3);
        guard++;
      }
    });
  }
  if(document.readyState!=='loading') fit();
  else document.addEventListener('DOMContentLoaded', fit);
})();
</script>'''

def dedash(s):
    # remove travessões (— –), preservando hífens de palavras compostas (- ASCII)
    s = s.replace(" — ", ", ").replace(" – ", ", ")
    s = s.replace("—", ", ").replace("–", ", ")
    for a,b in ((" ,",","),(",,",","),(", ,",", "),("  "," ")):
        while a in s: s = s.replace(a,b)
    return s

htmlout = f'''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>A Cor de Cada Pessoa</title><style>{CSS}</style></head>
<body>{dedash(''.join(body))}{FIT_JS}</body></html>'''

out = os.path.join(os.path.dirname(__file__),"ebook_cores.html")
with open(out,"w",encoding="utf-8") as f: f.write(htmlout)
print("HTML gerado:",out,"| capítulos:",chapters_idx)
