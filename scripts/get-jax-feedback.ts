import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getJax360Feedback() {
  // Find Jax Anderson
  const { data: jax, error: jaxError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .ilike('full_name', '%jax%anderson%')
    .single();

  if (jaxError || !jax) {
    console.log('Could not find Jax Anderson:', jaxError?.message);
    return;
  }

  console.log('Found:', jax.full_name, '(' + jax.email + ')');
  console.log('');

  // Get surveys where Jax is the subject
  const { data: surveys } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, status, due_date, created_at')
    .eq('employee_id', jax.id);

  if (!surveys || surveys.length === 0) {
    console.log('No 360 surveys found for Jax Anderson');
    return;
  }

  console.log('Surveys:', surveys.length);

  for (const survey of surveys) {
    console.log('\n========================================');
    console.log('Survey: ' + survey.survey_name);
    console.log('========================================');
    console.log('Status:', survey.status);
    console.log('Due:', survey.due_date);

    // Get reviewers and their status
    const { data: reviewers } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('reviewer_name, relationship, status, completed_at')
      .eq('survey_id', survey.id);

    console.log('\nReviewers:');
    for (const r of reviewers || []) {
      console.log('  -', r.reviewer_name, '(' + r.relationship + '):', r.status);
    }

    // Get responses with questions
    const { data: responses } = await supabase
      .from('feedback_360_responses')
      .select(`
        response_text,
        reviewer_email,
        question:feedback_360_questions(question_text, category)
      `)
      .eq('survey_id', survey.id)
      .eq('is_draft', false);

    console.log('\n--- Feedback Responses (' + (responses?.length || 0) + ') ---');

    // Group by reviewer
    const byReviewer: Record<string, any[]> = {};
    for (const resp of responses || []) {
      if (!byReviewer[resp.reviewer_email]) {
        byReviewer[resp.reviewer_email] = [];
      }
      byReviewer[resp.reviewer_email].push(resp);
    }

    for (const [email, resps] of Object.entries(byReviewer)) {
      console.log('\n>> Reviewer: ' + email);
      for (const resp of resps) {
        const q = resp.question as any;
        console.log('\n  Q [' + (q?.category || 'General') + ']: ' + (q?.question_text || 'Unknown'));
        console.log('  A:', resp.response_text);
      }
    }

    // Check for AI-generated report
    const { data: report } = await supabase
      .from('feedback_360_reports')
      .select('themes, overall_strengths, development_areas, consensus_areas, executive_summary')
      .eq('survey_id', survey.id)
      .single();

    if (report) {
      console.log('\n--- AI-Generated Report Summary ---');
      if (report.executive_summary) {
        console.log('\nExecutive Summary:');
        console.log(report.executive_summary);
      }
      if (report.overall_strengths) {
        console.log('\nStrengths:');
        console.log(report.overall_strengths);
      }
      if (report.development_areas) {
        console.log('\nDevelopment Areas:');
        console.log(report.development_areas);
      }
      if (report.themes) {
        console.log('\nThemes:', JSON.stringify(report.themes, null, 2));
      }
    }
  }
}

getJax360Feedback();
