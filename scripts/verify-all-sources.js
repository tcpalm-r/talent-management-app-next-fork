const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAllSources() {
  console.log('=== Checking Thomas Palmer ID from ALL sources ===\n');

  // 1. Check user_profiles table
  console.log('1️⃣  user_profiles table:');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (profileError) {
    console.error('   Error:', profileError);
  } else {
    console.log(`   ID: ${profile.id}`);
    console.log(`   Name: ${profile.full_name}`);
  }
  console.log('');

  // 2. Check employees materialized view
  console.log('2️⃣  employees materialized view:');
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, email, name')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (employeeError) {
    console.error('   Error:', employeeError);
  } else {
    console.log(`   ID: ${employee.id}`);
    console.log(`   Name: ${employee.name}`);
  }
  console.log('');

  // 3. Simulate what /api/users/list returns
  console.log('3️⃣  /api/users/list endpoint (from user_profiles):');
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, app_role')
    .eq('is_active', true)
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (usersError) {
    console.error('   Error:', usersError);
  } else {
    console.log(`   ID: ${users.id}`);
    console.log(`   Name: ${users.full_name}`);
  }
  console.log('');

  // 4. Simulate what /api/dashboard/data returns
  console.log('4️⃣  /api/dashboard/data endpoint (from employees view):');
  const { data: dashboardEmployees, error: dashboardError } = await supabase
    .from('employees')
    .select('id, email, name')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (dashboardError) {
    console.error('   Error:', dashboardError);
  } else {
    console.log(`   ID: ${dashboardEmployees.id}`);
    console.log(`   Name: ${dashboardEmployees.name}`);
  }
  console.log('');

  // 5. Summary
  console.log('═══════════════════════════════════════════════════════════');
  if (profile && employee && users && dashboardEmployees) {
    const profileId = profile.id;
    const employeeId = employee.id;
    const usersId = users.id;
    const dashboardId = dashboardEmployees.id;

    console.log('\n📊 ID Comparison:');
    console.log(`   user_profiles:    ${profileId}`);
    console.log(`   employees view:   ${employeeId}`);
    console.log(`   users list API:   ${usersId}`);
    console.log(`   dashboard API:    ${dashboardId}`);
    console.log('');

    if (profileId === employeeId && employeeId === usersId && usersId === dashboardId) {
      console.log('✅ ALL IDs MATCH! Everything is correct.');
      console.log('');
      console.log('If the browser still shows the wrong ID:');
      console.log('   1. Clear cookies in DevTools');
      console.log('   2. Do hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
      console.log('   3. Check Network tab to see what /api/dashboard/data returns');
    } else {
      console.log('❌ IDs DO NOT MATCH!');
      console.log('');
      if (profileId !== employeeId) {
        console.log('⚠️  Problem: employees view has stale data');
        console.log('   Solution: Manually refresh materialized view in Supabase SQL Editor:');
        console.log('   REFRESH MATERIALIZED VIEW employees;');
      }
      if (profileId === usersId && profileId !== dashboardId) {
        console.log('⚠️  Problem: employees view not refreshed properly');
      }
    }
  }
}

verifyAllSources();
