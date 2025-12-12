/**
 * DRY RUN script - RELAXED CITATION VERSION
 *
 * This tests a modified prompt with relaxed citation requirements:
 * - 2-3 representative citations per theme (not exhaustive)
 * - No 100% response coverage requirement
 * - Focus on quality insights over citation quantity
 */

require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk').default;
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!anthropicKey) {
  console.error('Missing ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

const surveyAnalyzerConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 8192,  // Reduced from 16000
  temperature: 0.1,
};

/**
 * RELAXED PROMPT - Key differences:
 * 1. "2-3 representative citations" instead of "cite EVERY response"
 * 2. No "100% response coverage" requirement
 * 3. Shorter snippet requirement (10-20 words)
 */
function buildRelaxedPrompt({ employeeName, surveyTitle, responseCount, questionsFormatted, structuredResponses, tone }) {
  const toneInstruction = tone === 'softer'
    ? `\nTONE: Use encouraging, growth-oriented language. Frame development areas as opportunities.`
    : '';

  return `You are an expert HR analyst specializing in 360-degree feedback analysis. Analyze the following survey responses and produce a comprehensive, data-driven report.

CITATION RULES (SIMPLIFIED):
1. Every analytical statement MUST have 1-3 citations with valid response_ids
2. Use the exact response_id values provided in [response_id: xxx] markers
3. Include a 10-20 word verbatim snippet from the source response
4. Choose the MOST ILLUSTRATIVE examples - you don't need to cite every relevant response
5. Never fabricate response_ids - only use IDs from the input data

SENTIMENT VALUES:
- "very_positive" - Exceptional performance
- "positive" - Generally positive, meets expectations
- "mixed" - Contains both positive and negative elements
- "needs_work" - Areas requiring improvement
- "critical" - Significant concerns raised

MIXED SENTIMENT RULE:
When reviewers disagree on a topic, create ONE theme with sentiment "mixed" and include evidence from both perspectives.

AVOIDING HALLUCINATION:
- Do NOT invent details, metrics, or specifics not in the responses
- Paraphrase actual feedback - do not embellish
- Stay close to original wording when uncertain

JSON FORMAT:
- Replace double quotes in source text with single quotes in snippets
- Return ONLY valid JSON, no text before or after

Return this structure:

{
  "themes": [
    {
      "theme": "Theme name",
      "sentiment": "positive|mixed|needs_work",
      "supporting_evidence": [
        {
          "text": "Synthesized observation",
          "citations": [
            { "response_id": "uuid", "snippet": "10-20 word excerpt" }
          ]
        }
      ]
    }
  ],
  "overall_strengths": [
    { "text": "Strength", "citations": [{ "response_id": "uuid", "snippet": "excerpt" }] }
  ],
  "development_areas": [
    { "text": "Area", "citations": [{ "response_id": "uuid", "snippet": "excerpt" }] }
  ],
  "recommendations": [
    { "text": "Recommendation", "citations": [{ "response_id": "uuid", "snippet": "excerpt" }] }
  ],
  "sentiment_by_relationship": {
    "overall": 0.8,
    "manager": 0.85,
    "direct_report": 0.75
  },
  "consensus_areas": [
    { "text": "Area of agreement", "citations": [{ "response_id": "uuid", "snippet": "excerpt" }] }
  ],
  "outlier_opinions": [
    { "text": "Unique perspective", "citations": [{ "response_id": "uuid", "snippet": "excerpt" }] }
  ]
}

ANALYSIS GUIDELINES:
- Identify 5-8 major themes
- 3-5 strengths and development areas
- 4-6 actionable recommendations
- Focus on quality insights over exhaustive citation
${toneInstruction}
EMPLOYEE: ${employeeName}
SURVEY: ${surveyTitle}
RESPONSES: ${responseCount}

QUESTIONS:
${questionsFormatted}

RESPONSES BY RELATIONSHIP:
${structuredResponses}

Return ONLY valid JSON.`;
}

function extractQuestionText(questionText) {
  if (!questionText) return '';
  let text = questionText;
  try {
    while (typeof text === 'string' && text.startsWith('{')) {
      const parsed = JSON.parse(text);
      text = parsed.text || text;
      if (text === questionText) break;
    }
  } catch {
    // If parsing fails, return original
  }
  return text;
}

async function fetchSurveyData(surveyId) {
  console.log(`\nFetching data for survey: ${surveyId}`);

  const { data: survey, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', surveyId)
    .single();

  if (surveyError) {
    console.error('Error fetching survey:', surveyError);
    return null;
  }

  console.log(`  Survey: ${survey.survey_name}`);

  const { data: employee } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', survey.employee_id)
    .single();

  const employeeName = employee?.full_name || 'Unknown Employee';
  console.log(`  Employee: ${employeeName}`);

  const { data: responses, error: responsesError } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', surveyId);

  if (responsesError) {
    console.error('Error fetching responses:', responsesError);
    return null;
  }

  console.log(`  Response rows: ${responses.length}`);

  const questionIds = [...new Set(responses.map(r => r.question_id))];

  const { data: questions } = await supabase
    .from('feedback_360_questions')
    .select('id, question_text, category')
    .in('id', questionIds);

  console.log(`  Questions: ${questions?.length || 0}`);

  const reviewerEmails = [...new Set(responses.map(r => r.reviewer_email))];
  console.log(`  Unique reviewers: ${reviewerEmails.length}`);

  const { data: reviewers } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('id, email, relationship, status')
    .eq('survey_id', surveyId);

  const emailToRelationship = {};
  reviewers?.forEach(r => {
    emailToRelationship[r.email] = r.relationship || 'peer';
  });

  const responsesByReviewer = {};
  responses.forEach(r => {
    const email = r.reviewer_email;
    if (!responsesByReviewer[email]) {
      responsesByReviewer[email] = {
        id: email,
        participant_id: email,
        responses: {},
        response_ids: {}
      };
    }
    responsesByReviewer[email].responses[r.question_id] = r.response_text || r.rating;
    responsesByReviewer[email].response_ids[r.question_id] = r.id;
  });

  const groupedResponses = Object.values(responsesByReviewer);
  console.log(`  Grouped responses: ${groupedResponses.length}`);

  const participants = reviewerEmails.map(email => ({
    id: email,
    relationship: emailToRelationship[email] || 'peer',
    status: 'completed'
  }));

  return {
    survey: {
      id: survey.id,
      employee_name: employeeName,
      survey_title: survey.survey_name
    },
    responses: groupedResponses,
    participants,
    questions: (questions || []).map(q => ({
      id: q.id,
      question: extractQuestionText(q.question_text),
      type: 'text',
      scale_max: 5
    }))
  };
}

function prepareResponsesForAnalysis(responses, participants, questions) {
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const byRelationship = {};

  responses.forEach(response => {
    const participant = participantMap.get(response.participant_id);
    if (!participant) return;

    if (!byRelationship[participant.relationship]) {
      byRelationship[participant.relationship] = [];
    }
    byRelationship[participant.relationship].push({ participant, response });
  });

  let output = '';

  Object.entries(byRelationship).forEach(([relationship, items]) => {
    output += `\n### ${relationship.toUpperCase()} (${items.length})\n\n`;

    items.forEach((item, index) => {
      output += `**${relationship} #${index + 1}:**\n`;

      questions.forEach(question => {
        const answer = item.response.responses[question.id];
        if (answer !== undefined && answer !== null && answer !== '') {
          const responseId = item.response.response_ids?.[question.id] || item.response.id;
          output += `[response_id: ${responseId}]\n`;
          output += `Q: ${question.question}\n`;
          output += `A: "${answer}"\n\n`;
        }
      });
    });
  });

  return output;
}

async function runDryAnalysis(surveyData) {
  const startTime = Date.now();

  const structuredResponses = prepareResponsesForAnalysis(
    surveyData.responses,
    surveyData.participants,
    surveyData.questions
  );

  const questionsFormatted = surveyData.questions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join('\n');

  const prompt = buildRelaxedPrompt({
    employeeName: surveyData.survey.employee_name,
    surveyTitle: surveyData.survey.survey_title,
    responseCount: surveyData.responses.length,
    questionsFormatted,
    structuredResponses,
    tone: 'standard'
  });

  console.log('\n' + '═'.repeat(80));
  console.log('RELAXED PROMPT TEST (DRY RUN)');
  console.log('═'.repeat(80));
  console.log(`Model: ${surveyAnalyzerConfig.model}`);
  console.log(`Max tokens: ${surveyAnalyzerConfig.maxTokens}`);
  console.log(`Prompt length: ${prompt.length} characters`);
  console.log('\nWaiting for AI response...\n');

  const response = await anthropic.messages.create({
    model: surveyAnalyzerConfig.model,
    max_tokens: surveyAnalyzerConfig.maxTokens,
    temperature: surveyAnalyzerConfig.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ AI response received in ${elapsed}s`);

  // Log token usage
  console.log(`   Input tokens: ${response.usage?.input_tokens || 'N/A'}`);
  console.log(`   Output tokens: ${response.usage?.output_tokens || 'N/A'}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  let jsonText = content.text.trim();
  const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
  } else {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  const analysis = JSON.parse(jsonText);
  return { analysis, elapsed, outputTokens: response.usage?.output_tokens };
}

function countCitations(analysis) {
  let total = 0;

  if (analysis.themes) {
    analysis.themes.forEach(theme => {
      if (theme.supporting_evidence) {
        theme.supporting_evidence.forEach(ev => {
          total += ev.citations?.length || 0;
        });
      }
    });
  }

  ['overall_strengths', 'development_areas', 'recommendations', 'consensus_areas', 'outlier_opinions'].forEach(key => {
    if (analysis[key]) {
      analysis[key].forEach(item => {
        total += item.citations?.length || 0;
      });
    }
  });

  return total;
}

function displayResults(analysis, elapsed, outputTokens) {
  console.log('\n' + '═'.repeat(80));
  console.log('RELAXED PROMPT RESULTS');
  console.log('═'.repeat(80));

  const totalCitations = countCitations(analysis);
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Time: ${elapsed}s`);
  console.log(`   Output tokens: ${outputTokens}`);
  console.log(`   Total citations: ${totalCitations}`);
  console.log(`   Themes: ${analysis.themes?.length || 0}`);
  console.log(`   Strengths: ${analysis.overall_strengths?.length || 0}`);
  console.log(`   Development areas: ${analysis.development_areas?.length || 0}`);
  console.log(`   Recommendations: ${analysis.recommendations?.length || 0}`);

  // Themes
  if (analysis.themes && analysis.themes.length > 0) {
    console.log('\n📊 THEMES:');
    analysis.themes.forEach((theme, i) => {
      const citationCount = theme.supporting_evidence?.reduce((sum, ev) =>
        sum + (ev.citations?.length || 0), 0) || 0;

      console.log(`\n   ${i + 1}. ${theme.theme}`);
      console.log(`      Sentiment: ${theme.sentiment} | Citations: ${citationCount}`);

      if (theme.supporting_evidence) {
        theme.supporting_evidence.forEach((ev, j) => {
          console.log(`      Evidence ${j + 1}: ${ev.text.substring(0, 100)}...`);
        });
      }
    });
  }

  // Strengths
  if (analysis.overall_strengths && analysis.overall_strengths.length > 0) {
    console.log('\n\n💪 STRENGTHS:');
    analysis.overall_strengths.forEach((s, i) => {
      const text = typeof s === 'string' ? s : s.text;
      console.log(`   ${i + 1}. ${text}`);
    });
  }

  // Development Areas
  if (analysis.development_areas && analysis.development_areas.length > 0) {
    console.log('\n\n📈 DEVELOPMENT AREAS:');
    analysis.development_areas.forEach((d, i) => {
      const text = typeof d === 'string' ? d : d.text;
      console.log(`   ${i + 1}. ${text}`);
    });
  }

  // Recommendations
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    console.log('\n\n💡 RECOMMENDATIONS:');
    analysis.recommendations.forEach((r, i) => {
      const text = typeof r === 'string' ? r : r.text;
      console.log(`   ${i + 1}. ${text}`);
    });
  }

  // Sentiment
  if (analysis.sentiment_by_relationship) {
    console.log('\n\n📉 SENTIMENT BY RELATIONSHIP:');
    Object.entries(analysis.sentiment_by_relationship).forEach(([key, value]) => {
      const bar = '█'.repeat(Math.round(value * 20));
      console.log(`   ${key.padEnd(20)} ${bar} ${(value * 100).toFixed(0)}%`);
    });
  }

  console.log('\n' + '═'.repeat(80));
  console.log('END OF RELAXED PROMPT TEST');
  console.log('═'.repeat(80) + '\n');
}

async function listSurveys() {
  const { data: surveys } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, status')
    .limit(20);

  for (const survey of surveys) {
    const { count } = await supabase
      .from('feedback_360_survey_reviewers')
      .select('id', { count: 'exact' })
      .eq('survey_id', survey.id)
      .eq('status', 'completed');
    survey.completed = count || 0;
  }

  surveys.sort((a, b) => b.completed - a.completed);

  console.log('\nAvailable surveys:');
  console.log('─'.repeat(80));
  surveys.forEach(s => {
    console.log(`  ${s.id.substring(0, 8)}... | ${(s.survey_name || 'Untitled').padEnd(40)} | ${s.completed} completed`);
  });
  console.log('─'.repeat(80));

  return surveys;
}

async function main() {
  const args = process.argv.slice(2);
  let surveyId = args[0];

  if (!surveyId) {
    const surveys = await listSurveys();
    const rigoSurvey = surveys.find(s => s.survey_name?.includes('Rigo'));
    if (rigoSurvey) {
      surveyId = rigoSurvey.id;
      console.log(`\nUsing Rigo Lopez survey: ${surveyId}`);
    } else {
      surveyId = surveys[0]?.id;
      console.log(`\nUsing first survey: ${surveyId}`);
    }
  }

  const surveyData = await fetchSurveyData(surveyId);
  if (!surveyData) {
    console.error('Failed to fetch survey data');
    process.exit(1);
  }

  const { analysis, elapsed, outputTokens } = await runDryAnalysis(surveyData);
  displayResults(analysis, elapsed, outputTokens);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
