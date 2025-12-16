const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ynycbfyzbavbgxvniylt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlueWNiZnl6YmF2Ymd4dm5peWx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODEyMTUyMiwiZXhwIjoyMDczNjk3NTIyfQ.xCyvrSs3RH1fZXqkh7NllVVY9vR-IDLlMFuwqHo96RE'
);

async function checkReportData() {
  // First, let's see what columns exist
  const { data: reports, error } = await supabase
    .from('feedback_360_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching reports:', error);
    return;
  }

  if (!reports || reports.length === 0) {
    console.log('No reports found');
    return;
  }

  const report = reports[0];
  console.log('Available columns:', Object.keys(report));
  console.log('\n========================================');
  console.log('Latest Report:');
  console.log('Survey ID:', report.survey_id);
  console.log('Created:', report.created_at);
  console.log('\n--- consensus_areas ---');
  console.log(JSON.stringify(report.consensus_areas, null, 2));
  console.log('\n--- varied_by_relationship ---');
  console.log(JSON.stringify(report.varied_by_relationship, null, 2));
  console.log('\n--- outliers ---');
  console.log(JSON.stringify(report.outliers, null, 2));
  console.log('\n--- outlier_opinions (old field) ---');
  console.log(JSON.stringify(report.outlier_opinions, null, 2));
  console.log('========================================\n');
}

checkReportData().catch(console.error);
