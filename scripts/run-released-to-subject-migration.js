/**
 * Run migration to add released_to_subject_at column
 * and pre-release Jason's finalized surveys
 */
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const MIGRATION_SQL = `
-- Add released_to_subject_at column to feedback_360_surveys
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS released_to_subject_at TIMESTAMPTZ DEFAULT NULL;

-- Pre-release Jason's finalized surveys
UPDATE feedback_360_surveys
SET released_to_subject_at = NOW()
WHERE status = 'finalized'
  AND (created_by = '3bccaf29-bc33-4b1e-9ce1-db7967886b0a'
       OR LOWER(created_by_email) = 'jasons@sonance.com');
`;

async function runMigration() {
  console.log('🔄 Running released_to_subject_at migration...\n');

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    const result = await client.query(MIGRATION_SQL);
    console.log('✅ Migration executed successfully!');

    // Verify the column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'feedback_360_surveys'
      AND column_name = 'released_to_subject_at'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ Column verified:', columnCheck.rows[0]);
    } else {
      console.log('⚠️ Column not found after migration');
    }

    // Check how many surveys were pre-released for Jason
    const jasonSurveys = await client.query(`
      SELECT COUNT(*) as count
      FROM feedback_360_surveys
      WHERE released_to_subject_at IS NOT NULL
        AND (created_by = '3bccaf29-bc33-4b1e-9ce1-db7967886b0a'
             OR LOWER(created_by_email) = 'jasons@sonance.com')
    `);
    console.log(`✅ Pre-released ${jasonSurveys.rows[0].count} of Jason's finalized surveys`);

    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
