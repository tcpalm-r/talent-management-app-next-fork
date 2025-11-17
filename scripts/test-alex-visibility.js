const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAlexVisibility() {
  console.log('=== TESTING ALEX FOURNIER SURVEY VISIBILITY ===\n');

  // 1. Get Alex's profile
  const { data: alexProfile, error: alexError } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('full_name', '%Alex Fournier%')
    .single();

  if (alexError || !alexProfile) {
    console.error('Could not find Alex Fournier:', alexError);
    return;
  }

  console.log('Alex Fournier Profile:');
  console.log(`  ID: ${alexProfile.id}`);
  console.log(`  Email: ${alexProfile.email}`);
  console.log(`  Role: ${alexProfile.app_role}\n`);

  // 2. Fetch all surveys with reviewers
  const { data: allSurveys, error: surveysError } = await supabase
    .from('feedback_360_surveys')
    .select(`
      *,
      reviewers:feedback_360_survey_reviewers(
        id,
        status,
        reviewer_email,
        access_token
      )
    `)
    .order('created_at', { ascending: false });

  if (surveysError) {
    console.error('Error fetching surveys:', surveysError);
    return;
  }

  console.log(`Total surveys in database: ${allSurveys.length}\n`);

  // 3. Apply the same filtering logic as the API for regular users
  let filteredSurveys = allSurveys.filter((survey) => {
    const isCreator = survey.created_by === alexProfile.id || survey.created_by === alexProfile.email;
    const isSubject = survey.employee_id === alexProfile.id;
    const isReviewer = survey.reviewers?.some(r => r.reviewer_email === alexProfile.email);

    // Apply the filtering logic from app/api/surveys/list/route.ts
    if (isCreator) return true;
    if (survey.status === 'draft') return false;
    if (isSubject && survey.status === 'finalized') return true;
    if (isReviewer) return true;

    return false;
  });

  console.log(`Filtered surveys Alex should see: ${filteredSurveys.length}\n`);

  if (filteredSurveys.length > 0) {
    console.log('Surveys Alex SHOULD see:');
    for (const survey of filteredSurveys) {
      // Get employee name
      const { data: emp } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', survey.employee_id)
        .single();

      const isCreator = survey.created_by === alexProfile.id || survey.created_by === alexProfile.email;
      const isSubject = survey.employee_id === alexProfile.id;
      const isReviewer = survey.reviewers?.some(r => r.reviewer_email === alexProfile.email);

      console.log(`\n  Survey: ${survey.survey_name || 'Untitled'}`);
      console.log(`    Employee: ${emp?.full_name || 'Unknown'}`);
      console.log(`    Status: ${survey.status}`);
      console.log(`    Reason visible:`);
      if (isCreator) console.log(`      - Created by Alex`);
      if (isSubject) console.log(`      - Alex is the subject (status: ${survey.status})`);
      if (isReviewer) console.log(`      - Alex is a reviewer`);
    }
  } else {
    console.log('✅ Alex Fournier should NOT see any surveys based on the filtering logic.\n');
  }

  // 4. Check which surveys Alex should NOT see but might be showing
  let excludedSurveys = allSurveys.filter((survey) => {
    const isCreator = survey.created_by === alexProfile.id || survey.created_by === alexProfile.email;
    const isSubject = survey.employee_id === alexProfile.id;
    const isReviewer = survey.reviewers?.some(r => r.reviewer_email === alexProfile.email);

    if (isCreator) return false;
    if (survey.status === 'draft') return true;
    if (isSubject && survey.status === 'finalized') return false;
    if (isReviewer) return false;

    return true;
  });

  if (excludedSurveys.length > 0) {
    console.log(`\nSurveys Alex SHOULD NOT see: ${excludedSurveys.length}`);
    for (const survey of excludedSurveys.slice(0, 5)) {
      const { data: emp } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', survey.employee_id)
        .single();

      console.log(`\n  Survey: ${survey.survey_name || 'Untitled'}`);
      console.log(`    Employee: ${emp?.full_name || 'Unknown'}`);
      console.log(`    Status: ${survey.status}`);
      console.log(`    Created by: ${survey.created_by}`);
    }
  }

  console.log('\n=== TEST COMPLETE ===');
}

testAlexVisibility().catch(console.error);
