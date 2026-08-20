# Aviso de fim do trial — especificação

Implementar no backend da LIA (repo próprio). A landing page **não** promete
esse aviso hoje; quando ele existir, reintroduzir a frase (ver o fim deste doc).

## Por que existe

Trial com cartão e sem aviso vira máquina de ressentimento: a pessoa é cobrada,
não lembra que assinou, e a sensação é de ter sido enganada. Nesse público isso
é pior que perder a venda — vira chargeback e reclamação pública.

Mas mandar pra todo mundo também tem custo: quem está usando a LIA todos os dias
não precisa de aviso, e receber um lembrete de cobrança no meio de uma conversa
sobre algo difícil quebra o tom.

## O furo do plano original

A ideia inicial era o aviso "pegar carona" na primeira leitura do dia 6.

Só que **quem mais precisa do aviso é justamente quem não vai ter leitura.**
Se ela sumiu depois do onboarding, não há material pra gerar leitura nenhuma —
e é exatamente ela quem esqueceu que assinou e vai contestar a cobrança.

Ou seja: carona na leitura só cobre quem não precisa. Por isso são dois caminhos.

## Caminho A — engajou (tem leitura no d6)

Manda a leitura normalmente. No fim dela, uma linha só:

> Amanhã fecha sua primeira semana comigo. Se quiser seguir, não precisa fazer
> nada. Se preferir parar, dá pra cancelar até amanhã e nada é cobrado.

Não vira mensagem separada. É o fecho da leitura.

## Caminho B — não engajou (sem leitura)

Aqui o aviso é mensagem própria, e tem dupla função: última chance de ativar
**e** divulgação honesta. Não tratar como aviso de cobrança — tratar como porta
aberta.

> Oi. Sua primeira semana comigo fecha amanhã e a gente quase não conversou.
>
> Sem cobrança de minha parte: semana ruim acontece, e não é sinal de nada
> sobre você.
>
> Se quiser tentar, me conta como foi hoje e eu sigo daqui. Se preferir parar,
> dá pra cancelar até amanhã e nada é cobrado.

Três coisas de propósito:
- **"a gente quase não conversou"** sem culpa. Nesse público, cobrança de
  frequência aciona a mesma ferida que o produto tenta tratar.
- **"não é sinal de nada sobre você"** desarma a leitura de fracasso pessoal.
- A saída vem por último, depois da porta aberta. Se vier primeiro, vira
  convite pra cancelar.

## Regra de corte

`engajou = enviou ao menos 1 mensagem nos últimos 3 dias`

Simples de propósito. O sinal que importa não é volume, é "ela lembra que isso
existe". Quem mandou algo recentemente lembra; quem não mandou, não.

## Quando

Dia 6, no horário que ela indicou preferir no onboarding (`best_time`). Nunca
de madrugada, nunca no minuto da virada.

## O que NÃO fazer

- Não dizer só "seu teste acaba amanhã". Omite o fato material (vai sair
  dinheiro) e a cobrança chega como surpresa do mesmo jeito — o aviso teria o
  custo do envio sem o benefício de evitar a reclamação.
- Não usar urgência, desconto de retenção ou "última chance".
- Não mandar duas vezes. Uma mensagem, e pronto.

## Antes de considerar pronto

- [ ] Confirmar se a Ticto já manda e-mail próprio de fim de trial. Se manda,
      parte do problema já está coberta e o caminho B fica ainda mais focado.
- [ ] Confirmar o caminho de cancelamento. Se ela precisar caçar onde cancelar,
      o chargeback vira o caminho mais fácil e nenhum aviso salva.
- [ ] Depois de implementado: reintroduzir na landing (`billing-note` em
      `public/lia.html`) a frase "e a gente te avisa antes".
