/**
 * Check what data is currently in the report for this survey
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const surveyId = '0e040061-226e-4c02-aa8f-a4e02df9c80b';

async function checkReportData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('🔍 Checking report data for survey:', surveyId);
  console.log('');

  const { data: report, error } = await supabase
    .from('feedback_360_reports')
    .select('*')
    .eq('survey_id', surveyId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!report) {
    console.log('⚠️  No report found');
    return;
  }

  console.log('📊 Report Data:');
  console.log('  Generated at:', report.generated_at);
  console.log('  Updated at:', report.updated_at);
  console.log('');

  console.log('🎯 Sentiment by Relationship:');
  console.log(JSON.stringify(report.sentiment_by_relationship, null, 2));
  console.log('');

  // Check what fields exist
  const hasRelationshipData =
    report.sentiment_by_relationship?.manager !== undefined ||
    report.sentiment_by_relationship?.peer !== undefined ||
    report.sentiment_by_relationship?.direct_report !== undefined ||
    report.sentiment_by_relationship?.cross_functional !== undefined;

  if (hasRelationshipData) {
    console.log('⚠️  REPORT HAS RELATIONSHIP BREAKDOWN');
    console.log('   This is the NEW format with per-relationship scores');
    console.log('   Subjects should NOT see these fields!');
  } else {
    console.log('✅ REPORT ONLY HAS OVERALL SCORE');
    console.log('   This is the OLD format or already filtered');
    console.log('   Safe for subjects to view');
  }
}

checkReportData().catch(console.error);
