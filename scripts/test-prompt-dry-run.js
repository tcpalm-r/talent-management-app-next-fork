/**
 * DRY RUN test script for iterating on the survey analyzer prompt
 *
 * This script:
 * 1. Fetches survey data from Supabase (READ ONLY)
 * 2. Calls the analyzer service DIRECTLY (bypasses API route)
 * 3. Returns the result WITHOUT saving anything to the database
 *
 * Usage: node scripts/test-prompt-dry-run.js [survey-name-substring]
 * Example: node scripts/test-prompt-dry-run.js "User 2"
 */

require('dotenv').config({ path: '.env.local' });

// We need to use dynamic import for ES modules
async function main() {
  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get search term from args
  const searchTerm = process.argv[2] || 'User 2';
  console.log(`\n🔍 Searching for survey containing: "${searchTerm}"\n`);

  // Find the survey
  const { data: surveys, error: surveyError } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .ilike('survey_name', `%${searchTerm}%`)
    .limit(5);

  if (surveyError || !surveys || surveys.length === 0) {
    console.error('Survey not found:', surveyError?.message || 'No matches');

    // List available surveys
    const { data: allSurveys } = await supabase
      .from('feedback_360_surveys')
      .select('id, survey_name, status')
      .limit(20);

    console.log('\nAvailable surveys:');
    allSurveys?.forEach(s => {
      console.log(`  - ${s.survey_name} (${s.status})`);
    });
    process.exit(1);
  }

  const survey = surveys[0];
  console.log(`✅ Found survey: "${survey.survey_name}" (${survey.status})`);
  console.log(`   ID: ${survey.id}`);

  // Fetch reviewers
  const { data: reviewers, error: reviewersError } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', survey.id);

  if (reviewersError) {
    console.error('Failed to fetch reviewers:', reviewersError.message);
    process.exit(1);
  }

  console.log(`   Reviewers: ${reviewers.length} (${reviewers.filter(r => r.status === 'completed').length} completed)`);

  // Fetch responses
  const { data: responses, error: responsesError } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', survey.id);

  if (responsesError) {
    console.error('Failed to fetch responses:', responsesError.message);
    process.exit(1);
  }

  console.log(`   Responses: ${responses.length} rows`);

  // Fetch questions
  const { data: surveyQuestions, error: questionsError } = await supabase
    .from('feedback_360_survey_questions')
    .select(`*, question:feedback_360_questions(*)`)
    .eq('survey_id', survey.id)
    .order('question_order');

  if (questionsError) {
    console.error('Failed to fetch questions:', questionsError.message);
    process.exit(1);
  }

  console.log(`   Questions: ${surveyQuestions.length}`);

  // Fetch employee name
  let employeeName = 'Unknown Employee';
  if (survey.employee_id) {
    const { data: employee } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', survey.employee_id)
      .single();

    if (employee) {
      employeeName = employee.full_name;
    }
  }
  console.log(`   Employee: ${employeeName}`);

  // Transform data for analyzer
  const participants = reviewers.map(r => ({
    id: r.id,
    survey_id: r.survey_id,
    reviewer_name: r.reviewer_name || '',
    reviewer_email: r.reviewer_email || '',
    relationship: r.relationship || 'cross_functional',
    status: r.status || 'pending',
    invited_at: r.invited_at,
    completed_at: r.completed_at,
  }));

  const emailToIdMap = new Map(reviewers.map(r => [r.reviewer_email, r.id]));

  // Group responses by reviewer
  const groupedResponses = {};
  responses.forEach(r => {
    const reviewerId = emailToIdMap.get(r.reviewer_email);
    if (!reviewerId) return;

    if (!groupedResponses[r.reviewer_email]) {
      groupedResponses[r.reviewer_email] = {
        id: r.id,
        survey_id: r.survey_id,
        participant_id: reviewerId,
        responses: {},
        response_ids: {},
        submitted_at: r.created_at || new Date().toISOString(),
      };
    }

    groupedResponses[r.reviewer_email].responses[r.question_id] = r.response_text || r.rating;
    groupedResponses[r.reviewer_email].response_ids[r.question_id] = r.id;
  });

  const transformedResponses = Object.values(groupedResponses);

  const questions = surveyQuestions
    .filter(sq => sq.question)
    .map(sq => ({
      id: sq.question_id,
      question: sq.question?.question_text || '',
      type: sq.question?.question_type || 'text',
      scale_max: sq.question?.scale_max || undefined,
    }));

  const surveyData = {
    id: survey.id,
    employee_id: survey.employee_id,
    employee_name: employeeName,
    survey_title: survey.survey_name || 'Untitled Survey',
    status: survey.status,
    created_by: survey.created_by,
    created_at: survey.created_at,
    due_date: survey.due_date,
  };

  console.log('\n' + '─'.repeat(80));
  console.log('🤖 Calling analyzer (DRY RUN - no database writes)...');
  console.log('─'.repeat(80) + '\n');

  const startTime = Date.now();

  const Anthropic = require('@anthropic-ai/sdk').default;

  // Config (matches lib/prompts/survey-analyzer.ts)
  const surveyAnalyzerConfig = {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8192,
    temperature: 0.3,
  };

  // Build prompt function (copied from lib/prompts/survey-analyzer.ts for CommonJS compatibility)
  function buildSurveyAnalyzerPrompt({ employeeName, surveyTitle, responseCount, questionsFormatted, structuredResponses, tone = 'standard' }) {
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
  "executive_summary": "A concise 2-3 sentence overview using ${employeeName}'s name...",
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
3. The "snippet" must be a 20-50 word VERBATIM excerpt from the actual response text
4. DO NOT paraphrase or summarize in the snippet - copy the exact words from the source

EXHAUSTIVE CITATION RULE FOR THEMES:
- For each theme, you MUST scan ALL responses and cite EVERY response that relates to that theme
- Do NOT cherry-pick or sample - if 6 reviewers mentioned something relevant to a theme, include 6 citations
- The number of unique response_ids cited = the number we show as "mentioned by X reviewers"
- Missing citations means UNDERCOUNTING - this is a data integrity issue
- When in doubt, INCLUDE the citation rather than omit it

For other sections (strengths, development areas, recommendations, insights):
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
1. **Executive Summary**: 2-3 sentences using ${employeeName}'s name, highlighting top strengths and development areas
2. **Themes**: Identify 5-8 major themes with sentiment and supporting evidence
3. **Strengths**: 3-5 clear strengths synthesized from feedback
4. **Development Areas**: 3-5 growth opportunities
5. **Recommendations**: 4-6 specific, actionable steps
6. **Consensus**: Areas of broad agreement
7. **Outliers**: Unique perspectives (without relationship attribution)

SENTIMENT SCORES (0-1 scale):
- Calculate overall and per-relationship scores based on tone and constructiveness
- Only include relationship keys that have responses
- Use exactly these lowercase keys: "overall", "manager", "slt", "peer", "direct_report", "cross_functional"
- Normalize any uppercase relationship types (e.g., "SLT" → "slt", "MANAGER" → "manager")

ABSOLUTELY MAINTAIN STRICT ANONYMITY in the "text" fields. The "snippet" citations are for HR audit only.`;
  }

  // Prepare responses with IDs (same as prepareResponsesForAnalysis in service)
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
            } else if (question.type === 'text') {
              output += `A: "${answer}"\n`;
            } else {
              output += `A: ${answer}\n`;
            }
            output += '\n';
          }
        });
      });
    });

    return output;
  }

  const structuredResponses = prepareResponsesForAnalysis(transformedResponses, participants, questions);
  const questionsFormatted = questions.map((q, i) => `${i + 1}. ${q.question} (${q.type})`).join('\n');

  const prompt = buildSurveyAnalyzerPrompt({
    employeeName: surveyData.employee_name,
    surveyTitle: surveyData.survey_title,
    responseCount: transformedResponses.length,
    questionsFormatted,
    structuredResponses,
    tone: 'standard',
  });

  // Log prompt stats
  console.log(`📝 Prompt length: ${prompt.length} characters`);
  console.log(`📊 Input data: ${transformedResponses.length} reviewers, ${questions.length} questions`);

  // Count response IDs in the input
  const responseIdMatches = structuredResponses.match(/\[response_id: [^\]]+\]/g) || [];
  console.log(`🔗 Response IDs in input: ${responseIdMatches.length}`);

  // Call Claude
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log(`\n⏳ Calling ${surveyAnalyzerConfig.model}...`);

  let jsonText = '';
  try {
    const response = await anthropic.messages.create({
      model: surveyAnalyzerConfig.model,
      max_tokens: surveyAnalyzerConfig.maxTokens,
      temperature: surveyAnalyzerConfig.temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Response received in ${elapsed}s\n`);

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON
    jsonText = content.text.trim();
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1];
    } else {
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    // Try to parse, with repair attempts
    let analysis;
    try {
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.log('⚠️  Initial JSON parse failed, attempting repair...');

      // Repair attempt 1: Fix unescaped quotes in strings
      // This is a common issue where snippets contain quotes like "faster releases"
      let repaired = jsonText;

      // Remove trailing commas before ] or }
      repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

      // Try to close unclosed arrays/objects at the end
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
      }

      try {
        analysis = JSON.parse(repaired);
        console.log('✅ JSON repaired successfully');
      } catch (repairError) {
        // Last resort: try truncating to find valid JSON
        console.log('⚠️  Repair failed, trying truncation recovery...');
        for (let i = repaired.length - 1; i > repaired.length / 2; i--) {
          if (repaired[i] === '}') {
            const truncated = repaired.substring(0, i + 1);
            try {
              analysis = JSON.parse(truncated);
              console.log(`✅ Recovered JSON by truncating at position ${i}`);
              break;
            } catch {
              // Continue searching
            }
          }
        }
        if (!analysis) {
          throw parseError; // Re-throw original error
        }
      }
    }

    // Display results
    console.log('═'.repeat(80));
    console.log('DRY RUN RESULTS (NOT SAVED)');
    console.log('═'.repeat(80));

    console.log('\n📋 EXECUTIVE SUMMARY:');
    console.log(`   ${analysis.executive_summary || 'N/A'}`);

    console.log('\n📊 THEMES:');
    if (analysis.themes) {
      analysis.themes.forEach((theme, i) => {
        const citationCount = theme.supporting_evidence?.reduce((sum, ev) => {
          if (typeof ev === 'string') return sum;
          return sum + (ev.citations?.length || 0);
        }, 0) || 0;

        const uniqueIds = new Set();
        theme.supporting_evidence?.forEach(ev => {
          if (typeof ev === 'object' && ev.citations) {
            ev.citations.forEach(c => {
              if (c.response_id) uniqueIds.add(c.response_id);
            });
          }
        });

        console.log(`\n   ${i + 1}. ${theme.theme}`);
        console.log(`      Sentiment: ${theme.sentiment}`);
        console.log(`      Citations: ${citationCount} (${uniqueIds.size} unique responses)`);

        // Show supporting evidence
        if (theme.supporting_evidence) {
          theme.supporting_evidence.forEach((ev, j) => {
            const text = typeof ev === 'string' ? ev : ev.text;
            console.log(`      Evidence ${j + 1}: ${text?.substring(0, 100)}${text?.length > 100 ? '...' : ''}`);
          });
        }
      });
    }

    console.log('\n💪 STRENGTHS:');
    (analysis.overall_strengths || []).forEach((s, i) => {
      const text = typeof s === 'string' ? s : s.text;
      console.log(`   ${i + 1}. ${text}`);
    });

    console.log('\n📈 DEVELOPMENT AREAS:');
    (analysis.development_areas || []).forEach((d, i) => {
      const text = typeof d === 'string' ? d : d.text;
      console.log(`   ${i + 1}. ${text}`);
    });

    console.log('\n🎯 RECOMMENDATIONS:');
    (analysis.recommendations || []).forEach((r, i) => {
      const text = typeof r === 'string' ? r : r.text;
      console.log(`   ${i + 1}. ${text}`);
    });

    console.log('\n📈 SENTIMENT SCORES:');
    if (analysis.sentiment_by_relationship) {
      Object.entries(analysis.sentiment_by_relationship).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    // Citation coverage analysis
    console.log('\n🔍 CITATION ANALYSIS:');
    const allCitedIds = new Set();

    const collectCitations = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach(item => {
        if (typeof item === 'object' && item.citations) {
          item.citations.forEach(c => {
            if (c.response_id) allCitedIds.add(c.response_id);
          });
        }
      });
    };

    analysis.themes?.forEach(t => collectCitations(t.supporting_evidence));
    collectCitations(analysis.overall_strengths);
    collectCitations(analysis.development_areas);
    collectCitations(analysis.recommendations);
    collectCitations(analysis.consensus_areas);
    collectCitations(analysis.outlier_opinions);

    console.log(`   Response IDs in input: ${responseIdMatches.length}`);
    console.log(`   Unique response IDs cited: ${allCitedIds.size}`);
    console.log(`   Coverage: ${((allCitedIds.size / responseIdMatches.length) * 100).toFixed(0)}%`);

    // Check for potentially hallucinated IDs
    const inputIds = new Set(responseIdMatches.map(m => m.match(/\[response_id: ([^\]]+)\]/)?.[1]));
    const hallucinated = [...allCitedIds].filter(id => !inputIds.has(id));
    if (hallucinated.length > 0) {
      console.log(`   ⚠️  POTENTIAL HALLUCINATED IDs: ${hallucinated.length}`);
      hallucinated.forEach(id => console.log(`      - ${id}`));
    } else {
      console.log(`   ✅ All cited IDs match input data`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('DRY RUN COMPLETE - NO DATA WAS SAVED');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  JSON parsing failed. This is a known issue with complex outputs.');
    console.log('Raw response saved to: /tmp/survey-analyzer-raw-response.txt');

    // Save raw response for debugging
    const fs = require('fs');
    if (typeof jsonText !== 'undefined') {
      fs.writeFileSync('/tmp/survey-analyzer-raw-response.txt', jsonText);
      console.log(`\nResponse length: ${jsonText.length} chars`);
      console.log('\nFirst 1500 chars of response:');
      console.log('─'.repeat(80));
      console.log(jsonText.substring(0, 1500));
      console.log('─'.repeat(80));
      console.log('\nLast 500 chars of response:');
      console.log('─'.repeat(80));
      console.log(jsonText.substring(jsonText.length - 500));
      console.log('─'.repeat(80));
    }
  }
}

main().catch(console.error);
