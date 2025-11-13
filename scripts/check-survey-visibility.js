const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVisibility() {
  console.log('=== Checking Survey Visibility Logic ===\n');

  const thomasId = '5b1e1ee7-5850-4b7f-8881-9304c17ab63f';
  const thomasEmail = 'thomas.palmer@sonance.com';

  const surveys = [
    { id: 'cfa36302-c024-4248-a159-19fc24b3b3e1', name: 'Elliott Amador' },
    { id: 'd2644336-96fd-42c8-93e0-626974757f2c', name: 'Leader 1 [TEST]' }
  ];

  for (const survey of surveys) {
    console.log(`\n--- ${survey.name} Survey ---`);

    const { data, error } = await supabase
      .from('feedback_360_surveys')
      .select(`
        id,
        survey_name,
        created_by,
        employee_id,
        status,
        reviewers:feedback_360_survey_reviewers(reviewer_email)
      `)
      .eq('id', survey.id)
      .single();

    if (error) {
      console.error('Error:', error);
      continue;
    }

    console.log(`Survey ID: ${data.id}`);
    console.log(`Created by: ${data.created_by}`);
    console.log(`Employee ID: ${data.employee_id}`);
    console.log(`Status: ${data.status}`);
    console.log(`\nVisibility checks for Thomas Palmer (${thomasId}):`);

    // Check 1: Created by this user
    const createdByMatch = data.created_by === thomasId;
    console.log(`  ✓ Created by user: ${createdByMatch ? 'YES' : 'NO'}`);

    // Check 2: Subject is this user
    const subjectMatch = data.employee_id === thomasId;
    console.log(`  ✓ Subject is user: ${subjectMatch ? 'YES' : 'NO'}`);

    // Check 3: User is a reviewer
    const isReviewer = data.reviewers?.some(r => r.reviewer_email === thomasEmail);
    console.log(`  ✓ User is reviewer: ${isReviewer ? 'YES' : 'NO'}`);

    // Check 4: Check if Thomas is the subject
    const { data: subject } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('id', data.employee_id)
      .single();

    if (subject) {
      console.log(`\nSubject: ${subject.full_name} (${subject.email})`);
    }

    // Determine visibility
    const shouldBeVisible = createdByMatch || subjectMatch || (isReviewer && data.status !== 'draft');
    console.log(`\n=> Should be visible: ${shouldBeVisible ? 'YES' : 'NO'}`);
  }
}

checkVisibility();
