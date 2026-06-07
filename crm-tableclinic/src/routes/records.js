const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');

router.use(authApiMiddleware);

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data });
const err = (res, error, status = 500) => res.status(status).json({ success: false, error });

// ════════════════════════════════════════════════════════════
// PRONTUÁRIO (medical_records)
// ════════════════════════════════════════════════════════════

router.get('/patient/:id', async (req, res) => {
  try {
    const [meds, meas, emot] = await Promise.all([
      pool.query(`
        SELECT mr.*, u.name AS nutritionist_name
        FROM medical_records mr
        LEFT JOIN users u ON u.id = mr.nutritionist_id
        WHERE mr.patient_id=$1 ORDER BY mr.consultation_date DESC
      `, [req.params.id]),
      pool.query(
        `SELECT * FROM body_measurements WHERE patient_id=$1 ORDER BY record_date DESC`,
        [req.params.id]
      ),
      pool.query(`
        SELECT er.*, u.name AS nutritionist_name
        FROM emotional_records er
        LEFT JOIN users u ON u.id = er.nutritionist_id
        WHERE er.patient_id=$1 ORDER BY er.consultation_date DESC
      `, [req.params.id]),
    ]);
    ok(res, {
      medical:      meds.rows,
      measurements: meas.rows,
      emotional:    emot.rows,
    });
  } catch (e) { err(res, e.message); }
});

// ── Anamnese ─────────────────────────────────────────────────

router.post('/medical', async (req, res) => {
  const { patient_id, appointment_id, consultation_date, notes } = req.body;
  if (!patient_id) return err(res, 'patient_id obrigatório', 400);
  try {
    const { rows } = await pool.query(`
      INSERT INTO medical_records
        (patient_id, nutritionist_id, appointment_id, consultation_date, notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [patient_id, req.user.id, appointment_id||null,
        consultation_date||new Date().toISOString().slice(0,10), notes||null]);
    ok(res, rows[0], 201);
  } catch (e) { err(res, e.message); }
});

router.put('/medical/:id', async (req, res) => {
  const { consultation_date, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE medical_records SET consultation_date=$1, notes=$2 WHERE id=$3 RETURNING *`,
      [consultation_date, notes, req.params.id]
    );
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

// ── Medidas corporais ────────────────────────────────────────

router.post('/measurements', async (req, res) => {
  const { patient_id, record_date, weight, measures } = req.body;
  if (!patient_id) return err(res, 'patient_id obrigatório', 400);
  try {
    const { rows } = await pool.query(`
      INSERT INTO body_measurements (patient_id, record_date, weight, measures)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [patient_id, record_date||new Date().toISOString().slice(0,10),
        weight||null, measures ? JSON.stringify(measures) : null]);
    ok(res, rows[0], 201);
  } catch (e) { err(res, e.message); }
});

router.get('/measurements/:patient_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM body_measurements WHERE patient_id=$1 ORDER BY record_date DESC`,
      [req.params.patient_id]
    );
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── Registros emocionais ─────────────────────────────────────

router.post('/emotional', async (req, res) => {
  const { patient_id, consultation_date, free_notes, mood_score, themes, keyword } = req.body;
  if (!patient_id) return err(res, 'patient_id obrigatório', 400);
  try {
    const { rows } = await pool.query(`
      INSERT INTO emotional_records
        (patient_id, nutritionist_id, consultation_date, free_notes, mood_score, themes, keyword)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [patient_id, req.user.id,
        consultation_date||new Date().toISOString().slice(0,10),
        free_notes||null, mood_score||null,
        themes ? JSON.stringify(themes) : null, keyword||null]);
    ok(res, rows[0], 201);
  } catch (e) { err(res, e.message); }
});

router.put('/emotional/:id', async (req, res) => {
  const { consultation_date, free_notes, mood_score, themes, keyword } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE emotional_records
      SET consultation_date=$1, free_notes=$2, mood_score=$3, themes=$4, keyword=$5
      WHERE id=$6 RETURNING *
    `, [consultation_date, free_notes, mood_score,
        themes ? JSON.stringify(themes) : null, keyword, req.params.id]);
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

router.get('/emotional/:patient_id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT er.*, u.name AS nutritionist_name
      FROM emotional_records er
      LEFT JOIN users u ON u.id = er.nutritionist_id
      WHERE er.patient_id=$1
      ORDER BY er.consultation_date ASC
    `, [req.params.patient_id]);
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── Memória da nutri ─────────────────────────────────────────

router.get('/memory/:patient_id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM patient_memory WHERE patient_id=$1`,
      [req.params.patient_id]
    );
    ok(res, rows[0] || { patient_id: req.params.patient_id, content: '' });
  } catch (e) { err(res, e.message); }
});

router.put('/memory/:patient_id', async (req, res) => {
  const { content } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO patient_memory (patient_id, nutritionist_id, content, updated_at)
      VALUES ($1,$2,$3,NOW())
      ON CONFLICT (patient_id) DO UPDATE
        SET content=$3, nutritionist_id=$2, updated_at=NOW()
      RETURNING *
    `, [req.params.patient_id, req.user.id, content||'']);
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

module.exports = router;
