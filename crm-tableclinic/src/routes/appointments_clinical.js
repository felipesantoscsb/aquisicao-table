const router = require('express').Router();
const { pool } = require('../db');
const { authApiMiddleware } = require('../auth');
const { sendWhatsapp, fmtDateTimeBR } = require('../zapi');

router.use(authApiMiddleware);

const ok  = (res, data, status = 200) => res.status(status).json({ success: true,  data });
const err = (res, error, status = 500) => res.status(status).json({ success: false, error });

// ── Helper: notificações de agendamento ──────────────────────
async function notifyAppointment(appt) {
  try {
    // Busca dados completos
    const { rows } = await pool.query(`
      SELECT ac.*, p.name AS patient_name, p.phone AS patient_phone,
             u.name AS nutri_name_full, u.whatsapp AS nutri_whatsapp
      FROM appointments_clinical ac
      JOIN patients p ON p.id = ac.patient_id
      LEFT JOIN users u ON u.id = ac.nutritionist_id
      WHERE ac.id=$1
    `, [appt.id || appt]);
    const a = rows[0];
    if (!a) return;

    const dtLabel = fmtDateTimeBR(a.start_time);

    // Paciente
    if (a.patient_phone) {
      await sendWhatsapp(a.patient_phone,
        `Olá ${a.patient_name}! Sua consulta está agendada para ${dtLabel}. ` +
        `Qualquer dúvida estamos à disposição 💚`
      );
    }

    // Nutri
    if (a.nutri_whatsapp) {
      await sendWhatsapp(a.nutri_whatsapp,
        `📅 Nova consulta agendada\nPaciente: ${a.patient_name}\nData: ${dtLabel}`
      );
    }
  } catch (e) {
    console.error('[appointments] notify error:', e.message);
  }
}

// ── GET /api/appointments-clinical ───────────────────────────
router.get('/', async (req, res) => {
  const { nutritionist_id, status, date_from, date_to, patient_id } = req.query;

  let q = `
    SELECT ac.*,
           p.name AS patient_name, p.phone AS patient_phone,
           u.name AS nutritionist_name, u.nutri_name AS nutri_short
    FROM appointments_clinical ac
    JOIN patients p ON p.id = ac.patient_id
    LEFT JOIN users u ON u.id = ac.nutritionist_id
    WHERE ac.status != 'cancelado'
  `;
  const params = [];
  let i = 1;

  if (req.user.role === 'nutri') {
    q += ` AND ac.nutritionist_id=$${i++}`;
    params.push(req.user.id);
  } else if (nutritionist_id) {
    q += ` AND ac.nutritionist_id=$${i++}`;
    params.push(nutritionist_id);
  }

  if (status)     { q += ` AND ac.status=$${i++}`;           params.push(status); }
  if (date_from)  { q += ` AND ac.start_time >= $${i++}`;    params.push(date_from); }
  if (date_to)    { q += ` AND ac.start_time <= $${i++}`;    params.push(date_to); }
  if (patient_id) { q += ` AND ac.patient_id=$${i++}`;       params.push(patient_id); }

  q += ' ORDER BY ac.start_time';

  try {
    const { rows } = await pool.query(q, params);
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── GET /api/appointments-clinical/week ──────────────────────
router.get('/week', async (req, res) => {
  const { date, nutritionist_id } = req.query;
  const ref = date ? new Date(date) : new Date();
  // Segunda da semana atual
  const day    = ref.getDay();
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const nutriFilter = req.user.role === 'nutri' ? req.user.id : (nutritionist_id || null);
  const params = [monday.toISOString(), sunday.toISOString()];
  let q = `
    SELECT ac.*, p.name AS patient_name, u.nutri_name AS nutri_short
    FROM appointments_clinical ac
    JOIN patients p ON p.id = ac.patient_id
    LEFT JOIN users u ON u.id = ac.nutritionist_id
    WHERE ac.start_time BETWEEN $1 AND $2 AND ac.status != 'cancelado'
  `;
  if (nutriFilter) { q += ` AND ac.nutritionist_id=$3`; params.push(nutriFilter); }
  q += ' ORDER BY ac.start_time';

  try {
    const { rows } = await pool.query(q, params);
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── GET /api/appointments-clinical/month ─────────────────────
router.get('/month', async (req, res) => {
  const { year, month, nutritionist_id } = req.query;
  const y = parseInt(year  || new Date().getFullYear());
  const m = parseInt(month || (new Date().getMonth() + 1));
  const start = new Date(y, m - 1, 1).toISOString();
  const end   = new Date(y, m, 0, 23, 59, 59).toISOString();

  const nutriFilter = req.user.role === 'nutri' ? req.user.id : (nutritionist_id || null);
  const params = [start, end];
  let q = `
    SELECT ac.*, p.name AS patient_name, u.nutri_name AS nutri_short
    FROM appointments_clinical ac
    JOIN patients p ON p.id = ac.patient_id
    LEFT JOIN users u ON u.id = ac.nutritionist_id
    WHERE ac.start_time BETWEEN $1 AND $2 AND ac.status != 'cancelado'
  `;
  if (nutriFilter) { q += ` AND ac.nutritionist_id=$3`; params.push(nutriFilter); }
  q += ' ORDER BY ac.start_time';

  try {
    const { rows } = await pool.query(q, params);
    ok(res, rows);
  } catch (e) { err(res, e.message); }
});

// ── POST /api/appointments-clinical ──────────────────────────
router.post('/', async (req, res) => {
  const { patient_id, nutritionist_id, start_time, end_time, duration_minutes,
          type, recurrence, recurrence_days, status, notes } = req.body;

  if (!patient_id || !start_time) {
    return err(res, 'patient_id e start_time são obrigatórios', 400);
  }

  try {
    const created = [];

    const insertOne = async (st) => {
      const et = end_time || (st
        ? (() => { const d = new Date(st); d.setMinutes(d.getMinutes() + (duration_minutes || 50)); return d.toISOString(); })()
        : null);

      const { rows } = await pool.query(`
        INSERT INTO appointments_clinical
          (patient_id, nutritionist_id, start_time, end_time, duration_minutes,
           type, recurrence, recurrence_days, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
      `, [patient_id, nutritionist_id||null, st, et, duration_minutes||50,
          type||'consulta', recurrence||'none', recurrence_days||null,
          status||'agendado', notes||null]);
      return rows[0];
    };

    if (recurrence === 'weekly' && recurrence_days) {
      // Cria um appointment por semana durante recurrence_days dias
      const start = new Date(start_time);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + parseInt(recurrence_days));
      let cursor = new Date(start);
      while (cursor <= endDate) {
        const appt = await insertOne(cursor.toISOString());
        created.push(appt);
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const appt = await insertOne(start_time);
      created.push(appt);
    }

    // Notifica apenas o primeiro agendamento
    if (created[0]) setImmediate(() => notifyAppointment(created[0]));

    ok(res, created, 201);
  } catch (e) { err(res, e.message); }
});

// ── PUT /api/appointments-clinical/:id ───────────────────────
router.put('/:id', async (req, res) => {
  const fields = ['patient_id','nutritionist_id','start_time','end_time',
                  'duration_minutes','type','status','notes'];
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
      `UPDATE appointments_clinical SET ${updates.join(',')} WHERE id=$${i} RETURNING *`,
      params
    );
    if (!rows[0]) return err(res, 'Agendamento não encontrado', 404);

    // Notifica se horário mudou
    if (req.body.start_time) setImmediate(() => notifyAppointment(req.params.id));

    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

// ── DELETE /api/appointments-clinical/:id (cancelar) ─────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `UPDATE appointments_clinical SET status='cancelado' WHERE id=$1`,
      [req.params.id]
    );
    ok(res, { message: 'Agendamento cancelado' });
  } catch (e) { err(res, e.message); }
});

// ── POST /api/appointments-clinical/:id/confirm ───────────────
router.post('/:id/confirm', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE appointments_clinical SET status='confirmado' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    ok(res, rows[0]);
  } catch (e) { err(res, e.message); }
});

module.exports = router;
