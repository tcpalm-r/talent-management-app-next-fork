#!/usr/bin/env node

/**
 * Simplified Database Analysis using Supabase Client
 *
 * Uses Supabase REST API to query information_schema and pg_catalog
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 Supabase Database Analysis\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Scan codebase for table references
function scanCodebaseForTableUsage() {
  const tableReferences = {};
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.sql'];

  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        try {
          const stat = fs.statSync(fullPath);

          // Skip node_modules, .next, etc.
          if (item === 'node_modules' || item === '.next' || item === '.git' || item === 'dist') {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (extensions.some(ext => item.endsWith(ext))) {
            const content = fs.readFileSync(fullPath, 'utf8');

            // Look for .from('table_name') patterns
            const fromMatches = content.matchAll(/\.from\(['"`]([a-z_0-9]+)['"`]\)/gi);

            for (const match of fromMatches) {
              const tableName = match[1];
              if (!tableReferences[tableName]) {
                tableReferences[tableName] = [];
              }
              if (!tableReferences[tableName].includes(fullPath)) {
                tableReferences[tableName].push(fullPath.replace(process.cwd(), ''));
              }
            }
          }
        } catch (err) {
          // Skip files/dirs we can't access
        }
      }
    } catch (err) {
      // Skip directories we can't access
    }
  }

  scanDirectory(process.cwd());
  return tableReferences;
}

async function analyzeDatabase() {
  const report = {
    timestamp: new Date().toISOString(),
    database: supabaseUrl,
    sections: {}
  };

  // Get list of all tables using Supabase
  console.log('📊 Section 1: Fetching Tables & Basic Info...\n');

  try {
    // Query user_profiles table to get table list (workaround)
    // We'll use information from the database module
    const { data: userProfiles, error: upError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (!upError) {
      console.log('  ✓ Connection verified\n');
    }

    // Complete list of base tables from Supabase dashboard (17 base tables)
    const baseTables = [
      'user_profiles',
      'assessment_responses',
      'box_definitions',
      'departments',
      'feedback_360_questions',
      'feedback_360_reports',
      'feedback_360_responses',
      'feedback_360_survey_questions',
      'feedback_360_survey_reviewers',
      'feedback_360_surveys',
      'hr_modules',
      'ideal_team_player_matrix',
      'itp_assessments',
      'organizations',
      'performance_reviews',
      'sync_history',
      'talent_grid_assessments'
    ];

    // Materialized views (1)
    const materializedViews = [
      'employees'
    ];

    // Regular views (3)
    const views = [
      'assessments',
      'feedback_360_question_usage_stats',
      'recent_syncs'
    ];

    // All tables to analyze
    const knownTables = [...baseTables, ...materializedViews, ...views];

    console.log('📊 Section 2: Analyzing Table Usage...\n');

    const tableAnalysis = [];

    for (const tableName of knownTables) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          tableAnalysis.push({
            table: tableName,
            rowCount: count,
            accessible: true
          });
          console.log(`  ✓ ${tableName}: ${count} rows`);
        } else {
          tableAnalysis.push({
            table: tableName,
            rowCount: 0,
            accessible: false,
            error: error.message
          });
          console.log(`  ⚠️  ${tableName}: ${error.message}`);
        }
      } catch (err) {
        tableAnalysis.push({
          table: tableName,
          rowCount: 0,
          accessible: false,
          error: err.message
        });
        console.log(`  ❌ ${tableName}: ${err.message}`);
      }
    }

    report.sections.tableAnalysis = tableAnalysis;

    // Scan codebase for references
    console.log('\n📊 Section 3: Scanning Codebase for Table References...\n');
    const codebaseReferences = scanCodebaseForTableUsage();

    const referenceCounts = Object.entries(codebaseReferences).map(([table, files]) => ({
      table,
      fileCount: files.length,
      files: files.slice(0, 5) // First 5 files only
    })).sort((a, b) => b.fileCount - a.fileCount);

    console.log('  Top referenced tables:');
    referenceCounts.slice(0, 10).forEach(({ table, fileCount }) => {
      console.log(`    • ${table}: ${fileCount} files`);
    });

    report.sections.codebaseReferences = referenceCounts;

    // Find unused tables
    console.log('\n📊 Section 4: Identifying Unused Tables...\n');

    const unusedTables = tableAnalysis.filter(t => {
      const hasCodeReferences = codebaseReferences[t.table] && codebaseReferences[t.table].length > 0;
      const hasRows = t.rowCount > 0;
      return !hasCodeReferences && !hasRows && t.accessible;
    });

    const lowUsageTables = tableAnalysis.filter(t => {
      const hasCodeReferences = codebaseReferences[t.table] && codebaseReferences[t.table].length > 0;
      const hasLowRows = t.rowCount < 5;
      return !hasCodeReferences || hasLowRows;
    });

    console.log(`  ⚠️  Found ${unusedTables.length} completely unused tables`);
    unusedTables.forEach(t => console.log(`    • ${t.table}`));

    console.log(`\n  ⚠️  Found ${lowUsageTables.length} low-usage tables`);
    lowUsageTables.slice(0, 5).forEach(t =>
      console.log(`    • ${t.table}: ${t.rowCount} rows, ${codebaseReferences[t.table]?.length || 0} code refs`)
    );

    report.sections.unusedTables = unusedTables;
    report.sections.lowUsageTables = lowUsageTables;

    // Security check - try to access tables and see what fails
    console.log('\n📊 Section 5: RLS Policy Check...\n');

    const rlsCheck = [];
    for (const tableName of knownTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (error) {
          rlsCheck.push({
            table: tableName,
            accessible: false,
            error: error.message,
            possibleRLS: error.message.includes('policy') || error.message.includes('permission')
          });
          if (error.message.includes('policy') || error.message.includes('permission')) {
            console.log(`  🔒 ${tableName}: RLS policy may be blocking access`);
          }
        } else {
          rlsCheck.push({
            table: tableName,
            accessible: true
          });
          console.log(`  ✓ ${tableName}: Accessible`);
        }
      } catch (err) {
        rlsCheck.push({
          table: tableName,
          accessible: false,
          error: err.message
        });
      }
    }

    report.sections.rlsCheck = rlsCheck;

    // Executive Summary
    const accessibleTables = tableAnalysis.filter(t => t.accessible).length;
    const totalRows = tableAnalysis.reduce((sum, t) => sum + (t.rowCount || 0), 0);
    const tablesWithCodeRefs = Object.keys(codebaseReferences).length;
    const rlsProtected = rlsCheck.filter(t => t.possibleRLS).length;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 EXECUTIVE SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Database Objects:`);
    console.log(`  • Base Tables: ${baseTables.length}`);
    console.log(`  • Materialized Views: ${materializedViews.length}`);
    console.log(`  • Views: ${views.length}`);
    console.log(`  • Total: ${knownTables.length}`);
    console.log('');
    console.log(`Status:`);
    console.log(`  • Accessible: ${accessibleTables}/${knownTables.length}`);
    console.log(`  • Total Rows: ${totalRows.toLocaleString()}`);
    console.log(`  • Referenced in Code: ${tablesWithCodeRefs}`);
    console.log('');
    console.log('ISSUES:');
    console.log(`  ⚠️  Unused Tables: ${unusedTables.length}`);
    console.log(`  ⚠️  Low-Usage Tables: ${lowUsageTables.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    report.executiveSummary = {
      baseTables: baseTables.length,
      materializedViews: materializedViews.length,
      views: views.length,
      totalObjects: knownTables.length,
      accessibleTables,
      totalRows,
      tablesWithCodeReferences: tablesWithCodeRefs,
      rlsProtectedTables: rlsProtected,
      unusedTablesCount: unusedTables.length,
      lowUsageTablesCount: lowUsageTables.length
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'DATABASE_ANALYSIS_SIMPLE.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Report saved to: ${reportPath}\n`);

  } catch (err) {
    console.error(`❌ Analysis error: ${err.message}`);
    report.error = err.message;
  }

  return report;
}

analyzeDatabase()
  .then(() => {
    console.log('✅ Analysis complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
