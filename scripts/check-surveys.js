const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSurveys() {
  console.log('Fetching all 360 surveys...\n');

  const { data: surveys, error } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, status, created_at, employee_id, created_by')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!surveys || surveys.length === 0) {
    console.log('No surveys found');
    return;
  }

  console.log(`Found ${surveys.length} survey(s):\n`);

  for (const survey of surveys) {
    console.log(`Survey ID: ${survey.id}`);
    console.log(`  Name: ${survey.survey_name || 'Untitled'}`);
    console.log(`  Status: ${survey.status}`);
    console.log(`  Created: ${new Date(survey.created_at).toLocaleString()}`);
    console.log(`  Employee ID: ${survey.employee_id}`);
    console.log(`  Created By: ${survey.created_by}`);

    // Check reviewers
    const { count: reviewerCount } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', survey.id);

    console.log(`  Reviewers: ${reviewerCount || 0}`);

    // Check report
    const { data: report } = await supabase
      .from('feedback_360_reports')
      .select('id')
      .eq('survey_id', survey.id)
      .single();

    console.log(`  AI Report: ${report ? 'Yes' : 'No'}`);
    console.log('');
  }
}

checkSurveys();
