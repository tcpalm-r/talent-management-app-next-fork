const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// The 5 users to update based on the screenshot
const usersToUpdate = [
  { email: 'gigid@sonance.com', id: '6958b8a1-a459-4df7-b0ce-062d4c56d23f' },
  { email: 'jasons@sonance.com', id: '3bccaf29-bc33-4b1e-9ce1-db7967886b0a' },
  { email: 'jorgen@sonance.com', id: 'df135c41-0905-4ecb-8d65-e1b3ab447828' },
  { email: 'mikes@sonance.com', id: 'e57dcddb-5249-4b76-894f-f44636e43d17' },
  { email: 'patm@sonance.com', id: '8221904c-bc14-440b-a62a-219b45ba74cf' },
];

async function updateUsersToSLT() {
  try {
    console.log('═══════════════════════════════════════');
    console.log('  Updating 5 Users to SLT Role');
    console.log('═══════════════════════════════════════\n');

    // First, verify all users exist and are currently admin
    console.log('Step 1: Verifying current user roles...\n');

    for (const user of usersToUpdate) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, app_role')
        .eq('email', user.email)
        .single();

      if (error) {
        console.log(`❌ Could not find user: ${user.email}`);
        console.log(`   Error: ${error.message}\n`);
        continue;
      }

      console.log(`✓ Found: ${data.full_name} (${data.email})`);
      console.log(`  Current role: ${data.app_role}`);
      console.log(`  ID: ${data.id}\n`);
    }

    // Update all users to SLT role
    console.log('Step 2: Updating users to SLT role...\n');

    let successCount = 0;
    let failCount = 0;

    for (const user of usersToUpdate) {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          app_role: 'slt',
          updated_at: new Date().toISOString()
        })
        .eq('email', user.email)
        .select('id, email, full_name, app_role')
        .single();

      if (error) {
        console.log(`❌ Failed to update ${user.email}`);
        console.log(`   Error: ${error.message}`);

        if (error.code === '23514') {
          console.log(`   ⚠️  The database constraint needs to be updated first!`);
          console.log(`   Please run: node scripts/run-slt-migration.js`);
          console.log(`   Or manually execute the SQL in Supabase SQL Editor.\n`);
        }
        failCount++;
        continue;
      }

      console.log(`✓ Updated: ${data.full_name}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  New role: ${data.app_role}\n`);
      successCount++;
    }

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('  Update Summary');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Successfully updated: ${successCount}`);
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount}`);
    }
    console.log('═══════════════════════════════════════\n');

    // Verify final state
    if (successCount > 0) {
      console.log('Step 3: Verifying updates...\n');

      const { data: sltUsers, error } = await supabase
        .from('user_profiles')
        .select('email, full_name, app_role')
        .eq('app_role', 'slt')
        .order('full_name');

      if (!error && sltUsers) {
        console.log(`Found ${sltUsers.length} user(s) with SLT role:`);
        sltUsers.forEach(user => {
          console.log(`  - ${user.full_name} (${user.email})`);
        });
        console.log();
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

updateUsersToSLT();
