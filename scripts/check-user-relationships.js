#!/usr/bin/env node

/**
 * Script to check Thomas Palmer's relationships
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRelationships() {
  console.log('\n👤 LOOKING FOR THOMAS PALMER IN DATABASE\n');

  // Find Thomas Palmer
  const { data: thomasData } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, department, title, manager_id, app_role, role')
    .eq('full_name', 'Thomas Palmer')
    .eq('is_active', true);

  if (!thomasData || thomasData.length === 0) {
    console.log('⚠️  Thomas Palmer not found in database');
    return;
  }

  const thomas = thomasData[0];
  console.log('✅ Found Thomas Palmer:');
  console.log(`   Email: ${thomas.email}`);
  console.log(`   Department: ${thomas.department}`);
  console.log(`   Title: ${thomas.title}`);
  console.log(`   App Role: ${thomas.app_role}`);
  console.log(`   360 Role: ${thomas.role || 'N/A'}\n`);

  // Find Thomas's manager
  if (thomas.manager_id) {
    const { data: managerData } = await supabase
      .from('user_profiles')
      .select('full_name, email, title')
      .eq('id', thomas.manager_id)
      .single();

    if (managerData) {
      console.log(`👔 Manager: ${managerData.full_name} (${managerData.email})`);
      console.log(`   Title: ${managerData.title}\n`);
    }
  }

  // Find direct reports (people who report to Thomas)
  const { data: directReports } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, title, department')
    .eq('manager_id', thomas.id)
    .eq('is_active', true)
    .order('full_name');

  console.log(`👥 Direct Reports (${directReports.length}):`);
  if (directReports.length === 0) {
    console.log('   None');
  } else {
    directReports.forEach(report => {
      console.log(`   • ${report.full_name} (${report.email}) - ${report.title}`);
    });
  }

  // Find peers (same manager as Thomas)
  if (thomas.manager_id) {
    const { data: peers } = await supabase
      .from('user_profiles')
      .select('full_name, email, title')
      .eq('manager_id', thomas.manager_id)
      .neq('id', thomas.id)
      .eq('is_active', true)
      .order('full_name');

    console.log(`\n👫 Peers (same manager) (${peers.length}):`);
    if (peers.length === 0) {
      console.log('   None');
    } else {
      peers.forEach(peer => {
        console.log(`   • ${peer.full_name} (${peer.email}) - ${peer.title}`);
      });
    }
  }

  console.log('\n');
}

checkRelationships().catch(console.error);
