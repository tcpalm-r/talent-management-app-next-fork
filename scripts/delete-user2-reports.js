const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findAndDeleteReports() {
  // First find the user
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .ilike('full_name', '%User 2%TEST%');

  if (userError) {
    console.error('Error finding user:', userError);
    return;
  }

  console.log('Found users:', users);

  if (!users || users.length === 0) {
    console.log('No users found matching "User 2 [TEST]"');
    return;
  }

  const userIds = users.map(u => u.id);
  console.log('User IDs:', userIds);

  // Find surveys for these users
  const { data: surveys, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name')
    .in('employee_id', userIds);

  if (surveyError) {
    console.error('Error finding surveys:', surveyError);
    return;
  }

  console.log('Found surveys:', surveys);

  if (!surveys || surveys.length === 0) {
    console.log('No surveys found for User 2 [TEST]');
    return;
  }

  const surveyIds = surveys.map(s => s.id);
  console.log('Survey IDs to delete reports for:', surveyIds);

  // First find the reports
  const { data: reports } = await supabase
    .from('feedback_360_reports')
    .select('id')
    .in('survey_id', surveyIds);

  if (reports && reports.length > 0) {
    const reportIds = reports.map(r => r.id);
    console.log('Report IDs to delete:', reportIds);

    // Delete citations first (they reference reports)
    const { error: citationError } = await supabase
      .from('feedback_360_report_citations')
      .delete()
      .in('report_id', reportIds);

    if (citationError) {
      console.error('Error deleting citations:', citationError);
    } else {
      console.log('Deleted citations for reports');
    }
  }

  // Delete reports for these surveys
  const { data: deleted, error: deleteError } = await supabase
    .from('feedback_360_reports')
    .delete()
    .in('survey_id', surveyIds)
    .select();

  if (deleteError) {
    console.error('Error deleting reports:', deleteError);
  } else {
    console.log('Deleted reports:', deleted?.length || 0, deleted);
  }

  // Also reset survey status back to in_progress if it was completed
  const { data: updated, error: updateError } = await supabase
    .from('feedback_360_surveys')
    .update({ status: 'in_progress', completed_at: null })
    .in('id', surveyIds)
    .in('status', ['completed', 'finalized'])
    .select();

  if (updateError) {
    console.error('Error updating survey status:', updateError);
  } else {
    console.log('Reset survey status for:', updated?.length || 0, 'surveys');
  }
}

findAndDeleteReports();
