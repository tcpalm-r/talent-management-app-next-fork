/**
 * Backfill script: Add created_by_email to existing surveys
 *
 * This script populates the created_by_email field for surveys that were
 * created before the field was added. It looks up the creator's email from
 * the user_profiles table based on the created_by UUID.
 *
 * Usage:
 *   node scripts/backfill-survey-creator-emails.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillCreatorEmails() {
  console.log('🔍 Starting backfill of created_by_email for surveys...\n');

  try {
    // Step 1: Get all surveys missing created_by_email
    const { data: surveysToUpdate, error: fetchError } = await supabase
      .from('feedback_360_surveys')
      .select('id, created_by, created_by_email')
      .is('created_by_email', null)
      .not('created_by', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching surveys:', fetchError);
      return;
    }

    if (!surveysToUpdate || surveysToUpdate.length === 0) {
      console.log('✅ No surveys need backfilling. All surveys have created_by_email set!');
      return;
    }

    console.log(`📋 Found ${surveysToUpdate.length} surveys that need created_by_email\n`);

    let successCount = 0;
    let failCount = 0;
    let notFoundCount = 0;

    // Step 2: Process each survey
    for (const survey of surveysToUpdate) {
      // Look up user profile by created_by UUID
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', survey.created_by)
        .single();

      if (userError || !userProfile) {
        console.log(`⚠️  Survey ${survey.id}: Could not find user profile for created_by=${survey.created_by}`);
        notFoundCount++;
        continue;
      }

      // Update survey with creator email
      const { error: updateError } = await supabase
        .from('feedback_360_surveys')
        .update({ created_by_email: userProfile.email })
        .eq('id', survey.id);

      if (updateError) {
        console.log(`❌ Survey ${survey.id}: Failed to update - ${updateError.message}`);
        failCount++;
      } else {
        console.log(`✅ Survey ${survey.id}: Set created_by_email to ${userProfile.email}`);
        successCount++;
      }
    }

    // Step 3: Summary
    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Failed to update: ${failCount}`);
    console.log(`   ⚠️  Creator not found: ${notFoundCount}`);
    console.log(`   📋 Total processed: ${surveysToUpdate.length}`);

    if (notFoundCount > 0) {
      console.log('\n⚠️  Some surveys have created_by UUIDs that don\'t exist in user_profiles.');
      console.log('   These surveys were likely created with test users or deleted accounts.');
      console.log('   You may need to manually investigate these cases.');
    }

  } catch (error) {
    console.error('❌ Unexpected error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillCreatorEmails()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
