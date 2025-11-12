/**
 * Debug script to test API filtering
 */

const surveyId = '0e040061-226e-4c02-aa8f-a4e02df9c80b';

async function testAPIFiltering() {
  console.log('🔍 Testing API Filtering for Survey:', surveyId);
  console.log('');

  try {
    // Test 1: Call API endpoint
    console.log('📡 Calling GET /api/360-generate-report...');
    const response = await fetch(`http://localhost:3004/api/360-generate-report?survey_id=${surveyId}`, {
      headers: {
        'Cookie': document.cookie // Pass cookies for auth
      }
    });

    const data = await response.json();

    console.log('\n✅ Response Status:', response.status);
    console.log('✅ Response Data Keys:', Object.keys(data));

    if (data.viewerRole) {
      console.log('\n🎭 Viewer Role:', data.viewerRole);
    }

    if (data.report && data.report.sentiment_by_relationship) {
      console.log('\n📊 Sentiment by Relationship Keys:');
      console.log('   ', Object.keys(data.report.sentiment_by_relationship));

      const hasRelationshipData =
        data.report.sentiment_by_relationship.manager !== undefined ||
        data.report.sentiment_by_relationship.peer !== undefined ||
        data.report.sentiment_by_relationship.direct_report !== undefined ||
        data.report.sentiment_by_relationship.cross_functional !== undefined;

      if (hasRelationshipData) {
        console.log('   ⚠️  HAS relationship breakdown (sponsor/admin view)');
        console.log('   If you are the SUBJECT, this is wrong!');
      } else {
        console.log('   ✅ NO relationship breakdown (subject view)');
        console.log('   Only has overall score - correct!');
      }

      console.log('\n📈 Full sentiment_by_relationship:');
      console.log(JSON.stringify(data.report.sentiment_by_relationship, null, 2));
    }

    if (data.error) {
      console.log('\n❌ Error:', data.error);
      console.log('   Message:', data.message);
    }

  } catch (error) {
    console.error('\n❌ Fetch Error:', error.message);
  }
}

// Run test
testAPIFiltering();
