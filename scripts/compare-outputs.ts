/**
 * Compare Pass 1 outputs side by side
 * Run with: npx tsx scripts/compare-outputs.ts
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch } from 'undici';
import * as fs from 'fs';

const surveyId = '395743b6-ac58-4936-a198-a262b7ae7969';

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

async function runVariant(variant: 'full' | 'no-citations'): Promise<{ time: number; tokens: number; output: any }> {
  console.log(`\nRunning ${variant.toUpperCase()} variant...`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: survey } = await supabase.from('feedback_360_surveys').select('*').eq('id', surveyId).single();
  const { data: employee } = await supabase.from('user_profiles').select('full_name').eq('id', survey.employee_id).single();
  const { data: reviewers } = await supabase.from('feedback_360_survey_reviewers').select('*').eq('survey_id', surveyId);
  const { data: responses } = await supabase.from('feedback_360_responses').select('*').eq('survey_id', surveyId);
  const { data: surveyQuestions } = await supabase
    .from('feedback_360_survey_questions')
    .select('*, question:feedback_360_questions(*)')
    .eq('survey_id', surveyId)
    .order('question_order');

  const employeeName = employee?.full_name || 'Unknown';

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

  let prompt: string;
  let maxTokens: number;

  if (variant === 'no-citations') {
    prompt = PROMPT_NO_CITATIONS
      .replace('{employeeName}', employeeName)
      .replace('{responseCount}', String(transformedResponses.length))
      .replace('{questionBlocks}', questionBlocks);
    maxTokens = 8000;
  } else {
    const { buildPass1Prompt, preparePass1Input } = await import('../lib/prompts/survey-analyzer-pass1');
    const fullQuestionBlocks = preparePass1Input(
      transformedResponses.map((r: any) => ({
        participant_id: r.participant_id,
        responses: r.responses,
        response_ids: r.response_ids,
      })),
      questions.map((q: any) => ({ id: q.id, question: q.question, type: 'text' }))
    );
    prompt = buildPass1Prompt({
      employeeName,
      surveyTitle: survey.survey_name,
      totalResponseCount: transformedResponses.length,
      questionBlocks: fullQuestionBlocks,
    });
    maxTokens = 20000;
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    fetch: undiciFetch as any,
  });

  const startTime = Date.now();
  let responseText = '';

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  stream.on('text', (text) => { responseText += text; });

  const final = await stream.finalMessage();
  const elapsed = Date.now() - startTime;

  // Parse JSON
  let parsed = null;
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || responseText.match(/(\[[\s\S]*\])/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    }
  } catch (e) {
    console.error('JSON parse failed');
  }

  return {
    time: elapsed,
    tokens: final.usage.output_tokens,
    output: parsed,
  };
}

async function main() {
  console.log('🔬 Running quality comparison...\n');

  // Run both variants
  const noCitations = await runVariant('no-citations');
  const full = await runVariant('full');

  // Save outputs for manual comparison
  fs.writeFileSync(
    'scripts/output-no-citations.json',
    JSON.stringify(noCitations.output, null, 2)
  );
  fs.writeFileSync(
    'scripts/output-full.json',
    JSON.stringify(full.output, null, 2)
  );

  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nNO-CITATIONS: ${(noCitations.time / 1000).toFixed(1)}s, ${noCitations.tokens} tokens`);
  console.log(`FULL:         ${(full.time / 1000).toFixed(1)}s, ${full.tokens} tokens`);
  console.log(`\nSpeedup: ${(full.time / noCitations.time).toFixed(1)}x faster without citations`);

  // Compare first question's themes
  if (noCitations.output && full.output) {
    console.log('\n' + '='.repeat(60));
    console.log('QUALITY COMPARISON - Question 1 Themes');
    console.log('='.repeat(60));

    console.log('\n📋 NO-CITATIONS themes:');
    noCitations.output[0]?.themes?.forEach((t: any, i: number) => {
      console.log(`  ${i + 1}. ${t.theme} (${t.sentiment}, ${t.support_count} mentions)`);
      if (t.summary) console.log(`     "${t.summary}"`);
    });

    console.log('\n📋 FULL themes:');
    full.output[0]?.themes?.forEach((t: any, i: number) => {
      console.log(`  ${i + 1}. ${t.theme} (${t.sentiment}, ${t.support_count} mentions)`);
      // Show citation count if available
      const citationCount = t.evidence?.reduce((sum: number, e: any) => sum + (e.citations?.length || 0), 0) || 0;
      if (citationCount > 0) console.log(`     [${citationCount} citations]`);
    });
  }

  console.log('\n📁 Full outputs saved to:');
  console.log('   scripts/output-no-citations.json');
  console.log('   scripts/output-full.json');
}

main().catch(console.error);
