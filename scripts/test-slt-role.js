const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSLTRole() {
  try {
    console.log('Testing SLT role creation...\n');

    // Test 1: Create a test user with SLT role
    const testEmail = `slt-test-${Date.now()}@sonance.com`;
    console.log(`Creating test user: ${testEmail}`);

    const { data: newUser, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        email: testEmail,
        full_name: 'SLT Test User',
        app_role: 'slt',
        department: 'Executive',
        title: 'Senior Leadership Team Member',
        app_access: true,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return;
    }

    console.log('✓ User created successfully with SLT role');
    console.log(`  ID: ${newUser.id}`);
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Role: ${newUser.app_role}`);
    console.log(`  Name: ${newUser.full_name}\n`);

    // Test 2: Query the user back
    const { data: queriedUser, error: queryError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', newUser.id)
      .single();

    if (queryError) {
      console.error('❌ Error querying user:', queryError);
      return;
    }

    console.log('✓ User queried successfully');
    console.log(`  Role from database: ${queriedUser.app_role}\n`);

    // Test 3: Update role to SLT (to ensure updates also work)
    const { data: updatedUser, error: updateError } = await supabase
      .from('user_profiles')
      .update({ app_role: 'slt' })
      .eq('id', newUser.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating user role:', updateError);
      return;
    }

    console.log('✓ User role updated successfully');
    console.log(`  Updated role: ${updatedUser.app_role}\n`);

    // Test 4: Query all SLT users
    const { data: sltUsers, error: sltQueryError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, app_role, title')
      .eq('app_role', 'slt')
      .eq('is_active', true);

    if (sltQueryError) {
      console.error('❌ Error querying SLT users:', sltQueryError);
      return;
    }

    console.log(`✓ Found ${sltUsers.length} SLT user(s):`);
    sltUsers.forEach(user => {
      console.log(`  - ${user.full_name} (${user.email})`);
    });

    // Cleanup: Delete test user
    console.log(`\nCleaning up test user...`);
    const { error: deleteError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', newUser.id);

    if (deleteError) {
      console.error('❌ Error deleting test user:', deleteError);
      console.log(`Please manually delete user with ID: ${newUser.id}`);
      return;
    }

    console.log('✓ Test user deleted successfully\n');
    console.log('═══════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('SLT role is working correctly.');
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testSLTRole();
