/**
 * Regenerate a 360 report to test the new per-relationship sentiment analysis
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const surveyId = process.argv[2] || '0e040061-226e-4c02-aa8f-a4e02df9c80b';

async function regenerateReport() {
  console.log('🔄 Regenerating report for survey:', surveyId);
  console.log('');

  try {
    const response = await fetch('http://localhost:3004/api/360-generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        survey_id: surveyId,
        tone: 'standard'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', data.error || data.message);
      console.error('Details:', data.details);
      console.log('\n⚠️  Note: This endpoint requires authentication.');
      console.log('💡 Alternative: Use the UI to regenerate the report:');
      console.log('   1. Start dev server: npm run dev');
      console.log('   2. Login to the app');
      console.log('   3. Go to 360 Feedback Dashboard');
      console.log('   4. Open the survey');
      console.log('   5. Click "Reanalyze" button');
      return;
    }

    console.log('✅ Report regenerated successfully!\n');
    console.log('Sentiment by relationship:');
    console.log(JSON.stringify(data.report.sentiment_by_relationship, null, 2));

    // Check if it has relationship breakdown
    const sentiment = data.report.sentiment_by_relationship;
    const hasBreakdown = sentiment.manager || sentiment.peer ||
                         sentiment.direct_report || sentiment.cross_functional;

    if (hasBreakdown) {
      console.log('\n✅ SUCCESS: Report now has per-relationship sentiment scores!');
      console.log('\nNext steps:');
      console.log('1. Finalize the survey (status: completed → finalized)');
      console.log('2. Test viewing as sponsor (should see all relationships)');
      console.log('3. Test viewing as subject (should see only overall)');
    } else {
      console.log('\n⚠️  Report still only has overall score');
      console.log('This might happen if:');
      console.log('- The AI didn\'t generate per-relationship scores');
      console.log('- There aren\'t enough responses from different relationship types');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the dev server is running: npm run dev');
  }
}

regenerateReport();
