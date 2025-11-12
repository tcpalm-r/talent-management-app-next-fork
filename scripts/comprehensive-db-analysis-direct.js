#!/usr/bin/env node

/**
 * Comprehensive Supabase Database Analysis Script (Direct Connection)
 *
 * Analyzes:
 * 1. Complete table structure with relationships
 * 2. Tables without proper indexes
 * 3. Unused or orphaned tables
 * 4. Missing RLS policies and security gaps
 * 5. Schema inconsistencies and normalization issues
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse connection string from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Extract project ID from Supabase URL
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectId) {
  console.error('❌ Could not extract project ID from Supabase URL');
  process.exit(1);
}

// Create PostgreSQL connection string using the Supabase pooler
// Use the known working connection string from earlier scripts
const connectionString = "postgresql://postgres.qufwxmqbmyaexkjrbsxc:Sonance2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres";

console.log(`🔗 Connecting to database...`);
console.log(`   Project: ${projectId}`);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Test connection
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected successfully\n`);
    return true;
  } catch (err) {
    console.error(`❌ Database connection failed: ${err.message}`);
    console.error(`\nPlease ensure you have the correct DATABASE_URL or SUPABASE_DB_PASSWORD set in .env.local`);
    return false;
  }
}

// Scan codebase for table references
function scanCodebaseForTableUsage() {
  const tableReferences = {};
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.sql'];

  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        // Skip node_modules, .next, etc.
        if (item === 'node_modules' || item === '.next' || item === '.git' || item === 'dist') {
          continue;
        }

        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');

            // Look for .from('table_name') or .table('table_name') patterns
            const fromMatches = content.matchAll(/\.from\(['"`]([a-z_0-9]+)['"`]\)/gi);
            const tableMatches = content.matchAll(/\.table\(['"`]([a-z_0-9]+)['"`]\)/gi);

            for (const match of [...fromMatches, ...tableMatches]) {
              const tableName = match[1];
              if (!tableReferences[tableName]) {
                tableReferences[tableName] = [];
              }
              tableReferences[tableName].push(fullPath.replace(process.cwd(), ''));
            }
          } catch (err) {
            // Skip files we can't read
          }
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
  console.log('🔍 Starting Comprehensive Database Analysis...\n');

  const report = {
    timestamp: new Date().toISOString(),
    database: supabaseUrl,
    sections: {}
  };

  // ============================================================
  // 1. COMPLETE TABLE STRUCTURE WITH RELATIONSHIPS
  // ============================================================
  console.log('📊 Section 1: Analyzing Table Structure & Relationships...');

  try {
    // Get all tables and columns
    const tableStructureQuery = `
      SELECT
        t.table_schema,
        t.table_name,
        t.table_type,
        c.column_name,
        c.data_type,
        c.column_default,
        c.is_nullable,
        c.character_maximum_length,
        tc.constraint_type,
        kcu.constraint_name
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON t.table_name = c.table_name
        AND t.table_schema = c.table_schema
      LEFT JOIN information_schema.key_column_usage kcu
        ON c.column_name = kcu.column_name
        AND c.table_name = kcu.table_name
        AND c.table_schema = kcu.table_schema
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE t.table_schema = 'public'
        AND t.table_type IN ('BASE TABLE', 'VIEW', 'MATERIALIZED VIEW')
      ORDER BY t.table_type, t.table_name, c.ordinal_position;
    `;

    const tableResult = await pool.query(tableStructureQuery);
    const tableData = tableResult.rows;

    // Get foreign keys
    const foreignKeysQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;

    const fkResult = await pool.query(foreignKeysQuery);
    const fkData = fkResult.rows;

    // Organize data
    const tables = {};

    tableData.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = {
          name: row.table_name,
          type: row.table_type,
          columns: [],
          primaryKeys: [],
          foreignKeys: []
        };
      }

      if (row.column_name) {
        tables[row.table_name].columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
          maxLength: row.character_maximum_length
        });

        if (row.constraint_type === 'PRIMARY KEY') {
          tables[row.table_name].primaryKeys.push(row.column_name);
        }
      }
    });

    // Add foreign key relationships
    fkData.forEach(fk => {
      if (tables[fk.table_name]) {
        tables[fk.table_name].foreignKeys.push({
          column: fk.column_name,
          references: {
            table: fk.foreign_table_name,
            column: fk.foreign_column_name
          },
          onUpdate: fk.update_rule,
          onDelete: fk.delete_rule
        });
      }
    });

    report.sections.tableStructure = {
      totalTables: Object.keys(tables).length,
      tables: tables,
      foreignKeyCount: fkData.length
    };

    console.log(`  ✓ Found ${Object.keys(tables).length} tables`);
    console.log(`  ✓ Found ${fkData.length} foreign key relationships\n`);
  } catch (err) {
    console.error(`  ❌ Error analyzing table structure: ${err.message}\n`);
    report.sections.tableStructure = { error: err.message };
  }

  // ============================================================
  // 2. TABLES WITHOUT PROPER INDEXES
  // ============================================================
  console.log('🔍 Section 2: Analyzing Indexes...');

  try {
    const indexQuery = `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;

    const indexResult = await pool.query(indexQuery);
    const indexData = indexResult.rows;

    const fkColumnsQuery = `
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;

    const fkResult = await pool.query(fkColumnsQuery);
    const fkColumnsData = fkResult.rows;

    // Build index map
    const indexedColumns = {};
    indexData.forEach(idx => {
      if (!indexedColumns[idx.tablename]) {
        indexedColumns[idx.tablename] = [];
      }

      // Extract column names from index definition
      const colMatch = idx.indexdef.match(/\(([^)]+)\)/);
      if (colMatch) {
        const cols = colMatch[1].split(',').map(c => c.trim());
        indexedColumns[idx.tablename].push(...cols);
      }
    });

    // Find missing indexes on foreign keys
    const missingIndexes = [];
    fkColumnsData.forEach(fk => {
      const tableIndexes = indexedColumns[fk.table_name] || [];
      const hasIndex = tableIndexes.some(col =>
        col.toLowerCase().includes(fk.column_name.toLowerCase())
      );

      if (!hasIndex) {
        missingIndexes.push({
          table: fk.table_name,
          column: fk.column_name,
          recommendation: `CREATE INDEX idx_${fk.table_name}_${fk.column_name} ON ${fk.table_name}(${fk.column_name});`
        });
      }
    });

    report.sections.indexes = {
      totalIndexes: indexData.length,
      indexes: indexData,
      missingIndexesOnForeignKeys: missingIndexes,
      missingCount: missingIndexes.length
    };

    console.log(`  ✓ Found ${indexData.length} indexes`);
    console.log(`  ⚠️  Found ${missingIndexes.length} foreign keys without indexes\n`);
  } catch (err) {
    console.error(`  ❌ Error analyzing indexes: ${err.message}\n`);
    report.sections.indexes = { error: err.message };
  }

  // ============================================================
  // 3. UNUSED OR ORPHANED TABLES
  // ============================================================
  console.log('📉 Section 3: Analyzing Table Usage...');

  try {
    const tableStatsQuery = `
      SELECT
        schemaname,
        relname as table_name,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del,
        n_live_tup,
        n_dead_tup,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname;
    `;

    const statsResult = await pool.query(tableStatsQuery);
    const statsData = statsResult.rows;

    const tableSizeQuery = `
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;

    const sizeResult = await pool.query(tableSizeQuery);
    const sizeData = sizeResult.rows;

    // Scan codebase for table references
    console.log('  📁 Scanning codebase for table references...');
    const codebaseReferences = scanCodebaseForTableUsage();

    // Combine stats with size and code references
    const unusedTables = [];
    const lowUsageTables = [];

    statsData.forEach(stat => {
      const totalActivity =
        (stat.seq_scan || 0) +
        (stat.idx_scan || 0) +
        (stat.n_tup_ins || 0) +
        (stat.n_tup_upd || 0) +
        (stat.n_tup_del || 0);

      const hasCodeReferences = codebaseReferences[stat.table_name] &&
                               codebaseReferences[stat.table_name].length > 0;

      const sizeInfo = sizeData.find(s => s.tablename === stat.table_name);

      const tableInfo = {
        table: stat.table_name,
        stats: stat,
        size: sizeInfo ? sizeInfo.size : 'unknown',
        sizeBytes: sizeInfo ? parseInt(sizeInfo.size_bytes) : 0,
        totalActivity,
        codeReferences: codebaseReferences[stat.table_name] || [],
        hasCodeReferences
      };

      if (totalActivity === 0 && !hasCodeReferences) {
        unusedTables.push(tableInfo);
      } else if (totalActivity < 10 || !hasCodeReferences) {
        lowUsageTables.push(tableInfo);
      }
    });

    report.sections.tableUsage = {
      allTableStats: statsData,
      unusedTables,
      lowUsageTables,
      codebaseReferences,
      unusedCount: unusedTables.length,
      lowUsageCount: lowUsageTables.length
    };

    console.log(`  ✓ Analyzed ${statsData.length} tables`);
    console.log(`  ⚠️  Found ${unusedTables.length} completely unused tables`);
    console.log(`  ⚠️  Found ${lowUsageTables.length} low-usage tables\n`);
  } catch (err) {
    console.error(`  ❌ Error analyzing table usage: ${err.message}\n`);
    report.sections.tableUsage = { error: err.message };
  }

  // ============================================================
  // 4. MISSING RLS POLICIES AND SECURITY GAPS
  // ============================================================
  console.log('🔒 Section 4: Analyzing RLS Policies & Security...');

  try {
    const rlsStatusQuery = `
      SELECT
        schemaname,
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    const rlsResult = await pool.query(rlsStatusQuery);
    const rlsData = rlsResult.rows;

    const policiesQuery = `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    const policiesResult = await pool.query(policiesQuery);
    const policiesData = policiesResult.rows;

    // Organize by table
    const securityAnalysis = {};
    const missingPolicies = [];
    const rlsDisabled = [];

    rlsData.forEach(table => {
      securityAnalysis[table.tablename] = {
        table: table.tablename,
        rlsEnabled: table.rls_enabled,
        policies: [],
        missingOperations: []
      };

      if (!table.rls_enabled) {
        rlsDisabled.push(table.tablename);
      }
    });

    // Add policies
    policiesData.forEach(policy => {
      if (securityAnalysis[policy.tablename]) {
        securityAnalysis[policy.tablename].policies.push(policy);
      }
    });

    // Check for missing policies
    const requiredOperations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    Object.values(securityAnalysis).forEach(table => {
      if (table.rlsEnabled) {
        const policyCmds = table.policies.map(p => p.cmd);
        const missing = requiredOperations.filter(op => !policyCmds.includes(op));

        if (missing.length > 0) {
          table.missingOperations = missing;
          missingPolicies.push({
            table: table.table,
            missing: missing
          });
        }

        if (table.policies.length === 0) {
          missingPolicies.push({
            table: table.table,
            missing: requiredOperations,
            critical: true,
            note: 'RLS enabled but NO policies defined - table is inaccessible'
          });
        }
      }
    });

    report.sections.security = {
      totalTables: Object.keys(securityAnalysis).length,
      rlsDisabledTables: rlsDisabled,
      rlsDisabledCount: rlsDisabled.length,
      tablesWithMissingPolicies: missingPolicies,
      missingPolicyCount: missingPolicies.length,
      allPolicies: policiesData,
      securityAnalysis
    };

    console.log(`  ✓ Analyzed ${Object.keys(securityAnalysis).length} tables`);
    console.log(`  ⚠️  ${rlsDisabled.length} tables have RLS disabled`);
    console.log(`  ⚠️  ${missingPolicies.length} tables have incomplete RLS policies\n`);
  } catch (err) {
    console.error(`  ❌ Error analyzing RLS policies: ${err.message}\n`);
    report.sections.security = { error: err.message };
  }

  // ============================================================
  // 5. SCHEMA INCONSISTENCIES AND NORMALIZATION ISSUES
  // ============================================================
  console.log('🔧 Section 5: Analyzing Schema Consistency...');

  try {
    const inconsistencies = {
      namingIssues: [],
      normalizationIssues: [],
      dataTypeIssues: []
    };

    if (report.sections.tableStructure?.tables) {
      const tables = report.sections.tableStructure.tables;

      // Check naming conventions
      Object.values(tables).forEach(table => {
        // Check table name convention
        if (table.name !== table.name.toLowerCase()) {
          inconsistencies.namingIssues.push({
            type: 'table_case',
            table: table.name,
            issue: 'Table name not lowercase',
            recommendation: `Rename to ${table.name.toLowerCase()}`
          });
        }

        // Check column naming patterns
        table.columns.forEach(col => {
          // Mixed case columns
          if (col.name !== col.name.toLowerCase()) {
            inconsistencies.namingIssues.push({
              type: 'column_case',
              table: table.name,
              column: col.name,
              issue: 'Column name not lowercase'
            });
          }

          // Inconsistent ID patterns
          if (col.name.includes('id') && !col.name.endsWith('_id') && col.name !== 'id') {
            inconsistencies.namingIssues.push({
              type: 'id_pattern',
              table: table.name,
              column: col.name,
              issue: 'Inconsistent ID column naming (should be "id" or end with "_id")'
            });
          }

          // Check for potential foreign keys without constraints
          if ((col.name.endsWith('_id') || col.name.includes('_id_')) && col.name !== 'id') {
            const hasFk = table.foreignKeys.some(fk => fk.column === col.name);
            if (!hasFk) {
              inconsistencies.normalizationIssues.push({
                type: 'missing_fk_constraint',
                table: table.name,
                column: col.name,
                issue: 'Column looks like a foreign key but has no constraint',
                recommendation: 'Add foreign key constraint or rename column'
              });
            }
          }
        });
      });

      // Check for similar columns with different data types
      const columnsByName = {};
      Object.values(tables).forEach(table => {
        table.columns.forEach(col => {
          if (!columnsByName[col.name]) {
            columnsByName[col.name] = [];
          }
          columnsByName[col.name].push({
            table: table.name,
            type: col.type,
            nullable: col.nullable
          });
        });
      });

      Object.entries(columnsByName).forEach(([colName, occurrences]) => {
        if (occurrences.length > 1) {
          const types = [...new Set(occurrences.map(o => o.type))];
          if (types.length > 1) {
            inconsistencies.dataTypeIssues.push({
              column: colName,
              issue: 'Same column name with different data types',
              occurrences: occurrences
            });
          }
        }
      });
    }

    report.sections.schemaConsistency = {
      namingIssues: inconsistencies.namingIssues,
      normalizationIssues: inconsistencies.normalizationIssues,
      dataTypeIssues: inconsistencies.dataTypeIssues,
      totalIssues:
        inconsistencies.namingIssues.length +
        inconsistencies.normalizationIssues.length +
        inconsistencies.dataTypeIssues.length
    };

    console.log(`  ✓ Schema consistency check complete`);
    console.log(`  ⚠️  Found ${inconsistencies.namingIssues.length} naming issues`);
    console.log(`  ⚠️  Found ${inconsistencies.normalizationIssues.length} normalization issues`);
    console.log(`  ⚠️  Found ${inconsistencies.dataTypeIssues.length} data type inconsistencies\n`);
  } catch (err) {
    console.error(`  ❌ Error analyzing schema consistency: ${err.message}\n`);
    report.sections.schemaConsistency = { error: err.message };
  }

  // ============================================================
  // GENERATE EXECUTIVE SUMMARY
  // ============================================================
  report.executiveSummary = {
    totalTables: report.sections.tableStructure?.totalTables || 0,
    totalIndexes: report.sections.indexes?.totalIndexes || 0,
    criticalIssues: {
      missingIndexes: report.sections.indexes?.missingCount || 0,
      unusedTables: report.sections.tableUsage?.unusedCount || 0,
      rlsDisabled: report.sections.security?.rlsDisabledCount || 0,
      missingPolicies: report.sections.security?.missingPolicyCount || 0
    },
    schemaIssues: report.sections.schemaConsistency?.totalIssues || 0
  };

  // Close connection
  await pool.end();

  // ============================================================
  // SAVE REPORT
  // ============================================================
  const reportPath = path.join(process.cwd(), 'DATABASE_ANALYSIS_COMPREHENSIVE.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 EXECUTIVE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Tables: ${report.executiveSummary.totalTables}`);
  console.log(`Total Indexes: ${report.executiveSummary.totalIndexes}`);
  console.log('');
  console.log('CRITICAL ISSUES:');
  console.log(`  ⚠️  Missing Indexes on Foreign Keys: ${report.executiveSummary.criticalIssues.missingIndexes}`);
  console.log(`  ⚠️  Unused Tables: ${report.executiveSummary.criticalIssues.unusedTables}`);
  console.log(`  🔒 Tables with RLS Disabled: ${report.executiveSummary.criticalIssues.rlsDisabled}`);
  console.log(`  🔒 Tables with Missing Policies: ${report.executiveSummary.criticalIssues.missingPolicies}`);
  console.log('');
  console.log('SCHEMA ISSUES:');
  console.log(`  🔧 Total Schema Inconsistencies: ${report.executiveSummary.schemaIssues}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Full report saved to: ${reportPath}`);
  console.log('');

  return report;
}

// Run the analysis
(async () => {
  const connected = await testConnection();
  if (!connected) {
    console.error('\n💡 To fix this, add to your .env.local file:');
    console.error('   DATABASE_URL=postgresql://postgres:[YOUR_PROJECT_REF]:[YOUR_DB_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres');
    console.error('\n   You can find your connection string in Supabase Dashboard > Project Settings > Database');
    process.exit(1);
  }

  await analyzeDatabase();
  console.log('✅ Analysis complete!');
  process.exit(0);
})().catch(err => {
  console.error('❌ Analysis failed:', err);
  process.exit(1);
});
