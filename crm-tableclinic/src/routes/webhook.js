const router = require('express').Router();
const { pool } = require('../db');

router.post('/quiz', async (req, res) => {
  const { nome, name, email, whats, phone, profile, tier, score, obs_form, origin } = req.body;
  const leadName = nome || name || 'Lead sem nome';
  const leadPhone = whats || phone || null;
  const leadOrigin = origin || 'Formulário';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const leadRes = await client.query(
      `INSERT INTO leads (name, phone, email, origin, tier, profile, score, quiz_answers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [leadName, leadPhone, email || null, leadOrigin,
       tier || 'warm', profile || null, score || null,
       req.body ? JSON.stringify(req.body) : null]
    );
    const leadId = leadRes.rows[0].id;

    await client.query(
      `INSERT INTO pipeline_cards (lead_id, funnel, stage, obs_form)
       VALUES ($1,'pre_consulta','Agendada',$2)`,
      [leadId, obs_form || null]
    );

    await client.query('COMMIT');
    res.json({ ok: true, lead_id: leadId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  } finally {
    client.release();
  }
});

module.exports = router;
