/**
 * Find completed surveys with responses
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Finding completed surveys with responses...\n');

  const { data: surveys } = await supabase
    .from('feedback_360_surveys')
    .select(`
      id,
      survey_name,
      status,
      employee_id,
      created_at,
      user_profiles!feedback_360_surveys_employee_id_fkey (
        full_name,
        email
      )
    `)
    .in('status', ['completed', 'finalized'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (!surveys || surveys.length === 0) {
    console.log('❌ No completed surveys found');
    return;
  }

  console.log(`Found ${surveys.length} completed surveys:\n`);

  for (const survey of surveys) {
    // Count responses
    const { data: responses } = await supabase
      .from('feedback_360_responses')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', survey.id);

    const { count: responseCount } = await supabase
      .from('feedback_360_responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', survey.id);

    const employee = survey.user_profiles;

    console.log(`Survey: ${survey.survey_name}`);
    console.log(`  ID: ${survey.id}`);
    console.log(`  Employee: ${employee?.full_name || 'Unknown'}`);
    console.log(`  Status: ${survey.status}`);
    console.log(`  Responses: ${responseCount || 0}`);
    console.log(`  Created: ${survey.created_at}`);
    console.log('');
  }
}

main().catch(console.error);
