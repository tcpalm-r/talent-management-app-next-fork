/**
 * Analyze surveys with potentially incorrect relationship classifications
 *
 * This script identifies reviewers marked as "cross_functional" that should
 * actually be "manager" or "direct_report" based on the current detection logic.
 *
 * RUN WITH: npx tsx scripts/analyze-relationship-issues.ts
 */

import 'dotenv/config';
import { supabaseAdmin } from '../lib/supabase-admin';

interface ReviewerWithContext {
  reviewer_id: string;
  reviewer_email: string;
  reviewer_name: string;
  current_relationship: string;
  survey_id: string;
  survey_name: string;
  survey_status: string;
  subject_id: string;
  subject_name: string;
  subject_email: string;
  subject_manager_id: string | null;
  subject_manager_email: string | null;
  // Reviewer's profile data
  reviewer_user_id: string | null;
  reviewer_manager_id: string | null;
  reviewer_manager_email: string | null;
}

async function analyzeRelationshipIssues() {
  console.log('='.repeat(80));
  console.log('ANALYZING SURVEY RELATIONSHIP ISSUES');
  console.log('='.repeat(80));
  console.log('');

  // Get all reviewers with cross_functional relationship from active/in-progress surveys
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

  if (!reviewers || reviewers.length === 0) {
    console.log('No cross_functional reviewers found in active/draft surveys.');
    return;
  }

  console.log(`Found ${reviewers.length} cross_functional reviewers across all surveys.`);
  console.log('');

  // Get all user profiles for email-based matching
  const { data: allUsers, error: usersError } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, full_name, manager_id, manager_email');

  if (usersError) {
    console.error('Error fetching users:', usersError);
    return;
  }

  const userByEmail = new Map(allUsers?.map(u => [u.email?.toLowerCase(), u]) || []);
  const userById = new Map(allUsers?.map(u => [u.id, u]) || []);

  // Analyze each reviewer
  const issues: Array<{
    reviewerEmail: string;
    reviewerName: string;
    subjectName: string;
    subjectEmail: string;
    surveyName: string;
    surveyId: string;
    surveyStatus: string;
    currentRelationship: string;
    shouldBe: string;
    reason: string;
  }> = [];

  for (const reviewer of reviewers) {
    const survey = reviewer.feedback_360_surveys as any;
    const subject = userById.get(survey.employee_id);

    if (!subject) {
      console.log(`  Warning: No subject found for survey ${survey.id} (employee_id: ${survey.employee_id})`);
      continue;
    }

    // Find the reviewer's user profile by email
    const reviewerProfile = userByEmail.get(reviewer.reviewer_email?.toLowerCase());

    // Check if should be "manager"
    // Rule: reviewer's ID matches subject's manager_id, OR reviewer's email matches subject's manager_email
    let shouldBeManager = false;
    let managerReason = '';

    if (reviewerProfile) {
      if (subject.manager_id && reviewerProfile.id === subject.manager_id) {
        shouldBeManager = true;
        managerReason = `Reviewer ID (${reviewerProfile.id}) matches subject's manager_id`;
      }
    }

    if (!shouldBeManager && subject.manager_email && reviewer.reviewer_email) {
      if (subject.manager_email.toLowerCase() === reviewer.reviewer_email.toLowerCase()) {
        shouldBeManager = true;
        managerReason = `Reviewer email (${reviewer.reviewer_email}) matches subject's manager_email (${subject.manager_email})`;
      }
    }

    // Check if should be "direct_report"
    // Rule: reviewer's manager_id = subject's id, OR reviewer's manager_email = subject's email
    let shouldBeDirectReport = false;
    let directReportReason = '';

    if (reviewerProfile) {
      if (reviewerProfile.manager_id && reviewerProfile.manager_id === subject.id) {
        shouldBeDirectReport = true;
        directReportReason = `Reviewer's manager_id (${reviewerProfile.manager_id}) matches subject's ID`;
      }
      if (!shouldBeDirectReport && reviewerProfile.manager_email && subject.email) {
        if (reviewerProfile.manager_email.toLowerCase() === subject.email.toLowerCase()) {
          shouldBeDirectReport = true;
          directReportReason = `Reviewer's manager_email (${reviewerProfile.manager_email}) matches subject's email (${subject.email})`;
        }
      }
    }

    if (shouldBeManager) {
      issues.push({
        reviewerEmail: reviewer.reviewer_email,
        reviewerName: reviewer.reviewer_name,
        subjectName: subject.full_name,
        subjectEmail: subject.email,
        surveyName: survey.survey_name,
        surveyId: survey.id,
        surveyStatus: survey.status,
        currentRelationship: 'cross_functional',
        shouldBe: 'manager',
        reason: managerReason
      });
    } else if (shouldBeDirectReport) {
      issues.push({
        reviewerEmail: reviewer.reviewer_email,
        reviewerName: reviewer.reviewer_name,
        subjectName: subject.full_name,
        subjectEmail: subject.email,
        surveyName: survey.survey_name,
        surveyId: survey.id,
        surveyStatus: survey.status,
        currentRelationship: 'cross_functional',
        shouldBe: 'direct_report',
        reason: directReportReason
      });
    }
  }

  // Output results
  console.log('');
  console.log('='.repeat(80));
  console.log(`FOUND ${issues.length} MISCLASSIFIED RELATIONSHIPS`);
  console.log('='.repeat(80));
  console.log('');

  if (issues.length === 0) {
    console.log('All cross_functional relationships appear to be correct!');
    return;
  }

  // Group by should-be relationship
  const managerIssues = issues.filter(i => i.shouldBe === 'manager');
  const directReportIssues = issues.filter(i => i.shouldBe === 'direct_report');

  if (managerIssues.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`SHOULD BE "manager" (${managerIssues.length} records):`);
    console.log('─'.repeat(80));
    for (const issue of managerIssues) {
      console.log(`
  Survey: ${issue.surveyName} (${issue.surveyStatus})
  Survey ID: ${issue.surveyId}
  Subject: ${issue.subjectName} (${issue.subjectEmail})
  Reviewer: ${issue.reviewerName} (${issue.reviewerEmail})
  Reason: ${issue.reason}
`);
    }
  }

  if (directReportIssues.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`SHOULD BE "direct_report" (${directReportIssues.length} records):`);
    console.log('─'.repeat(80));
    for (const issue of directReportIssues) {
      console.log(`
  Survey: ${issue.surveyName} (${issue.surveyStatus})
  Survey ID: ${issue.surveyId}
  Subject: ${issue.subjectName} (${issue.subjectEmail})
  Reviewer: ${issue.reviewerName} (${issue.reviewerEmail})
  Reason: ${issue.reason}
`);
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total misclassified: ${issues.length}`);
  console.log(`  Should be "manager": ${managerIssues.length}`);
  console.log(`  Should be "direct_report": ${directReportIssues.length}`);
  console.log('');
  console.log('To fix these, you would need to update the relationship field in feedback_360_reviewers table.');
}

analyzeRelationshipIssues()
  .then(() => {
    console.log('\nAnalysis complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
