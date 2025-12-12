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
  console.log('Checking tables...\n');

  const tables = [
    'feedback_360_surveys',
    'feedback_360_reports',
    'feedback_360_report_citations',
    'organization_settings',
    'survey_meta_feedback'
  ];

  for (const t of tables) {
    const r = await supabase.from(t).select('*').limit(0);
    console.log(t + ':', r.error ? 'NOT FOUND - ' + r.error.message : 'EXISTS');
  }

  // Check columns on surveys
  console.log('\n--- Survey Columns ---');
  const { data: surveyData } = await supabase.from('feedback_360_surveys').select('*').limit(1);
  if (surveyData && surveyData.length > 0) {
    console.log(Object.keys(surveyData[0]).sort().join('\n'));
  }

  // Check columns on reports
  console.log('\n--- Report Columns ---');
  const { data: reportData } = await supabase.from('feedback_360_reports').select('*').limit(1);
  if (reportData && reportData.length > 0) {
    console.log(Object.keys(reportData[0]).sort().join('\n'));
  }
}

main().catch(console.error);
