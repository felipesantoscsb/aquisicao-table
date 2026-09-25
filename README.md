# Meta Ads Ops

Projeto para landing pages, quizzes e endpoint de CAPI (Conversions API do Meta).

## Status

🚧 Base inicial — estrutura Express (frontend + backend CAPI) será montada via Claude Code.

## Stack pretendida

- Node.js + Express
- Frontend estático (quizzes / landing pages) em `/public`
- Backend com endpoint de CAPI em `/src`
- Deploy automático via Railway

## Rodando localmente (em breve)

```bash
npm install
npm start
```

## Tracking de `/conversa`

O formulário usa diretamente o mesmo Pixel principal do `/raiz`
(`989971718548782`) e envia `Lead` pela
Conversions API com o mesmo `event_id` do navegador. A conversão só é confirmada
depois que o SDR responde `activated: true`; cliques, validações e falhas não
geram `Lead`.

Variáveis:

- `META_CAPI_TOKEN`: token server-side da Conversions API.
- `NODE_ENV=production`: ambiente normal de produção. Em `development` e `test`,
  a CAPI só envia quando há um `META_TEST_EVENT_CODE`.
- `META_TEST_EVENT_CODE`: opcional e somente server-side para o Test Events.
- `REDIS_URL_TRACKING`: persistência de idempotência por 24 horas.

A atribuição first-touch e latest-touch é preservada por 90 dias em cookies
first-party (`SameSite=Lax`, `Secure` em HTTPS). São capturados apenas valores
presentes: UTMs, `fbclid`, `_fbp` e `_fbc`. `_fbc` só é derivado quando existe
`fbclid`. O site ainda não possui um gerenciador de consentimento granular; esta
instrumentação segue o comportamento e a política atuais, mas a definição
jurídica/implantação de consent mode permanece uma dependência separada.

Para o link da bio, use ao menos:

`https://www.evelynliu.com.br/conversa?utm_source=instagram&utm_medium=bio&utm_campaign=<campanha>`

Se o gerenciador do link permitir, preserve parâmetros dinâmicos reais. Não
preencha `fbclid`, `_fbc` ou outras identificações artificialmente.

### Validação no Meta Events Manager

1. Em homologação, configure `META_CAPI_TOKEN` e `META_TEST_EVENT_CODE`.
2. Acesse `/conversa` com UTMs e confirme `PageView` e `ViewContent`.
3. Avance da primeira etapa e confirme um único `Contact`.
4. Envie um lead de teste que o SDR confirme com `activated: true`.
5. Confirme `Lead` em Browser e Server com o mesmo `event_id` e deduplicação em
   uma única conversão.
6. Repita clique, retry e refresh; não deve surgir um novo lead para a mesma
   ocorrência. Teste também validação recusada e falha temporária da Meta.
7. Verifique na rede do navegador que token, Test Event Code e dados sensíveis
   não aparecem. Remova `META_TEST_EVENT_CODE` ao finalizar.

Como o anúncio passa antes pelo perfil do Instagram, os parâmetros do clique no
anúncio podem se perder. O código preserva somente o que chega ao site e não
reconstrói atribuição ausente.
