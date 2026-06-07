const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');
const { autoGenerateJornada } = require('./jornadas');
const { sendWhatsapp, fmtDateTimeBR } = require('../zapi');

router.use(authApiMiddleware);

// ── Helper: notifica nutri ao agendar ────────────────────────
async function notifyNutri(card) {
  if (!card.nutri || !card.appointment_date) return;
  try {
    const { rows } = await pool.query(
      'SELECT whatsapp FROM users WHERE nutri_name=$1 LIMIT 1',
      [card.nutri]
    );
    const phone = rows[0]?.whatsapp;
    if (!phone) return;
    const msg =
      `📅 Nova consulta agendada\n` +
      `Paciente: ${card.lead_name || 'Lead'}\n` +
      `Data: ${fmtDateTimeBR(card.appointment_date)}\n` +
      `Observação: ${card.obs_form || '—'}`;
    await sendWhatsapp(phone, msg);
  } catch (err) {
    console.error('[pipeline] ZAPI nutri erro:', err.message);
  }
}

// GET /api/pipeline/cards
router.get('/cards', async (req, res) => {
  const { nutri, funnel, search, date_from, date_to } = req.query;
  let q = `
    SELECT pc.*, l.name AS lead_name, l.phone, l.email, l.tier, l.origin, l.profile,
           j.url_slug AS jornada_slug
    FROM pipeline_cards pc
    JOIN leads l ON l.id = pc.lead_id
    LEFT JOIN jornadas j ON j.card_id = pc.id
    WHERE 1=1
  `;
  const params = [];
  let i = 1;
  if (nutri && nutri !== 'all') { q += ` AND pc.nutri=$${i}`; params.push(nutri); i++; }
  if (funnel) { q += ` AND pc.funnel=$${i}`; params.push(funnel); i++; }
  if (search) { q += ` AND (l.name ILIKE $${i} OR l.phone ILIKE $${i})`; params.push(`%${search}%`); i++; }
  if (date_from) { q += ` AND pc.appointment_date >= $${i}`; params.push(date_from); i++; }
  if (date_to)   { q += ` AND pc.appointment_date <= $${i}`; params.push(date_to); i++; }
  q += ' ORDER BY pc.updated_at DESC';
  try {
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /cards error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/cards/:id
router.get('/cards/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pc.*, l.name AS lead_name, l.phone, l.email, l.tier, l.origin, l.profile,
             l.quiz_answers, l.score,
             j.url_slug AS jornada_slug
      FROM pipeline_cards pc
      JOIN leads l ON l.id = pc.lead_id
      LEFT JOIN jornadas j ON j.card_id = pc.id
      WHERE pc.id=$1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Card não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /cards/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipeline/cards
router.post('/cards', async (req, res) => {
  const { lead_id, funnel, nutri, stage, appointment_date, obs_form } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO pipeline_cards (lead_id, funnel, nutri, stage, appointment_date, obs_form)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [lead_id, funnel || 'pre_consulta', nutri || null, stage || 'Agendada',
       appointment_date || null, obs_form || null]
    );
    const card = rows[0];
    res.status(201).json(card);

    // Auto-gera jornada em background se obs_form preenchida
    if (obs_form && obs_form.trim()) {
      setImmediate(() => autoGenerateJornada(card.id));
    }

    // Notifica nutri ao criar com agendamento
    if (appointment_date && nutri) {
      // Busca nome do lead para a mensagem
      pool.query('SELECT name FROM leads WHERE id=$1', [lead_id])
        .then(({ rows: lr }) => notifyNutri({ ...card, lead_name: lr[0]?.name }))
        .catch(err => console.error('[pipeline] notifyNutri create erro:', err.message));
    }
  } catch (err) {
    console.error('POST /cards error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/pipeline/cards/:id
router.patch('/cards/:id', async (req, res) => {
  const allowed = ['stage','nutri','funnel','appointment_date','next_action_responsible',
    'next_action_deadline','closing_date','product_indicated','loss_reason',
    'obs_nutri','plan_url'];
  const updates = ['updated_at=NOW()'];
  const params  = [];
  let i = 1;
  for (const f of allowed) {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${i}`); params.push(req.body[f]); i++; }
  }
  params.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE pipeline_cards SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Card não encontrado' });
    res.json(rows[0]);

    // Notifica nutri se appointment_date foi atualizado
    if (req.body.appointment_date) {
      pool.query(
        `SELECT pc.nutri, pc.appointment_date, pc.obs_form, l.name AS lead_name
         FROM pipeline_cards pc JOIN leads l ON l.id=pc.lead_id WHERE pc.id=$1`,
        [req.params.id]
      ).then(({ rows: cr }) => {
        if (cr[0]) notifyNutri(cr[0]);
      }).catch(err => console.error('[pipeline] notifyNutri patch erro:', err.message));
    }
  } catch (err) {
    console.error('PATCH /cards/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
