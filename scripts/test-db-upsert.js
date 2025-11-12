/**
 * Test database upsert to see if we can save reports
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const surveyId = '0e040061-226e-4c02-aa8f-a4e02df9c80b';

async function testUpsert() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('🧪 Testing database upsert for feedback_360_reports');
  console.log('');

  const testReport = {
    survey_id: surveyId,
    themes: [
      {
        theme: 'Test Theme',
        sentiment: 'positive',
        frequency: 5,
      },
    ],
    overall_strengths: ['Test strength'],
    development_areas: ['Test area'],
    recommendations: ['Test recommendation'],
    sentiment_by_relationship: {
      overall: 0.85,
      manager: 0.90,
      peer: 0.80,
      direct_report: 0.88,
      cross_functional: 0.82,
    },
    key_insights: ['Test insight'],
    consensus_areas: ['Test consensus'],
    outlier_opinions: ['Test outlier'],
    generated_by: 'test-script',
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('📝 Attempting upsert...');
  const { data, error } = await supabase
    .from('feedback_360_reports')
    .upsert(testReport, {
      onConflict: 'survey_id',
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Upsert failed:');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
    return;
  }

  console.log('✅ Upsert successful!');
  console.log('   Report ID:', data.id);
  console.log('');

  // Now try to fetch it back
  console.log('🔍 Fetching report back...');
  const { data: fetched, error: fetchError } = await supabase
    .from('feedback_360_reports')
    .select('*')
    .eq('survey_id', surveyId)
    .single();

  if (fetchError) {
    console.error('❌ Fetch failed:', fetchError.message);
    return;
  }

  console.log('✅ Report fetched successfully');
  console.log('   Sentiment by relationship:', fetched.sentiment_by_relationship);

  // Clean up - delete the test report
  console.log('');
  console.log('🧹 Cleaning up test data...');
  const { error: deleteError } = await supabase
    .from('feedback_360_reports')
    .delete()
    .eq('survey_id', surveyId);

  if (deleteError) {
    console.error('⚠️  Could not delete test data:', deleteError.message);
  } else {
    console.log('✅ Test data cleaned up');
  }
}

testUpsert().catch(console.error);
