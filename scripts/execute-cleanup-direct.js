#!/usr/bin/env node
/**
 * Execute Phase 1 Database Cleanup - Direct SQL Execution
 * Uses Supabase admin client with direct SQL
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function main() {
  console.log('\n🗑️  Database Cleanup - Phase 1\n');
  console.log('='.repeat(60));
  console.log('');

  const commands = [
    { sql: 'DROP TABLE IF EXISTS performance_review_participants CASCADE', desc: 'performance_review_participants (table)' },
    { sql: 'DROP TABLE IF EXISTS performance_review_deadlines CASCADE', desc: 'performance_review_deadlines (table)' },
    { sql: 'DROP TABLE IF EXISTS user_profile_changes CASCADE', desc: 'user_profile_changes (table)' },
    { sql: 'DROP VIEW IF EXISTS active_performance_reviews CASCADE', desc: 'active_performance_reviews (view)' },
    { sql: 'DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews CASCADE', desc: 'active_performance_reviews (mat view)' },
    { sql: 'DROP VIEW IF EXISTS active_users CASCADE', desc: 'active_users (view)' },
    { sql: 'DROP MATERIALIZED VIEW IF EXISTS active_users CASCADE', desc: 'active_users (mat view)' },
    { sql: 'DROP VIEW IF EXISTS pending_users CASCADE', desc: 'pending_users (view)' },
    { sql: 'DROP MATERIALIZED VIEW IF EXISTS pending_users CASCADE', desc: 'pending_users (mat view)' }
  ];

  console.log('⚠️  IMPORTANT: This requires SQL execution permissions');
  console.log('If this fails, copy PHASE1_CLEANUP_SQL.sql to Supabase SQL Editor\n');
  console.log('Attempting to execute via Supabase client...\n');

  // Try using the sql` tagged template if available
  try {
    // Check if we can access the SQL executor
    const testQuery = `SELECT 1 as test`;

    // Supabase doesn't expose raw SQL execution via JS client for security
    console.log('❌ Direct SQL execution not available via Supabase JS client\n');
    console.log('📋 NEXT STEPS:\n');
    console.log('1. Open Supabase Dashboard → SQL Editor');
    console.log('2. Copy the contents of PHASE1_CLEANUP_SQL.sql');
    console.log('3. Paste and run in SQL Editor');
    console.log('');
    console.log('OR use this single command:');
    console.log('');
    console.log('```sql');
    console.log('-- Phase 1 Cleanup');
    console.log('DROP TABLE IF EXISTS performance_review_participants CASCADE;');
    console.log('DROP TABLE IF EXISTS performance_review_deadlines CASCADE;');
    console.log('DROP TABLE IF EXISTS user_profile_changes CASCADE;');
    console.log('DROP VIEW IF EXISTS active_performance_reviews CASCADE;');
    console.log('DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews CASCADE;');
    console.log('DROP VIEW IF EXISTS active_users CASCADE;');
    console.log('DROP MATERIALIZED VIEW IF EXISTS active_users CASCADE;');
    console.log('DROP VIEW IF EXISTS pending_users CASCADE;');
    console.log('DROP MATERIALIZED VIEW IF EXISTS pending_users CASCADE;');
    console.log('```');
    console.log('');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
