const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin','sdr','nutri')),
        nutri_name VARCHAR(50),
        whatsapp VARCHAR(20),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(30),
        email VARCHAR(150),
        origin VARCHAR(60),
        tier VARCHAR(10) CHECK (tier IN ('hot','warm','cold')),
        profile VARCHAR(5) CHECK (profile IN ('E','R','S','A')),
        score INTEGER,
        quiz_answers JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pipeline_cards (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        funnel VARCHAR(30) CHECK (funnel IN ('pre_consulta','captacao','reativacao','pos_venda')),
        nutri VARCHAR(30),
        stage VARCHAR(40) NOT NULL DEFAULT 'Agendada',
        appointment_date DATE,
        next_action_responsible VARCHAR(100),
        next_action_deadline DATE,
        closing_date DATE,
        product_indicated VARCHAR(20) CHECK (product_indicated IN ('Essential','Premium','Elite') OR product_indicated IS NULL),
        loss_reason TEXT,
        obs_form TEXT,
        obs_nutri TEXT,
        plan_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jornadas (
        id SERIAL PRIMARY KEY,
        card_id INTEGER REFERENCES pipeline_cards(id) ON DELETE CASCADE,
        html_content TEXT,
        url_slug VARCHAR(200) UNIQUE,
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        generated_by INTEGER REFERENCES users(id)
      );
    `);

    // Migração: adiciona coluna whatsapp se ainda não existir (banco já existente)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);
    `);

    // seed users
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('table2026', 10);

    const seeds = [
      { name: 'Felipe',  email: 'admin@tableclinic.com.br',   role: 'admin', nutri_name: null },
      { name: 'Juliana', email: 'juliana@tableclinic.com.br',  role: 'nutri', nutri_name: 'Juliana' },
      { name: 'Natalia', email: 'natalia@tableclinic.com.br',  role: 'nutri', nutri_name: 'Natalia' },
    ];

    for (const u of seeds) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, nutri_name)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, hash, u.role, u.nutri_name]
      );
    }

    console.log('DB initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
