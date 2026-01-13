/**
 * DRY RUN: Scale Test for Report Generation
 *
 * This script tests whether report generation works with 20 reviewers × 5 questions
 * by taking Rigo's survey data (12 reviewers × 4 questions) and scaling it up.
 *
 * Features:
 * - Fetches Rigo's real survey data (read-only)
 * - Generates synthetic reviewers with varied responses
 * - Adds a 5th question with unique responses
 * - Runs the two-pass analyzer
 * - Reports token usage and timing metrics
 * - Does NOT write to database
 *
 * Usage: node scripts/dry-run-scale-test.js [surveyId]
 * Default: Uses Rigo Lopez's survey
 */

require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk').default;
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ==================== Configuration ====================

const RIGO_SURVEY_ID = 'a076df65-f4b9-45f8-902a-bb666b5ddef1';
const TARGET_REVIEWERS = 20;
const TARGET_QUESTIONS = 5;

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

// Model config matching production
const pass1Config = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 20000,
  temperature: 0.0,
};

const pass2Config = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 20000,
  temperature: 0.0,
};

// ==================== Data Variation Helpers ====================

// Sentiment variations for synthetic responses
const sentimentPrefixes = [
  "I've consistently observed that ",
  "One thing I particularly appreciate is ",
  "An area where there's room for growth is ",
  "From my perspective, ",
  "What stands out to me is ",
  "I've noticed that ",
  "A key strength I see is ",
  "Something worth mentioning is ",
];

const sentimentSuffixes = [
  ", which has been valuable for the team.",
  ", and this has positively impacted our work.",
  ". This is an area that could benefit from more focus.",
  ", which demonstrates strong capability.",
  ". I'd encourage continuing this approach.",
  ", though there's potential for even more.",
  ". This has been evident in multiple situations.",
  ", and the team has benefited from this.",
];

// Focus areas for varied responses
const focusAreas = [
  'communication skills',
  'leadership approach',
  'technical expertise',
  'collaboration style',
  'time management',
  'problem-solving ability',
  'strategic thinking',
  'team development',
];

// Project names for adding specificity
const projectNames = [
  'Q4 Infrastructure Migration',
  'Customer Portal Redesign',
  'Product Launch Initiative',
  'Cross-functional Alignment Project',
  'Performance Optimization Sprint',
  'New Market Expansion',
  'Process Automation Initiative',
  'Team Restructuring Effort',
];

// Metrics for adding specificity
const metrics = [
  '25% improvement',
  '40% reduction',
  'ahead of schedule',
  'within budget',
  'exceeded targets',
  'above expectations',
  '3x growth',
  'significant ROI',
];

/**
 * Generate a varied response based on the original text and reviewer index
 */
function generateVariedResponse(originalText, reviewerIndex, relationship) {
  if (!originalText || originalText.trim().length < 10) {
    return generateDefaultResponse(reviewerIndex, relationship);
  }

  // Select variation components based on reviewer index
  const prefix = sentimentPrefixes[reviewerIndex % sentimentPrefixes.length];
  const suffix = sentimentSuffixes[reviewerIndex % sentimentSuffixes.length];
  const focus = focusAreas[reviewerIndex % focusAreas.length];
  const project = projectNames[reviewerIndex % projectNames.length];
  const metric = metrics[reviewerIndex % metrics.length];

  // Transform based on relationship type
  let perspectiveIntro = '';
  switch (relationship) {
    case 'manager':
      perspectiveIntro = `As their manager, ${prefix.toLowerCase()}`;
      break;
    case 'direct_report':
      perspectiveIntro = `Working under their leadership, ${prefix.toLowerCase()}`;
      break;
    case 'slt':
      perspectiveIntro = `From a senior leadership perspective, ${prefix.toLowerCase()}`;
      break;
    case 'cross_functional':
      perspectiveIntro = `In our cross-functional collaboration, ${prefix.toLowerCase()}`;
      break;
    default:
      perspectiveIntro = prefix;
  }

  // Extract key phrases from original and paraphrase
  const sentences = originalText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const keyIdea = sentences[0]?.trim() || originalText.substring(0, 100);

  // Build varied response
  const variations = [
    // Variation 1: Restructure with perspective intro
    `${perspectiveIntro}${keyIdea.toLowerCase()}${suffix}`,

    // Variation 2: Add specificity with project/metric
    `${prefix}Rigo demonstrates strong ${focus}. During the ${project}, this was evident when they achieved ${metric}${suffix}`,

    // Variation 3: Different framing
    `Regarding ${focus}, ${keyIdea}. This was particularly apparent during ${project}, where we saw ${metric}${suffix}`,

    // Variation 4: Development-focused
    `${prefix}Rigo's ${focus} has been a notable strength. In the context of ${project}, I observed ${keyIdea.toLowerCase()}.`,

    // Variation 5: Impact-focused
    `The impact of Rigo's ${focus} on ${project} has been significant. ${keyIdea}. The result was ${metric}${suffix}`,
  ];

  return variations[reviewerIndex % variations.length];
}

/**
 * Generate a default response when original is empty or too short
 */
function generateDefaultResponse(reviewerIndex, relationship) {
  const focus = focusAreas[reviewerIndex % focusAreas.length];
  const project = projectNames[reviewerIndex % projectNames.length];
  const metric = metrics[reviewerIndex % metrics.length];
  const prefix = sentimentPrefixes[reviewerIndex % sentimentPrefixes.length];
  const suffix = sentimentSuffixes[reviewerIndex % sentimentSuffixes.length];

  const templates = [
    `${prefix}Rigo's ${focus} has been instrumental in our team's success. During ${project}, this led to ${metric}${suffix}`,
    `In the area of ${focus}, Rigo has shown consistent growth. The ${project} was a great example where we achieved ${metric}.`,
    `${prefix}Rigo excels in ${focus}. A notable example was during ${project}, resulting in ${metric}${suffix}`,
    `Rigo's approach to ${focus} sets them apart. On ${project}, this contributed to ${metric}. I'd recommend continuing this direction.`,
  ];

  return templates[reviewerIndex % templates.length];
}

/**
 * Generate response for the synthetic 5th question
 */
function generateQuestion5Response(reviewerIndex, relationship) {
  const focus1 = focusAreas[reviewerIndex % focusAreas.length];
  const focus2 = focusAreas[(reviewerIndex + 3) % focusAreas.length];
  const project = projectNames[(reviewerIndex + 1) % projectNames.length];
  const metric = metrics[(reviewerIndex + 2) % metrics.length];

  const relationshipContext = {
    manager: 'From my oversight perspective,',
    direct_report: 'As someone who reports to Rigo,',
    slt: 'At the leadership level,',
    cross_functional: 'Working alongside Rigo in different departments,',
  };

  const intro = relationshipContext[relationship] || 'In my experience,';

  const templates = [
    `${intro} I'd add that Rigo's ${focus1} complements their ${focus2} exceptionally well. This combination was evident during ${project}, where their approach led to ${metric}. I believe continued focus on these areas will drive even better results.`,

    `Beyond what I've shared, ${intro.toLowerCase()} Rigo has shown remarkable growth in ${focus1}. The ${project} demonstrated this clearly. One area for future development could be ${focus2}, where I see potential for ${metric}.`,

    `${intro} one additional observation is how Rigo balances ${focus1} with ${focus2}. During ${project}, this balance helped achieve ${metric}. I'd encourage them to continue leveraging these complementary strengths.`,

    `${intro} Rigo's evolution in ${focus1} has been impressive to witness. Notably, during ${project}, their efforts contributed to ${metric}. For continued growth, I'd suggest exploring more opportunities in ${focus2}.`,

    `I want to highlight Rigo's ability to adapt their ${focus1} to different contexts. ${intro.toLowerCase()} during ${project}, this adaptability led to ${metric}. Their ${focus2} is also worth noting as a secondary strength.`,
  ];

  return templates[reviewerIndex % templates.length];
}

// ==================== Data Fetching ====================

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

  // Fetch employee name
  const { data: employee } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', survey.employee_id)
    .single();

  const employeeName = employee?.full_name || 'Unknown Employee';
  console.log(`  Employee: ${employeeName}`);

  // Fetch reviewers
  const { data: reviewers, error: reviewersError } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', surveyId)
    .eq('status', 'completed');

  if (reviewersError) {
    console.error('Error fetching reviewers:', reviewersError);
    return null;
  }

  console.log(`  Reviewers: ${reviewers?.length || 0}`);

  // Fetch responses
  const { data: responses, error: responsesError } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', surveyId);

  if (responsesError) {
    console.error('Error fetching responses:', responsesError);
    return null;
  }

  console.log(`  Response rows: ${responses.length}`);

  // Get unique question IDs
  const questionIds = [...new Set(responses.map(r => r.question_id))];

  // Fetch questions
  const { data: questions } = await supabase
    .from('feedback_360_questions')
    .select('id, question_text, category')
    .in('id', questionIds);

  console.log(`  Questions: ${questions?.length || 0}`);

  // Create email to relationship map
  const emailToRelationship = {};
  const emailToId = {};
  reviewers?.forEach(r => {
    emailToRelationship[r.reviewer_email] = r.relationship || 'cross_functional';
    emailToId[r.reviewer_email] = r.id;
  });

  // Group responses by reviewer
  const responsesByReviewer = {};
  responses.forEach(r => {
    const email = r.reviewer_email;
    if (!responsesByReviewer[email]) {
      responsesByReviewer[email] = {
        id: emailToId[email] || email,
        participant_id: emailToId[email] || email,
        relationship: emailToRelationship[email] || 'cross_functional',
        responses: {},
        response_ids: {}
      };
    }
    responsesByReviewer[email].responses[r.question_id] = r.response_text || r.rating;
    responsesByReviewer[email].response_ids[r.question_id] = r.id;
  });

  const groupedResponses = Object.values(responsesByReviewer);
  console.log(`  Grouped responses: ${groupedResponses.length}`);

  return {
    survey: {
      id: survey.id,
      employee_name: employeeName,
      survey_title: survey.survey_name
    },
    responses: groupedResponses,
    questions: (questions || []).map(q => ({
      id: q.id,
      question: extractQuestionText(q.question_text),
      type: 'text',
      scale_max: 5
    }))
  };
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
    // Return original
  }
  return text;
}

// ==================== Data Scaling ====================

/**
 * Scale the survey data to TARGET_REVIEWERS and TARGET_QUESTIONS
 */
function scaleData(originalData) {
  const { survey, responses: originalResponses, questions: originalQuestions } = originalData;

  console.log('\n' + '='.repeat(60));
  console.log('SCALING DATA');
  console.log('='.repeat(60));
  console.log(`Original: ${originalResponses.length} reviewers, ${originalQuestions.length} questions`);
  console.log(`Target: ${TARGET_REVIEWERS} reviewers, ${TARGET_QUESTIONS} questions`);

  // Add the 5th question
  const scaledQuestions = [...originalQuestions];
  const syntheticQuestion = {
    id: `synthetic-q5-${uuidv4().substring(0, 8)}`,
    question: 'What additional feedback would you like to share about this employee that hasn\'t been covered in the previous questions?',
    type: 'text',
    scale_max: 5
  };
  scaledQuestions.push(syntheticQuestion);
  console.log(`Added synthetic question: "${syntheticQuestion.question.substring(0, 50)}..."`);

  // Keep all original responses and add synthetic ones
  const scaledResponses = [...originalResponses];

  // Add 5th question responses to original reviewers
  originalResponses.forEach((response, idx) => {
    response.responses[syntheticQuestion.id] = generateQuestion5Response(idx, response.relationship);
    response.response_ids[syntheticQuestion.id] = `original-q5-${idx}-${uuidv4().substring(0, 8)}`;
  });

  // Calculate how many synthetic reviewers we need
  const syntheticReviewersNeeded = TARGET_REVIEWERS - originalResponses.length;
  console.log(`Creating ${syntheticReviewersNeeded} synthetic reviewers...`);

  // Relationship distribution for synthetic reviewers
  const relationships = ['manager', 'slt', 'direct_report', 'cross_functional'];

  for (let i = 0; i < syntheticReviewersNeeded; i++) {
    const relationship = relationships[i % relationships.length];
    const baseResponse = originalResponses[i % originalResponses.length];

    const syntheticResponse = {
      id: `synthetic-reviewer-${i}-${uuidv4().substring(0, 8)}`,
      participant_id: `synthetic-reviewer-${i}-${uuidv4().substring(0, 8)}`,
      relationship,
      responses: {},
      response_ids: {}
    };

    // Generate varied responses for each question
    scaledQuestions.forEach((question, qIdx) => {
      const originalAnswer = baseResponse.responses[question.id] || '';

      if (question.id === syntheticQuestion.id) {
        // 5th question - generate unique response
        syntheticResponse.responses[question.id] = generateQuestion5Response(
          originalResponses.length + i,
          relationship
        );
      } else {
        // Existing questions - vary the response
        syntheticResponse.responses[question.id] = generateVariedResponse(
          originalAnswer,
          originalResponses.length + i + qIdx, // Use combined index for more variation
          relationship
        );
      }

      syntheticResponse.response_ids[question.id] =
        `synthetic-${i}-q${qIdx}-${uuidv4().substring(0, 8)}`;
    });

    scaledResponses.push(syntheticResponse);
  }

  console.log(`Total scaled responses: ${scaledResponses.length}`);
  console.log(`Total scaled questions: ${scaledQuestions.length}`);

  // Log relationship distribution
  const relationshipCounts = {};
  scaledResponses.forEach(r => {
    relationshipCounts[r.relationship] = (relationshipCounts[r.relationship] || 0) + 1;
  });
  console.log('Relationship distribution:');
  Object.entries(relationshipCounts).forEach(([rel, count]) => {
    console.log(`  ${rel}: ${count}`);
  });

  return {
    survey,
    responses: scaledResponses,
    questions: scaledQuestions
  };
}

// ==================== Prompt Builders ====================
// (Adapted from lib/prompts/survey-analyzer-pass1.ts and survey-analyzer-pass2.ts)

function preparePass1Input(responses, questions) {
  let output = '';

  questions.forEach((question, qIndex) => {
    output += `## QUESTION ${qIndex + 1}\n`;
    output += `Question ID: ${question.id}\n`;
    output += `Question: ${question.question}\n`;
    output += `Type: ${question.type}\n\n`;
    output += `### Responses:\n\n`;

    let responseCount = 0;

    responses.forEach((response) => {
      const answer = response.responses[question.id];
      if (answer !== undefined && answer !== null && answer !== '') {
        responseCount++;
        const responseId = response.response_ids?.[question.id] || response.participant_id;

        output += `[response_id: ${responseId}]\n`;
        output += `Answer: "${answer}"\n\n`;
      }
    });

    if (responseCount === 0) {
      output += `(No responses for this question)\n\n`;
    }

    output += `---\n\n`;
  });

  return output;
}

function buildPass1Prompt({ employeeName, surveyTitle, totalResponseCount, questionBlocks }) {
  return `You are analyzing 360-degree feedback responses for ${employeeName}.

# TASK: QUESTION-LEVEL EXTRACTION

Analyze the responses to EACH question independently. For each question, extract:
1. **Themes** - Patterns that emerge from multiple responses
2. **Strengths** - Positive observations about the employee
3. **Gaps** - Areas for improvement or development
4. **Examples** - Concrete, specific details (metrics, project names, dates)

# SURVEY CONTEXT

EMPLOYEE: ${employeeName}
SURVEY: ${surveyTitle}
TOTAL RESPONSES: ${totalResponseCount}

# QUESTIONS AND RESPONSES

${questionBlocks}

---

# CRITICAL RULES

## 1. ONLY Extract What's Directly Stated
- **Do NOT infer or introduce new issues** not mentioned in responses
- **Do NOT add your own interpretation** beyond what's written
- If something isn't explicitly stated, don't include it

## 2. Citation Requirements
- Every theme/strength/gap MUST have citations with exact response_ids from input
- Use verbatim 10-40 word snippets from the source response
- **100% Coverage**: Every response_id must appear at least once across all your citations

## 3. Count Support Accurately
- \`support_count\` = number of UNIQUE response_ids that mention this theme

## 4. Use Aggregate Language ONLY
- CORRECT: "Reviewers noted", "Feedback indicated", "Observations suggest"
- WRONG: "The manager said", "Direct reports mentioned"

---

# OUTPUT FORMAT

Return a JSON array with one object per question:

\`\`\`json
[
  {
    "question_id": "exact-uuid-from-input",
    "question_text": "The question text",
    "response_count": 8,
    "themes": [
      {
        "theme": "Brief Theme Title (3-6 words)",
        "support_count": 5,
        "sentiment": "positive",
        "evidence": [
          {
            "text": "Synthesized observation based on the responses",
            "citations": [
              {
                "response_id": "uuid-1",
                "snippet": "verbatim excerpt 10-40 words"
              }
            ]
          }
        ]
      }
    ],
    "strengths": [
      {
        "text": "Specific strength observation",
        "citations": [
          { "response_id": "uuid", "snippet": "supporting excerpt" }
        ]
      }
    ],
    "gaps": [
      {
        "text": "Specific area for improvement",
        "citations": [
          { "response_id": "uuid", "snippet": "supporting excerpt" }
        ]
      }
    ],
    "examples": [
      "Led the Q3 infrastructure migration",
      "Reduced deployment time by 40%"
    ]
  }
]
\`\`\`

Sentiment Values: "positive", "needs_work", "mixed"

JSON Rules:
- Use single quotes (') inside strings, never double quotes
- No trailing commas
- Response must be ONLY the JSON array, no markdown or commentary

Now analyze each question and return the JSON array:`;
}

function formatQuestionSummaries(summaries) {
  let output = '';

  summaries.forEach((summary, idx) => {
    output += `## Question ${idx + 1}: ${summary.question_text || 'Unknown'}\n\n`;

    if (summary.themes?.length > 0) {
      output += `### Themes:\n`;
      summary.themes.forEach((theme, i) => {
        output += `${i + 1}. **${theme.theme}** (${theme.sentiment}, support: ${theme.support_count})\n`;
        theme.evidence?.forEach(ev => {
          output += `   - ${ev.text}\n`;
        });
      });
      output += '\n';
    }

    if (summary.strengths?.length > 0) {
      output += `### Strengths:\n`;
      summary.strengths.forEach((s, i) => {
        output += `${i + 1}. ${s.text}\n`;
      });
      output += '\n';
    }

    if (summary.gaps?.length > 0) {
      output += `### Gaps:\n`;
      summary.gaps.forEach((g, i) => {
        output += `${i + 1}. ${g.text}\n`;
      });
      output += '\n';
    }

    if (summary.examples?.length > 0) {
      output += `### Examples:\n`;
      summary.examples.forEach((e, i) => {
        output += `${i + 1}. ${e}\n`;
      });
      output += '\n';
    }

    output += '---\n\n';
  });

  return output;
}

function buildPass2Prompt({ employeeName, surveyTitle, totalResponseCount, relationshipsWithResponses, questionSummariesFormatted, tone }) {
  const toneGuidance = tone === 'softer'
    ? '\n\nTONE: Use a supportive and constructive tone. Frame challenges as growth opportunities.'
    : '';

  return `You are synthesizing 360-degree feedback for ${employeeName}.${toneGuidance}

# TASK: GLOBAL SYNTHESIS

Based on the question-level summaries below, create a comprehensive feedback report.

# CONTEXT

EMPLOYEE: ${employeeName}
SURVEY: ${surveyTitle}
TOTAL REVIEWERS: ${totalResponseCount}
RELATIONSHIPS REPRESENTED: ${relationshipsWithResponses.join(', ')}

# QUESTION SUMMARIES (from Pass 1)

${questionSummariesFormatted}

---

# SYNTHESIS REQUIREMENTS

1. **Cross-cutting themes**: Identify patterns that appear across multiple questions
2. **Prioritize by support**: Themes mentioned by more reviewers get more emphasis
3. **Preserve citations**: Keep all citations from Pass 1 exactly as provided
4. **Aggregate language**: Never mention specific relationship types in text

---

# OUTPUT FORMAT

Return a JSON object:

\`\`\`json
{
  "themes": [
    {
      "theme": "Theme Name",
      "sentiment": "positive",
      "supporting_evidence": [
        {
          "text": "Synthesized observation",
          "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
        }
      ]
    }
  ],
  "overall_strengths": [
    {
      "text": "Key strength",
      "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
    }
  ],
  "development_areas": [
    {
      "text": "Growth opportunity",
      "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
    }
  ],
  "recommendations": [
    {
      "text": "Actionable recommendation",
      "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
    }
  ],
  "consensus_areas": [
    {
      "text": "Area of broad agreement",
      "groups_agreeing": ["manager", "direct_report"],
      "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
    }
  ],
  "varied_by_relationship": [
    {
      "topic": "Topic name",
      "perspectives": [
        { "group": "manager", "view": "...", "citations": [...] }
      ]
    }
  ],
  "outliers": [
    {
      "text": "Unique perspective",
      "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
    }
  ],
  "sentiment_by_relationship": {
    "overall": 0.84,
    "manager": 0.85,
    "slt": 0.82,
    "direct_report": 0.90,
    "cross_functional": 0.80
  }
}
\`\`\`

## Guidelines:
- 5-8 themes, 3-5 strengths, 3-5 development areas, 4-6 recommendations
- Sentiment scores: 0-1 scale based on tone and constructiveness
- Only include relationship keys that have responses

Now synthesize the feedback and return the JSON object:`;
}

// ==================== Analysis Execution ====================

async function runPass1(data) {
  console.log('\n' + '='.repeat(60));
  console.log('PASS 1: Question-Level Extraction');
  console.log('='.repeat(60));

  const questionBlocks = preparePass1Input(data.responses, data.questions);

  const prompt = buildPass1Prompt({
    employeeName: data.survey.employee_name,
    surveyTitle: data.survey.survey_title,
    totalResponseCount: data.responses.length,
    questionBlocks
  });

  console.log(`Prompt length: ${prompt.length} characters`);
  console.log(`Estimated input tokens: ~${Math.round(prompt.length / 4)}`);
  console.log('Calling Claude API...\n');

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: pass1Config.model,
    max_tokens: pass1Config.maxTokens,
    temperature: pass1Config.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const elapsed = Date.now() - startTime;

  console.log(`Pass 1 completed in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Usage: ${JSON.stringify(response.usage)}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON
  let jsonText = content.text.trim();
  const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }

  const summaries = JSON.parse(jsonText);

  return {
    summaries,
    outputTokens: response.usage?.output_tokens || 0,
    inputTokens: response.usage?.input_tokens || 0,
    elapsedMs: elapsed
  };
}

async function runPass2(data, pass1Result) {
  console.log('\n' + '='.repeat(60));
  console.log('PASS 2: Global Synthesis');
  console.log('='.repeat(60));

  // Calculate rate limit delay
  const RATE_LIMIT_TOKENS_PER_MINUTE = 8000;
  const BUFFER_SECONDS = 15;

  let delayMs = BUFFER_SECONDS * 1000;
  if (pass1Result.outputTokens > RATE_LIMIT_TOKENS_PER_MINUTE) {
    const tokensOver = pass1Result.outputTokens - RATE_LIMIT_TOKENS_PER_MINUTE;
    const minutesToWait = tokensOver / RATE_LIMIT_TOKENS_PER_MINUTE;
    delayMs = Math.ceil(minutesToWait * 60 + BUFFER_SECONDS) * 1000;
  }

  console.log(`Rate limit delay: ${(delayMs / 1000).toFixed(0)}s`);
  console.log('Waiting...');
  await new Promise(resolve => setTimeout(resolve, delayMs));

  const questionSummariesFormatted = formatQuestionSummaries(pass1Result.summaries);

  // Get unique relationships
  const relationships = [...new Set(data.responses.map(r => r.relationship))];

  const prompt = buildPass2Prompt({
    employeeName: data.survey.employee_name,
    surveyTitle: data.survey.survey_title,
    totalResponseCount: data.responses.length,
    relationshipsWithResponses: relationships,
    questionSummariesFormatted,
    tone: 'standard'
  });

  console.log(`Prompt length: ${prompt.length} characters`);
  console.log(`Estimated input tokens: ~${Math.round(prompt.length / 4)}`);
  console.log('Calling Claude API...\n');

  const startTime = Date.now();

  const response = await anthropic.messages.create({
    model: pass2Config.model,
    max_tokens: pass2Config.maxTokens,
    temperature: pass2Config.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const elapsed = Date.now() - startTime;

  console.log(`Pass 2 completed in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Usage: ${JSON.stringify(response.usage)}`);

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON
  let jsonText = content.text.trim();
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }

  const analysis = JSON.parse(jsonText);

  return {
    analysis,
    outputTokens: response.usage?.output_tokens || 0,
    inputTokens: response.usage?.input_tokens || 0,
    elapsedMs: elapsed
  };
}

// ==================== Main Execution ====================

async function main() {
  const args = process.argv.slice(2);
  const surveyId = args[0] || RIGO_SURVEY_ID;

  console.log('\n' + '='.repeat(60));
  console.log('DRY RUN: Scale Test for Report Generation');
  console.log('Testing: 20 Reviewers x 5 Questions');
  console.log('='.repeat(60));

  // Step 1: Fetch original data
  const originalData = await fetchSurveyData(surveyId);
  if (!originalData) {
    console.error('Failed to fetch survey data');
    process.exit(1);
  }

  // Step 2: Scale the data
  const scaledData = scaleData(originalData);

  // Step 3: Run Pass 1
  const pass1Result = await runPass1(scaledData);

  // Step 4: Run Pass 2
  const pass2Result = await runPass2(scaledData, pass1Result);

  // Step 5: Generate report
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  const totalTime = pass1Result.elapsedMs + pass2Result.elapsedMs;

  console.log('\n--- Token Usage ---');
  console.log(`Pass 1 Input:  ${pass1Result.inputTokens.toLocaleString()} tokens`);
  console.log(`Pass 1 Output: ${pass1Result.outputTokens.toLocaleString()} tokens`);
  console.log(`Pass 2 Input:  ${pass2Result.inputTokens.toLocaleString()} tokens`);
  console.log(`Pass 2 Output: ${pass2Result.outputTokens.toLocaleString()} tokens`);
  console.log(`Total Tokens:  ${(pass1Result.inputTokens + pass1Result.outputTokens + pass2Result.inputTokens + pass2Result.outputTokens).toLocaleString()} tokens`);

  console.log('\n--- Timing ---');
  console.log(`Pass 1: ${(pass1Result.elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Pass 2: ${(pass2Result.elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Total:  ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Timeout Limit: 720s`);
  console.log(`Status: ${totalTime < 720000 ? 'WITHIN LIMIT' : 'EXCEEDED'}`);

  console.log('\n--- Analysis Quality ---');
  console.log(`Questions analyzed: ${pass1Result.summaries.length}`);
  console.log(`Themes extracted: ${pass2Result.analysis.themes?.length || 0}`);
  console.log(`Strengths: ${pass2Result.analysis.overall_strengths?.length || 0}`);
  console.log(`Development areas: ${pass2Result.analysis.development_areas?.length || 0}`);
  console.log(`Recommendations: ${pass2Result.analysis.recommendations?.length || 0}`);

  // Count citations
  let totalCitations = 0;
  ['themes', 'overall_strengths', 'development_areas', 'recommendations', 'consensus_areas', 'outliers']
    .forEach(section => {
      const items = pass2Result.analysis[section] || [];
      items.forEach(item => {
        if (item.supporting_evidence) {
          item.supporting_evidence.forEach(ev => {
            totalCitations += ev.citations?.length || 0;
          });
        } else if (item.citations) {
          totalCitations += item.citations.length;
        }
      });
    });

  console.log(`Total citations: ${totalCitations}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULT: ' + (totalTime < 720000 ? 'SUCCESS' : 'FAILED'));
  console.log('='.repeat(60));

  // Save results to file
  const resultsDir = path.join(__dirname, 'dry-run-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(resultsDir, `scale-test-${timestamp}.json`);

  const results = {
    testConfig: {
      originalReviewers: originalData.responses.length,
      originalQuestions: originalData.questions.length,
      scaledReviewers: scaledData.responses.length,
      scaledQuestions: scaledData.questions.length
    },
    pass1: {
      inputTokens: pass1Result.inputTokens,
      outputTokens: pass1Result.outputTokens,
      elapsedMs: pass1Result.elapsedMs,
      questionCount: pass1Result.summaries.length
    },
    pass2: {
      inputTokens: pass2Result.inputTokens,
      outputTokens: pass2Result.outputTokens,
      elapsedMs: pass2Result.elapsedMs
    },
    totalTokens: pass1Result.inputTokens + pass1Result.outputTokens + pass2Result.inputTokens + pass2Result.outputTokens,
    totalTimeMs: totalTime,
    withinTimeout: totalTime < 720000,
    analysis: pass2Result.analysis,
    pass1Summaries: pass1Result.summaries
  };

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
