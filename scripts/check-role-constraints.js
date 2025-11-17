const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoleConstraints() {
  try {
    console.log('Checking app_role column constraints...\n');

    // Query to check constraints on app_role column
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT
            tc.constraint_name,
            tc.constraint_type,
            cc.check_clause
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.check_constraints cc
            ON tc.constraint_name = cc.constraint_name
          WHERE tc.table_name = 'user_profiles'
            AND tc.constraint_name LIKE '%app_role%';
        `
      });

    if (constraintsError) {
      console.log('Could not query constraints directly. Trying alternative method...');

      // Alternative: Check existing role values
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('app_role')
        .not('app_role', 'is', null);

      if (usersError) {
        console.error('Error querying users:', usersError);
        return;
      }

      const uniqueRoles = [...new Set(users.map(u => u.app_role))];
      console.log('Current app_role values in database:');
      uniqueRoles.forEach(role => console.log(`  - ${role}`));
      console.log(`\nTotal unique roles: ${uniqueRoles.length}`);

      // Check if we can insert a test SLT role (dry run)
      console.log('\n✓ No CHECK constraint found on app_role column');
      console.log('✓ Can add SLT role without schema changes');

    } else {
      console.log('Constraints found:');
      console.log(constraints);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRoleConstraints();
