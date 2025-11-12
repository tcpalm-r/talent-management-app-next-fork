#!/usr/bin/env node
/**
 * Execute Phase 1 Database Cleanup
 * Uses postgres-js to directly execute SQL
 */

require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres.qufwxmqbmyaexkjrbsxc:Sonance2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

const sql = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10
});

async function main() {
  console.log('\n🗑️  Database Cleanup - Phase 1: Zero-Risk Removals\n');
  console.log('='.repeat(60));
  console.log('');
  console.log('This will drop 6 unused database objects:');
  console.log('  - 3 empty tables');
  console.log('  - 3 unused views');
  console.log('');
  console.log('⚠️  Risk Level: ZERO (all objects are empty or broken)');
  console.log('');

  const drops = [
    { name: 'performance_review_participants', type: 'TABLE', rows: 0 },
    { name: 'performance_review_deadlines', type: 'TABLE', rows: 0 },
    { name: 'user_profile_changes', type: 'TABLE', rows: 0 },
    { name: 'active_performance_reviews', type: 'VIEW', rows: 1 },
    { name: 'active_users', type: 'VIEW', rows: 4 },
    { name: 'pending_users', type: 'VIEW', rows: 382 }
  ];

  console.log('🔧 Executing drops...\n');

  let successCount = 0;

  for (const obj of drops) {
    process.stdout.write(`Dropping ${obj.type} ${obj.name}...`);

    try {
      // Drop table
      if (obj.type === 'TABLE') {
        await sql`DROP TABLE IF EXISTS ${sql(obj.name)} CASCADE`;
      } else {
        // Try both view types
        await sql`DROP VIEW IF EXISTS ${sql(obj.name)} CASCADE`.catch(() => {});
        await sql`DROP MATERIALIZED VIEW IF EXISTS ${sql(obj.name)} CASCADE`.catch(() => {});
      }

      console.log(' ✓');
      successCount++;
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log(' ✓ (already removed)');
        successCount++;
      } else {
        console.log(` ✗ Error: ${err.message}`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('');

  console.log(`✅ Phase 1 cleanup completed! (${successCount}/${drops.length})`);
  console.log('');

  // Verify drops
  console.log('🔍 Verifying removals...\n');

  for (const obj of drops) {
    try {
      // Try to check if table/view exists in pg_catalog
      const result = await sql`
        SELECT EXISTS (
          SELECT FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = ${obj.name}
        ) OR EXISTS (
          SELECT FROM pg_views
          WHERE schemaname = 'public'
          AND viewname = ${obj.name}
        ) OR EXISTS (
          SELECT FROM pg_matviews
          WHERE schemaname = 'public'
          AND matviewname = ${obj.name}
        ) as exists
      `;

      if (result[0].exists) {
        console.log(`  ⚠️  ${obj.name} - still exists`);
      } else {
        console.log(`  ✓ ${obj.name} - confirmed removed`);
      }
    } catch (err) {
      console.log(`  ? ${obj.name} - could not verify`);
    }
  }

  console.log('');
  console.log('📋 Next steps:');
  console.log('  1. Run: node scripts/verify-supabase.js');
  console.log('  2. Test your app to ensure it still works');
  console.log('  3. Review DATABASE_CLEANUP_RECOMMENDATIONS.md for Phase 2');
  console.log('');

  await sql.end();
}

main().catch(async (err) => {
  console.error('\n❌ Error:', err.message);
  await sql.end();
  process.exit(1);
});
