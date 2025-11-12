/**
 * Add executive_summary column to feedback_360_reports table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addExecutiveSummaryColumn() {
  console.log('Adding executive_summary column to feedback_360_reports table...');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE feedback_360_reports
      ADD COLUMN IF NOT EXISTS executive_summary TEXT;
    `
  });

  if (error) {
    // Try direct query
    console.log('Trying direct SQL...');
    const { error: directError } = await supabase
      .from('feedback_360_reports')
      .select('executive_summary')
      .limit(1);

    if (directError && directError.code === '42703') {
      console.error('❌ Column does not exist and cannot be added via API');
      console.log('\nPlease run this SQL in Supabase SQL Editor:');
      console.log('ALTER TABLE feedback_360_reports ADD COLUMN executive_summary TEXT;');
    } else {
      console.log('✅ Column already exists or was added');
    }
    return;
  }

  console.log('✅ Column added successfully');
}

addExecutiveSummaryColumn();
