/**
 * Check if the executive summary was generated
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExecutiveSummary() {
  const surveyId = 'd2644336-96fd-42c8-93e0-626974757f2c';

  const { data, error } = await supabase
    .from('feedback_360_reports')
    .select('*')
    .eq('survey_id', surveyId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Report generated at:', data.generated_at);
  console.log('\nAll columns:', Object.keys(data));
  console.log('\nChecking for executive_summary field...');

  // Try different possible column names
  const reportData = data.report || data.analysis || data;

  if (reportData && typeof reportData === 'object') {
    if ('executive_summary' in reportData) {
      console.log('✅ Executive summary EXISTS!');
      console.log('\nExecutive Summary:');
      console.log(reportData.executive_summary);
    } else {
      console.log('❌ Executive summary NOT FOUND in report');
      console.log('\nReport fields present:');
      console.log(Object.keys(reportData));
    }
  } else {
    console.log('❌ No report data found');
  }
}

checkExecutiveSummary();
