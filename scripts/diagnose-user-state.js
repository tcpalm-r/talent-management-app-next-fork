const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseUserState() {
  console.log('=== Diagnosing User State ===\n');

  // Get Thomas Palmer's profile
  const { data: thomas, error: thomasError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (thomasError) {
    console.error('Error fetching Thomas Palmer:', thomasError);
    return;
  }

  console.log('Thomas Palmer Profile:');
  console.log(`  ID: ${thomas.id}`);
  console.log(`  Email: ${thomas.email}`);
  console.log(`  Name: ${thomas.full_name}`);
  console.log(`  Role: ${thomas.app_role}`);
  console.log('');

  // Get surveys and check created_by field
  const { data: surveys, error: surveysError } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, created_by, employee_id, status')
    .order('created_at', { ascending: false });

  if (surveysError) {
    console.error('Error fetching surveys:', surveysError);
    return;
  }

  console.log(`Found ${surveys.length} total surveys:\n`);

  for (const survey of surveys) {
    const isCreatedByThomas = survey.created_by === thomas.id;
    const icon = isCreatedByThomas ? '✓ SPONSOR' : '✗ Not sponsor';

    console.log(`${icon} - ${survey.survey_name}`);
    console.log(`   Survey ID: ${survey.id}`);
    console.log(`   Created by: ${survey.created_by}`);
    console.log(`   Match Thomas? ${isCreatedByThomas ? 'YES' : 'NO'}`);

    if (!isCreatedByThomas) {
      // Check who actually created it
      const { data: creator } = await supabase
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', survey.created_by)
        .single();

      if (creator) {
        console.log(`   Actual creator: ${creator.full_name} (${creator.email})`);
      } else {
        console.log(`   ⚠️  Creator ID ${survey.created_by} not found in database!`);
      }
    }
    console.log('');
  }

  // Check if there are any surveys with the old wrong ID
  const wrongId = '7c511164-a69c-4a8c-913d-a691d3b169b5';
  const { data: wrongSurveys } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name')
    .eq('created_by', wrongId);

  if (wrongSurveys && wrongSurveys.length > 0) {
    console.log('\n⚠️  WARNING: Found surveys with wrong creator ID:');
    wrongSurveys.forEach(s => console.log(`   - ${s.survey_name} (${s.id})`));
    console.log('\nRun: node scripts/fix-survey-creator.js');
  }
}

diagnoseUserState();
