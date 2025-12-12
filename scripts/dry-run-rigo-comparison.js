/**
 * Dry Run: Compare Old vs New Prompt for Rigo Lopez Survey
 *
 * This script:
 * 1. Fetches Rigo Lopez's survey data from Supabase
 * 2. Runs analysis with BOTH old and new prompts
 * 3. Compares results side-by-side
 * 4. Does NOT write to database
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !anthropicKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

// Old prompt builder (before our changes)
const OLD_PROMPT = `You are an expert organizational psychologist specializing in 360-degree feedback analysis. Analyze these survey responses to identify themes, patterns, and actionable insights.

EMPLOYEE BEING REVIEWED: {employeeName}
SURVEY TITLE: {surveyTitle}
TOTAL RESPONSES: {responseCount}

SURVEY QUESTIONS:
{questionsFormatted}

RESPONSES BY RELATIONSHIP TYPE (each answer includes a response_id for citation tracking):
{structuredResponses}

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

// Import new prompt from the actual file
async function getNewPromptBuilder() {
  // We'll dynamically import the new prompt
  const promptModule = await import('../lib/prompts/survey-analyzer.ts');
  return promptModule.buildSurveyAnalyzerPrompt;
}

// Prepare responses format (same as surveyAnalyzerService.ts)
function prepareResponsesForAnalysis(responses, participants, questions) {
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const byRelationship = {};

  responses.forEach((response) => {
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

      questions.forEach((question) => {
        const answer = item.response.responses[question.id];
        if (answer !== undefined && answer !== null && answer !== '') {
          const responseId = item.response.response_ids?.[question.id] || item.response.id;

          output += `[response_id: ${responseId}]\n`;
          output += `Q: ${question.question}\n`;

          if (question.type === 'rating') {
            output += `A: ${answer}/${question.scale_max || 5}\n`;
          } else if (question.type === 'text') {
            output += `A: "${answer}"\n`;
          } else if (question.type === 'multiple_choice') {
            output += `A: ${answer}\n`;
          }
          output += '\n';
        }
      });
    });
  });

  return output;
}

async function main() {
  console.log('🔍 Starting dry-run comparison...\n');

  // Use the known completed survey with responses
  const surveyId = 'e1d4fe45-dc01-4495-b3fd-34e9a8066044';

  // Step 1: Fetch survey
  console.log('📋 Step 1: Fetching survey...');
  const { data: survey, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', surveyId)
    .single();

  if (surveyError || !survey) {
    console.error('❌ Could not find survey:', surveyError?.message);
    process.exit(1);
  }

  console.log(`✅ Found survey: ${survey.survey_name} (${survey.id})`);
  console.log(`   Status: ${survey.status}`);

  // Step 2: Get employee details
  console.log('\n📋 Step 2: Finding employee...');
  const { data: employee, error: empError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .eq('id', survey.employee_id)
    .single();

  if (empError || !employee) {
    console.error('❌ Could not find employee:', empError?.message);
    process.exit(1);
  }

  console.log(`✅ Found: ${employee.full_name} (${employee.email})`);

  // Step 3: Fetch all related data
  console.log('\n📋 Step 3: Fetching survey data...');

  // Reviewers
  const { data: reviewers } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', survey.id);

  // Responses
  const { data: responses } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', survey.id);

  // Questions
  const { data: surveyQuestions } = await supabase
    .from('feedback_360_survey_questions')
    .select(`
      *,
      question:feedback_360_questions(*)
    `)
    .eq('survey_id', survey.id)
    .order('question_order');

  console.log(`✅ Data loaded:`);
  console.log(`   Reviewers: ${reviewers?.length || 0}`);
  console.log(`   Responses: ${responses?.length || 0}`);
  console.log(`   Questions: ${surveyQuestions?.length || 0}`);

  if (!responses || responses.length === 0) {
    console.error('❌ No responses found - cannot run analysis');
    process.exit(1);
  }

  // Step 4: Transform data
  console.log('\n📋 Step 4: Transforming data...');

  const participants = reviewers.map(reviewer => {
    let relationship = 'cross_functional';
    const rel = (reviewer.relationship || 'cross_functional').toLowerCase();
    if (['manager', 'slt', 'direct_report', 'cross_functional'].includes(rel)) {
      relationship = rel;
    }

    return {
      id: reviewer.id,
      survey_id: reviewer.survey_id,
      participant_name: reviewer.reviewer_name || 'Anonymous',
      participant_email: reviewer.reviewer_email,
      relationship,
      status: reviewer.status,
      access_token: reviewer.access_token || '',
      invited_at: reviewer.invited_at || reviewer.created_at || new Date().toISOString(),
      completed_at: reviewer.completed_at || undefined,
      created_at: reviewer.created_at || new Date().toISOString(),
    };
  });

  const questions = (surveyQuestions || []).map(sq => {
    const q = sq.question;
    return {
      id: sq.question_id,
      question: q?.question_text || 'Question text not available',
      type: 'text',
      required: true,
      category: q?.category || undefined,
    };
  });

  const emailToIdMap = new Map(reviewers.map(r => [r.reviewer_email, r.id]));

  const groupedResponses = responses.reduce((acc, response) => {
    const reviewerEmail = response.reviewer_email;
    const reviewerId = emailToIdMap.get(reviewerEmail);

    if (!reviewerId) {
      console.warn(`No reviewer ID found for email: ${reviewerEmail}`);
      return acc;
    }

    if (!acc[reviewerEmail]) {
      acc[reviewerEmail] = {
        id: response.id,
        survey_id: response.survey_id,
        participant_id: reviewerId,
        responses: {},
        response_ids: {},
        submitted_at: response.created_at || new Date().toISOString(),
        created_at: response.created_at || new Date().toISOString(),
        updated_at: response.updated_at || new Date().toISOString(),
      };
    }

    acc[reviewerEmail].responses[response.question_id] =
      response.response_text || response.rating;
    acc[reviewerEmail].response_ids[response.question_id] = response.id;

    return acc;
  }, {});

  const transformedResponses = Object.values(groupedResponses);

  // Prepare formatted data for prompts
  const questionsFormatted = questions.map((q, i) => `${i + 1}. ${q.question} (${q.type})`).join('\n');
  const structuredResponses = prepareResponsesForAnalysis(transformedResponses, participants, questions);

  console.log('✅ Data transformation complete');

  // Step 5: Build prompts
  console.log('\n📋 Step 5: Building prompts...');

  const promptData = {
    employeeName: employee.full_name,
    surveyTitle: survey.survey_name || 'Untitled Survey',
    responseCount: responses.length,
    questionsFormatted,
    structuredResponses,
  };

  const oldPrompt = OLD_PROMPT
    .replace('{employeeName}', promptData.employeeName)
    .replace('{surveyTitle}', promptData.surveyTitle)
    .replace('{responseCount}', promptData.responseCount)
    .replace('{questionsFormatted}', promptData.questionsFormatted)
    .replace('{structuredResponses}', promptData.structuredResponses);

  const buildNewPrompt = await getNewPromptBuilder();
  const newPrompt = buildNewPrompt(promptData);

  console.log('✅ Prompts built');
  console.log(`   Old prompt length: ${oldPrompt.length} chars`);
  console.log(`   New prompt length: ${newPrompt.length} chars`);

  // Step 6: Run analysis with OLD prompt
  console.log('\n📋 Step 6: Running analysis with OLD prompt...');
  const startOld = Date.now();

  const oldResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 16384,
    temperature: 0.0,
    messages: [{ role: 'user', content: oldPrompt }],
  });

  const oldElapsed = Date.now() - startOld;
  const oldContent = oldResponse.content[0].text;

  console.log(`✅ Old prompt analysis complete (${oldElapsed}ms)`);

  // Step 7: Run analysis with NEW prompt
  console.log('\n📋 Step 7: Running analysis with NEW prompt...');
  const startNew = Date.now();

  const newResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 20000,
    temperature: 0.0,
    messages: [{ role: 'user', content: newPrompt }],
  });

  const newElapsed = Date.now() - startNew;
  const newContent = newResponse.content[0].text;

  console.log(`✅ New prompt analysis complete (${newElapsed}ms)`);

  // Step 8: Parse and compare results
  console.log('\n📋 Step 8: Parsing and comparing results...');

  function extractJson(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Parse error:', e.message);
      return null;
    }
  }

  const oldAnalysis = extractJson(oldContent);
  const newAnalysis = extractJson(newContent);

  if (!oldAnalysis || !newAnalysis) {
    console.error('❌ Failed to parse one or both results');

    // Save raw outputs for debugging
    fs.writeFileSync(
      path.join(__dirname, 'dry-run-old-raw.txt'),
      oldContent
    );
    fs.writeFileSync(
      path.join(__dirname, 'dry-run-new-raw.txt'),
      newContent
    );

    console.log('💾 Raw outputs saved to scripts/dry-run-*-raw.txt');
    process.exit(1);
  }

  // Step 9: Generate comparison report
  console.log('\n📊 COMPARISON RESULTS\n');
  console.log('═'.repeat(80));

  function countCitations(analysis) {
    let total = 0;
    const sections = ['themes', 'overall_strengths', 'development_areas', 'recommendations', 'consensus_areas', 'outlier_opinions'];

    sections.forEach(section => {
      if (Array.isArray(analysis[section])) {
        analysis[section].forEach(item => {
          if (section === 'themes' && item.supporting_evidence) {
            item.supporting_evidence.forEach(evidence => {
              if (evidence.citations) total += evidence.citations.length;
            });
          } else if (item.citations) {
            total += item.citations.length;
          }
        });
      }
    });

    return total;
  }

  function getUniqueResponseIds(analysis) {
    const ids = new Set();
    const sections = ['themes', 'overall_strengths', 'development_areas', 'recommendations', 'consensus_areas', 'outlier_opinions'];

    sections.forEach(section => {
      if (Array.isArray(analysis[section])) {
        analysis[section].forEach(item => {
          if (section === 'themes' && item.supporting_evidence) {
            item.supporting_evidence.forEach(evidence => {
              if (evidence.citations) {
                evidence.citations.forEach(c => ids.add(c.response_id));
              }
            });
          } else if (item.citations) {
            item.citations.forEach(c => ids.add(c.response_id));
          }
        });
      }
    });

    return ids;
  }

  const comparison = {
    old: {
      elapsed: oldElapsed,
      themes: oldAnalysis.themes?.length || 0,
      strengths: oldAnalysis.overall_strengths?.length || 0,
      development: oldAnalysis.development_areas?.length || 0,
      recommendations: oldAnalysis.recommendations?.length || 0,
      consensus: oldAnalysis.consensus_areas?.length || 0,
      outliers: oldAnalysis.outlier_opinions?.length || 0,
      totalCitations: countCitations(oldAnalysis),
      uniqueResponsesCited: getUniqueResponseIds(oldAnalysis).size,
      totalResponses: responses.length,
    },
    new: {
      elapsed: newElapsed,
      themes: newAnalysis.themes?.length || 0,
      strengths: newAnalysis.overall_strengths?.length || 0,
      development: newAnalysis.development_areas?.length || 0,
      recommendations: newAnalysis.recommendations?.length || 0,
      consensus: newAnalysis.consensus_areas?.length || 0,
      outliers: newAnalysis.outlier_opinions?.length || 0,
      totalCitations: countCitations(newAnalysis),
      uniqueResponsesCited: getUniqueResponseIds(newAnalysis).size,
      totalResponses: responses.length,
    }
  };

  console.log('SURVEY:', survey.survey_name);
  console.log('EMPLOYEE:', employee.full_name);
  console.log('TOTAL RESPONSES:', responses.length);
  console.log('');

  console.log('METRIC'.padEnd(30), 'OLD PROMPT'.padEnd(15), 'NEW PROMPT'.padEnd(15), 'CHANGE');
  console.log('─'.repeat(80));

  const metrics = [
    ['Processing Time', `${comparison.old.elapsed}ms`, `${comparison.new.elapsed}ms`, `${comparison.new.elapsed - comparison.old.elapsed > 0 ? '+' : ''}${comparison.new.elapsed - comparison.old.elapsed}ms`],
    ['Themes', comparison.old.themes, comparison.new.themes, comparison.new.themes - comparison.old.themes],
    ['Strengths', comparison.old.strengths, comparison.new.strengths, comparison.new.strengths - comparison.old.strengths],
    ['Development Areas', comparison.old.development, comparison.new.development, comparison.new.development - comparison.old.development],
    ['Recommendations', comparison.old.recommendations, comparison.new.recommendations, comparison.new.recommendations - comparison.old.recommendations],
    ['Consensus Areas', comparison.old.consensus, comparison.new.consensus, comparison.new.consensus - comparison.old.consensus],
    ['Outlier Opinions', comparison.old.outliers, comparison.new.outliers, comparison.new.outliers - comparison.old.outliers],
    ['Total Citations', comparison.old.totalCitations, comparison.new.totalCitations, comparison.new.totalCitations - comparison.old.totalCitations],
    ['Unique Responses Cited', comparison.old.uniqueResponsesCited, comparison.new.uniqueResponsesCited, comparison.new.uniqueResponsesCited - comparison.old.uniqueResponsesCited],
    ['Citation Coverage %', `${Math.round(comparison.old.uniqueResponsesCited / comparison.old.totalResponses * 100)}%`, `${Math.round(comparison.new.uniqueResponsesCited / comparison.new.totalResponses * 100)}%`, ''],
  ];

  metrics.forEach(([metric, oldVal, newVal, change]) => {
    console.log(
      metric.padEnd(30),
      String(oldVal).padEnd(15),
      String(newVal).padEnd(15),
      String(change)
    );
  });

  console.log('═'.repeat(80));

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.join(__dirname, 'dry-run-results');

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const outputData = {
    survey: {
      id: survey.id,
      name: survey.survey_name,
      employee: employee.full_name,
      totalResponses: responses.length,
    },
    comparison,
    oldAnalysis,
    newAnalysis,
    oldPrompt,
    newPrompt,
  };

  const outputPath = path.join(resultsDir, `comparison-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`\n💾 Detailed results saved to: ${outputPath}`);
  console.log('\n✅ Dry-run comparison complete!');
}

main().catch(console.error);
