#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // Check for specific columns
  const tables = [
    'feedback_360_survey_reviewers',
    'feedback_360_questions',
    'feedback_360_deleted_surveys'
  ];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log('Error:', error.message);
      continue;
    }
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).sort().join(', '));
    } else {
      console.log('Table is empty');
    }
  }
}

main().catch(console.error);
