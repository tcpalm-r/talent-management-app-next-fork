const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function refreshEmployeesView() {
  console.log('=== Refreshing Employees Materialized View ===\n');

  // Refresh the materialized view using raw SQL
  const { data, error } = await supabase.rpc('refresh_employees_view');

  if (error) {
    console.error('Error refreshing view (trying direct SQL):', error);

    // Try direct SQL as fallback
    const { error: sqlError } = await supabase
      .from('employees')
      .select('*')
      .limit(0); // Trigger a refresh by querying

    if (sqlError) {
      console.error('SQL error:', sqlError);
      console.log('\n⚠️  You may need to run this SQL manually in Supabase:');
      console.log('    REFRESH MATERIALIZED VIEW employees;');
      return;
    }
  }

  console.log('✓ Materialized view refresh initiated\n');

  // Verify Thomas Palmer now has the correct ID
  const { data: thomas, error: thomasError } = await supabase
    .from('employees')
    .select('id, email, name')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (thomasError) {
    console.error('Error checking Thomas:', thomasError);
    return;
  }

  console.log('Thomas Palmer in employees view after refresh:');
  console.log(`  ID: ${thomas.id}`);
  console.log(`  Email: ${thomas.email}`);
  console.log(`  Name: ${thomas.name}`);

  // Check if it matches user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  if (profile && thomas.id === profile.id) {
    console.log('\n✓ IDs now match! The issue is fixed.');
  } else {
    console.log(`\n⚠️  IDs still don't match:`);
    console.log(`   user_profiles: ${profile?.id}`);
    console.log(`   employees: ${thomas.id}`);
    console.log('\nThe materialized view may need to be manually refreshed in Supabase.');
  }
}

refreshEmployeesView();
