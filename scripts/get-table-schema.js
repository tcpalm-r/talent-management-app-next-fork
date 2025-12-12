#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // Get one row from each table to understand structure
  const tables = [
    'feedback_360_report_citations',
    'organization_settings',
    'survey_meta_feedback'
  ];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log('Error:', error.message);
      continue;
    }
    if (data && data.length > 0) {
      console.log('Columns:', JSON.stringify(Object.keys(data[0]).sort(), null, 2));
      console.log('Sample:', JSON.stringify(data[0], null, 2));
    } else {
      // Table is empty, try to insert and get validation error to see columns
      console.log('Table is empty - trying to detect schema via error...');
      const { error: insertError } = await supabase.from(table).insert({}).single();
      if (insertError) {
        console.log('Insert error (shows required columns):', insertError.message);
      }
    }
  }
}

main().catch(console.error);
