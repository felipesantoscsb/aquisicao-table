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

    // ══════════════════════════════════════════════════════════
    // TABELAS ORIGINAIS
    // ══════════════════════════════════════════════════════════

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'sdr',
        nutri_name VARCHAR(50),
        whatsapp VARCHAR(20),
        phone VARCHAR(20),
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
        appointment_date TIMESTAMPTZ,
        next_action_responsible VARCHAR(100),
        next_action_deadline DATE,
        closing_date DATE,
        product_indicated VARCHAR(20) CHECK (product_indicated IN ('Essential','Premium','Elite') OR product_indicated IS NULL),
        loss_reason TEXT,
        obs_form TEXT,
        obs_nutri TEXT,
        plan_url TEXT,
        converted_to_patient BOOLEAN DEFAULT FALSE,
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

    // ══════════════════════════════════════════════════════════
    // NOVAS TABELAS — MÓDULO CLÍNICO
    // ══════════════════════════════════════════════════════════

    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id),
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(30),
        birthday DATE,
        nutritionist_id INTEGER REFERENCES users(id),
        clinical_status VARCHAR(20) NOT NULL DEFAULT 'ativo'
          CHECK (clinical_status IN ('ativo','manutenção','alta','inativo')),
        product VARCHAR(60) NOT NULL DEFAULT 'Table Elite',
        start_date DATE,
        webdiet_link TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS patient_history_nutritionist (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        nutritionist_id INTEGER REFERENCES users(id),
        changed_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS appointments_clinical (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        nutritionist_id INTEGER REFERENCES users(id),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        duration_minutes INTEGER DEFAULT 50,
        type VARCHAR(20) NOT NULL DEFAULT 'consulta'
          CHECK (type IN ('consulta','encaixe','bloqueio')),
        recurrence VARCHAR(20) NOT NULL DEFAULT 'none'
          CHECK (recurrence IN ('none','weekly')),
        recurrence_days INTEGER CHECK (recurrence_days IN (30,60,90) OR recurrence_days IS NULL),
        status VARCHAR(20) NOT NULL DEFAULT 'agendado'
          CHECK (status IN ('agendado','confirmado','realizado','cancelado')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS medical_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        nutritionist_id INTEGER REFERENCES users(id),
        appointment_id INTEGER REFERENCES appointments_clinical(id),
        consultation_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS body_measurements (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        record_date DATE NOT NULL DEFAULT CURRENT_DATE,
        weight NUMERIC(5,2),
        measures JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS emotional_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        nutritionist_id INTEGER REFERENCES users(id),
        consultation_date DATE NOT NULL DEFAULT CURRENT_DATE,
        free_notes TEXT,
        mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),
        themes JSONB,
        keyword VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS patient_memory (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE UNIQUE,
        nutritionist_id INTEGER REFERENCES users(id),
        content TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS charges (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        package_type VARCHAR(30) NOT NULL
          CHECK (package_type IN ('mensal','bimestral','trimestral','semestral','manutenção','avulso')),
        value NUMERIC(10,2),
        issue_date DATE DEFAULT CURRENT_DATE,
        due_date DATE,
        paid_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'pendente'
          CHECK (status IN ('pendente','pago','vencido','cancelado')),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ══════════════════════════════════════════════════════════
    // MIGRATIONS DE SCHEMA (idempotentes)
    // ══════════════════════════════════════════════════════════

    // Colunas originais
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);`);
    await client.query(`ALTER TABLE pipeline_cards ADD COLUMN IF NOT EXISTS converted_to_patient BOOLEAN DEFAULT FALSE;`);

    // Bug 2: migrar appointment_date de DATE para TIMESTAMPTZ
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='pipeline_cards'
            AND column_name='appointment_date'
            AND data_type='date'
        ) THEN
          ALTER TABLE pipeline_cards
            ALTER COLUMN appointment_date TYPE TIMESTAMPTZ
            USING appointment_date::timestamptz;
        END IF;
      END $$;
    `);

    // Expandir role check para incluir 'administrativo'
    await client.query(`
      DO $$
      DECLARE c_name text;
      BEGIN
        SELECT constraint_name INTO c_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
        WHERE tc.table_name='users' AND tc.constraint_type='CHECK'
          AND ccu.column_name='role'
        LIMIT 1;
        IF c_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c_name);
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `).catch(() => {});

    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin','sdr','nutri','administrativo'));
    `).catch(() => {}); // Ignora se já existir

    // Corrige datas inválidas do Notion
    await client.query(`
      UPDATE pipeline_cards
      SET appointment_date = NULL
      WHERE appointment_date IS NOT NULL
        AND appointment_date::text LIKE '0001-01-01%';
    `).catch(() => {});

    // Migra email do admin
    await client.query(`
      UPDATE users
      SET email = 'adm@tableclinic.com.br'
      WHERE email = 'admin@tableclinic.com.br' AND role = 'admin';
    `);

    // ══════════════════════════════════════════════════════════
    // SEEDS
    // ══════════════════════════════════════════════════════════
    const bcrypt = require('bcryptjs');
    const hash   = await bcrypt.hash('table2026', 10);

    const seeds = [
      { name: 'Felipe',  email: 'adm@tableclinic.com.br',      role: 'admin',          nutri_name: null,      whatsapp: null },
      { name: 'Juliana', email: 'juliana@tableclinic.com.br',   role: 'nutri',           nutri_name: 'Juliana', whatsapp: null },
      { name: 'Natalia', email: 'natalia@tableclinic.com.br',   role: 'nutri',           nutri_name: 'Natalia', whatsapp: null },
      { name: 'Evelyn',  email: 'evelyn@tableclinic.com.br',    role: 'nutri',           nutri_name: 'Evelyn',  whatsapp: '5511918253788' },
      { name: 'Karina',  email: 'karina@tableclinic.com.br',    role: 'administrativo',  nutri_name: null,      whatsapp: '5511918253788' },
    ];

    for (const u of seeds) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, nutri_name, whatsapp)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, hash, u.role, u.nutri_name, u.whatsapp]
      );
    }

    console.log('✅ DB initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
