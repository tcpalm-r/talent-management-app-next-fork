const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkThomasInEmployees() {
  console.log('=== Checking Thomas Palmer in Employees ===\n');

  // Check user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return;
  }

  console.log('Thomas Palmer in user_profiles:');
  console.log(`  ID: ${profile.id}`);
  console.log(`  Email: ${profile.email}`);
  console.log(`  Name: ${profile.full_name}`);
  console.log('');

  // Check employees (materialized view)
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('*')
    .eq('email', 'thomas.palmer@sonance.com');

  if (employeesError) {
    console.error('Error fetching employees:', employeesError);
    return;
  }

  console.log(`Thomas Palmer in employees view: ${employees.length > 0 ? 'FOUND' : 'NOT FOUND'}`);

  if (employees.length > 0) {
    const emp = employees[0];
    console.log(`  ID: ${emp.id}`);
    console.log(`  Email: ${emp.email}`);
    console.log(`  Name: ${emp.name}`);
    console.log('');

    if (emp.id !== profile.id) {
      console.log('  ⚠️  WARNING: Employee ID does not match profile ID!');
      console.log(`     Profile ID: ${profile.id}`);
      console.log(`     Employee ID: ${emp.id}`);
    } else {
      console.log('  ✓ IDs match!');
    }
  } else {
    console.log('  ⚠️  Thomas Palmer NOT found in employees view!');
    console.log('  This means currentUserEmployee will use the fallback logic.');
    console.log('  Check if the employees materialized view needs to be refreshed.');
  }
}

checkThomasInEmployees();
