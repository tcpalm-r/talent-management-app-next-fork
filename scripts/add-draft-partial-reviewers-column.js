/**
 * Migration script to add draft_partial_reviewers column to feedback_360_surveys table
 *
 * This column stores partial reviewers (with only relationship selected, no name/email yet)
 * as JSON during the draft saving process.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumn() {
  console.log('🔄 Adding draft_partial_reviewers column to feedback_360_surveys table...\n');

  try {
    // Execute raw SQL to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE feedback_360_surveys
        ADD COLUMN IF NOT EXISTS draft_partial_reviewers JSONB;

        COMMENT ON COLUMN feedback_360_surveys.draft_partial_reviewers IS
        'Stores partial reviewers (with only relationship selected) during draft saving';
      `
    });

    if (error) {
      // If the RPC function doesn't exist, we need to use a different approach
      if (error.message.includes('function exec_sql')) {
        console.log('⚠️  exec_sql RPC function not available, using direct PostgreSQL connection...\n');
        console.log('Please run the following SQL in your Supabase SQL Editor:\n');
        console.log('-----------------------------------------------------------');
        console.log(`
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS draft_partial_reviewers JSONB;

COMMENT ON COLUMN feedback_360_surveys.draft_partial_reviewers IS
  'Stores partial reviewers (with only relationship selected) during draft saving';
        `);
        console.log('-----------------------------------------------------------\n');
        console.log('After running this SQL, the migration will be complete.');
        return;
      }

      throw error;
    }

    console.log('✅ Column added successfully!');
    console.log('The draft_partial_reviewers column is now available in feedback_360_surveys');

  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    console.error('\nPlease add the column manually using the Supabase dashboard:');
    console.log('-----------------------------------------------------------');
    console.log(`
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS draft_partial_reviewers JSONB;

COMMENT ON COLUMN feedback_360_surveys.draft_partial_reviewers IS
  'Stores partial reviewers (with only relationship selected) during draft saving';
    `);
    console.log('-----------------------------------------------------------\n');
    process.exit(1);
  }
}

addColumn();
