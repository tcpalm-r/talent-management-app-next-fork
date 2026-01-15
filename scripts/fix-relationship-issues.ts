/**
 * Fix misclassified survey relationships
 *
 * This script ONLY updates the `relationship` column on feedback_360_survey_reviewers.
 * Nothing else is touched.
 *
 * RUN DRY-RUN:  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/fix-relationship-issues.ts
 * RUN FOR REAL: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/fix-relationship-issues.ts --apply
 */

import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase-admin';

const DRY_RUN = !process.argv.includes('--apply');

async function fixRelationshipIssues() {
  console.log('='.repeat(80));
  console.log(DRY_RUN ? 'DRY RUN - NO CHANGES WILL BE MADE' : '⚠️  APPLYING CHANGES');
  console.log('='.repeat(80));
  console.log('');

  // Get all cross_functional reviewers
  const { data: reviewers, error: reviewersError } = await supabaseAdmin
    .from('feedback_360_survey_reviewers')
    .select(`
      id,
      reviewer_email,
      reviewer_name,
      relationship,
      survey_id,
      feedback_360_surveys!inner (
        id,
        survey_name,
        status,
        employee_id
      )
    `)
    .eq('relationship', 'cross_functional');

  if (reviewersError) {
    console.error('Error fetching reviewers:', reviewersError);
    return;
  }

  // Get all user profiles
  const { data: allUsers, error: usersError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, manager_id, manager_email');

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  const userByEmail = new Map(allUsers?.map(u => [u.email?.toLowerCase(), u]) || []);
  const userById = new Map(allUsers?.map(u => [u.id, u]) || []);

  // Find records that need fixing
  const fixes: Array<{
    reviewerId: string;
    reviewerEmail: string;
    reviewerName: string;
    subjectName: string;
    surveyName: string;
    surveyStatus: string;
    currentRelationship: string;
    newRelationship: string;
  }> = [];

  for (const reviewer of reviewers || []) {
    const survey = reviewer.feedback_360_surveys as any;
    const subject = userById.get(survey.employee_id);
    if (!subject) continue;

    const reviewerProfile = userByEmail.get(reviewer.reviewer_email?.toLowerCase());

    // Check if should be "manager"
    let shouldBeManager = false;
    if (reviewerProfile && subject.manager_id && reviewerProfile.id === subject.manager_id) {
      shouldBeManager = true;
    }
    if (!shouldBeManager && subject.manager_email && reviewer.reviewer_email) {
      if (subject.manager_email.toLowerCase() === reviewer.reviewer_email.toLowerCase()) {
        shouldBeManager = true;
      }
    }

    // Check if should be "direct_report"
    let shouldBeDirectReport = false;
    if (reviewerProfile) {
      if (reviewerProfile.manager_id && reviewerProfile.manager_id === subject.id) {
        shouldBeDirectReport = true;
      }
      if (!shouldBeDirectReport && reviewerProfile.manager_email && subject.email) {
        if (reviewerProfile.manager_email.toLowerCase() === subject.email.toLowerCase()) {
          shouldBeDirectReport = true;
        }
      }
    }

    if (shouldBeManager) {
      fixes.push({
        reviewerId: reviewer.id,
        reviewerEmail: reviewer.reviewer_email,
        reviewerName: reviewer.reviewer_name || 'Unknown',
        subjectName: subject.full_name,
        surveyName: survey.survey_name,
        surveyStatus: survey.status,
        currentRelationship: 'cross_functional',
        newRelationship: 'manager'
      });
    } else if (shouldBeDirectReport) {
      fixes.push({
        reviewerId: reviewer.id,
        reviewerEmail: reviewer.reviewer_email,
        reviewerName: reviewer.reviewer_name || 'Unknown',
        subjectName: subject.full_name,
        surveyName: survey.survey_name,
        surveyStatus: survey.status,
        currentRelationship: 'cross_functional',
        newRelationship: 'direct_report'
      });
    }
  }

  if (fixes.length === 0) {
    console.log('No fixes needed!');
    return;
  }

  // Show what will be changed
  console.log(`Found ${fixes.length} records to fix:\n`);

  for (const fix of fixes) {
    console.log(`  ${fix.reviewerName} (${fix.reviewerEmail})`);
    console.log(`    Survey: ${fix.surveyName} [${fix.surveyStatus}]`);
    console.log(`    Subject: ${fix.subjectName}`);
    console.log(`    Change: "${fix.currentRelationship}" → "${fix.newRelationship}"`);
    console.log('');
  }

  if (DRY_RUN) {
    console.log('─'.repeat(80));
    console.log('This is a DRY RUN. No changes were made.');
    console.log('To apply these changes, run with --apply flag:');
    console.log('  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/fix-relationship-issues.ts --apply');
    return;
  }

  // Apply fixes one by one
  console.log('─'.repeat(80));
  console.log('Applying fixes...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const fix of fixes) {
    const { error } = await supabaseAdmin
      .from('feedback_360_survey_reviewers')
      .update({ relationship: fix.newRelationship })
      .eq('id', fix.reviewerId);

    if (error) {
      console.error(`  ✗ Failed to update ${fix.reviewerEmail}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ✓ Updated ${fix.reviewerEmail}: ${fix.currentRelationship} → ${fix.newRelationship}`);
      successCount++;
    }
  }

  console.log('');
  console.log('─'.repeat(80));
  console.log(`Done. Success: ${successCount}, Errors: ${errorCount}`);
}

fixRelationshipIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
