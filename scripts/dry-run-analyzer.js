/**
 * DRY RUN script for survey analyzer prompt iteration
 *
 * This script:
 * 1. Fetches survey data from Supabase (READ ONLY)
 * 2. Calls the AI analyzer
 * 3. Outputs the results to console
 * 4. DOES NOT save anything to the database
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

// Import the prompt builder - we'll inline it for the script
const surveyAnalyzerConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 16000,
  temperature: 0.0,
};

/**
 * Build survey analyzer prompt - MUST MATCH lib/prompts/survey-analyzer.ts exactly
 */
function buildSurveyAnalyzerPrompt({ employeeName, surveyTitle, responseCount, questionsFormatted, structuredResponses, tone }) {
  const toneGuidance = tone === 'softer'
    ? '\n\nTONE GUIDANCE: Use a supportive and constructive tone. Frame challenges as growth opportunities. Balance criticism with encouragement. Focus on potential and progress rather than deficiencies. Use phrases like "opportunity to enhance" rather than "weakness" or "needs improvement".'
    : '';

  return `You are an expert organizational psychologist specializing in 360-degree feedback analysis. Analyze these survey responses to identify themes, patterns, and actionable insights.${toneGuidance}

EMPLOYEE BEING REVIEWED: ${employeeName}
SURVEY TITLE: ${surveyTitle}
TOTAL RESPONSES: ${responseCount}

SURVEY QUESTIONS:
${questionsFormatted}

RESPONSES BY RELATIONSHIP TYPE (each answer includes a response_id for citation tracking):
${structuredResponses}

IMPORTANT: Respond ONLY with valid, parseable JSON. Do not include any text before or after the JSON object.

JSON STRING FORMATTING (CRITICAL - prevents parsing errors):
- When the source text contains double quotes (e.g., someone wrote "faster releases"), replace them with single quotes in your output: 'faster releases'
- Example CORRECT: "snippet": "leadership said we needed 'faster releases' and the team agreed"
- Example WRONG: "snippet": "leadership said we needed "faster releases" and the team agreed"
- This applies to ALL string fields, especially "snippet" which often contains quoted speech from the source material

Return exactly this structure:

{
  "themes": [
    {
      "theme": "Concise theme name",
      "sentiment": "positive",
      "supporting_evidence": [
        {
          "text": "Synthesized observation (paraphrased, NOT a direct quote)",
          "citations": [
            {
              "response_id": "uuid-from-input-data",
              "snippet": "20-50 word relevant excerpt from the original response"
            }
          ]
        }
      ]
    }
  ],
  "overall_strengths": [
    {
      "text": "Synthesized strength statement",
      "citations": [
        { "response_id": "uuid", "snippet": "relevant excerpt" }
      ]
    }
  ],
  "development_areas": [
    {
      "text": "Area for improvement",
      "citations": [{ "response_id": "uuid", "snippet": "relevant excerpt" }]
    }
  ],
  "recommendations": [
    {
      "text": "Actionable recommendation",
      "citations": [{ "response_id": "uuid", "snippet": "relevant excerpt" }]
    }
  ],
  "sentiment_by_relationship": {
    "overall": 0.84,
    "manager": 0.85,
    "slt": 0.82,
    "peer": 0.78,
    "direct_report": 0.92,
    "cross_functional": 0.80
  },
  "consensus_areas": [
    {
      "text": "Area of broad agreement",
      "citations": [{ "response_id": "uuid", "snippet": "relevant excerpt" }]
    }
  ],
  "outlier_opinions": [
    {
      "text": "Unique perspective worth noting",
      "citations": [{ "response_id": "uuid", "snippet": "relevant excerpt" }]
    }
  ]
}

CITATION REQUIREMENTS - THIS IS CRITICAL FOR ACCURACY:
1. Every statement MUST have at least one citation with a valid response_id from the input data
2. The "response_id" MUST exactly match a response_id from the input - do NOT invent or modify IDs
3. The "snippet" must be a 10-30 word VERBATIM excerpt from the actual response text
4. DO NOT paraphrase or summarize in the snippet - copy the exact words from the source

EXHAUSTIVE CITATION RULE FOR THEMES:
- For each theme, you MUST scan ALL responses and cite EVERY response that relates to that theme
- Do NOT cherry-pick or sample - if 6 reviewers mentioned something relevant to a theme, include 6 citations
- The number of unique response_ids cited = the number we show as "mentioned by X reviewers"
- Missing citations means UNDERCOUNTING - this is a data integrity issue
- When in doubt, INCLUDE the citation rather than omit it

For other sections (strengths, development areas, recommendations, consensus, outliers):
- Include citations from all relevant responses, prioritizing the most illustrative examples
- Aim for comprehensive coverage while avoiding redundancy

RESPONSE COVERAGE REQUIREMENT:
- Every response_id from the input MUST appear in at least one citation somewhere in your output
- If a response doesn't clearly fit any theme, create an appropriate theme or include it in outliers
- No response should be silently ignored - all feedback must be accounted for
- Before finalizing, mentally verify: "Have I cited every response_id at least once?"

MIXED SENTIMENT HANDLING - PRESERVE DISAGREEMENT:
- If reviewers disagree on a topic (e.g., some say strength, others say weakness), mark sentiment as "mixed"
- In supporting_evidence, PRESERVE the disagreement - include evidence from BOTH sides
- Do NOT average conflicting opinions into a neutral statement
- Do NOT synthesize opposing views into one "balanced" statement
- Example: If 3 reviewers say "excellent communicator" and 2 say "needs to communicate more proactively", you MUST:
  * Mark sentiment as "mixed"
  * Include separate supporting_evidence entries for BOTH perspectives
  * Cite all 5 responses (3 positive + 2 constructive)
- When there is genuine consensus (all agree), then use "positive" or "needs_work" appropriately

SYNTHESIS RULES - PREVENTING HALLUCINATION DRIFT:
- The "text" field MUST be a faithful paraphrase of what was actually said, not an interpretation
- Do NOT add nuance, adjectives, or qualifiers that are not present in the source responses
- Do NOT combine different ideas into one statement - keep distinct observations separate
- Match your language to the evidence level:
  * 1-2 sources: "mentioned", "one perspective was", "noted"
  * 3-4 sources: "several noted", "multiple reviewers observed"
  * 5+ sources: "broadly recognized", "consistent feedback", "strong consensus"
- If only 1-2 people mentioned something, do NOT use phrases like "widely noted", "clear consensus", or "unanimously agreed"
- When paraphrasing, ask yourself: "Would the original respondent recognize this as their feedback?"

CRITICAL - ANONYMITY & AGGREGATION REQUIREMENTS:
- NEVER include direct quotes verbatim in the "text" field - always paraphrase
- The "snippet" field CAN contain direct excerpts (this is for audit purposes only)
- NEVER mention specific relationship types like "manager said" in the "text" field
- NEVER provide counts by relationship type in the "text" field
- Combine ALL feedback into unified, anonymized observations
- Use general attributions: "Feedback indicated...", "Multiple reviewers noted...", "A common theme..."

ANALYSIS GUIDELINES:
1. **Themes**: Identify 5-8 major themes with sentiment and supporting evidence
2. **Strengths**: 3-5 clear strengths synthesized from feedback
3. **Development Areas**: 3-5 growth opportunities
4. **Recommendations**: 4-6 specific, actionable steps
5. **Consensus**: Areas of broad agreement across reviewers
6. **Outliers**: Unique perspectives worth noting (without relationship attribution)

SENTIMENT SCORES (0-1 scale):
- Calculate overall and per-relationship scores based on tone and constructiveness
- Only include relationship keys that have responses
- Use exactly these lowercase keys: "overall", "manager", "slt", "peer", "direct_report", "cross_functional"
- Normalize any uppercase relationship types (e.g., "SLT" → "slt", "MANAGER" → "manager")

ABSOLUTELY MAINTAIN STRICT ANONYMITY in the "text" fields. The "snippet" citations are for HR audit only.`;
}

// Helper to extract question text from potentially nested JSON
function extractQuestionText(questionText) {
  if (!questionText) return '';
  let text = questionText;
  try {
    // Handle nested JSON structure
    while (typeof text === 'string' && text.startsWith('{')) {
      const parsed = JSON.parse(text);
      text = parsed.text || text;
      if (text === questionText) break; // Prevent infinite loop
    }
  } catch {
    // If parsing fails, return original
  }
  return text;
}

async function fetchSurveyData(surveyId) {
  console.log(`\nFetching data for survey: ${surveyId}`);

  // Fetch survey
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
  console.log(`  Employee ID: ${survey.employee_id}`);

  // Fetch employee name
  const { data: employee } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', survey.employee_id)
    .single();

  const employeeName = employee?.full_name || 'Unknown Employee';
  console.log(`  Employee: ${employeeName}`);

  // Fetch responses first to get the actual question IDs used
  const { data: responses, error: responsesError } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', surveyId);

  if (responsesError) {
    console.error('Error fetching responses:', responsesError);
    return null;
  }

  console.log(`  Response rows: ${responses.length}`);

  // Get unique question IDs from responses
  const questionIds = [...new Set(responses.map(r => r.question_id))];

  // Fetch questions
  const { data: questions } = await supabase
    .from('feedback_360_questions')
    .select('id, question_text, category')
    .in('id', questionIds);

  console.log(`  Questions: ${questions?.length || 0}`);

  // Get unique reviewer emails and create participant mapping
  const reviewerEmails = [...new Set(responses.map(r => r.reviewer_email))];
  console.log(`  Unique reviewers: ${reviewerEmails.length}`);

  // Fetch reviewer relationships from the reviewers table
  const { data: reviewers } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('id, email, relationship, status')
    .eq('survey_id', surveyId);

  // Create email -> relationship map
  const emailToRelationship = {};
  reviewers?.forEach(r => {
    emailToRelationship[r.email] = r.relationship || 'peer';
  });

  // Group responses by reviewer_email
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

  // Create participants from unique reviewers
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
      type: 'text', // Default to text for now
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
    output += `\n### ${relationship.toUpperCase()} (${items.length} response${items.length !== 1 ? 's' : ''})\n\n`;

    items.forEach((item, index) => {
      output += `**${relationship.charAt(0).toUpperCase() + relationship.slice(1)} #${index + 1}:**\n`;

      questions.forEach(question => {
        const answer = item.response.responses[question.id];
        if (answer !== undefined && answer !== null && answer !== '') {
          const responseId = item.response.response_ids?.[question.id] || item.response.id;

          output += `[response_id: ${responseId}]\n`;
          output += `Q: ${question.question}\n`;

          if (question.type === 'rating') {
            output += `A: ${answer}/${question.scale_max || 5}\n`;
          } else {
            output += `A: "${answer}"\n`;
          }
          output += '\n';
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
    .map((q, i) => `${i + 1}. ${q.question} (${q.type})`)
    .join('\n');

  const prompt = buildSurveyAnalyzerPrompt({
    employeeName: surveyData.survey.employee_name,
    surveyTitle: surveyData.survey.survey_title,
    responseCount: surveyData.responses.length,
    questionsFormatted,
    structuredResponses,
    tone: 'standard'
  });

  console.log('\n' + '═'.repeat(80));
  console.log('CALLING AI ANALYZER (DRY RUN - NO DATABASE CHANGES)');
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

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON from response
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

  return analysis;
}

function displayResults(analysis) {
  console.log('\n' + '═'.repeat(80));
  console.log('DRY RUN RESULTS (NOT SAVED TO DATABASE)');
  console.log('═'.repeat(80));

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

  // Consensus
  if (analysis.consensus_areas && analysis.consensus_areas.length > 0) {
    console.log('\n\n🤝 CONSENSUS AREAS:');
    analysis.consensus_areas.forEach((c, i) => {
      const text = typeof c === 'string' ? c : c.text;
      console.log(`   ${i + 1}. ${text}`);
    });
  }

  // Outliers
  if (analysis.outlier_opinions && analysis.outlier_opinions.length > 0) {
    console.log('\n\n🔍 OUTLIER OPINIONS:');
    analysis.outlier_opinions.forEach((o, i) => {
      const text = typeof o === 'string' ? o : o.text;
      console.log(`   ${i + 1}. ${text}`);
    });
  }

  console.log('\n' + '═'.repeat(80));
  console.log('END OF DRY RUN - NO CHANGES MADE TO DATABASE');
  console.log('═'.repeat(80) + '\n');
}

async function listSurveys() {
  const { data: surveys } = await supabase
    .from('feedback_360_surveys')
    .select('id, survey_name, status')
    .limit(20);

  // Get response counts
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
    console.log(`  ${s.id.substring(0, 8)}... | ${(s.survey_name || 'Untitled').padEnd(40)} | ${s.completed} completed | ${s.status}`);
  });
  console.log('─'.repeat(80));

  return surveys;
}

async function main() {
  const args = process.argv.slice(2);
  let surveyId = args[0];

  if (!surveyId) {
    const surveys = await listSurveys();
    // Default to Rigo Lopez survey
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

  const analysis = await runDryAnalysis(surveyData);
  displayResults(analysis);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
