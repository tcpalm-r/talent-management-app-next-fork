/**
 * Test script for iterating on the survey analyzer prompt
 * Finds a survey with responses and triggers report regeneration
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findSurveyWithResponses() {
  // Find surveys with responses
  const { data: surveys, error } = await supabase
    .from('feedback_360_surveys')
    .select(`
      id,
      survey_name,
      status,
      employee_id
    `)
    // Get all surveys to see what's available
    // .in('status', ['completed', 'finalized', 'closed', 'needs_reanalysis'])
    .limit(20);

  if (error) {
    console.error('Error fetching surveys:', error);
    return null;
  }

  // Get response counts for each
  for (const survey of surveys) {
    const { count } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('id', { count: 'exact' })
      .eq('survey_id', survey.id)
      .eq('status', 'completed');

    survey.completed_reviewers = count || 0;
  }

  // Sort by most responses
  surveys.sort((a, b) => b.completed_reviewers - a.completed_reviewers);

  console.log('\nAvailable surveys with completed responses:');
  console.log('─'.repeat(80));
  surveys.forEach(s => {
    console.log(`  ${s.id.substring(0, 8)}... | ${s.survey_name.padEnd(40)} | ${s.completed_reviewers} reviewers | ${s.status}`);
  });
  console.log('─'.repeat(80));

  return surveys[0]; // Return the one with most responses
}

async function triggerRegeneration(surveyId) {
  console.log(`\nTriggering report regeneration for survey: ${surveyId}`);
  console.log('This may take 1-2 minutes...\n');

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3004/api/360-generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ survey_id: surveyId }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${elapsed}s):`, errorText);
      return null;
    }

    const result = await response.json();
    console.log(`✅ Report generated in ${elapsed}s`);

    return result;
  } catch (err) {
    console.error('❌ Request failed:', err.message);
    return null;
  }
}

function analyzeReport(report) {
  if (!report || !report.report) {
    console.log('No report data to analyze');
    return;
  }

  const r = report.report;

  console.log('\n' + '═'.repeat(80));
  console.log('REPORT ANALYSIS');
  console.log('═'.repeat(80));

  // Executive summary
  console.log('\n📋 EXECUTIVE SUMMARY:');
  console.log(`   ${r.executive_summary || 'N/A'}`);

  // Theme analysis
  if (r.themes && r.themes.length > 0) {
    console.log('\n📊 THEMES:');
    r.themes.forEach((theme, i) => {
      const citationCount = theme.supporting_evidence?.reduce((sum, ev) => {
        return sum + (ev.citations?.length || 0);
      }, 0) || 0;

      const uniqueResponseIds = new Set();
      theme.supporting_evidence?.forEach(ev => {
        ev.citations?.forEach(c => {
          if (c.response_id) uniqueResponseIds.add(c.response_id);
        });
      });

      console.log(`   ${i + 1}. ${theme.theme}`);
      console.log(`      Sentiment: ${theme.sentiment} | Citations: ${citationCount} | Unique responses: ${uniqueResponseIds.size}`);
    });
  }

  // Citation coverage analysis
  console.log('\n🔍 CITATION COVERAGE:');
  const allCitedIds = new Set();

  const countCitations = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      if (item.citations) {
        item.citations.forEach(c => {
          if (c.response_id) allCitedIds.add(c.response_id);
        });
      }
    });
  };

  // Count from all sections
  r.themes?.forEach(t => countCitations(t.supporting_evidence));
  countCitations(r.overall_strengths);
  countCitations(r.development_areas);
  countCitations(r.recommendations);
  countCitations(r.key_insights);
  countCitations(r.consensus_areas);
  countCitations(r.outlier_opinions);

  console.log(`   Total unique response_ids cited: ${allCitedIds.size}`);

  // Mixed sentiment check
  const mixedThemes = r.themes?.filter(t => t.sentiment === 'mixed') || [];
  console.log(`   Themes with 'mixed' sentiment: ${mixedThemes.length}`);
  mixedThemes.forEach(t => {
    console.log(`      - ${t.theme}`);
  });

  // Sentiment scores
  if (r.sentiment_by_relationship) {
    console.log('\n📈 SENTIMENT SCORES:');
    Object.entries(r.sentiment_by_relationship).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }

  console.log('\n' + '═'.repeat(80));
}

async function main() {
  const args = process.argv.slice(2);
  const surveyId = args[0];

  let targetSurvey;

  if (surveyId) {
    targetSurvey = { id: surveyId };
    console.log(`Using provided survey ID: ${surveyId}`);
  } else {
    targetSurvey = await findSurveyWithResponses();
    if (!targetSurvey) {
      console.log('No suitable survey found');
      process.exit(1);
    }
    console.log(`\nSelected survey: ${targetSurvey.survey_name} (${targetSurvey.completed_reviewers} reviewers)`);
  }

  const result = await triggerRegeneration(targetSurvey.id);

  if (result) {
    analyzeReport(result);
  }
}

main().catch(console.error);
