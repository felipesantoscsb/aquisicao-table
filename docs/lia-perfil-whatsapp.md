# Perfil do WhatsApp da LIA — configuração

Imagem: `public/images/lia-whatsapp.jpg` (640x640, 22KB).
Regeração: `scripts/gen_lia_avatar_wa.html` + Chrome headless.

## Nome do perfil

**LIA**

Via Z-API não há review da Meta: o nome é simplesmente o que estiver
configurado na conta do WhatsApp. Define e pronto.

Razão de "LIA" puro: é o que aparece na lista de conversas dela. "LIA"
parece nome de pessoa. Qualquer coisa com "nutri", "dieta" ou "Table
Clinic" entrega o assunto pra quem olhar a tela por cima do ombro — mesma
lógica do descritor da fatura do cartão.

Configure pelo app WhatsApp Business no número, e só depois conecte o QR
no Z-API. Categoria, horário e descrição só existem na versão Business.

## Recado / About (limite 139 caracteres)

> Uma inteligência da Table. Acompanho seus padrões e o seu dia a dia por aqui.

Variante mais explícita (se preferir clareza a discrição):

> Uma inteligência da Table, criada a partir da metodologia de Evelyn Liu.
> Acompanho sua relação com a comida, todos os dias.

## Descrição (limite 512 caracteres)

> A LIA é uma inteligência especializada em comportamento alimentar, criada
> pela Table a partir da metodologia de Evelyn Liu.
>
> Ela aprende seus padrões ao longo do tempo, percebe o que se repete e
> acompanha o seu dia a dia, por texto ou áudio.
>
> A LIA não prescreve dieta, cardápio nem plano alimentar, e não substitui
> atendimento profissional. Quando uma situação pede avaliação, a equipe da
> Table entra.

O parágrafo final não é burocracia: é o que evita expectativa errada e
protege em qualquer questionamento de política.

## Demais campos

| Campo | Valor |
|---|---|
| Categoria | Saúde e bem-estar (alternativa mais segura: Serviços) |
| Site | https://www.evelynliu.com.br/lia |
| E-mail | (definir — de preferência um endereço da Table, não pessoal) |
| Endereço | deixar vazio |
| Horário | 24 horas, todos os dias |

**Horário importa mais do que parece.** A premissa do produto é estar às
21h47, no fim de semana, na madrugada. Cadastrar horário comercial
contradiz a promessa da landing e ainda mostra "fechado" justo no momento
mais vulnerável dela.

## Z-API: o que muda

Z-API dirige uma sessão real do WhatsApp (QR code), não a API oficial.
Consequências:

**A favor.** Não existe janela de 24 horas nem template aprovado. A LIA pode
mandar mensagem personalizada e dinâmica a qualquer hora. O diferencial
central do produto ("ela te procura primeiro") funciona sem contorno — o que
não aconteceria na Cloud API, onde fora da janela só rola texto fixo.

**Contra.** É solução não oficial. A Meta pode banir o número, e o gatilho
mais comum é bloqueio e denúncia por parte de quem recebe. Se o número cair,
cai o produto inteiro e o histórico das conversas junto.

### Por que o risco aqui é menor do que parece

Ban costuma vir de disparo frio. A LIA fala com quem **pagou** e marcou
consentimento explícito de check-in no onboarding. Ela está esperando a
mensagem. Bloqueio e denúncia são improváveis.

Isso é diferente da recuperação de checkout, que fala com quem abandonou
carrinho e não pediu nada — e foi exatamente o que derrubou a qualidade do
número em julho, ao ponto de a sequência de 4h ser pausada.

**Não repita o erro: número dedicado da LIA, separado do número usado para
recuperação e para o Protocolo Raiz.** Misturar os dois tráfegos coloca o
produto pago refém da qualidade de um disparo frio.

### Cuidados

- Aquecimento do número antes de volume. Chip novo disparando muito é o
  padrão clássico de ban.
- Monitorar taxa de bloqueio e denúncia. É o sinal antecedente do ban, não
  o volume em si.
- Backup do histórico do lado da LIA, nunca só no aparelho. Se o número cair,
  o contexto das usuárias não pode cair junto — é literalmente o produto.
- Ter caminho de migração para a Cloud API mapeado. Em escala, não oficial
  eventualmente quebra. Não é urgente agora, mas não pode ser descoberto no
  dia em que acontecer.
