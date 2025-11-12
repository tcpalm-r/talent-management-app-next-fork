#!/usr/bin/env node
/**
 * Database Usage Analysis Script
 *
 * This script catalogs all database objects (tables, views, materialized views)
 * and identifies which ones are actually used in the codebase.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Get all tables from information_schema
async function getAllTables() {
  const { data, error } = await client.rpc('get_all_tables_info');

  if (error) {
    // Fallback to a basic query
    const query = `
      SELECT
        table_name,
        'table' as table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const { data: fallbackData, error: fallbackError } = await client.rpc('sql', { query });

    if (fallbackError) {
      console.error('Error fetching tables:', fallbackError);
      return [];
    }

    return fallbackData || [];
  }

  return data || [];
}

// Get all views
async function getAllViews() {
  const query = `
    SELECT
      table_name,
      CASE
        WHEN table_type = 'VIEW' THEN 'view'
        WHEN table_type = 'MATERIALIZED VIEW' THEN 'materialized_view'
        ELSE table_type
      END as view_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type IN ('VIEW', 'MATERIALIZED VIEW')
    ORDER BY table_name;
  `;

  try {
    // Try raw SQL query
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ query })
    });

    if (response.ok) {
      const data = await response.json();
      return data || [];
    }
  } catch (err) {
    console.log('Could not fetch views via RPC');
  }

  return [];
}

// Test if a table/view exists
async function testTableExists(tableName) {
  try {
    const { error } = await client
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('Could not find')) {
        return false;
      }
      // Other errors might mean it exists but has permission issues
      return 'unknown';
    }

    return true;
  } catch (err) {
    return 'unknown';
  }
}

// Get row count for a table
async function getRowCount(tableName) {
  try {
    const { count, error } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return null;
    }

    return count;
  } catch (err) {
    return null;
  }
}

// Search codebase for table references
function searchCodebase(tableName) {
  const references = [];
  const searchPattern = new RegExp(`\\.from\\(['"\`]${tableName}['"\`]\\)`, 'g');

  function searchDirectory(dir, relativeBase = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(relativeBase, entry.name);

      // Skip node_modules, .next, .git
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
        continue;
      }

      if (entry.isDirectory()) {
        searchDirectory(fullPath, relativePath);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const matches = content.match(searchPattern);

          if (matches) {
            references.push({
              file: relativePath,
              count: matches.length
            });
          }
        } catch (err) {
          // Skip files that can't be read
        }
      }
    }
  }

  const projectRoot = path.resolve(__dirname, '..');
  searchDirectory(projectRoot);

  return references;
}

async function main() {
  console.log('\n📊 Database Usage Analysis\n');
  console.log('='.repeat(70));
  console.log('');

  // Known tables from schema and verification script
  const knownTables = [
    'user_profiles',
    'employees',
    'performance_reviews',
    'performance_review_participants',
    'performance_review_deadlines',
    'ideal_team_player_matrix',
    'assessments',
    'assessment_responses',
    'feedback_360_questions',
    'feedback_360_surveys',
    'feedback_360_survey_questions',
    'feedback_360_survey_reviewers',
    'feedback_360_responses',
    'feedback_360_reports',
    'nine_box_assessments',
    'performance_improvement_plans',
    'succession_plans',
    'hr_modules',
    'sync_history',
    'user_profile_changes',
    'departments',
    'active_users',
    'pending_users',
    'active_performance_reviews'
  ];

  console.log('🔍 Analyzing database objects...\n');

  const results = [];

  for (const tableName of knownTables) {
    process.stdout.write(`Checking ${tableName}...`);

    const exists = await testTableExists(tableName);
    const rowCount = exists === true ? await getRowCount(tableName) : null;
    const codeRefs = searchCodebase(tableName);

    results.push({
      name: tableName,
      exists: exists,
      rowCount: rowCount,
      codeReferences: codeRefs.length,
      files: codeRefs
    });

    console.log(` ✓`);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('\n📋 Analysis Results\n');

  // Category 1: Tables that don't exist but are referenced in code
  const missingButReferenced = results.filter(r => r.exists === false && r.codeReferences > 0);

  if (missingButReferenced.length > 0) {
    console.log('❌ MISSING TABLES (referenced in code but don\'t exist in database):');
    console.log('');
    missingButReferenced.forEach(r => {
      console.log(`  ${r.name}`);
      console.log(`    References: ${r.codeReferences} files`);
      r.files.forEach(f => console.log(`      - ${f.file} (${f.count} times)`));
      console.log('');
    });
  }

  // Category 2: Tables that exist but are NOT referenced in code (DEAD TABLES)
  const existsButUnused = results.filter(r => r.exists === true && r.codeReferences === 0);

  if (existsButUnused.length > 0) {
    console.log('🗑️  DEAD TABLES (exist in database but not used in code):');
    console.log('');
    existsButUnused.forEach(r => {
      console.log(`  ${r.name}`);
      console.log(`    Row count: ${r.rowCount === null ? 'unknown' : r.rowCount}`);
      console.log(`    ⚠️  CANDIDATE FOR REMOVAL`);
      console.log('');
    });
  }

  // Category 3: Tables that exist with 0 rows and minimal references (POTENTIAL DEAD)
  const existsEmptyLowUse = results.filter(r =>
    r.exists === true &&
    r.rowCount === 0 &&
    r.codeReferences > 0 &&
    r.codeReferences < 3
  );

  if (existsEmptyLowUse.length > 0) {
    console.log('⚠️  POTENTIALLY DEAD TABLES (empty with minimal usage):');
    console.log('');
    existsEmptyLowUse.forEach(r => {
      console.log(`  ${r.name}`);
      console.log(`    Row count: 0`);
      console.log(`    References: ${r.codeReferences} files`);
      r.files.forEach(f => console.log(`      - ${f.file}`));
      console.log('');
    });
  }

  // Category 4: Healthy tables (exist, have data, are used)
  const healthy = results.filter(r =>
    r.exists === true &&
    r.codeReferences > 0 &&
    (r.rowCount === null || r.rowCount > 0)
  );

  console.log('✅ ACTIVE TABLES (in use):');
  console.log('');
  healthy.forEach(r => {
    console.log(`  ${r.name}`);
    console.log(`    Rows: ${r.rowCount === null ? 'unknown' : r.rowCount}`);
    console.log(`    Code refs: ${r.codeReferences} files`);
  });

  console.log('');
  console.log('='.repeat(70));
  console.log('\n📊 Summary Statistics\n');

  console.log(`Total tables analyzed: ${results.length}`);
  console.log(`Active & healthy: ${healthy.length}`);
  console.log(`Dead (unused): ${existsButUnused.length}`);
  console.log(`Potentially dead (empty): ${existsEmptyLowUse.length}`);
  console.log(`Missing but referenced: ${missingButReferenced.length}`);

  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'DATABASE_USAGE_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: DATABASE_USAGE_REPORT.json\n`);
}

main().catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
