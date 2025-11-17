#!/usr/bin/env node

/**
 * Check what tables exist and find the reviewers table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking for reviewer tables...\n');

  // Try different possible table names
  const tableNames = [
    'feedback_360_reviewers',
    'reviewers',
    'survey_reviewers',
    '360_reviewers'
  ];

  for (const tableName of tableNames) {
    console.log(`Trying: ${tableName}`);
    const { data, error } = await supabase
      .from(tableName)
      .select('relationship')
      .limit(1);

    if (!error) {
      console.log(`✅ Found table: ${tableName}`);

      // Get counts by relationship
      const { data: allData } = await supabase
        .from(tableName)
        .select('relationship');

      if (allData) {
        const counts = {};
        allData.forEach(row => {
          counts[row.relationship] = (counts[row.relationship] || 0) + 1;
        });
        console.log('\nRelationship distribution:');
        console.table(counts);
      }
      return tableName;
    } else {
      console.log(`  ❌ ${error.message}`);
    }
  }

  console.log('\n❌ Could not find any reviewer table');
}

checkTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
