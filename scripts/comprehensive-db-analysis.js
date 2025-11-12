#!/usr/bin/env node
/**
 * Comprehensive Database Analysis Script
 * 
 * Analyzes:
 * 1. Complete table structure with relationships
 * 2. Tables without proper indexes
 * 3. Unused or orphaned tables  
 * 4. Missing RLS policies and security gaps
 * 5. Schema inconsistencies and normalization issues
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Execute SQL query via RPC
async function executeQuery(query, description) {
  try {
    const { data, error } = await client.rpc('exec_sql', { query });
    if (error) {
      console.error(`  ❌ Error in ${description}:`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`  ❌ Exception in ${description}:`, err.message);
    return null;
  }
}

// Search codebase for table references
function searchCodebase(tableName) {
  const references = [];
  const patterns = [
    new RegExp(`\\.from\\(['"\`]${tableName}['"\`]\\)`, 'g'),
    new RegExp(`'${tableName}'`, 'g'),
    new RegExp(`"${tableName}"`, 'g'),
  ];

  function searchDirectory(dir, relativeBase = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(relativeBase, entry.name);
        
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }
        
        if (entry.isDirectory()) {
          searchDirectory(fullPath, relativePath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|sql)$/.test(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            let matchCount = 0;
            
            for (const pattern of patterns) {
              const matches = content.match(pattern);
              if (matches) {
                matchCount += matches.length;
              }
            }
            
            if (matchCount > 0) {
              references.push({ file: relativePath, count: matchCount });
            }
          } catch (err) {
            // Skip files that can't be read
          }
        }
      }
    } catch (err) {
      // Skip directories that can't be read
    }
  }

  const projectRoot = path.resolve(__dirname, '..');
  searchDirectory(projectRoot);
  
  return references;
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         COMPREHENSIVE SUPABASE DATABASE ANALYSIS REPORT            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {},
    sections: {}
  };

  // =========================================================================
  // SECTION 1: TABLE STRUCTURE WITH RELATIONSHIPS
  // =========================================================================
  console.log('📊 SECTION 1: TABLE STRUCTURE & RELATIONSHIPS\n');
  console.log('─'.repeat(70));
  
  // Get all tables
  console.log('\n1.1 Fetching all tables and views...');
  const tablesQuery = `
    SELECT 
      table_name,
      table_type,
      CASE table_type
        WHEN 'BASE TABLE' THEN 1
        WHEN 'VIEW' THEN 2
        WHEN 'MATERIALIZED VIEW' THEN 3
        ELSE 4
      END as type_order
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY type_order, table_name;
  `;
  const tables = await executeQuery(tablesQuery, 'tables query');
  
  if (tables) {
    const baseTables = tables.filter(t => t.table_type === 'BASE TABLE');
    const views = tables.filter(t => t.table_type === 'VIEW');
    const matViews = tables.filter(t => t.table_type === 'MATERIALIZED VIEW');
    
    report.sections.tables = { base: baseTables, views, materialized_views: matViews };
    console.log(`     ✓ Found ${baseTables.length} base tables, ${views.length} views, ${matViews.length} materialized views`);
  }
  
  // Get detailed column information
  console.log('1.2 Fetching table schemas and columns...');
  const columnsQuery = `
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.is_nullable,
      c.column_default,
      CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY'
        ELSE ''
      END as constraint_type
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    LEFT JOIN (
      SELECT ku.table_name, ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
    LEFT JOIN (
      SELECT ku.table_name, ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position;
  `;
  const columns = await executeQuery(columnsQuery, 'columns query');
  
  if (columns) {
    report.sections.table_schemas = columns;
    const tableCount = [...new Set(columns.map(c => c.table_name))].length;
    console.log(`     ✓ Fetched schema details for ${tableCount} tables (${columns.length} columns)`);
  }
  
  // Get foreign key relationships
  console.log('1.3 Mapping foreign key relationships...');
  const fkQuery = `
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `;
  const foreignKeys = await executeQuery(fkQuery, 'foreign keys query');
  
  if (foreignKeys) {
    report.sections.foreign_keys = foreignKeys;
    console.log(`     ✓ Found ${foreignKeys.length} foreign key relationships`);
  }

  // =========================================================================
  // SECTION 2: INDEX ANALYSIS
  // =========================================================================
  console.log('\n\n📊 SECTION 2: INDEX ANALYSIS\n');
  console.log('─'.repeat(70));
  
  // Get all indexes
  console.log('\n2.1 Fetching all indexes...');
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
  const indexes = await executeQuery(indexQuery, 'indexes query');
  
  if (indexes) {
    report.sections.indexes = indexes;
    const tableCount = [...new Set(indexes.map(i => i.tablename))].length;
    console.log(`     ✓ Found ${indexes.length} indexes across ${tableCount} tables`);
  }
  
  // Find foreign keys without indexes
  console.log('2.2 Identifying foreign keys without indexes...');
  const missingIndexQuery = `
    SELECT DISTINCT
      kcu.table_name,
      kcu.column_name,
      ccu.table_name AS references_table,
      ccu.column_name AS references_column
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_indexes idx
        WHERE idx.schemaname = 'public' 
          AND idx.tablename = kcu.table_name
          AND (
            idx.indexdef LIKE '%' || kcu.column_name || '%'
            OR idx.indexdef LIKE '%' || kcu.column_name || ',%'
            OR idx.indexdef LIKE '%,' || kcu.column_name || '%'
          )
      )
    ORDER BY kcu.table_name, kcu.column_name;
  `;
  const missingIndexes = await executeQuery(missingIndexQuery, 'missing indexes query');
  
  if (missingIndexes) {
    report.sections.missing_indexes = missingIndexes;
    console.log(`     ⚠️  Found ${missingIndexes.length} foreign keys WITHOUT indexes (PERFORMANCE ISSUE)`);
  }

  // =========================================================================
  // SECTION 3: TABLE USAGE STATISTICS
  // =========================================================================
  console.log('\n\n📊 SECTION 3: TABLE USAGE ANALYSIS\n');
  console.log('─'.repeat(70));
  
  // Get table usage statistics
  console.log('\n3.1 Fetching database usage statistics...');
  const statsQuery = `
    SELECT
      schemaname,
      relname as table_name,
      seq_scan,
      seq_tup_read,
      idx_scan,
      idx_tup_fetch,
      n_tup_ins as inserts,
      n_tup_upd as updates,
      n_tup_del as deletes,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname;
  `;
  const stats = await executeQuery(statsQuery, 'usage stats query');
  
  if (stats) {
    report.sections.usage_stats = stats;
    console.log(`     ✓ Fetched usage statistics for ${stats.length} tables`);
    
    // Identify potentially unused tables
    const unusedTables = stats.filter(s => 
      (s.seq_scan === 0 || s.seq_scan === null) &&
      (s.idx_scan === 0 || s.idx_scan === null) &&
      (s.inserts === 0 || s.inserts === null) &&
      (s.updates === 0 || s.updates === null) &&
      (s.deletes === 0 || s.deletes === null)
    );
    console.log(`     ⚠️  Found ${unusedTables.length} tables with ZERO database activity`);
  }
  
  // Get table sizes
  console.log('3.2 Calculating table sizes...');
  const sizeQuery = `
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS total_size,
      pg_size_pretty(pg_relation_size('public.' || tablename)) AS table_size,
      pg_size_pretty(pg_total_relation_size('public.' || tablename) - pg_relation_size('public.' || tablename)) AS indexes_size,
      pg_total_relation_size('public.' || tablename) AS total_bytes
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size('public.' || tablename) DESC;
  `;
  const sizes = await executeQuery(sizeQuery, 'table sizes query');
  
  if (sizes) {
    report.sections.table_sizes = sizes;
    console.log(`     ✓ Calculated sizes for ${sizes.length} tables`);
  }
  
  // Analyze code usage
  console.log('3.3 Scanning codebase for table references...');
  const codeUsage = {};
  if (tables) {
    const baseTables = tables.filter(t => t.table_type === 'BASE TABLE');
    for (const table of baseTables) {
      const refs = searchCodebase(table.table_name);
      codeUsage[table.table_name] = {
        references: refs.length,
        files: refs
      };
    }
    report.sections.code_usage = codeUsage;
    
    const unusedInCode = Object.entries(codeUsage).filter(([_, data]) => data.references === 0);
    console.log(`     ⚠️  Found ${unusedInCode.length} tables NOT referenced in codebase`);
  }

  // =========================================================================
  // SECTION 4: ROW LEVEL SECURITY (RLS) ANALYSIS
  // =========================================================================
  console.log('\n\n📊 SECTION 4: ROW LEVEL SECURITY ANALYSIS\n');
  console.log('─'.repeat(70));
  
  // Get RLS status
  console.log('\n4.1 Checking RLS status for all tables...');
  const rlsQuery = `
    SELECT 
      schemaname,
      tablename, 
      rowsecurity as rls_enabled
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  const rlsStatus = await executeQuery(rlsQuery, 'RLS status query');
  
  if (rlsStatus) {
    report.sections.rls_status = rlsStatus;
    const rlsDisabled = rlsStatus.filter(r => !r.rls_enabled);
    console.log(`     ✓ Checked RLS for ${rlsStatus.length} tables`);
    console.log(`     ⚠️  Found ${rlsDisabled.length} tables with RLS DISABLED (SECURITY RISK)`);
  }
  
  // Get RLS policies
  console.log('4.2 Fetching RLS policies...');
  const policiesQuery = `
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd as command,
      qual as using_expression,
      with_check as with_check_expression
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;
  const policies = await executeQuery(policiesQuery, 'RLS policies query');
  
  if (policies) {
    report.sections.rls_policies = policies;
    console.log(`     ✓ Found ${policies.length} RLS policies`);
    
    // Analyze policy coverage
    const policyCoverage = {};
    policies.forEach(p => {
      if (!policyCoverage[p.tablename]) {
        policyCoverage[p.tablename] = { SELECT: 0, INSERT: 0, UPDATE: 0, DELETE: 0, ALL: 0 };
      }
      policyCoverage[p.tablename][p.command]++;
    });
    
    report.sections.policy_coverage = policyCoverage;
    
    // Find tables with RLS enabled but missing policies
    if (rlsStatus) {
      const tablesWithRLS = rlsStatus.filter(r => r.rls_enabled);
      const tablesWithoutPolicies = tablesWithRLS.filter(t => !policyCoverage[t.tablename]);
      console.log(`     ⚠️  Found ${tablesWithoutPolicies.length} tables with RLS enabled but NO policies (SECURITY RISK)`);
    }
  }

  // =========================================================================
  // SECTION 5: SCHEMA INCONSISTENCIES
  // =========================================================================
  console.log('\n\n📊 SECTION 5: SCHEMA CONSISTENCY ANALYSIS\n');
  console.log('─'.repeat(70));
  
  console.log('\n5.1 Analyzing naming conventions...');
  if (columns) {
    const inconsistencies = {
      mixed_case_tables: [],
      mixed_case_columns: [],
      inconsistent_id_columns: [],
      inconsistent_timestamp_columns: []
    };
    
    // Check table names
    const tableNames = [...new Set(columns.map(c => c.table_name))];
    tableNames.forEach(name => {
      if (name !== name.toLowerCase() || name.includes(' ')) {
        inconsistencies.mixed_case_tables.push(name);
      }
    });
    
    // Check for inconsistent ID column naming
    const idColumns = columns.filter(c => c.column_name.includes('id'));
    const idPatterns = [...new Set(idColumns.map(c => {
      if (c.column_name === 'id') return 'id';
      if (c.column_name.endsWith('_id')) return 'suffix_id';
      if (c.column_name.startsWith('id_')) return 'prefix_id';
      return 'mixed';
    }))];
    
    if (idPatterns.length > 2) {
      inconsistencies.inconsistent_id_columns = idColumns.map(c => ({
        table: c.table_name,
        column: c.column_name
      }));
    }
    
    // Check timestamp column naming
    const timestampColumns = columns.filter(c => 
      c.data_type.includes('timestamp') || 
      c.column_name.includes('date') ||
      c.column_name.includes('time')
    );
    
    const timestampPatterns = [...new Set(timestampColumns.map(c => {
      if (c.column_name.endsWith('_at')) return 'suffix_at';
      if (c.column_name.endsWith('_date')) return 'suffix_date';
      if (c.column_name.endsWith('_time')) return 'suffix_time';
      return 'other';
    }))];
    
    report.sections.naming_inconsistencies = inconsistencies;
    
    console.log(`     ${inconsistencies.mixed_case_tables.length > 0 ? '⚠️' : '✓'} Table naming: ${inconsistencies.mixed_case_tables.length} tables with non-standard names`);
    console.log(`     ${idPatterns.length > 2 ? '⚠️' : '✓'} ID column patterns: ${idPatterns.join(', ')}`);
    console.log(`     ${timestampPatterns.length > 2 ? '⚠️' : '✓'} Timestamp patterns: ${timestampPatterns.join(', ')}`);
  }
  
  console.log('\n5.2 Checking for potential normalization issues...');
  if (columns && foreignKeys) {
    const normalizationIssues = [];
    
    // Find columns that look like they should be foreign keys but aren't
    const idLikeColumns = columns.filter(c => 
      c.column_name.endsWith('_id') && 
      c.column_name !== 'id' &&
      c.constraint_type !== 'FOREIGN KEY'
    );
    
    idLikeColumns.forEach(col => {
      // Check if there's a table that matches the prefix
      const prefix = col.column_name.replace('_id', '');
      const possibleTables = [
        prefix,
        prefix + 's',
        prefix + 'es',
        prefix.replace(/_/g, '')
      ];
      
      if (columns.some(c => possibleTables.includes(c.table_name))) {
        normalizationIssues.push({
          table: col.table_name,
          column: col.column_name,
          issue: 'Possible missing foreign key constraint',
          suggestion: `Consider adding FK to ${prefix} table`
        });
      }
    });
    
    report.sections.normalization_issues = normalizationIssues;
    console.log(`     ${normalizationIssues.length > 0 ? '⚠️' : '✓'} Found ${normalizationIssues.length} potential normalization issues`);
  }

  // =========================================================================
  // GENERATE SUMMARY
  // =========================================================================
  console.log('\n\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                          EXECUTIVE SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');
  
  report.summary = {
    total_tables: tables ? tables.filter(t => t.table_type === 'BASE TABLE').length : 0,
    total_views: tables ? tables.filter(t => t.table_type === 'VIEW' || t.table_type === 'MATERIALIZED VIEW').length : 0,
    total_indexes: indexes ? indexes.length : 0,
    missing_indexes: missingIndexes ? missingIndexes.length : 0,
    total_foreign_keys: foreignKeys ? foreignKeys.length : 0,
    tables_without_rls: rlsStatus ? rlsStatus.filter(r => !r.rls_enabled).length : 0,
    total_policies: policies ? policies.length : 0,
    unused_tables_db: stats ? stats.filter(s => 
      (s.seq_scan === 0 || s.seq_scan === null) &&
      (s.idx_scan === 0 || s.idx_scan === null)
    ).length : 0,
    unused_tables_code: codeUsage ? Object.values(codeUsage).filter(d => d.references === 0).length : 0
  };
  
  console.log(`📊 Database Objects:`);
  console.log(`   • Base Tables: ${report.summary.total_tables}`);
  console.log(`   • Views/Materialized Views: ${report.summary.total_views}`);
  console.log(`   • Indexes: ${report.summary.total_indexes}`);
  console.log(`   • Foreign Keys: ${report.summary.total_foreign_keys}\n`);
  
  console.log(`⚠️  Issues Found:`);
  console.log(`   • Foreign keys without indexes: ${report.summary.missing_indexes} ${report.summary.missing_indexes > 0 ? '⚠️  PERFORMANCE ISSUE' : '✓'}`);
  console.log(`   • Tables without RLS: ${report.summary.tables_without_rls} ${report.summary.tables_without_rls > 0 ? '⚠️  SECURITY RISK' : '✓'}`);
  console.log(`   • Tables unused (DB stats): ${report.summary.unused_tables_db} ${report.summary.unused_tables_db > 0 ? '⚠️  CLEANUP NEEDED' : '✓'}`);
  console.log(`   • Tables unused (code refs): ${report.summary.unused_tables_code} ${report.summary.unused_tables_code > 0 ? '⚠️  CLEANUP NEEDED' : '✓'}\n`);
  
  console.log(`🔒 Security:`);
  console.log(`   • RLS Policies: ${report.summary.total_policies}`);
  console.log(`   • Tables with RLS: ${report.summary.total_tables - report.summary.tables_without_rls}/${report.summary.total_tables}\n`);

  // =========================================================================
  // SAVE REPORT
  // =========================================================================
  const reportPath = path.join(__dirname, '..', 'DATABASE_ANALYSIS_COMPREHENSIVE.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('═'.repeat(70));
  console.log(`\n✅ Analysis complete! Detailed report saved to:\n   ${reportPath}\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
