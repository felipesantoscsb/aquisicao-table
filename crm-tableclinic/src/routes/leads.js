const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');

router.use(authApiMiddleware);

// GET /api/leads
router.get('/', async (req, res) => {
  const { search, tier, origin, limit = 100, offset = 0 } = req.query;
  let q = `SELECT l.*, pc.stage, pc.funnel, pc.nutri, pc.product_indicated,
                  j.url_slug AS jornada_slug
           FROM leads l
           LEFT JOIN pipeline_cards pc ON pc.lead_id = l.id
           LEFT JOIN jornadas j ON j.card_id = pc.id
           WHERE 1=1`;
  const params = [];
  let i = 1;
  if (search) { q += ` AND (l.name ILIKE $${i} OR l.phone ILIKE $${i} OR l.email ILIKE $${i})`; params.push(`%${search}%`); i++; }
  if (tier) { q += ` AND l.tier=$${i}`; params.push(tier); i++; }
  if (origin) { q += ` AND l.origin=$${i}`; params.push(origin); i++; }
  q += ` ORDER BY l.created_at DESC LIMIT $${i} OFFSET $${i+1}`;
  params.push(Number(limit), Number(offset));
  try {
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar leads' });
  }
});

// POST /api/leads
router.post('/', async (req, res) => {
  const { name, phone, email, origin, tier, profile, score, quiz_answers } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO leads (name, phone, email, origin, tier, profile, score, quiz_answers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, phone, email, origin, tier, profile, score, quiz_answers ? JSON.stringify(quiz_answers) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar lead' });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Lead não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar lead' });
  }
});

// PATCH /api/leads/:id
router.patch('/:id', async (req, res) => {
  const fields = ['name','phone','email','origin','tier','profile','score'];
  const updates = [];
  const params = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${i}`); params.push(req.body[f]); i++; }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nada para atualizar' });
  params.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE leads SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

module.exports = router;
