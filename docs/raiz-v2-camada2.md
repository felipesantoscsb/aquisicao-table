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

Resolvido pelo `lid`, a captura de nome/e-mail/WhatsApp é **pulada** e o link
não carrega dado pessoal nenhum. Link do D+3:

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
