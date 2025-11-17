#!/usr/bin/env node

/**
 * Migration Script: Replace 'peer' with 'cross_functional'
 *
 * This script migrates existing 'peer' relationship values to 'cross_functional'
 * in the feedback_360_reviewers table.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migratePeerToCrossFunctional() {
  console.log('🔄 Starting migration: peer → cross_functional\n');

  try {
    // Step 1: Check current state
    console.log('📊 Current relationship distribution:');
    const { data: beforeCounts, error: beforeError } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('relationship')
      .then(result => {
        if (result.error) return result;
        const counts = {};
        result.data.forEach(row => {
          counts[row.relationship] = (counts[row.relationship] || 0) + 1;
        });
        return { data: counts, error: null };
      });

    if (beforeError) throw beforeError;
    console.table(beforeCounts);

    const peerCount = beforeCounts['peer'] || 0;
    if (peerCount === 0) {
      console.log('\n✅ No "peer" relationships found. Migration not needed.');
      return;
    }

    console.log(`\n🔄 Found ${peerCount} reviewers with "peer" relationship`);
    console.log('   Updating to "cross_functional"...\n');

    // Step 2: Perform the migration
    const { data: updateResult, error: updateError } = await supabase
      .from('feedback_360_survey_reviewers')
      .update({ relationship: 'cross_functional' })
      .eq('relationship', 'peer')
      .select();

    if (updateError) throw updateError;

    console.log(`✅ Successfully updated ${updateResult.length} reviewers\n`);

    // Step 3: Verify the migration
    console.log('📊 New relationship distribution:');
    const { data: afterCounts, error: afterError } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('relationship')
      .then(result => {
        if (result.error) return result;
        const counts = {};
        result.data.forEach(row => {
          counts[row.relationship] = (counts[row.relationship] || 0) + 1;
        });
        return { data: counts, error: null };
      });

    if (afterError) throw afterError;
    console.table(afterCounts);

    // Verify no 'peer' relationships remain
    if (afterCounts['peer']) {
      console.warn(`\n⚠️  Warning: ${afterCounts['peer']} "peer" relationships still exist`);
    } else {
      console.log('\n✅ Migration complete! No "peer" relationships remain.');
      console.log('\n📝 Valid relationship types are now:');
      console.log('   - manager: Direct manager');
      console.log('   - slt: Senior Leadership Team member');
      console.log('   - direct_report: Someone who reports to the survey subject');
      console.log('   - cross_functional: Cross-functional colleague (formerly "peer")');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
migratePeerToCrossFunctional()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
