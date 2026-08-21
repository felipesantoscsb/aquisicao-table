# Ações por evento — webhook Ticto (LIA)

Referência para implementar em `handleLiaTicto()` (aqui) e no backend da LIA.

Os nomes de status dos eventos de assinatura **não estão confirmados em payload
real**. O handler já grava o cru de tudo em `lia:ticto:*:raw` e loga — a primeira
compra de teste revela os nomes verdadeiros. Não inventar strings antes disso.

## Prioridade 1 — receita que se perde sem ação

| Evento | Ação |
|---|---|
| **[Assinatura] Atrasada** | Cobrança falhou. Mensagem da LIA sem constrangimento + link pra atualizar cartão. É a maior recuperação de receita em assinatura, e a falha quase nunca é intenção de sair: é cartão vencido. Repetir no d1, d3, d5; parar depois. |
| **Venda Recusada** | Recusa no ato da compra. Ela queria comprar e não conseguiu. Mensagem curta com link de retentativa em até 30min. |
| **[Assinatura] Cartão atualizado** | Se estava em atraso, tirar do estado de dunning e parar a régua. Sem esse gancho a pessoa que já resolveu continua recebendo cobrança. |
| **Abandono de Carrinho** | Recuperação com template **próprio da LIA**. Nunca reaproveitar o do Protocolo Raiz. |

## Prioridade 2 — retenção e aprendizado

| Evento | Ação |
|---|---|
| **[Assinatura] Cancelada** | Coleta de feedback. Ver seção própria abaixo — o timing e a pergunta importam mais que o fato de perguntar. |
| **[Assinatura] Período de Testes Encerrado** | Bifurca: converteu → mensagem de "primeira semana paga", reforçando o que ela já construiu. Não converteu → feedback (pergunta diferente da de cancelamento). |
| **[Assinatura] Período de Testes Iniciado** | Marca `trial_started_at`, agenda o aviso do d6 (ver `lia-aviso-fim-do-trial.md`). |
| **Reclamado** | Disputa aberta, **ainda não é chargeback**. Alerta pra pessoa humana na hora: é a última janela de resolver antes de virar perda + penalidade na adquirente. Nunca automatizar resposta aqui. |
| **[Assinatura] Retomada** | Win-back deu certo. A LIA volta reconhecendo a ausência sem cobrar explicação. |

## Prioridade 3 — estado e higiene

| Evento | Ação |
|---|---|
| **Venda Realizada** | Purchase CAPI no pixel da LIA, criar/ativar usuária, iniciar acompanhamento. |
| **Reembolso** | Encerrar acesso, registrar motivo, feedback leve. |
| **Chargeback** | Encerrar acesso **imediato**, marcar a pessoa, **não** tentar recuperar nem pedir feedback. Insistir com quem contestou aumenta risco. |
| **[Assinatura] Acesso Encerrado** | A LIA para de procurar e de responder. Sem isso ela continua mandando mensagem pra quem não paga mais. |
| **[Assinatura] Encerrada** | Fim natural do ciclo. Arquivar, manter histórico pra eventual retorno. |
| **[Assinatura] Plano Alterado** | Mensal↔anual. Só ajustar expectativa de cobrança. |
| **[Assinatura] Extendida** | Renovou. Nada a fazer. |
| **Pix Gerado / Aguardando Pagamento / Pix Expirado** | Gerou e não pagou. Lembrete com o código; no expirado, link novo. |
| **[Afiliação] Aprovada** | Sem ação enquanto não houver programa de afiliados. |

## Cancelamento pela própria LIA (handoff manual pra Karina/ops)

A LP e a página de obrigado prometem: **"cancele direto com a LIA, no
WhatsApp"** — sem formulário, sem portal separado. A promessa continua
verdadeira mesmo sem API: a cliente só fala com a LIA, nunca com um sistema.
Decisão confirmada: **por ora o cancelamento é handoff da LIA pra Karina, que
executa manualmente na Ticto.** Sem necessidade de API de cancelamento
programático — resolve o ponto técnico, mas troca por um risco operacional
diferente, que é o que esta seção cobre.

### O que precisa existir

1. **A LIA reconhecer intenção de cancelamento na conversa** (gatilho por
   palavra-chave/intenção básica resolve o essencial, não precisa ser perfeito).
2. **Confirmar antes de fazer o handoff.** Uma pergunta evita acionar Karina
   por mensagem ambígua — só uma, sem tentar reter.
3. **Handoff pra Karina de forma que ela veja rápido.** Definir o canal (ex.:
   número/grupo de WhatsApp que ela monitora, ou painel interno) e incluir no
   handoff: nome, WhatsApp, transaction_id/subscription_id, e se está dentro
   do trial ou já pagando — pra ela não precisar caçar essa informação.
4. **Confirmar pra ela na hora**, mesmo antes de Karina processar: *"Recebi
   seu pedido, o cancelamento está sendo feito e nada será cobrado."* Isso não
   é firula — é o que faz a cliente não continuar achando que precisa insistir
   ou que o pedido se perdeu.
5. **Dispara o evento `subscription_canceled`** no fluxo já documentado acima,
   incluindo a régua de feedback (24-48h depois, ver seção seguinte).

### O risco que o handoff manual introduz — e a rede de segurança

Handoff manual tem atraso. Se a cliente pedir cancelamento dentro do trial e
Karina processar DEPOIS que a Ticto já disparou a cobrança automática, a
promessa "nada é cobrado" quebra mesmo que ela tenha pedido a tempo — e nesse
público isso não é só um reembolso chato, é confirmar a desconfiança que a
página inteira trabalhou pra desarmar.

Duas coisas resolvem isso, e as duas precisam existir (não é OU):

- **SLA de processamento por Karina.** Pedido registrado tem que ser
  processado no mesmo dia útil, e obrigatoriamente antes da rotina diária de
  cobrança da Ticto. Definir esse horário de corte com quem cuida da operação.
- **Rede de segurança automática.** Se por qualquer motivo (fim de semana,
  volume, falha humana) o processamento atrasar e a cobrança disparar mesmo
  assim: **estorno automático de qualquer cobrança que caia depois de um
  pedido de cancelamento já registrado**, sem precisar a cliente reclamar pra
  isso acontecer. Isto é o que torna a promessa da página verdadeira na
  prática, mesmo com processo manual por trás.

**Antes de rodar tráfego pago com essa copy no ar**: confirmar canal de
handoff pra Karina, confirmar o SLA, e testar cancelando uma assinatura de
teste real de ponta a ponta — incluindo o caso "pedi em cima da hora".

> **Status (21/08/2026):** decisão deliberada de rodar 100% manual nessa fase
> — volume atual não justifica automação ainda, e tráfego já está no ar.
> Automação (SLA formal + estorno automático) entra no radar pra terça-feira
> seguinte (25/08). Até lá, a rede de segurança É o Karina acompanhando de
> perto: qualquer atraso vira estorno manual assim que percebido, não um
> processo automático. Revisar esta seção quando isso for atacado.

## Feedback de cancelamento

O erro fácil aqui é perguntar "por que você cancelou?". Nesse público essa
pergunta pede **justificativa**, que aciona exatamente a dinâmica de vergonha
que o produto tenta tratar. Resultado: baixa resposta e respostas defensivas
("falta de tempo") que não ensinam nada.

**Regras:**

- **Não perguntar na hora.** Esperar 24 a 48h, quando a carga emocional caiu.
- **Deixar explícito que não há volta atrás.** Se ela achar que é tentativa de
  retenção, não responde.
- **Uma pergunta só.** Formulário mata a taxa de resposta.
- **Separar quem cancelou no trial de quem cancelou pagando.** São perguntas
  diferentes porque são motivos diferentes.

### Cancelou durante o trial

> Oi. Vi que você decidiu não seguir, e tá tudo bem. Não vou tentar te
> convencer de nada.
>
> Só uma pergunta, se você quiser responder: teve alguma coisa que você
> esperava de mim e não encontrou?

"O que você esperava e não encontrou" pergunta sobre o produto, não sobre ela.
Não exige que ela se explique.

### Cancelou depois de pagar

> Oi. Sua assinatura foi encerrada e eu não vou te procurar mais.
>
> Antes de parar: se tivesse uma coisa que eu deveria ter feito diferente
> nesse tempo, qual seria?

Assume a responsabilidade do lado da LIA. Ela responde sobre o serviço, não
sobre a própria falha.

### O que não fazer

- Desconto de retenção. Nesse público soa como "seu problema é preço", e o
  problema quase nunca é preço.
- Perguntar mais de uma vez. Silêncio é resposta.
- Pedir feedback de quem deu chargeback.

## O feedback que vale mais e ninguém coleta

Quem cancela é uma minoria vocal. O sinal maior está em **quem parou de
responder sem cancelar** — ela ainda paga, mas já saiu. Vale uma régua própria
pra inatividade (ex.: 10 dias sem mensagem), com a mesma lógica: sem culpa,
uma pergunta, porta aberta.
