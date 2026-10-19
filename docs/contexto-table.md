# Contexto Table Clinic — produtos, funis e sistemas

Primer para quem (pessoa ou agente) vai construir algo novo em cima da Table e
precisa entender o terreno sem reconstruir tudo por leitura de código.
Estado em **19/10/2026**. O que muda rápido está marcado como tal.

---

## 1. O negócio

A Table Clinic é uma clínica de **nutrição comportamental** fundada por Evelyn
Liu (CRN-3 70082), autora de "Gordura Não Existe". A tese do método é que o
problema quase nunca é informação: é o comportamento que devolve a pessoa ao
mesmo ponto. Por isso nada no funil promete emagrecimento, e nenhuma peça faz
diagnóstico.

**ICP:** mulheres que já sabem o que fazer, já tentaram várias vezes e voltam
ao mesmo ciclo. Não é público de dieta nova; é público cansado de dieta.

**Limites que valem como regra de produto**, não como detalhe de copy:

- nada promete perda de peso nem substitui cuidado médico ou psicológico;
- a Table não trata transtorno alimentar — encaminha;
- agentes de WhatsApp nunca dão orientação nutricional, nunca diagnosticam e
  nunca comentam imagem de corpo, exame ou medicação;
- depoimento sempre acompanhado de aviso de que resultado varia.

---

## 2. Escada de produtos

| Produto | Preço | Checkout (Cakto) | Papel |
|---|---|---|---|
| Ebook "Gordura Não Existe" / quiz Cores | R$ 19,90 | `exrc2pi` | isca de entrada, funil próprio |
| **Protocolo Raiz** | R$ 97 | `pjgpde8`, `5n62wpr`, `ai223ee` | produto de entrada, o "PR" do código |
| Sessão Raiz | — | `ak63ytv` | sessão individual, vendida avulsa e inclusa no PR |
| Pré-consulta | gratuita | — | conversa de qualificação, porta para os planos |
| Table Essential | R$ 898 à vista (R$ 849,50 com cashback do PR) | — | acompanhamento, 3 meses |
| Table Premium | R$ 1.498 – R$ 1.798 | — | acompanhamento, 3 meses |
| Table Elite | R$ 2.400 – R$ 3.100 | — | acompanhamento, 3 meses, 12 encontros |

### Atenção ao nome do produto de entrada

**"Protocolo Raiz" e "A Primeira Ruptura" são o mesmo produto de R$ 97.** O
nome novo é "A Primeira Ruptura", usado no funil `/raiz-radar`. O nome antigo
continua no checkout `ai223ee`, nas páginas de plano e em todo o banco
(`pr_purchases`, `source` com `pr`, rotas `/oferta-*-pr-*`). O rename do
checkout está pendente. Ao escrever código novo, **`PR` significa Protocolo
Raiz**.

As páginas de plano existem em 18 variantes: 3 tiers × 3 nutris (`isa`, `ju`,
`nati`) × com e sem sufixo `-pr`. O sufixo `-pr` é a versão com **cashback de
50% do Protocolo Raiz** (R$ 48,50) para quem já comprou. Rotas em
`/oferta-{tier}-{pr-}{nutri}` e obrigados em `/obrigado-{tier}{-pr}`.

---

## 3. O funil novo: `/raiz-radar`

É a aquisição universal da Table depois dos anúncios. Substitui, para tráfego
novo, o `/raiz` (quiz-cakto) e o `/raiz-v2`, que seguem no ar para campanhas
antigas.

Arquivo único: `public/quiz-ascensao-table.html`. Detalhe de produto do quiz
em `docs/quiz-ascensao-table.md`.

### Estrutura

1. **Hero** → 2. **6 perguntas de Radar** (um pilar cada) → 3. **Respiro**
   (devolve leitura do pilar mais frágil antes de pedir mais seis perguntas)
   → 4. **6 perguntas comerciais** (4 de fit, 2 de prontidão) → 5. **Captura**
   (nome, e-mail, WhatsApp) → 6. **Resultado roteado**.

Os seis pilares: relação com o corpo, relação com a comida, recursos na vida
real, conhecimento alimentar, consciência e presença, adaptabilidade.

### Roteamento

```
route = fit >= 7 && prontidao >= 4  ? 'A'
      : fit >= 5                    ? 'B'
      : 'C'
```

O convite para a pré-consulta **não olha a rota, olha o fit**, por uma
constante separada:

```js
const CORTE_PRE_CONSULTA = 5;   // capacidade da equipe, não qualidade da lead
```

Consequência prática:

| Rota | Vê pré-consulta | Vê oferta R$ 97 | Enquadramento da pré-consulta |
|---|---|---|---|
| A | sim | não | porta de entrada, **gratuita** |
| B | sim | sim | **entregável da Primeira Ruptura** — o botão desce para a oferta, não abre o formulário |
| C | não | sim, com ponte educativa de 4 passos | — |

Subir `CORTE_PRE_CONSULTA` aperta o funil sem tocar em mais nada. A capacidade
hoje é ~20 pré-consultas/semana, 40 com uma virada de chave, e acima disso
exige contratar.

### Segundo filtro: `/pre-consulta`

A rota A não manda a lead direto para o WhatsApp. Ela vai para
`public/Funil/formulario-pre-consulta-v2.html`, que pede três coisas: relato
aberto (piso de 40 caracteres), histórico do que já tentou, e turnos + dias de
disponibilidade. Só então `POST /api/pre-consulta/solicitar` monta o briefing e
chama o Hub.

A URL carrega **só um id opaco** (`?lid=`). Telefone em query string seria PII
exposta. O contexto da lead vem de `GET /api/lead-contexto?lid=`, que lê
`lead:{lead_event_id}` do Redis.

### Rotas de revisão

`/raiz-radar-a`, `/raiz-radar-b`, `/raiz-radar-c` montam a tela final de cada
rota sem passar pelo quiz, com dados de exemplo. Servem com `X-Robots-Tag:
noindex, nofollow` e **desligam o pixel por inteiro** (sem init, sem PageView,
sem evento custom, sem CAPI). Nunca usar para medir nada.

---

## 4. Os três repositórios

| Repo | Papel | Stack |
|---|---|---|
| `aquisicao-table` | páginas públicas, quizzes, checkouts, pixel/CAPI, Redis de leads | Express 4 + Redis |
| `hub-tableclinic` | CRM/pipeline, agenda, financeiro, relatórios, growth | Node + Postgres |
| `sdr-table` | agentes de WhatsApp | Node + Redis + Z-API |

`lia` é repo separado (produto LIA, páginas ES, checkout Paddle) e não faz
parte deste funil.

### Integração

Tudo por webhook HTTP com segredo compartilhado em header
(`x-webhook-secret`, de `HUB_WEBHOOK_SECRET` ou `INTERNAL_WEBHOOK_SECRET`).
Endpoints do Hub consumidos pelos outros dois:

```
/webhook/handoff-agendamento    pedido de pré-consulta -> card no pipeline
/webhook/quiz                   lead de quiz
/webhook/inbound/event          telemetria do funil de WhatsApp inbound
/webhook/sdr-contact-check      "posso falar com esse número?"
/webhook/sdr-card-stage         move card de etapa
/webhook/oferta-respondeu
/webhook/oferta-desfecho
/webhook/campanha-resposta
/webhook/whatsapp-template-sent
/webhook/evelyn-branch/event
```

**Política fail-open.** Só o veto definitivo do Hub (já é paciente, já
converteu) impede um agente de falar. Check indisponível **não** bloqueia.
Essa regra já foi violada uma vez e o número ficou mudo sem ninguém perceber.

### Pipeline (Hub)

Funis: `captacao`, `pre_consulta`, `quiz`.
Etapas observadas: `Contato Inicial`, `A Agendar`, `Agendada`, `Reagendada`,
`Reagendar`, `Cancelada`, `Executada`, `Condução`, `Paciente`.
`Reagendar` e `Cancelada` ficam de fora dos cálculos de conversão.

Lead que nasce de WhatsApp inbound entra em `captacao` / `Contato Inicial`.
Pedido de pré-consulta entra em `pre_consulta` / `A Agendar` — **`Agendada` é
só quando a Karina marcou de fato**, e já houve incidente de cards nascendo
direto em `Agendada`.

---

## 5. Agentes de WhatsApp (`sdr-table`)

Quatro modos, cada um com prompt próprio em `config/prompts/`: `sdr`,
`inbound`, `reativacao`, `oferta`. Mais `confirmacao`, `dossie`, `consultivo`,
`arquiteto`, `recuperacao-checkout`.

**Dois números, duas instâncias Z-API, e isso é proposital:**

- o número carregado do SDR, com a instância original;
- o número inbound (5511963934151), na instância da satisfação, com cliente
  axios separado (`ZAPI_INBOUND_*`). A separação é física justamente para que
  erro de parâmetro não consiga enviar pelo número errado.

O número oficial da Cloud API **nunca** é conectado à Z-API.

Como uma instância Z-API só tem um webhook de entrada, o tráfego que não é
inbound é repassado ao Hub em `/webhook/zapi/ops`.

### Origem no inbound

WhatsApp não carrega UTM. A única pista de origem é a **frase pré-preenchida**
do `wa.me?text=`. Núcleo: `quero saber mais sobre o acompanhamento da table
clinic`, com marcador de origem (`anuncio`, `story`, `bio`, `site`, `blog`,
`tiktok`). Sem marcador, a origem é `direto`.

`ctwa_clid` (para CAPI de business messaging) na prática **não chega pela
Z-API**, que é QR. Não contar com ele.

### Guardas

- **dedup por `INCR`, nunca `SET NX`.** `SET NX` devolve null tanto quando a
  chave existe quanto quando o Redis caiu — indistinguível. `INCR` separa
  1 / >1 / null.
- **circuit breaker por excedente**, não por volume bruto: conta saídas menos
  entradas na janela. Janela de 300s, excedente máximo 4, teto 16. Redis fora
  = falha aberta.

---

## 6. Medição

- **Pixel principal:** `989971718548782`. É o que o `/raiz-radar` usa, por
  decisão de 18/10/2026: zero variável nova e herda um dataset já treinado
  (EMQ 9,3) em vez de nascer frio.
- **`519946826343805`** é o pixel do `/raiz-v2`, em outra conta (a da LIA).
- Eventos do Radar se distinguem por `content_name` e `slug`, não por pixel.
- **Upsell não bate no pixel** desde 17/10/2026: ele derrubou o EMQ do
  `Purchase` de 8,5+ para 6,1, porque chegava só com IP e sem `eventID`.
  Só PR vai para a Meta.
- **tableclinic.com.br não tem nenhuma interação com a Meta.**

### Atribuição

Cookies de 90 dias `table_attr_first` / `table_attr_latest`, escritos por
`persistAttribution()`. É o formato que `/api/dash/attribution` lê, de
`lead:{lead_event_id}` no Redis.

Quiz novo **precisa** mandar `attribution: persistAttribution()` no POST de
captura. Sem isso a venda que chega depois por webhook do gateway (join por
`sck` = `lead_event_id`) não tem como ser ligada ao criativo. O `/raiz-radar`
nasceu sem e ficou sem atribuição até 18/10/2026.

---

## 7. Armadilhas que já custaram caro

Nenhuma destas se deduz lendo o código limpo.

**CSS — especificidade come elemento de caixa escura dentro de banda clara.**
`.page.result .band:not(.dark) h3` vale 0,4,1 e vence `.route-a-box h3`
(0,2,1). Já apagou o título da garantia, a letra miúda e a headline inteira da
caixa de pré-consulta (contraste 1,0, 97px de vazio, zero erro no console).
Toda regra de cor dentro dessas caixas precisa empatar em especificidade e vir
depois. Há testes travando isso.

**`aspect-ratio` só governa quando um eixo é `auto`.** Com `width="800"
height="800"` no HTML, a altura fica definida e o `aspect-ratio:1/1` do CSS é
ignorado em silêncio. As fotos de prova social renderizavam 230x800.

**`id` duplicado é bug silencioso de conversão.** Um splice ruim duplicou o
documento e os CTAs foram parar na cópia morta, que herdava `display:none`.
A página rodou sem nenhum botão, sem quebrar nada.

**`COALESCE(col, novo)` + `ON CONFLICT DO NOTHING`** torna o primeiro valor
permanente. Um valor errado na primeira gravação não se corrige rodando de
novo.

**`leads.phone` não tem índice único** no Hub, então `ON CONFLICT` em `leads`
é proibido.

**Telefone:** testar o prefixo `55` quebra DDD 55 (Santa Maria/RS).
`normalizePhone` olha comprimento, não prefixo.

**Cakto:** webhook é **por produto**. Produto novo sem webhook cadastrado =
nenhum `Purchase`. E o webhook exige `www` (301 vira 404).

**Meta:** saldo pendente estrangula tudo — parou o WhatsApp e inflou CPM em
73% com subentrega. Perguntar de cobrança **antes** de depurar código.

---

## 8. Pendências abertas em 19/10/2026

- rename do checkout `ai223ee` de "Protocolo Raiz" para "A Primeira Ruptura";
- campanha própria para `/raiz-radar`, otimizando por `Lead`, sem tocar na
  `RAIZ · 02`;
- `POST /api/funil/whatsapp/corrigir-agendadas` (roda com `dry_run` primeiro)
  para os cards que nasceram em `Agendada` indevidamente;
- decidir se a garantia sai de dentro da caixa de oferta e vira faixa própria;
- `RAIZ_V2_CAPI_TOKEN` segue ausente, então o CAPI do `/raiz-v2` é pulado.
