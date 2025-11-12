#!/usr/bin/env node
/**
 * List all tables in the Supabase database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function listAllTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('\n📊 Supabase Database Tables\n');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Query to get all tables and views from public schema
    const { data, error } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT
            table_name,
            table_type
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY
            CASE table_type
              WHEN 'BASE TABLE' THEN 1
              WHEN 'VIEW' THEN 2
              WHEN 'MATERIALIZED VIEW' THEN 3
              ELSE 4
            END,
            table_name;
        `
      });

    if (error) {
      console.error('Error querying database:', error.message);
      console.log('\nTrying alternative method...\n');

      // Alternative: Try to list known tables by attempting to query them
      const knownTables = [
        'user_profiles',
        'employees',
        'active_users',
        'performance_reviews',
        'active_performance_reviews',
        'assessments',
        'departments',
        'feedback_360_surveys',
        'feedback_360_reviewers',
        'feedback_360_questions',
        'feedback_360_survey_questions',
        'feedback_360_responses',
        'action_items',
        'one_on_one_notes',
        'retention_plans',
        'critical_roles',
        'succession_candidates'
      ];

      console.log('BASE TABLES & VIEWS:\n');

      for (const tableName of knownTables) {
        try {
          const { error: queryError } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);

          if (!queryError) {
            console.log(`  ✓ ${tableName}`);
          }
        } catch (e) {
          // Table doesn't exist or not accessible
        }
      }

      console.log('\n(This is a partial list of known tables. Some tables may not be shown.)');
    } else {
      // Group by type
      const tables = data.filter(t => t.table_type === 'BASE TABLE');
      const views = data.filter(t => t.table_type === 'VIEW');
      const matViews = data.filter(t => t.table_type === 'MATERIALIZED VIEW');

      if (tables.length > 0) {
        console.log('BASE TABLES:\n');
        tables.forEach(t => console.log(`  • ${t.table_name}`));
        console.log('');
      }

      if (views.length > 0) {
        console.log('VIEWS:\n');
        views.forEach(t => console.log(`  • ${t.table_name}`));
        console.log('');
      }

      if (matViews.length > 0) {
        console.log('MATERIALIZED VIEWS:\n');
        matViews.forEach(t => console.log(`  • ${t.table_name}`));
        console.log('');
      }

      console.log('='.repeat(80));
      console.log(`\nTotal: ${tables.length} tables, ${views.length} views, ${matViews.length} materialized views\n`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

listAllTables();
