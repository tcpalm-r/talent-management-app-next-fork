#!/usr/bin/env node

/**
 * Script to check users and relationships in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('\n📊 CHECKING USERS AND RELATIONSHIPS IN SUPABASE\n');

  // Get all active users
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, department, title, manager_id, app_role, role, is_active')
    .eq('is_active', true)
    .order('full_name');

  if (usersError) {
    console.error('Error fetching users:', usersError);
    process.exit(1);
  }

  console.log(`✅ Found ${users.length} active users:\n`);
  console.table(users);

  // Show manager relationships
  console.log('\n👥 MANAGER RELATIONSHIPS:\n');
  const usersWithManagers = users.filter(u => u.manager_id);

  if (usersWithManagers.length === 0) {
    console.log('⚠️  No manager relationships found');
  } else {
    for (const user of usersWithManagers) {
      const manager = users.find(u => u.id === user.manager_id);
      console.log(`${user.full_name} → Manager: ${manager?.full_name || 'Unknown'}`);
    }
  }

  console.log('\n');
}

checkUsers().catch(console.error);
