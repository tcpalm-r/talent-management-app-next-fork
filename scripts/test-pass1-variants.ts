/**
 * Test script to compare Pass 1 variants
 * Run with: npx tsx scripts/test-pass1-variants.ts [variant]
 *
 * Variants:
 *   full - Current full prompt with citations (default)
 *   no-citations - Simplified without citation requirements
 *   minimal - Bare minimum output
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch } from 'undici';

const surveyId = '395743b6-ac58-4936-a198-a262b7ae7969';
const variant = process.argv[2] || 'full';

// Simplified prompt WITHOUT citations
const PROMPT_NO_CITATIONS = `You are analyzing 360-degree feedback responses for {employeeName}.

# TASK: QUESTION-LEVEL EXTRACTION

For each question, extract:
1. **Themes** - Key patterns (3-5 per question)
2. **Strengths** - Positive observations
3. **Gaps** - Areas for improvement

# SURVEY CONTEXT
EMPLOYEE: {employeeName}
TOTAL RESPONSES: {responseCount}

# QUESTIONS AND RESPONSES
{questionBlocks}

---

# OUTPUT FORMAT

Return a JSON array with one object per question:

\`\`\`json
[
  {
    "question_id": "uuid",
    "question_text": "The question",
    "themes": [
      {
        "theme": "Theme Title",
        "support_count": 5,
        "sentiment": "positive|needs_work|mixed",
        "summary": "Brief description of this theme"
      }
    ],
    "strengths": ["Strength 1", "Strength 2"],
    "gaps": ["Gap 1", "Gap 2"]
  }
]
\`\`\`

Return ONLY valid JSON array, no markdown or commentary.`;

// Minimal prompt - just themes
const PROMPT_MINIMAL = `Analyze this 360 feedback for {employeeName}.

{questionBlocks}

Return a JSON array with one object per question containing:
- question_id (from input)
- themes: array of {theme, sentiment, support_count}
- top_strength: string
- top_gap: string

Return ONLY valid JSON.`;

async function main() {
  console.log(`\n🧪 Testing Pass 1 variant: ${variant.toUpperCase()}\n`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch survey data
  const { data: survey } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', surveyId)
    .single();

  const { data: employee } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', survey.employee_id)
    .single();

  const { data: reviewers } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', surveyId);

  const { data: responses } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', surveyId);

  const { data: surveyQuestions } = await supabase
    .from('feedback_360_survey_questions')
    .select('*, question:feedback_360_questions(*)')
    .eq('survey_id', surveyId)
    .order('question_order');

  const employeeName = employee?.full_name || 'Unknown';
  console.log(`Employee: ${employeeName}`);
  console.log(`Reviewers: ${reviewers?.length}`);
  console.log(`Responses: ${responses?.length}`);
  console.log(`Questions: ${surveyQuestions?.length}\n`);

  // Build question blocks
  const emailToIdMap = new Map<string, string>();
  reviewers?.forEach((r: any) => {
    const key = (r.reviewer_email || '').trim().toLowerCase();
    if (key) emailToIdMap.set(key, r.id);
  });

  const groupedResponses = (responses || []).reduce((acc: any, r: any) => {
    const key = (r.reviewer_email || '').trim().toLowerCase();
    const reviewerId = emailToIdMap.get(key);
    if (!reviewerId) return acc;
    if (!acc[key]) acc[key] = { participant_id: reviewerId, responses: {}, response_ids: {} };
    acc[key].responses[r.question_id] = r.response_text || r.rating;
    acc[key].response_ids[r.question_id] = r.id;
    return acc;
  }, {});

  const transformedResponses = Object.values(groupedResponses) as any[];
  const questions = (surveyQuestions || []).map((sq: any) => ({
    id: sq.question_id,
    question: sq.question?.question_text || 'Unknown',
  }));

  // Build question blocks string
  let questionBlocks = '';
  questions.forEach((q: any, idx: number) => {
    questionBlocks += `## QUESTION ${idx + 1}\n`;
    questionBlocks += `Question ID: ${q.id}\n`;
    questionBlocks += `Question: ${q.question}\n\n`;
    questionBlocks += `### Responses:\n\n`;

    transformedResponses.forEach((r: any) => {
      const answer = r.responses[q.id];
      if (answer) {
        if (variant === 'full') {
          questionBlocks += `[response_id: ${r.response_ids[q.id]}]\n`;
        }
        questionBlocks += `Answer: "${answer}"\n\n`;
      }
    });
    questionBlocks += `---\n\n`;
  });

  // Select prompt based on variant
  let promptTemplate: string;
  let maxTokens: number;

  if (variant === 'no-citations') {
    promptTemplate = PROMPT_NO_CITATIONS;
    maxTokens = 8000; // Much less output needed
  } else if (variant === 'minimal') {
    promptTemplate = PROMPT_MINIMAL;
    maxTokens = 4000; // Even less
  } else {
    // Full prompt - import from actual file
    const { buildPass1Prompt, preparePass1Input } = await import('../lib/prompts/survey-analyzer-pass1');

    const fullQuestionBlocks = preparePass1Input(
      transformedResponses.map((r: any) => ({
        participant_id: r.participant_id,
        responses: r.responses,
        response_ids: r.response_ids,
      })),
      questions.map((q: any) => ({ id: q.id, question: q.question, type: 'text' }))
    );

    const fullPrompt = buildPass1Prompt({
      employeeName,
      surveyTitle: survey.survey_name,
      totalResponseCount: transformedResponses.length,
      questionBlocks: fullQuestionBlocks,
    });

    promptTemplate = fullPrompt;
    maxTokens = 20000;
  }

  // Build final prompt
  const prompt = promptTemplate
    .replace('{employeeName}', employeeName)
    .replace('{responseCount}', String(transformedResponses.length))
    .replace('{questionBlocks}', questionBlocks);

  console.log(`Prompt length: ${prompt.length} chars`);
  console.log(`Max tokens: ${maxTokens}`);
  console.log(`\nStarting API call...\n`);

  // Make API call with streaming
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    fetch: undiciFetch as any,
  });

  const startTime = Date.now();
  let responseText = '';
  let lastLog = Date.now();

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  stream.on('text', (text) => {
    responseText += text;
    if (Date.now() - lastLog > 5000) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  Progress: ${responseText.length} chars, ${elapsed}s`);
      lastLog = Date.now();
    }
  });

  const final = await stream.finalMessage();
  const elapsed = Date.now() - startTime;

  console.log(`\n✅ COMPLETED in ${(elapsed / 1000).toFixed(1)} seconds`);
  console.log(`\nStats:`);
  console.log(`  Input tokens: ${final.usage.input_tokens}`);
  console.log(`  Output tokens: ${final.usage.output_tokens}`);
  console.log(`  Response length: ${responseText.length} chars`);
  console.log(`  Stop reason: ${final.stop_reason}`);

  // Try to parse JSON
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`  Questions parsed: ${parsed.length}`);
    }
  } catch (e) {
    console.log(`  JSON parse: failed`);
  }

  console.log(`\n📊 Summary for ${variant.toUpperCase()}:`);
  console.log(`  Time: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  Tokens: ${final.usage.input_tokens} in / ${final.usage.output_tokens} out`);
}

main().catch(console.error);
