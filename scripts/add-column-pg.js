/**
 * Add draft_partial_reviewers column using pg package
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL environment variable');
  process.exit(1);
}

async function addColumn() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('🔄 Adding draft_partial_reviewers column...\n');

    const sql = `
      ALTER TABLE feedback_360_surveys
      ADD COLUMN IF NOT EXISTS draft_partial_reviewers JSONB;
    `;

    await client.query(sql);

    console.log('✅ Column added successfully!');
    console.log('The draft_partial_reviewers column is now available in feedback_360_surveys\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

addColumn();
