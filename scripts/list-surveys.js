/**
 * List all surveys in the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function listSurveys() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('📋 Listing all 360 surveys...');
  console.log('');

  const { data: surveys, error } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, status, employee_id, created_by, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!surveys || surveys.length === 0) {
    console.log('⚠️  No surveys found');
    return;
  }

  console.log(`Found ${surveys.length} surveys:\n`);
  surveys.forEach((survey, idx) => {
    console.log(`${idx + 1}. ${survey.survey_name || 'Untitled'}`);
    console.log(`   ID: ${survey.id}`);
    console.log(`   Status: ${survey.status}`);
    console.log(`   Employee: ${survey.employee_id}`);
    console.log(`   Created by: ${survey.created_by}`);
    console.log(`   Created: ${survey.created_at}`);
    console.log('');
  });

  // Check for any finalized surveys
  const finalized = surveys.filter(s => s.status === 'finalized');
  if (finalized.length > 0) {
    console.log(`\n🎯 ${finalized.length} finalized survey(s) found:`);
    finalized.forEach(s => {
      console.log(`   - ${s.survey_name || 'Untitled'} (${s.id})`);
    });
  }

  // Check if any surveys have reports
  console.log('\n📊 Checking for existing reports...');
  const { data: reports, error: reportsError } = await supabase
    .from('feedback_360_reports')
    .select('survey_id')
    .in('survey_id', surveys.map(s => s.id));

  if (!reportsError && reports) {
    console.log(`   Found ${reports.length} report(s)`);
    if (reports.length > 0) {
      reports.forEach(r => {
        const survey = surveys.find(s => s.id === r.survey_id);
        console.log(`   - Report for: ${survey?.survey_name || 'Unknown'}`);
      });
    }
  }
}

listSurveys().catch(console.error);
