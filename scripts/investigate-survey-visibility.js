const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('=== INVESTIGATING SURVEY VISIBILITY ISSUE ===\n');

  // 1. Find Alex Fournier and Eliseo Cambray
  console.log('1. Finding users...');
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, app_role')
    .or('full_name.ilike.%Alex Fournier%,full_name.ilike.%Eliseo Cambray%');

  if (usersError) {
    console.error('Error finding users:', usersError);
    return;
  }

  console.log('Found users:', JSON.stringify(users, null, 2));
  const alex = users.find(u => u.full_name.includes('Alex Fournier'));
  const eliseo = users.find(u => u.full_name.includes('Eliseo Cambray'));

  if (!alex && !eliseo) {
    console.log('Could not find Alex Fournier or Eliseo Cambray');
    return;
  }

  const targetUser = alex || eliseo;
  console.log(`\n2. Investigating for user: ${targetUser.full_name} (${targetUser.email})`);
  console.log(`   ID: ${targetUser.id}`);
  console.log(`   Role: ${targetUser.app_role}\n`);

  // 2. Find all surveys with their employee details
  console.log('3. Finding all recent surveys...');
  const { data: surveys, error: surveysError } = await supabase
    .from('feedback_360_surveys')
    .select(`
      id,
      employee_id,
      created_by,
      status,
      survey_name,
      created_at,
      reviewers:feedback_360_survey_reviewers(
        id,
        reviewer_email,
        status
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (surveysError) {
    console.error('Error finding surveys:', surveysError);
    return;
  }

  // Get employee names
  const employeeIds = surveys.map(s => s.employee_id);
  const { data: employees } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', employeeIds);

  const employeeMap = {};
  employees?.forEach(emp => {
    employeeMap[emp.id] = emp.full_name;
  });

  console.log(`Found ${surveys.length} surveys:\n`);

  surveys.forEach((survey, idx) => {
    const employeeName = employeeMap[survey.employee_id] || 'Unknown';
    console.log(`Survey ${idx + 1}:`);
    console.log(`  ID: ${survey.id}`);
    console.log(`  Survey Name: ${survey.survey_name || 'N/A'}`);
    console.log(`  Employee: ${employeeName}`);
    console.log(`  Employee ID: ${survey.employee_id}`);
    console.log(`  Created By: ${survey.created_by}`);
    console.log(`  Status: ${survey.status}`);
    console.log(`  Reviewers: ${JSON.stringify(survey.reviewers, null, 2)}`);

    // Check if target user should see this survey
    const isCreator = survey.created_by === targetUser.id || survey.created_by === targetUser.email;
    const isSubject = survey.employee_id === targetUser.id;
    const isReviewer = survey.reviewers?.some(r => r.reviewer_email === targetUser.email);

    console.log(`\n  Should ${targetUser.full_name} see this survey?`);
    console.log(`    - Is Creator: ${isCreator} (comparing "${survey.created_by}" to "${targetUser.id}" or "${targetUser.email}")`);
    console.log(`    - Is Subject: ${isSubject} (comparing "${survey.employee_id}" to "${targetUser.id}")`);
    console.log(`    - Is Reviewer: ${isReviewer}`);
    console.log(`    - Status: ${survey.status} (draft = hidden for non-creators)`);

    const shouldSee = isCreator || (survey.status !== 'draft' && (isSubject || isReviewer));
    console.log(`    - CONCLUSION: ${shouldSee ? 'YES - SHOULD SEE' : 'NO - SHOULD NOT SEE'}\n`);
  });

  // 3. Check if there are any manager relationships
  console.log('\n4. Checking manager relationships...');
  const { data: directReports, error: reportsError } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('manager_id', targetUser.id);

  if (!reportsError && directReports && directReports.length > 0) {
    console.log(`${targetUser.full_name} has ${directReports.length} direct reports:`);
    directReports.forEach(dr => {
      console.log(`  - ${dr.full_name} (ID: ${dr.id})`);
    });
  } else {
    console.log(`${targetUser.full_name} has no direct reports.`);
  }

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

investigate().catch(console.error);
