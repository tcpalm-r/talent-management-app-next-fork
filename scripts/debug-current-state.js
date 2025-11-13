const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCurrentState() {
  console.log('=== Debugging Current User State ===\n');

  // Get Thomas Palmer's correct profile
  const { data: thomas, error: thomasError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (thomasError) {
    console.error('Error fetching Thomas:', thomasError);
    return;
  }

  console.log('✓ Thomas Palmer in user_profiles:');
  console.log(`  ID: ${thomas.id}`);
  console.log(`  Email: ${thomas.email}`);
  console.log(`  Name: ${thomas.full_name}`);
  console.log('');

  // Check what the middleware MOCK_USER looks like
  console.log('Middleware MOCK_USER (from middleware.ts lines 7-22):');
  console.log(`  id: 'dev-user-1'`);
  console.log(`  email: 'developer@test.com'`);
  console.log('');

  // Check lib/auth.ts MOCK_USER
  console.log('lib/auth.ts MOCK_USER (lines 27-40):');
  console.log(`  id: 'mock-thomas-palmer'`);
  console.log(`  email: 'thomas.palmer@sonance.com'`);
  console.log('');

  // Check surveys
  const { data: surveys, error: surveysError } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, created_by, employee_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (surveysError) {
    console.error('Error fetching surveys:', surveysError);
    return;
  }

  console.log('Recent Surveys:');
  surveys.forEach(s => {
    const matchesThomas = s.created_by === thomas.id;
    const matchesMockId = s.created_by === 'mock-thomas-palmer';
    const matchesDevUser = s.created_by === 'dev-user-1';

    console.log(`\n  ${s.survey_name}`);
    console.log(`    created_by: ${s.created_by}`);
    console.log(`    Matches Thomas (${thomas.id}): ${matchesThomas ? '✓ YES' : '✗ NO'}`);
    console.log(`    Matches mock-thomas-palmer: ${matchesMockId ? '✓ YES' : '✗ NO'}`);
    console.log(`    Matches dev-user-1: ${matchesDevUser ? '✓ YES' : '✗ NO'}`);
  });

  console.log('\n=== Problem Diagnosis ===\n');

  console.log('The issue is likely one of these:');
  console.log('1. UserSwitcher cookie (x-switched-user) not being set correctly');
  console.log('2. Middleware not reading the switched user cookie');
  console.log('3. Dashboard not using the switched user profile');
  console.log('4. currentUser.id not matching survey.created_by');
  console.log('');
  console.log('To debug, check browser DevTools:');
  console.log('  - Application > Cookies > Look for "x-switched-user"');
  console.log('  - Console > Look for "[UserSwitcher] Switched to user:" logs');
  console.log('  - Console > Look for "[Dashboard] Using userProfile as currentUserEmployee"');
  console.log('  - Network > Check /api/auth/switch-user response');
}

debugCurrentState();
