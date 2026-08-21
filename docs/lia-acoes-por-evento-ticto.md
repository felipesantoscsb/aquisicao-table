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

## Cancelamento pela própria LIA (dependência de backend)

A LP e a página de obrigado agora prometem: **"cancele direto com a LIA, no
WhatsApp"** — sem formulário, sem portal separado. Isso reduz fricção a quase
zero, mas cria uma dependência que precisa existir ANTES de divulgar essa
promessa, senão vira o mesmo problema que já corrigimos com o "te avisamos
antes": promessa na página sem lastro no backend.

O que precisa existir no backend da LIA:

1. **A LIA reconhecer intenção de cancelamento na conversa** (não precisa ser
   perfeito — um gatilho por palavra-chave/intenção básica resolve o essencial).
2. **Confirmar antes de executar.** Uma pergunta de confirmação evita
   cancelamento acidental por mensagem ambígua — mas só uma, sem tentar reter.
3. **Executar de fato na assinatura da Ticto.** Verificar se a Ticto expõe API
   para cancelar assinatura programaticamente (distinto do webhook, que só
   informa eventos — aqui precisamos do sentido contrário: LIA → Ticto).
   Se não existir API direta, o caminho é a equipe humana ser notificada e
   cancelar manualmente em minutos — mas nesse caso a copy não pode prometer
   "cancele direto com a LIA" como se fosse instantâneo e 100% automático.
4. **Confirmar pra ela que cancelou**, com data até quando o acesso continua
   ativo (se cancelar dentro do trial, deixar claro que não vai ser cobrada).
5. **Dispara o evento `subscription_canceled`** no fluxo já documentado acima,
   incluindo a régua de feedback (24-48h depois, ver seção seguinte).

**Antes de rodar tráfego pago com essa copy no ar**, confirmar que os passos
1-3 funcionam de ponta a ponta. Testar cancelando uma assinatura de teste real.

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
