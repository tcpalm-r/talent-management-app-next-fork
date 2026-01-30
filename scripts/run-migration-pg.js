/**
 * Run migration using pg directly
 */
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const MIGRATION_SQL = `
ALTER TABLE feedback_360_reports
ADD COLUMN IF NOT EXISTS theme_coherence JSONB DEFAULT NULL;

COMMENT ON COLUMN feedback_360_reports.theme_coherence IS 'Theme coherence analysis from Pass 3: contradictions, related themes, annotations, and coherence summary';
`;

async function runMigration() {
  console.log('🔄 Running migration via pg...\n');

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    await client.query(MIGRATION_SQL);
    console.log('✅ Migration executed successfully!');

    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'feedback_360_reports'
      AND column_name = 'theme_coherence'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Column verified:', result.rows[0]);
    } else {
      console.log('⚠️ Column not found after migration');
    }

    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
