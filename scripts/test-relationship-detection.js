#!/usr/bin/env node

/**
 * Test Script: Relationship Detection Logic
 *
 * This script tests the relationship detection logic against real data in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Replicate the detectRelationship logic
function detectRelationship(subject, reviewer) {
  // Rule 1: Is the reviewer the subject's manager?
  if (subject.manager_id && reviewer.id === subject.manager_id) {
    return 'manager';
  }

  // Rule 2: Is the reviewer a direct report of the subject?
  if (reviewer.manager_id && reviewer.manager_id === subject.id) {
    return 'direct_report';
  }

  // Rule 3: Is the reviewer an SLT member?
  if (reviewer.app_role === 'slt') {
    return 'slt';
  }

  // Rule 4: Default to cross-functional
  return 'cross_functional';
}

async function testRelationshipDetection() {
  console.log('🔍 Testing Relationship Detection Logic\n');

  try {
    // Fetch all active users
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    console.log(`📊 Found ${users.length} active users\n`);

    // Pick a test subject (use Elliott Amador if available, otherwise first user)
    let subject = users.find(u => u.full_name === 'Elliott Amador') || users[0];

    if (!subject) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`🎯 Testing relationships for: ${subject.full_name}`);
    console.log(`   Email: ${subject.email}`);
    console.log(`   Manager ID: ${subject.manager_id || 'N/A'}`);
    console.log(`   Role: ${subject.app_role || 'N/A'}\n`);

    // Categorize all other users by relationship
    const relationships = {
      manager: [],
      slt: [],
      direct_report: [],
      cross_functional: []
    };

    users.forEach(user => {
      if (user.id === subject.id) return; // Skip subject

      const relationship = detectRelationship(subject, user);
      relationships[relationship].push({
        name: user.full_name,
        email: user.email,
        title: user.title,
        role: user.app_role,
        manager_id: user.manager_id
      });
    });

    // Display results
    console.log('📋 Relationship Detection Results:\n');

    console.log(`👔 Manager (${relationships.manager.length}):`);
    if (relationships.manager.length > 0) {
      relationships.manager.forEach(u => {
        console.log(`   - ${u.name} (${u.email})`);
        console.log(`     Title: ${u.title || 'N/A'}`);
      });
    } else {
      console.log('   (None found)');
    }
    console.log('');

    console.log(`🎖️  SLT Members (${relationships.slt.length}):`);
    if (relationships.slt.length > 0) {
      relationships.slt.forEach(u => {
        console.log(`   - ${u.name} (${u.email})`);
        console.log(`     Role: ${u.role}`);
      });
    } else {
      console.log('   (None found)');
    }
    console.log('');

    console.log(`👥 Direct Reports (${relationships.direct_report.length}):`);
    if (relationships.direct_report.length > 0) {
      relationships.direct_report.forEach(u => {
        console.log(`   - ${u.name} (${u.email})`);
        console.log(`     Title: ${u.title || 'N/A'}`);
      });
    } else {
      console.log('   (None found)');
    }
    console.log('');

    console.log(`🤝 Cross-Functional Colleagues (${relationships.cross_functional.length}):`);
    if (relationships.cross_functional.length > 0) {
      relationships.cross_functional.slice(0, 5).forEach(u => {
        console.log(`   - ${u.name} (${u.email})`);
        console.log(`     Title: ${u.title || 'N/A'}`);
      });
      if (relationships.cross_functional.length > 5) {
        console.log(`   ... and ${relationships.cross_functional.length - 5} more`);
      }
    } else {
      console.log('   (None found)');
    }
    console.log('');

    // Summary
    console.log('📊 Summary:');
    console.table({
      Manager: relationships.manager.length,
      SLT: relationships.slt.length,
      'Direct Reports': relationships.direct_report.length,
      'Cross-Functional': relationships.cross_functional.length,
      Total: users.length - 1 // Exclude subject
    });

    console.log('\n✅ Relationship detection test complete!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testRelationshipDetection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
