const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function refreshMaterializedView() {
  console.log('=== Refreshing Employees Materialized View ===\n');

  try {
    // Execute raw SQL to refresh the materialized view
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: 'REFRESH MATERIALIZED VIEW employees;'
    });

    if (error) {
      console.error('RPC error (trying alternative method):', error.message);

      // Alternative: Use Supabase's query builder to trigger a refresh
      // by selecting from the view with a specific pattern
      const { error: queryError } = await supabase
        .from('employees')
        .select('id')
        .limit(1);

      if (queryError) {
        console.error('Query error:', queryError);
        console.log('\n⚠️  Cannot refresh via API. You need to run this SQL manually in Supabase:');
        console.log('\n    REFRESH MATERIALIZED VIEW employees;\n');
        console.log('Steps:');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Run: REFRESH MATERIALIZED VIEW employees;');
        return false;
      }
    }

    console.log('✓ Refresh command sent\n');

    // Verify the fix
    const { data: thomas, error: checkError } = await supabase
      .from('employees')
      .select('id, email, name')
      .eq('email', 'thomas.palmer@sonance.com')
      .single();

    if (checkError) {
      console.error('Error checking Thomas:', checkError);
      return false;
    }

    console.log('Thomas Palmer in employees view:');
    console.log(`  ID: ${thomas.id}`);
    console.log(`  Email: ${thomas.email}`);
    console.log(`  Name: ${thomas.name}`);

    // Check if it matches user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', 'thomas.palmer@sonance.com')
      .single();

    console.log('\nThomas Palmer in user_profiles:');
    console.log(`  ID: ${profile.id}`);
    console.log(`  Email: ${profile.email}`);

    if (thomas.id === profile.id) {
      console.log('\n✅ SUCCESS! IDs now match!');
      console.log('\nPlease reload your browser to see the fix.');
      return true;
    } else {
      console.log('\n⚠️  IDs still don\'t match. The view was not refreshed.');
      console.log('\nYou MUST run this SQL manually in Supabase SQL Editor:');
      console.log('    REFRESH MATERIALIZED VIEW employees;');
      return false;
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

refreshMaterializedView();
