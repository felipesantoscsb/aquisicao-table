const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');

router.use(authApiMiddleware);

// Apenas admin e administrativo podem gerenciar cobranças
function requireFinancial(req, res, next) {
  if (['admin','administrativo'].includes(req.user.role)) return next();
  return res.status(403).json({ success: false, error: 'Sem permissão financeira' });
}

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data });
const err = (res, error, status = 500) => res.status(status).json({ success: false, error });

// ── GET /api/charges ─────────────────────────────────────────
router.get('/', requireFinancial, async (req, res) => {
  const { status, patient_id, month, year } = req.query;
  let q = `
    SELECT c.*, p.name AS patient_name, u.nutri_name AS nutri_short
    FROM charges c
    JOIN patients p ON p.id = c.patient_id
    LEFT JOIN users u ON u.id = p.nutritionist_id
    WHERE c.status != 'cancelado'
  `;
  const params = [];
  let i = 1;

  if (status)     { q += ` AND c.status=$${i++}`;      params.push(status); }
  if (patient_id) { q += ` AND c.patient_id=$${i++}`;  params.push(patient_id); }
  if (month && year) {
    q += ` AND EXTRACT(MONTH FROM c.due_date)=$${i++} AND EXTRACT(YEAR FROM c.due_date)=$${i++}`;
    params.push(parseInt(month), parseInt(year));
  }
  q += ' ORDER BY c.due_date ASC';

  try {
    const { rows } = await pool.query(q, params);

    // Totais de resumo
    const totals = { pendente: 0, pago: 0, vencido: 0 };
    for (const r of rows) {
      if (totals[r.status] !== undefined) totals[r.status] += parseFloat(r.value || 0);
    }

    ok(res, { rows, totals });
  } catch (e) { err(res, e.message); }
});

// ── GET /api/charges/patient/:id ─────────────────────────────
router.get('/patient/:id', requireFinancial, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM charges WHERE patient_id=$1 ORDER BY due_date DESC`,
      [req.params.id]
    );
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── POST /api/charges ─────────────────────────────────────────
router.post('/', requireFinancial, async (req, res) => {
  const { patient_id, package_type, value, issue_date, due_date, notes } = req.body;
  if (!patient_id || !package_type) {
    return err(res, 'patient_id e package_type são obrigatórios', 400);
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO charges (patient_id, package_type, value, issue_date, due_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [patient_id, package_type, value||null,
        issue_date||new Date().toISOString().slice(0,10),
        due_date||null, notes||null]);
    ok(res, rows[0], 201);
  } catch (e) { err(res, e.message); }
});

// ── PUT /api/charges/:id ──────────────────────────────────────
router.put('/:id', requireFinancial, async (req, res) => {
  const fields = ['package_type','value','issue_date','due_date','paid_date','status','notes'];
  const updates = [];
  const params  = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); params.push(req.body[f]); }
  }
  if (!updates.length) return err(res, 'Nenhum campo para atualizar', 400);
  params.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE charges SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      params
    );
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

// ── PUT /api/charges/:id/pay ─────────────────────────────────
router.put('/:id/pay', requireFinancial, async (req, res) => {
  const paid_date = req.body.paid_date || new Date().toISOString().slice(0,10);
  try {
    const { rows } = await pool.query(`
      UPDATE charges SET status='pago', paid_date=$1 WHERE id=$2 RETURNING *
    `, [paid_date, req.params.id]);
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

// ── DELETE /api/charges/:id (cancelar) ───────────────────────
router.delete('/:id', requireFinancial, async (req, res) => {
  try {
    await pool.query(`UPDATE charges SET status='cancelado' WHERE id=$1`, [req.params.id]);
    ok(res, { message: 'Cobrança cancelada' });
  } catch (e) { err(res, e.message); }
});

module.exports = router;
