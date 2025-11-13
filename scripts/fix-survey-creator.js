const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSurveyCreator() {
  console.log('=== Fixing Survey Creator IDs ===\n');

  const correctThomasId = '5b1e1ee7-5850-4b7f-8881-9304c17ab63f';
  const wrongCreatorId = '7c511164-a69c-4a8c-913d-a691d3b169b5';

  // Find all surveys with the wrong creator ID
  const { data: surveys, error: findError } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, created_by')
    .eq('created_by', wrongCreatorId);

  if (findError) {
    console.error('Error finding surveys:', findError);
    return;
  }

  console.log(`Found ${surveys?.length || 0} survey(s) with incorrect creator ID:\n`);
  surveys?.forEach((survey) => {
    console.log(`- ${survey.survey_name} (${survey.id})`);
  });

  if (!surveys || surveys.length === 0) {
    console.log('\nNo surveys to fix!');
    return;
  }

  console.log('\nUpdating creator IDs...\n');

  // Update all surveys
  const { data: updated, error: updateError } = await supabase
    .from('feedback_360_surveys')
    .update({ created_by: correctThomasId })
    .eq('created_by', wrongCreatorId)
    .select();

  if (updateError) {
    console.error('Error updating surveys:', updateError);
    return;
  }

  console.log(`✓ Successfully updated ${updated?.length || 0} survey(s)!`);
  console.log(`\nUpdated surveys:`);
  updated?.forEach((survey) => {
    console.log(`- ${survey.survey_name}`);
    console.log(`  New created_by: ${survey.created_by}`);
  });
}

fixSurveyCreator();
