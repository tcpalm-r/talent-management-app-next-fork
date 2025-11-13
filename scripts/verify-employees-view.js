const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyEmployeesView() {
  console.log('=== Verifying Employees View Data ===\n');

  // Query the employees view directly
  const { data: employeesData, error: employeesError } = await supabase
    .from('employees')
    .select('id, email, name')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (employeesError) {
    console.error('Error querying employees view:', employeesError);
    return;
  }

  // Query user_profiles directly
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (profileError) {
    console.error('Error querying user_profiles:', profileError);
    return;
  }

  console.log('📊 Current State:\n');
  console.log('employees view:');
  console.log(`  ID: ${employeesData.id}`);
  console.log(`  Email: ${employeesData.email}`);
  console.log(`  Name: ${employeesData.name}`);
  console.log('');
  console.log('user_profiles table:');
  console.log(`  ID: ${profileData.id}`);
  console.log(`  Email: ${profileData.email}`);
  console.log(`  Name: ${profileData.full_name}`);
  console.log('');

  if (employeesData.id === profileData.id) {
    console.log('✅ IDs MATCH - Materialized view is correct!');
    console.log('');
    console.log('🔄 If the browser still shows the wrong ID, you need to:');
    console.log('   1. Do a HARD REFRESH in the browser:');
    console.log('      - Mac: Cmd + Shift + R');
    console.log('      - Windows/Linux: Ctrl + Shift + R');
    console.log('   2. Or clear browser cache and reload');
    console.log('');
    console.log('The browser has cached the old employees data in React state.');
  } else {
    console.log('❌ IDs DO NOT MATCH - Materialized view needs manual refresh!');
    console.log('');
    console.log('Run this SQL in Supabase SQL Editor:');
    console.log('   REFRESH MATERIALIZED VIEW employees;');
  }
}

verifyEmployeesView();
