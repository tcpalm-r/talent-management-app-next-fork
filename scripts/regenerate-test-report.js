/**
 * Regenerate a test 360 report with 6 reviewers
 * This will trigger the AI to generate a new report with the executive summary
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function regenerateTestReport() {
  try {
    // Find a completed survey with 6 reviewers
    const { data: surveys, error: surveysError } = await supabase
      .from('feedback_360_surveys')
      .select(`
        id,
        survey_name,
        status,
        employee_id,
        reviewers:feedback_360_survey_reviewers(id, status)
      `)
      .eq('status', 'completed')
      .limit(20);

    if (surveysError) {
      console.error('Error fetching surveys:', surveysError);
      return;
    }

    // Find one with 6 reviewers
    const targetSurvey = surveys.find(s => s.reviewers && s.reviewers.length === 6);

    if (!targetSurvey) {
      console.log('No completed survey found with 6 reviewers');
      console.log('Available surveys:');
      surveys.forEach(s => {
        console.log(`  - ${s.survey_name}: ${s.reviewers?.length || 0} reviewers, status: ${s.status}`);
      });

      // Use the first completed survey regardless
      const anySurvey = surveys.find(s => s.status === 'completed');
      if (!anySurvey) {
        console.log('No completed surveys found at all');
        return;
      }

      console.log(`\nUsing survey: ${anySurvey.survey_name} with ${anySurvey.reviewers?.length || 0} reviewers`);
      console.log(`Survey ID: ${anySurvey.id}`);
      console.log('\nTo regenerate, call the API:');
      console.log(`POST http://localhost:3004/api/360-generate-report`);
      console.log(`Body: { "survey_id": "${anySurvey.id}" }`);
      return;
    }

    console.log(`Found survey: ${targetSurvey.survey_name}`);
    console.log(`Survey ID: ${targetSurvey.id}`);
    console.log(`Reviewers: ${targetSurvey.reviewers.length}`);
    console.log('\nTo regenerate, call the API:');
    console.log(`POST http://localhost:3004/api/360-generate-report`);
    console.log(`Body: { "survey_id": "${targetSurvey.id}" }`);

  } catch (error) {
    console.error('Error:', error);
  }
}

regenerateTestReport();
