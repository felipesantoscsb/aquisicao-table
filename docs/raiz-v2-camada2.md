# Radar Table — duas camadas no mesmo arquivo

`public/quiz-raiz-v2.html` serve dois funis, em duas rotas. A página decide qual
camada roda pelo `location.pathname`.

Rota em vez de query param porque link encaminhado perde o `?source=`, e cair no
funil de canetas é o pior destino possível para quem nunca usou e acabou de
receber uma mensagem sobre "a segunda camada do seu mapeamento".
`?source=pr_nurture` continua funcionando como alias, para links já enviados.

| | `/raiz-v2` | `/raiz-radar` |
|---|---|---|
| Quem chega | tráfego pago frio, criativo de canetas | quem fez o quiz 1 e não comprou, no D+3 pelo WhatsApp |
| Abertura | "E quando a fome voltar?" | "Você já descobriu o seu padrão…" |
| 1ª pergunta | momento com as canetas | perfil do quiz 1, ou já direto no bloco 1 |
| Perguntas pontuadas | 9 | 14 |
| Medicação | abre o quiz e define o contexto | penúltimo bloco, não pontua |
| Oferta | Protocolo Raiz + livro + Sessão Raiz · R$ 97 · `ai223ee` | Sessão Raiz isolada · R$ 67 · `ak63ytv_1149729` |
| Pixel | 519946826343805 (conta da LIA) | o mesmo |

**A camada 1 não foi tocada.** Ela converte tráfego pago desde 21/09 e tem
oferta própria na Cakto, separada no dashboard por `versaoPr()`. Todo código
novo está atrás de `NURTURE`, que só é verdadeiro com `source=pr_nurture`.

## Por que a camada 2 existe

O quiz 1 responde "qual é o meu padrão?" e entrega um dos quatro perfis. A
camada 2 responde "como esse padrão está aparecendo na minha vida hoje?". Sem
essa distinção o segundo quiz parece repetição do primeiro, e a pessoa abandona.

Cadência: D0 quiz 1 → oferta do PR → dossiê. D+1 Sessão Raiz a R$ 67.
**D+3 este link.** D+5 retomada da Sessão Raiz.

## Como o perfil do quiz 1 é resolvido

Nesta ordem, parando no primeiro que responder:

1. `?previous_profile=emocional|restritiva|sobrevivencia|desconectada`
2. `?lid=<lead_event_id do quiz 1>` → `GET /api/raiz-v2/contexto`
3. a pergunta na tela, com a opção "não lembro / não fiz"

O endpoint encadeia duas chaves que já existiam: `lead:<lid>` (90 dias, gravada
no evento Lead) dá nome, e-mail e telefone; `quiz:perfil:<telefone>` (180 dias,
gravada no CompleteRegistration do quiz 1) dá a letra E/R/S/A. O telefone é
guardado sem DDI e a chave do perfil tem DDI: `normalizePhone` reconstrói.

## A camada 2 não captura nada

Não existe formulário em `/raiz-radar`, em nenhum cenário. Quem chega ali já é
lead nosso e veio de uma mensagem nossa: pedir nome, e-mail e WhatsApp de novo
seria atrito puro, cobrando duas vezes pela mesma informação. O quiz vai da
última pergunta direto para o Radar.

O que o `lid` entregar é interpolado; o que faltar, a página simplesmente não
menciona. Sem nome, o resultado abre em "Este é o seu Radar Table" em vez de
"Fulana, este é…", e o checkout vai sem preenchimento.

Consequências de medição, todas deliberadas:

- **`Lead` só dispara quando existe contato.** Sem e-mail e telefone não há como
  falar com a pessoa, e um Lead ali seria mentira que ainda por cima sujaria a
  métrica. `CompleteRegistration` continua disparando sempre, com o que existir.
- **`sck` do checkout é o `lid` do quiz 1** quando ele existe, e não um id novo.
  Assim a compra volta a casar com quem a pessoa já era, em vez de nascer órfã.
- Sem `lid`, a Meta recebe só `fbp`/`fbc`. EMQ menor, e não tem como ser
  diferente: não há dado para enviar.

O funil pago (`/raiz-v2`) **continua com a captura**, porque ali o lead é novo e
o formulário é o único momento em que ele entra na base.

Link do D+3:

```
https://www.evelynliu.com.br/raiz-radar?lid=<lead_event_id>
```

Sem o `lid` o link funciona igual: a pessoa só responde o perfil na primeira
tela. Vale para disparar na base antiga. Lembrando que `lead:<lid>` vive 90 dias
e `quiz:perfil:<telefone>` vive 180: passado isso, o `lid` não resolve mais e a
pessoa cai na pergunta de perfil, que é o comportamento correto.

O perfil anterior **nunca** entra no scoring. Ele só escreve copy: a transição
antes do bloco 1, a frase que conecta as duas leituras no resultado e a ponte da
oferta. A conexão é sempre não determinística ("sugere", "aponta", "pode estar"),
e quando o pilar mais frágil não bate com o padrão esperado o texto diz isso em
vez de forçar.

## Scoring

A fórmula é a mesma dos dois lados: média, por pilar, de todas as contribuições
que ele recebeu. Mudou a quantidade de amostras (9 → 14), não a matemática, e os
seis pilares do prontuário continuam idênticos.

Conferido com 4.000 conjuntos de respostas aleatórias: 94% caem no ramo
principal de interpretação (ponto forte × dois frágeis), spread mediano 2,0 em 5.
Os quatro ramos disparam corretamente nos extremos. O Radar não achatou.

## Tracking

Preservado: PageView, ViewContent, QuizStart, QuizProgress, Lead,
CompleteRegistration, OfferView, InitiateCheckout, ResultView, FAQInteraction.

Novos, só na camada 2: `RadarStarted`, `RadarProgress`, `RadarCompleted`,
`RadarResultViewed`, `SessaoRaizOfferViewed`. O InitiateCheckout da camada 2 vai
com `content_name: 'Sessão Raiz'` e `value: 67`.

**Perfil do quiz 1 e nome de pilar não vão para a Meta.** São leitura
psicológica e de saúde, e o funil já trata isso como sensível (ver o comentário
em `/api/capi`). Eles viajam só no payload do nosso `/api/capi/initiate-checkout`,
via `segmentoInterno()`, junto com `source: 'raiz-v2-nurture'`.

## O que a camada 2 esconde

`compBand` (Protocolo Raiz), `journeyBand`, `priceBand` (stack de R$ 391 e a
garantia de 7 dias) e `offerAnchor`. A VSL também sai: foi gravada para a oferta
de R$ 97. Para publicar uma VSL específica desta camada, basta um segundo id
Wistia e soltar o `vslSlot`.

A garantia de 7 dias **não** aparece na camada 2 de propósito: ela existe por
causa do Protocolo Raiz, e não há política definida para a Sessão Raiz avulsa.

---

# /sessao-raiz — a porta de entrada do D+1

Página curta, sem quiz, enviada no D+1 para quem fez o quiz 1 e não comprou o
Protocolo Raiz. Vende só a conversa: R$ 67, checkout `ak63ytv_1149729`, o mesmo
da camada 2 do Radar.

Design system do **quiz 1** (Cormorant Garamond + Jost, paleta moss/terra/cream),
não o do Radar. A pessoa viu o quiz 1 ontem; a página precisa parecer a mesma casa.

Pixel **principal** (989971718548782), não o da V2. `source: 'sessao-raiz'` não
casa com `ehRaizV2()`, então as credenciais certas são escolhidas sozinhas.
Eventos: ViewContent (`content_name: 'Sessão Raiz'`), `SessaoRaizPageViewed` e
InitiateCheckout (`value: 67`). Purchase não é disparado aqui.

`?lid=<lead_event_id do quiz 1>` preenche o checkout com nome, e-mail e telefone
via `GET /api/lead-contexto` (o caminho antigo `/api/raiz-v2/contexto` continua
valendo). Sem o lid a página funciona igual, só sem preenchimento.

## O crédito de R$ 97

A página promete: R$ 67 hoje viram R$ 97 de crédito na entrada de um
**acompanhamento contínuo da Table**. Sempre "crédito", nunca "desconto".

O crédito aponta para o acompanhamento, não para o Protocolo Raiz. Isso é
deliberado: o PR custa R$ 97 em todos os funis, e um crédito de R$ 97 zeraria a
entrada dele — quem pagasse R$ 67 pela sessão levaria o PR de graça, saindo mais
barato que o pacote de R$ 97 do /raiz-v2, que entrega PR + livro + sessão.
Apontando para o acompanhamento, o crédito tira o risco de começar pequeno sem
canibalizar nada. O Protocolo Raiz não é citado na página.

**O que não existe em código e depende de operação:** não há automação. Nenhum
cupom, nenhuma regra no checkout, nenhum gatilho. Hoje a conversão do crédito é
manual, feita por quem atende — e é por isso que a palavra "automaticamente"
ficou de fora da página.

## Quem conduz a sessão

Uma das nutricionistas comportamentais da equipe, não a Evelyn. Ela aparece só
como autora do método. Não há foto das nutris no projeto, então a seção usa um
monograma e diz explicitamente que quem atende depende da agenda da semana. Se
um dia houver fotos, é aqui que entram.

## O botão do topo

Leva para a seção da oferta, não para o checkout: no topo a pessoa ainda não viu
preço nem o que está incluído. Ele dispara `SessaoRaizOfferViewed`, nunca
InitiateCheckout — senão o evento de intenção de compra perde o sentido.
