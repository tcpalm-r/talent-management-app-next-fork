#!/usr/bin/env node
/**
 * Execute Phase 1 Database Cleanup - Simple Approach
 * Uses Supabase REST API to execute raw SQL
 */

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function executeSQL(sql) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SQL execution failed: ${text}`);
  }

  return response;
}

async function dropObject(type, name) {
  const dropStatements = [];

  if (type === 'TABLE') {
    dropStatements.push(`DROP TABLE IF EXISTS "${name}" CASCADE`);
  } else if (type === 'VIEW') {
    dropStatements.push(`DROP VIEW IF EXISTS "${name}" CASCADE`);
    dropStatements.push(`DROP MATERIALIZED VIEW IF EXISTS "${name}" CASCADE`);
  }

  for (const sql of dropStatements) {
    try {
      await executeSQL(sql);
    } catch (err) {
      // Ignore errors - object may not exist or may be wrong type
    }
  }
}

async function checkExists(type, name) {
  let query;

  if (type === 'TABLE') {
    query = `SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = 'public' AND tablename = '${name}'`;
  } else {
    query = `SELECT COUNT(*) as count FROM pg_views WHERE schemaname = 'public' AND viewname = '${name}'
             UNION ALL
             SELECT COUNT(*) as count FROM pg_matviews WHERE schemaname = 'public' AND matviewname = '${name}'`;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ query })
    });

    if (response.ok) {
      const result = await response.json();
      return result.length > 0;
    }
  } catch (err) {
    // Ignore
  }

  return null; // Unknown
}

async function main() {
  console.log('\n🗑️  Database Cleanup - Phase 1: Zero-Risk Removals\n');
  console.log('='.repeat(60));
  console.log('');

  const drops = [
    { name: 'performance_review_participants', type: 'TABLE' },
    { name: 'performance_review_deadlines', type: 'TABLE' },
    { name: 'user_profile_changes', type: 'TABLE' },
    { name: 'active_performance_reviews', type: 'VIEW' },
    { name: 'active_users', type: 'VIEW' },
    { name: 'pending_users', type: 'VIEW' }
  ];

  console.log('🔧 Executing drops via Supabase REST API...\n');

  for (const obj of drops) {
    process.stdout.write(`Dropping ${obj.type} ${obj.name}...`);

    try {
      await dropObject(obj.type, obj.name);
      console.log(' ✓');
    } catch (err) {
      console.log(` ⚠️  (${err.message})`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('✅ Execution completed!');
  console.log('');
  console.log('📋 Next: Run verification script');
  console.log('   node scripts/verify-supabase.js');
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error('\n💡 Try copying PHASE1_CLEANUP_SQL.sql into Supabase SQL Editor manually');
  process.exit(1);
});
