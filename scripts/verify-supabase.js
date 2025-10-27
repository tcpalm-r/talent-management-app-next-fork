#!/usr/bin/env node
/**
 * Supabase Verification Script
 *
 * Verifies database connection and tests key functionality.
 * Useful for debugging and ensuring proper setup.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

function checkEnvironmentVariables() {
  console.log('📋 Checking environment variables...\n');

  const missing = [];
  const present = [];

  REQUIRED_ENV_VARS.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`  ✓ ${varName}`);
    } else {
      missing.push(varName);
      console.log(`  ✗ ${varName} - MISSING`);
    }
  });

  console.log('');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease add these to your .env.local file.\n');
    return false;
  }

  console.log('✅ All required environment variables are set\n');
  return true;
}

async function testConnection(client, clientName) {
  console.log(`🔌 Testing ${clientName} connection...`);

  try {
    const { data, error } = await client
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error(`  ❌ ${clientName} connection failed:`, error.message);
      return false;
    }

    console.log(`  ✓ ${clientName} connection successful\n`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${clientName} connection error:`, error.message);
    return false;
  }
}

async function testTables(client) {
  console.log('📊 Checking database tables...\n');

  const tables = [
    'user_profiles',
    'employees',
    'performance_reviews',
    'feedback_360_surveys',
    'feedback_360_survey_reviewers',
    'feedback_360_responses',
    'nine_box_assessments',
    'performance_improvement_plans',
    'succession_plans'
  ];

  let allPresent = true;

  for (const table of tables) {
    try {
      const { error } = await client
        .from(table)
        .select('count')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`  ✗ ${table} - NOT FOUND`);
          allPresent = false;
        } else {
          console.log(`  ? ${table} - ${error.message}`);
          allPresent = false;
        }
      } else {
        console.log(`  ✓ ${table}`);
      }
    } catch (error) {
      console.log(`  ✗ ${table} - ERROR: ${error.message}`);
      allPresent = false;
    }
  }

  console.log('');
  return allPresent;
}

async function testQueries(client) {
  console.log('🔍 Testing sample queries...\n');

  try {
    // Test 1: Count user profiles
    const { count: userCount, error: userError } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    if (userError) {
      console.log(`  ✗ User profiles count: ${userError.message}`);
    } else {
      console.log(`  ✓ User profiles count: ${userCount || 0} users`);
    }

    // Test 2: Count employees
    const { count: empCount, error: empError } = await client
      .from('employees')
      .select('*', { count: 'exact', head: true });

    if (empError) {
      console.log(`  ✗ Employees count: ${empError.message}`);
    } else {
      console.log(`  ✓ Employees count: ${empCount || 0} employees`);
    }

    // Test 3: Count 360 surveys
    const { count: surveyCount, error: surveyError } = await client
      .from('feedback_360_surveys')
      .select('*', { count: 'exact', head: true });

    if (surveyError) {
      console.log(`  ✗ 360 surveys count: ${surveyError.message}`);
    } else {
      console.log(`  ✓ 360 surveys count: ${surveyCount || 0} surveys`);
    }

    console.log('');
    return true;
  } catch (error) {
    console.error(`  ❌ Query test failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('\n🔧 Supabase Database Verification\n');
  console.log('='.repeat(50));
  console.log('');

  // Step 1: Check environment variables
  if (!checkEnvironmentVariables()) {
    process.exit(1);
  }

  // Step 2: Create clients
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const anonClient = createClient(supabaseUrl, anonKey);
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Step 3: Test connections
  const anonOk = await testConnection(anonClient, 'Anon client');
  const serviceOk = await testConnection(serviceClient, 'Service client');

  if (!anonOk || !serviceOk) {
    console.error('❌ Connection tests failed\n');
    process.exit(1);
  }

  // Step 4: Test tables
  const tablesOk = await testTables(serviceClient);

  // Step 5: Test queries
  const queriesOk = await testQueries(serviceClient);

  // Summary
  console.log('='.repeat(50));
  console.log('');

  if (tablesOk && queriesOk) {
    console.log('✅ All verification tests passed!\n');
    console.log('Your Supabase database is properly configured and accessible.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some verification tests failed.\n');
    console.log('Please review the errors above and ensure:');
    console.log('1. Your database schema is properly set up');
    console.log('2. RLS policies allow the required access');
    console.log('3. All environment variables are correct\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
