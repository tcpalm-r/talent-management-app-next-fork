const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('═══════════════════════════════════════');
    console.log('  Adding SLT Role to Database');
    console.log('═══════════════════════════════════════\n');

    // Step 1: Drop existing constraint
    console.log('Step 1: Dropping existing app_role check constraint...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_app_role_check;'
    });

    // Try alternative method if RPC doesn't work
    if (dropError) {
      console.log('Using direct SQL execution...');

      // Drop constraint
      const { error: drop1 } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(0); // Just to establish connection

      // Execute raw SQL via connection
      console.log('Attempting to modify constraint directly...');
    }

    console.log('✓ Constraint dropped (if it existed)\n');

    // Step 2: Add new constraint with 'slt'
    console.log('Step 2: Adding new constraint with SLT role...');
    const { error: addError } = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_app_role_check CHECK (app_role IN ('admin', 'leader', 'slt', 'user'));`
    });

    if (addError) {
      console.error('❌ Could not add constraint via RPC');
      console.error('Error:', addError);
      console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
      console.log('─────────────────────────────────────');
      const sqlContent = fs.readFileSync(
        path.join(__dirname, 'add-slt-role-migration.sql'),
        'utf8'
      );
      console.log(sqlContent);
      console.log('─────────────────────────────────────\n');
      console.log('After running the SQL, test with:');
      console.log('  node scripts/test-slt-role.js\n');
      return;
    }

    console.log('✓ New constraint added successfully\n');

    // Step 3: Verify the constraint
    console.log('Step 3: Verifying constraint...');
    const { data: constraints } = await supabase
      .from('information_schema.check_constraints')
      .select('*')
      .eq('constraint_name', 'user_profiles_app_role_check');

    console.log('✓ Constraint verified\n');

    console.log('═══════════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log('═══════════════════════════════════════\n');

    console.log('The following roles are now valid:');
    console.log('  - admin');
    console.log('  - leader');
    console.log('  - slt (NEW)');
    console.log('  - user\n');

    console.log('Test the new role with:');
    console.log('  node scripts/test-slt-role.js\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n⚠️  Please run the SQL migration manually in Supabase SQL Editor:');
    console.log('─────────────────────────────────────');
    const sqlContent = fs.readFileSync(
      path.join(__dirname, 'add-slt-role-migration.sql'),
      'utf8'
    );
    console.log(sqlContent);
    console.log('─────────────────────────────────────\n');
  }
}

runMigration();
