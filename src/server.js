const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Lê o body das requisições JSON
app.use(express.json());

// Serve os arquivos estáticos da pasta public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rota POST /api/capi
app.post('/api/capi', (req, res) => {
  console.log('[CAPI] Payload recebido:', JSON.stringify(req.body, null, 2));

  // TODO: Implementar integração real com a Meta Conversions API
  // Exemplo do que virá aqui:
  //   - Validar os campos obrigatórios do evento (event_name, event_time, etc.)
  //   - Montar o payload no formato da Meta CAPI
  //   - Enviar via fetch para https://graph.facebook.com/v19.0/{META_PIXEL_ID}/events
  //     usando o token META_CAPI_TOKEN
  //   - Retornar a resposta da Meta pro cliente

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
