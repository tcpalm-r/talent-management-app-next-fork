const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkThomasEverywhere() {
  console.log('=== Finding ALL Thomas Palmer records ===\n');

  // Check user_profiles
  console.log('1️⃣  user_profiles table:');
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('email', '%thomas.palmer%');

  if (profileError) {
    console.error('   Error:', profileError);
  } else {
    profiles.forEach(p => {
      console.log(`   ID: ${p.id}`);
      console.log(`   Email: ${p.email}`);
      console.log(`   Name: ${p.full_name}`);
      console.log(`   Active: ${p.is_active}`);
      console.log('');
    });
  }

  // Check employees view
  console.log('2️⃣  employees materialized view:');
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .ilike('email', '%thomas.palmer%');

  if (empError) {
    console.error('   Error:', empError);
  } else {
    employees.forEach(e => {
      console.log(`   ID: ${e.id}`);
      console.log(`   Email: ${e.email}`);
      console.log(`   Name: ${e.name}`);
      console.log('');
    });
  }

  // Check surveys created_by
  console.log('3️⃣  Surveys created by Thomas Palmer:');
  const { data: surveys, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, created_by, employee_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (surveyError) {
    console.error('   Error:', surveyError);
  } else {
    console.log('   All recent surveys:');
    surveys.forEach(s => {
      console.log(`   - ${s.survey_name}`);
      console.log(`     created_by: ${s.created_by}`);
      console.log(`     employee_id: ${s.employee_id}`);
      console.log('');
    });
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n🔍 Summary:\n');

  const correctId = '5b1e1ee7-5850-4b7f-8881-9304c17ab63f';
  const wrongId = '7c511164-a69c-4a8c-913d-a691d3b169b5';

  console.log(`✅ Correct ID: ${correctId}`);
  console.log(`❌ Wrong ID:   ${wrongId}`);
  console.log('');

  if (profiles && profiles.length > 0) {
    console.log(`Found ${profiles.length} user_profiles record(s) for Thomas Palmer`);
    profiles.forEach((p, i) => {
      const isCorrect = p.id === correctId;
      const isWrong = p.id === wrongId;
      console.log(`  Profile ${i+1}: ${p.id} ${isCorrect ? '✅ CORRECT' : isWrong ? '❌ WRONG' : '❓ UNKNOWN'}`);
    });
  }

  console.log('');

  if (surveys && surveys.length > 0) {
    const thomasSurveys = surveys.filter(s =>
      s.created_by === correctId || s.created_by === wrongId
    );
    console.log(`Found ${thomasSurveys.length} surveys with Thomas Palmer IDs`);
    thomasSurveys.forEach(s => {
      const isCorrect = s.created_by === correctId;
      const isWrong = s.created_by === wrongId;
      console.log(`  - ${s.survey_name}`);
      console.log(`    created_by: ${s.created_by} ${isCorrect ? '✅ CORRECT' : isWrong ? '❌ WRONG' : ''}`);
    });
  }
}

checkThomasEverywhere();
