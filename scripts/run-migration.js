const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS final_narrative TEXT,
ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS narrative_version INTEGER DEFAULT 0;

COMMENT ON COLUMN feedback_360_surveys.final_narrative IS 'AI-generated one-page narrative summarizing the entire 360 report';
COMMENT ON COLUMN feedback_360_surveys.narrative_generated_at IS 'Timestamp when the narrative was last generated';
COMMENT ON COLUMN feedback_360_surveys.narrative_version IS 'Increments each time narrative is regenerated, used to track if report changes are ahead of narrative';
`;

(async () => {
  try {
    console.log('\n=== Running Migration ===\n');
    console.log(sql);
    console.log('\n========================\n');

    // Supabase doesn't have a direct SQL execution method via JS client
    // We need to use the REST API or run it manually
    console.log('⚠️  Supabase JS client cannot execute raw DDL SQL directly.\n');
    console.log('📋 Please copy the SQL above and run it manually in Supabase SQL Editor:\n');
    console.log(`   ${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql/new')}\n`);
    console.log('Or use the Supabase CLI: supabase db execute\n');

  } catch (err) {
    console.error('Error:', err.message);
  }
})();
