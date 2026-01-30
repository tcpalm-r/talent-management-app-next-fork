import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getDerick360Feedback() {
  // Find Derick Dahl
  const { data: derick, error: derickError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .ilike('full_name', '%derick%dahl%')
    .single();

  if (derickError || !derick) {
    console.log('Could not find Derick Dahl:', derickError?.message);
    return;
  }

  console.log('Found:', derick.full_name, '(' + derick.email + ')');
  console.log('');

  // Get his surveys
  const { data: surveys } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, status, due_date, created_at')
    .eq('employee_id', derick.id);

  if (!surveys || surveys.length === 0) {
    console.log('No 360 surveys found for Derick');
    return;
  }

  console.log('Surveys:', surveys.length);

  for (const survey of surveys) {
    console.log('\n=== Survey: ' + survey.survey_name + ' ===');
    console.log('Status:', survey.status);
    console.log('Due:', survey.due_date);

    // Get reviewers and their responses
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

    console.log('\nResponses (' + (responses?.length || 0) + '):');
    for (const resp of responses || []) {
      const q = resp.question as any;
      console.log('\n[' + (q?.category || 'General') + '] ' + (q?.question_text || 'Unknown question'));
      console.log('Response:', resp.response_text);
    }

    // Check for AI-generated report
    const { data: report } = await supabase
      .from('feedback_360_reports')
      .select('themes, overall_strengths, development_areas, consensus_areas')
      .eq('survey_id', survey.id)
      .single();

    if (report) {
      console.log('\n--- AI-Generated Analysis ---');
      console.log('Themes:', JSON.stringify(report.themes, null, 2));
      console.log('Strengths:', report.overall_strengths);
      console.log('Development Areas:', report.development_areas);
    }
  }
}

getDerick360Feedback();
