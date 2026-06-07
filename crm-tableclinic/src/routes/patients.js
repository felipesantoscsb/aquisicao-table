const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');

router.use(authApiMiddleware);

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data });
const err = (res, error, status = 500) => res.status(status).json({ success: false, error });

// ── GET /api/patients ─────────────────────────────────────────
router.get('/', async (req, res) => {
  const { nutritionist_id, clinical_status, product, include_inactive } = req.query;

  let q = `
    SELECT p.*,
           u.name AS nutritionist_name,
           u.nutri_name AS nutritionist_short,
           l.tier, l.origin, l.profile,
           j.url_slug AS jornada_slug
    FROM patients p
    LEFT JOIN users u  ON u.id = p.nutritionist_id
    LEFT JOIN leads l  ON l.id = p.lead_id
    LEFT JOIN pipeline_cards pc ON pc.lead_id = l.id
    LEFT JOIN jornadas j ON j.card_id = pc.id
    WHERE 1=1
  `;
  const params = [];
  let i = 1;

  if (!include_inactive) { q += ` AND p.clinical_status != 'inativo'`; }

  // Nutri só vê os próprios pacientes
  if (req.user.role === 'nutri') {
    q += ` AND p.nutritionist_id=$${i++}`;
    params.push(req.user.id);
  } else if (nutritionist_id) {
    q += ` AND p.nutritionist_id=$${i++}`;
    params.push(nutritionist_id);
  }

  if (clinical_status) { q += ` AND p.clinical_status=$${i++}`; params.push(clinical_status); }
  if (product)         { q += ` AND p.product ILIKE $${i++}`;   params.push(`%${product}%`); }

  q += ' ORDER BY p.name';

  try {
    const { rows } = await pool.query(q, params);
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── GET /api/patients/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
             u.name AS nutritionist_name,
             u.nutri_name AS nutritionist_short,
             l.tier, l.origin, l.profile, l.quiz_answers,
             j.url_slug AS jornada_slug
      FROM patients p
      LEFT JOIN users u  ON u.id = p.nutritionist_id
      LEFT JOIN leads l  ON l.id = p.lead_id
      LEFT JOIN pipeline_cards pc ON pc.lead_id = l.id
      LEFT JOIN jornadas j ON j.card_id = pc.id
      WHERE p.id=$1
    `, [req.params.id]);
    if (!rows[0]) return err(res, 'Paciente não encontrado', 404);
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

// ── POST /api/patients ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { lead_id, name, email, phone, birthday, nutritionist_id,
          clinical_status, product, start_date, webdiet_link } = req.body;
  if (!name) return err(res, 'name é obrigatório', 400);

  try {
    const { rows } = await pool.query(`
      INSERT INTO patients
        (lead_id, name, email, phone, birthday, nutritionist_id,
         clinical_status, product, start_date, webdiet_link)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [lead_id||null, name, email||null, phone||null, birthday||null,
        nutritionist_id||null, clinical_status||'ativo',
        product||'Table Elite', start_date||null, webdiet_link||null]);

    const patient = rows[0];

    // Marca lead como convertida no pipeline
    if (lead_id) {
      await pool.query(
        `UPDATE pipeline_cards SET converted_to_patient=true, updated_at=NOW()
         WHERE lead_id=$1`,
        [lead_id]
      ).catch(() => {});
    }

    // Registra nutri inicial no histórico
    if (nutritionist_id) {
      await pool.query(
        `INSERT INTO patient_history_nutritionist (patient_id, nutritionist_id)
         VALUES ($1,$2)`,
        [patient.id, nutritionist_id]
      ).catch(() => {});
    }

    ok(res, patient, 201);
  } catch (e) { err(res, e.message); }
});

// ── PUT /api/patients/:id ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  const fields = ['name','email','phone','birthday','nutritionist_id',
                  'clinical_status','product','start_date','webdiet_link'];
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
      `UPDATE patients SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      params
    );
    if (!rows[0]) return err(res, 'Paciente não encontrado', 404);

    // Registra mudança de nutri
    if (req.body.nutritionist_id) {
      await pool.query(
        `INSERT INTO patient_history_nutritionist (patient_id, nutritionist_id)
         VALUES ($1,$2)`,
        [req.params.id, req.body.nutritionist_id]
      ).catch(() => {});
    }

    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

// ── DELETE /api/patients/:id — soft delete ────────────────────
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'administrativo') {
    return err(res, 'Sem permissão', 403);
  }
  try {
    await pool.query(
      `UPDATE patients SET clinical_status='inativo' WHERE id=$1`,
      [req.params.id]
    );
    ok(res, { message: 'Paciente inativado' });
  } catch (e) { err(res, e.message); }
});

// ── GET /api/patients/:id/history ────────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ph.*, u.name AS nutritionist_name
      FROM patient_history_nutritionist ph
      JOIN users u ON u.id = ph.nutritionist_id
      WHERE ph.patient_id=$1
      ORDER BY ph.changed_at DESC
    `, [req.params.id]);
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

module.exports = router;
