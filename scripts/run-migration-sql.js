/**
 * Execute SQL migration using Supabase client
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running migration...\n');

  try {
    // Use Supabase's query endpoint to execute raw SQL
    const { data, error } = await supabase
      .from('feedback_360_surveys')
      .select('id')
      .limit(1);

    if (error && !error.message.includes('draft_partial_reviewers')) {
      console.log('✅ Table accessible, proceeding with manual column add...\n');
    }

    // Since we can't execute arbitrary SQL through the Supabase JS client,
    // we'll need to use a different approach - making an HTTP request to Supabase's REST API
    console.log('ℹ️  Direct SQL execution not available through Supabase JS client.');
    console.log('Please add the column using one of these methods:\n');
    console.log('1. Supabase Dashboard > SQL Editor > Run this SQL:');
    console.log('-----------------------------------------------------------');
    console.log(`ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS draft_partial_reviewers JSONB;`);
    console.log('-----------------------------------------------------------\n');
    console.log('2. Or use the database URL with psql (if installed)');
    console.log('3. Or I can try to add it automatically if you have the postgres package installed\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
