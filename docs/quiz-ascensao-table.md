# Quiz de aquisição e ascensão Table

## Objetivo

`/raiz-radar` é a primeira peça depois dos anúncios. O quiz combina duas leituras
que não devem ser confundidas:

1. **Radar educativo:** seis perguntas sobre corpo, comida, recursos na vida
   real, conhecimento, presença e adaptabilidade.
2. **Roteamento comercial:** quatro perguntas de fit e duas de prontidão.

O resultado sempre entrega valor antes da oferta. A pontuação comercial não
altera as notas do Radar e não aparece como julgamento de valor da pessoa.

## Rotas

| Rota | Regra atual | Próximo passo |
|---|---|---|
| A | fit ≥ 7 e prontidão ≥ 4 | convite para pré-consulta gratuita com nutricionista Table |
| B | fit ≥ 5, sem atingir A | A Primeira Ruptura por R$ 97, com ponte curta |
| C | fit < 5 | conscientização em quatro movimentos e A Primeira Ruptura por R$ 97 |

A recomendação da pré-consulta é sempre uma destas três: autonomia,
acompanhamento Table ou outro cuidado. A Rota C não é descarte: ela recebe uma
estrutura mais longa para compreender o mecanismo antes de ver a oferta.

Em uma simulação uniforme de todas as combinações possíveis, as regras dividem
o tráfego em 15,5% para A, 58,7% para B e 25,8% para C. Isso é apenas um teste
de distribuição lógica; o comportamento real precisa ser calibrado com dados.

## Entregável de A Primeira Ruptura

- mapa HTML personalizado;
- caminho prático de sete dias;
- exercícios em texto e áudio selecionados do banco existente;
- vídeos de Evelyn Liu associados às intervenções;
- Sessão Raiz individual com nutricionista comportamental;
- recomendação final entre autonomia, acompanhamento Table ou outro cuidado.

O quiz não reconstrói a matriz de intervenções da LIA. Ele apenas identifica o
contexto e prepara o encaminhamento para a matriz já existente.

## Mensuração e privacidade

- Meta recebe eventos comerciais genéricos: Lead, CompleteRegistration,
  RouteResultViewed, PreConsultRequest e InitiateCheckout.
- Pontuações, rota, pilares fortes/frágeis e prontidão não entram nos parâmetros
  enviados à Meta.
- O Hub recebe rota, scores de fit/prontidão e pilares extremos para análise
  interna e futura calibração.
- A Rota A só é encaminhada ao SDR quando a pessoa clica para solicitar a
  pré-consulta. Concluir o quiz sozinho não ativa abordagem comercial.

## Pontos antes da publicação

1. Confirmar se o checkout `ai223ee` será renomeado e ajustado para refletir
   “A Primeira Ruptura” e os entregáveis descritos na página.
2. Confirmar capacidade semanal da equipe para definir se o convite da Rota A
   precisa de limite ou janela de agenda.
3. Validar se o Hub já aceita os novos campos de roteamento; campos extras em
   JSON precisam ser ignorados ou persistidos sem rejeitar o webhook.
4. Rodar um teste controlado e revisar a distribuição A/B/C após volume mínimo,
   antes de alterar os cortes.
