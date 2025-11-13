#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Database 1: ynycbfyzbavbgxvniylt (current local)
const db1Url = 'https://ynycbfyzbavbgxvniylt.supabase.co';
const db1Key = process.argv[2]; // Pass as argument

// Database 2: naakxqtoskqnbvnpievj (current production)
const db2Url = 'https://naakxqtoskqnbvnpievj.supabase.co';
const db2Key = process.argv[3]; // Pass as argument

if (!db1Key || !db2Key) {
  console.error('Usage: node scripts/compare-databases.js <db1-service-key> <db2-service-key>');
  console.error('');
  console.error('DB1 (ynycbfyzbavbgxvniylt): Current LOCAL database');
  console.error('DB2 (naakxqtoskqnbvnpievj): Current PRODUCTION database');
  process.exit(1);
}

const db1 = createClient(db1Url, db1Key);
const db2 = createClient(db2Url, db2Key);

async function compare() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   COMPARING TWO SUPABASE DATABASES                    ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Compare surveys
  console.log('📋 SURVEYS COMPARISON:');
  console.log('─'.repeat(60));
  
  const { data: db1Surveys } = await db1
    .from('feedback_360_surveys')
    .select('id, survey_name, status, created_at');
  
  const { data: db2Surveys } = await db2
    .from('feedback_360_surveys')
    .select('id, survey_name, status, created_at');

  console.log(`\nDB1 (ynycbfyzbavbgxvniylt - LOCAL):`);
  console.log(`  ${db1Surveys?.length || 0} surveys`);
  db1Surveys?.slice(0, 5).forEach(s => {
    console.log(`  - ${s.survey_name} (${s.status})`);
  });

  console.log(`\nDB2 (naakxqtoskqnbvnpievj - PRODUCTION):`);
  console.log(`  ${db2Surveys?.length || 0} surveys`);
  db2Surveys?.slice(0, 5).forEach(s => {
    console.log(`  - ${s.survey_name} (${s.status})`);
  });

  // Compare user profiles
  console.log('\n\n👥 USER PROFILES COMPARISON:');
  console.log('─'.repeat(60));
  
  const { count: db1UserCount } = await db1
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });
  
  const { count: db2UserCount } = await db2
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  console.log(`\nDB1 (LOCAL): ${db1UserCount} user profiles`);
  console.log(`DB2 (PRODUCTION): ${db2UserCount} user profiles`);

  // Check for Thomas Palmer in both
  console.log('\n\n🔍 THOMAS PALMER IN BOTH DATABASES:');
  console.log('─'.repeat(60));

  const { data: db1Thomas } = await db1
    .from('user_profiles')
    .select('*')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  const { data: db2Thomas } = await db2
    .from('user_profiles')
    .select('*')
    .eq('email', 'thomas.palmer@sonance.com')
    .single();

  console.log('\nDB1 (LOCAL):');
  if (db1Thomas) {
    console.log(`  ✓ Found: ${db1Thomas.full_name}`);
    console.log(`    ID: ${db1Thomas.id}`);
    console.log(`    Role: ${db1Thomas.app_role}`);
  } else {
    console.log('  ✗ Not found');
  }

  console.log('\nDB2 (PRODUCTION):');
  if (db2Thomas) {
    console.log(`  ✓ Found: ${db2Thomas.full_name}`);
    console.log(`    ID: ${db2Thomas.id}`);
    console.log(`    Role: ${db2Thomas.app_role}`);
  } else {
    console.log('  ✗ Not found');
  }

  // Recommendation
  console.log('\n\n💡 RECOMMENDATION:');
  console.log('─'.repeat(60));
  
  if (db1UserCount > db2UserCount && db1Surveys?.length > db2Surveys?.length) {
    console.log('DB1 (ynycbfyzbavbgxvniylt) appears to be the MAIN database.');
    console.log('→ Update Vercel to use DB1 for production.');
  } else if (db2UserCount > db1UserCount && db2Surveys?.length > db1Surveys?.length) {
    console.log('DB2 (naakxqtoskqnbvnpievj) appears to be the MAIN database.');
    console.log('→ Update .env.local to use DB2 for local development.');
  } else {
    console.log('⚠️  Unclear which is the main database.');
    console.log('   Review the data and decide which has the correct production data.');
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   COMPARISON COMPLETE                                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
}

compare().catch(console.error);

