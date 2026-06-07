const router = require('express').Router();
const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');
const { sendWhatsapp, fmtDateTimeBR } = require('../zapi');
const fs = require('fs');
const path = require('path');

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const STAGE_OFFER = ['Oferta D+0', 'Follow Up D+1', 'Follow Up D+3', 'Venda Confirmada'];

// Stub para compatibilidade (sendWhatsapp agora vem do módulo zapi.js)
// eslint-disable-next-line no-unused-vars
async function _unused(phone, message) {
  const base = process.env.ZAPI_BASE_URL || 'https://api.z-api.io';
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;

  // stub body — unused, kept to avoid parse error
}

function buildWhatsappMsg(card, slug) {
  const apptDate = card.appointment_date
    ? fmtDateTimeBR(card.appointment_date)
    : 'não informada';

  return `📋 Jornada gerada para pré-consulta!

👤 *${card.lead_name}*
📅 ${apptDate}
🎯 Tier: ${card.tier || '—'} | Perfil: ${card.profile || '—'}
📦 Indicação: ${card.product_indicated || '—'}
📞 WhatsApp: ${card.phone || '—'}

*Formulário completo:*
${card.obs_form || '(sem observações)'}

🔗 *Jornada personalizada:*
https://crm.tableclinic.com.br/jornada/${slug}`;
}

router.use(authApiMiddleware);

// POST /api/generate-jornada
router.post('/generate-jornada', async (req, res) => {
  const { card_id, force } = req.body;
  if (!card_id) return res.status(400).json({ error: 'card_id obrigatório' });

  try {
    const { rows } = await pool.query(`
      SELECT pc.*, l.name AS lead_name, l.phone, l.email, l.tier, l.origin,
             l.profile, l.quiz_answers, l.score
      FROM pipeline_cards pc
      JOIN leads l ON l.id = pc.lead_id
      WHERE pc.id=$1
    `, [card_id]);
    const card = rows[0];
    if (!card) return res.status(404).json({ error: 'Card não encontrado' });

    // force=true permite geração automática em qualquer etapa (usado internamente)
    if (!force && !STAGE_OFFER.includes(card.stage)) {
      return res.status(400).json({ error: 'Jornada só pode ser gerada a partir da etapa Oferta D+0' });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt = `
DADOS DA LEAD:
- Nome: ${card.lead_name}
- Origem: ${card.origin || 'Formulário'}
- Tier: ${card.tier || 'warm'}
- Perfil: ${card.profile || 'não informado'}
- Score: ${card.score || 'não informado'}
- Nutri designada: ${card.nutri || 'Juliana'}
- Produto indicado: ${card.product_indicated || 'Essential'}
- Data: ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
- Observações do formulário: ${card.obs_form || 'não informado'}
- Observações da nutri: ${card.obs_nutri || 'não informado'}
- Respostas do quiz: ${card.quiz_answers ? JSON.stringify(card.quiz_answers, null, 2) : 'não informado'}

Gere a jornada personalizada conforme as instruções do sistema.
    `.trim();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let planData;
    try {
      planData = JSON.parse(message.content[0].text);
    } catch {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) planData = JSON.parse(jsonMatch[0]);
      else return res.status(500).json({ error: 'Resposta inválida da IA' });
    }

    // Build HTML from template
    const templatePath = path.join(__dirname, '../../public/templates/proposta.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = buildJornada(html, planData, card);

    const slug = slugify(card.lead_name) + '-' + Date.now().toString(36);
    const outputPath = path.join(__dirname, '../../public/jornadas', `${slug}.html`);
    fs.writeFileSync(outputPath, html, 'utf8');

    await pool.query(
      `INSERT INTO jornadas (card_id, html_content, url_slug, generated_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (url_slug) DO UPDATE SET html_content=$2, generated_at=NOW()`,
      [card_id, html, slug, req.user.id]
    );

    const jornada_url = `https://crm.tableclinic.com.br/jornada/${slug}`;
    await pool.query(
      `UPDATE pipeline_cards SET plan_url=$1, updated_at=NOW() WHERE id=$2`,
      [jornada_url, card_id]
    );

    // Z-API: notifica a nutri responsável (fire-and-forget, não bloqueia resposta)
    if (card.nutri) {
      pool.query('SELECT whatsapp FROM users WHERE nutri_name=$1 LIMIT 1', [card.nutri])
        .then(({ rows: nutriRows }) => {
          const nutriPhone = nutriRows[0]?.whatsapp;
          if (nutriPhone) {
            return sendWhatsapp(nutriPhone, buildWhatsappMsg({ ...card }, slug));
          }
        })
        .catch(err => console.error('Z-API: falha na consulta da nutri —', err.message));
    }

    res.json({ ok: true, slug, url: jornada_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao gerar jornada' });
  }
});

// GET /api/jornadas — lista para admin
router.get('/jornadas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT j.*, l.name AS lead_name, u.name AS generated_by_name
      FROM jornadas j
      JOIN pipeline_cards pc ON pc.id = j.card_id
      JOIN leads l ON l.id = pc.lead_id
      LEFT JOIN users u ON u.id = j.generated_by
      ORDER BY j.generated_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar jornadas' });
  }
});

function buildJornada(html, d, card) {
  const produto = d.produtoIndicado || card.product_indicated || 'Essential';

  // Meta Pixel dinâmico
  html = html.replace(
    /fbq\('track', 'ViewContent', \{content_name: '[^']*'\}\)/,
    `fbq('track', 'ViewContent', {content_name: 'Table ${produto}'})`
  );

  // Header
  html = html.replace(/Tamara Duraes Batista/g, d.nomeLead || card.lead_name);
  html = html.replace(/11 de maio de 2026/, d.dataFormatada || new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));

  // Seção 01
  html = html.replace(
    /(<div class="section-label">Para você,)[^<]*/,
    `$1 ${(d.nomeLead || card.lead_name).split(' ')[0]}`
  );
  if (d.s01Intro) {
    html = html.replace(
      /(<p class="lead-text">\s*Nove meses[\s\S]*?<\/p>\s*<p class="lead-text">[\s\S]*?<\/p>\s*<p class="lead-text">[\s\S]*?<\/p>)/,
      d.s01Intro.split('\n').filter(Boolean).map(p => `<p class="lead-text">${p}</p>`).join('\n  ')
    );
  }

  // Seção 02
  if (d.s02Titulo) {
    html = html.replace(
      /(section-label">)[^<]*(O que entendemos sobre você|O que você já trouxe)/,
      `$1${d.s02Titulo}`
    );
  }
  if (d.s02Conteudo) {
    html = html.replace(
      /(<div class="section-inner">[\s\S]*?<div class="ornament"><\/div>\s*)([\s\S]*?)(<\/div>\s*<\/section>\s*<!-- 03)/,
      (_, before, _content, after) => `${before}${d.s02Conteudo}${after}`
    );
  }

  // Seção 03 steps
  if (d.s03Steps && d.s03Steps.length) {
    const stepsHtml = d.s03Steps.map((s, idx) => `
      <div class="step">
        <div class="step-num">${idx + 1}</div>
        <div class="step-content">
          <h3>${s.titulo}</h3>
          <p>${s.descricao}</p>
        </div>
      </div>`).join('');
    html = html.replace(/<div class="steps">[\s\S]*?<\/div>\s*<\/section>\s*<!-- 04/, `<div class="steps">${stepsHtml}</div>\n</section>\n<!-- 04`);
  }

  // Seção 04 timeline
  const months = [d.s04Mes1, d.s04Mes2, d.s04Mes3];
  const dotColors = ['--1', '--2', '--3'];
  if (months.every(Boolean)) {
    const timelineHtml = months.map((m, i) => `
      <div class="timeline-item">
        <div class="timeline-dot timeline-dot${dotColors[i]}">Mês<br>0${i + 1}</div>
        <div class="timeline-content">
          <div class="month-label">${m.titulo}</div>
          <h3>${m.titulo}</h3>
          <ul>${(m.items || []).map(item => `<li>${item}</li>`).join('')}</ul>
        </div>
      </div>`).join('');
    html = html.replace(/<div class="timeline">[\s\S]*?<\/div>\s*\n\s*<!-- Gráfico/, `<div class="timeline">${timelineHtml}</div>\n    <!-- Gráfico`);
  }

  // Seção 05 equipe — substitui nutri
  if (d.nutriNome) {
    html = html.replace(/Natália Kelm/g, d.nutriNome);
    const bioMatch = html.match(/class="team-card__bio">([^<]*Natália[\s\S]*?)<\/p>/);
    if (bioMatch && d.nutriBio) {
      html = html.replace(bioMatch[0], `class="team-card__bio">${d.nutriBio}</p>`);
    }
    if (d.nutriFoto) {
      html = html.replace(/src="\/Funil\/Fotos Equipe\/natalia kelm\.jpeg"/, `src="${d.nutriFoto}"`);
    }
  }

  // Rodapé
  html = html.replace(
    /Este documento foi preparado exclusivamente para[^.]*\./,
    `Este documento foi preparado exclusivamente para ${d.nomeLead || card.lead_name}.`
  );

  return html;
}

const SYSTEM_PROMPT = `VOCÊ É O ARQUITETO DE JORNADAS DA TABLE CLINIC
Seu papel é gerar o conteúdo personalizado de uma jornada em HTML para uma lead específica.

SOBRE A TABLE CLINIC
A Table Clinic trata a dor emocional por trás do peso, não o peso em si. O emagrecimento é consequência, não o produto vendido. Metodologia de nutrição comportamental com foco psicoemocional. A tese central: o problema nunca foi a comida. Foi sempre o que veio antes da primeira garfada.

NUTRICIONISTAS DA EQUIPE
Juliana Guaranha:
Bio: Especialista em nutrição comportamental, vai ser sua parceira semanal, construindo junto com você um plano alimentar real, sem exclusões punitivas, que respeite quem você é e o que você gosta.
Foto: /Funil/Fotos Equipe/juliana guaranha.jpg

Natália Kelm:
Bio: Nutricionista formada pelo método Table Clinic, especialista em transformar planos alimentares em algo que a paciente realmente consegue viver. Ela vai construir junto com você uma estrutura que respeita a sua rotina e o seu histórico emocional com a comida.
Foto: /Funil/Fotos Equipe/natalia kelm.jpeg

Evelyn Liu (sempre presente como fundadora):
Bio: Nutricionista comportamental e autora de "Gordura Não Existe: O que Existe é Dor". Criou o método que une o trabalho psicoemocional ao plano alimentar, tratando a raiz do problema em vez de só o sintoma.
Foto: /Funil/Fotos Evelyn/Sorridente Palestrando.png

TOM DO CONTEÚDO
- Acolhedor, humano, sem julgamento
- Valida a dor específica da lead antes de qualquer solução
- NUNCA usa travessão (—)
- NUNCA usa linguagem clínica ou de dieta
- NUNCA promete resultados numéricos (quilos, medidas)
- Fala sobre paz com a comida, reconexão com o corpo, autonomia emocional
- Usa o histórico e as dificuldades reais da lead para personalizar cada parágrafo

DOIS TIPOS DE JORNADA:
TIPO 1 — Formulário de captação (origin não contém "pre_sessao")
Jornada de primeiro contato. Tom mais de apresentação e conexão.
Seção 02: "O que entendemos sobre você"
Seção 03: "Primeiros 3 passos"
Seção 04: "Sua jornada em 3 meses"
Seção 05: Equipe (Evelyn + nutri designada)

TIPO 2 — Protocolo Raiz (origin contém "pre_sessao")
Lead já é compradora. Tom de boas-vindas e aprofundamento.
Seção 02: "O que você já trouxe"
Seção 03: "O que vamos trabalhar juntas"
Seção 04: "Sua jornada em 3 meses"
Seção 05: Equipe (Evelyn + nutri designada)

FORMATO DE SAÍDA — responda APENAS com este JSON, sem texto antes ou depois, sem blocos de código:
{
  "nomeLead": "...",
  "dataFormatada": "15 de maio de 2026",
  "tipoPropostas": "captacao|protocolo",
  "s01Intro": "texto de abertura personalizado (2-3 frases, máx 60 palavras)",
  "s02Titulo": "título da seção 02",
  "s02Conteudo": "HTML interno com tags <p> e <div class='insight-block'><p>...</p></div>",
  "s03Titulo": "título da seção 03",
  "s03Steps": [
    { "titulo": "...", "descricao": "..." },
    { "titulo": "...", "descricao": "..." },
    { "titulo": "...", "descricao": "..." }
  ],
  "s04Mes1": { "titulo": "...", "items": ["...", "...", "...", "...", "..."] },
  "s04Mes2": { "titulo": "...", "items": ["...", "...", "...", "...", "..."] },
  "s04Mes3": { "titulo": "...", "items": ["...", "...", "...", "...", "..."] },
  "nutriNome": "Juliana Guaranha|Natália Kelm",
  "nutriRole": "Nutricionista comportamental",
  "nutriBio": "...",
  "nutriFoto": "/Funil/Fotos Equipe/natalia kelm.jpeg",
  "produtoIndicado": "Essential|Premium|Elite"
}`;

/**
 * Gera jornada automaticamente em background (fire-and-forget).
 * Chamado pelo pipeline após criar um card com obs_form preenchido.
 * Não lança exceções — erros são apenas logados.
 */
async function autoGenerateJornada(card_id) {
  try {
    const { rows } = await pool.query(`
      SELECT pc.*, l.name AS lead_name, l.phone, l.email, l.tier, l.origin,
             l.profile, l.quiz_answers, l.score
      FROM pipeline_cards pc
      JOIN leads l ON l.id = pc.lead_id
      WHERE pc.id=$1
    `, [card_id]);
    const card = rows[0];
    if (!card || !card.obs_form) return;

    // Verifica se já existe jornada para este card
    const { rows: existing } = await pool.query('SELECT id FROM jornadas WHERE card_id=$1', [card_id]);
    if (existing.length > 0) return;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userPrompt = `
DADOS DA LEAD:
- Nome: ${card.lead_name}
- Origem: ${card.origin || 'Formulário'}
- Tier: ${card.tier || 'warm'}
- Perfil: ${card.profile || 'não informado'}
- Score: ${card.score || 'não informado'}
- Nutri designada: ${card.nutri || 'Juliana'}
- Produto indicado: ${card.product_indicated || 'Essential'}
- Data: ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
- Observações do formulário: ${card.obs_form || 'não informado'}
- Observações da nutri: ${card.obs_nutri || 'não informado'}
- Respostas do quiz: ${card.quiz_answers ? JSON.stringify(card.quiz_answers, null, 2) : 'não informado'}

Gere a jornada personalizada conforme as instruções do sistema.
    `.trim();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let planData;
    try {
      planData = JSON.parse(message.content[0].text);
    } catch {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.error('[autoJornada] JSON inválido'); return; }
      planData = JSON.parse(jsonMatch[0]);
    }

    const templatePath = path.join(__dirname, '../../public/templates/proposta.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = buildJornada(html, planData, card);

    const slug       = slugify(card.lead_name) + '-' + Date.now().toString(36);
    const outputPath = path.join(__dirname, '../../public/jornadas', `${slug}.html`);

    // Garante que o diretório existe
    const dir = path.join(__dirname, '../../public/jornadas');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outputPath, html, 'utf8');

    await pool.query(
      `INSERT INTO jornadas (card_id, html_content, url_slug, generated_by)
       VALUES ($1,$2,$3,NULL)
       ON CONFLICT (url_slug) DO UPDATE SET html_content=$2, generated_at=NOW()`,
      [card_id, html, slug]
    );

    const jornada_url = `https://crm.tableclinic.com.br/jornada/${slug}`;
    await pool.query(
      `UPDATE pipeline_cards SET plan_url=$1, updated_at=NOW() WHERE id=$2`,
      [jornada_url, card_id]
    );

    // Notifica nutri via WhatsApp
    if (card.nutri) {
      pool.query('SELECT whatsapp FROM users WHERE nutri_name=$1 LIMIT 1', [card.nutri])
        .then(({ rows: nutriRows }) => {
          const nutriPhone = nutriRows[0]?.whatsapp;
          if (nutriPhone) sendWhatsapp(nutriPhone, buildWhatsappMsg(card, slug));
        })
        .catch(err => console.error('[autoJornada] WhatsApp error:', err.message));
    }

    console.log(`[autoJornada] Jornada gerada para card ${card_id}: /jornada/${slug}`);
  } catch (err) {
    console.error(`[autoJornada] Erro ao gerar para card ${card_id}:`, err.message);
  }
}

module.exports = router;
module.exports.autoGenerateJornada = autoGenerateJornada;
