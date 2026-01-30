const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function checkColumn() {
  console.log('Checking for theme_coherence column...\n');

  // Try selecting the column
  const { data, error } = await supabase
    .from('feedback_360_reports')
    .select('theme_coherence')
    .limit(1);

  if (!error) {
    console.log('✅ Column theme_coherence already exists!');
    console.log('Data:', data);
  } else if (error.message.includes('theme_coherence')) {
    console.log('❌ Column does not exist.');
    console.log('\n📋 Run this in Supabase Dashboard > SQL Editor:');
    console.log('─'.repeat(60));
    console.log('ALTER TABLE feedback_360_reports');
    console.log('ADD COLUMN IF NOT EXISTS theme_coherence JSONB DEFAULT NULL;');
    console.log('─'.repeat(60));
  } else {
    console.error('Unexpected error:', error.message);
  }
}

checkColumn();
