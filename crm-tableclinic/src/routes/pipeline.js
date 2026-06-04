const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');

router.use(authApiMiddleware);

// GET /api/pipeline/cards
router.get('/cards', async (req, res) => {
  const { nutri, funnel, search, date_from, date_to } = req.query;
  let q = `
    SELECT pc.*, l.name AS lead_name, l.phone, l.email, l.tier, l.origin, l.profile,
           p.url_slug AS proposal_slug
    FROM pipeline_cards pc
    JOIN leads l ON l.id = pc.lead_id
    LEFT JOIN proposals p ON p.card_id = pc.id
    WHERE 1=1
  `;
  const params = [];
  let i = 1;
  if (nutri && nutri !== 'all') { q += ` AND pc.nutri=$${i}`; params.push(nutri); i++; }
  if (funnel) { q += ` AND pc.funnel=$${i}`; params.push(funnel); i++; }
  if (search) { q += ` AND (l.name ILIKE $${i} OR l.phone ILIKE $${i})`; params.push(`%${search}%`); i++; }
  if (date_from) { q += ` AND pc.appointment_date >= $${i}`; params.push(date_from); i++; }
  if (date_to) { q += ` AND pc.appointment_date <= $${i}`; params.push(date_to); i++; }
  q += ' ORDER BY pc.updated_at DESC';
  try {
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar cards' });
  }
});

// GET /api/pipeline/cards/:id
router.get('/cards/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT pc.*, l.name AS lead_name, l.phone, l.email, l.tier, l.origin, l.profile,
             l.quiz_answers, l.score,
             p.url_slug AS proposal_slug
      FROM pipeline_cards pc
      JOIN leads l ON l.id = pc.lead_id
      LEFT JOIN proposals p ON p.card_id = pc.id
      WHERE pc.id=$1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Card não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar card' });
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
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar card' });
  }
});

// PATCH /api/pipeline/cards/:id
router.patch('/cards/:id', async (req, res) => {
  const allowed = ['stage','nutri','funnel','appointment_date','next_action_responsible',
    'next_action_deadline','closing_date','product_indicated','loss_reason',
    'obs_nutri','plan_url'];
  const updates = ['updated_at=NOW()'];
  const params = [];
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar card' });
  }
});

module.exports = router;
