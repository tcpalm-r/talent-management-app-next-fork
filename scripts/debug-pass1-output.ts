/**
 * Debug script to check Pass 1 output format
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { buildPass1Prompt, preparePass1Input } from '../lib/prompts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SURVEY_ID = '395743b6-ac58-4936-a198-a262b7ae7969';

async function main() {
  console.log('=== Debugging Pass 1 Output Format ===\n');

  // Load data
  const { data: survey } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', SURVEY_ID)
    .single();

  const { data: reviewers } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', SURVEY_ID);

  const { data: responses } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', SURVEY_ID);

  const { data: surveyQuestions } = await supabase
    .from('feedback_360_survey_questions')
    .select('*, feedback_360_questions(*)')
    .eq('survey_id', SURVEY_ID)
    .order('question_order');

  // Transform data
  const emailToReviewerMap = new Map(reviewers?.map(r => [r.reviewer_email, r.id]) || []);
  const groupedResponses: Record<string, any> = {};

  responses?.forEach(r => {
    const reviewerId = emailToReviewerMap.get(r.reviewer_email);
    if (!reviewerId) return;

    if (!groupedResponses[r.reviewer_email]) {
      groupedResponses[r.reviewer_email] = {
        id: r.id,
        survey_id: r.survey_id,
        participant_id: reviewerId,
        responses: {},
        response_ids: {},
        submitted_at: r.created_at,
      };
    }

    groupedResponses[r.reviewer_email].responses[r.question_id] = r.response_text || r.rating;
    groupedResponses[r.reviewer_email].response_ids[r.question_id] = r.id;
  });

  const transformedResponses = Object.values(groupedResponses);

  const questions = surveyQuestions?.map(sq => ({
    id: sq.question_id,
    question: sq.feedback_360_questions?.question_text || '',
    type: sq.feedback_360_questions?.question_type || 'text',
    scale_max: sq.feedback_360_questions?.scale_max,
  })) || [];

  // Build prompt (just first 500 chars for inspection)
  const questionBlocks = preparePass1Input(transformedResponses, questions);
  const prompt = buildPass1Prompt({
    employeeName: survey?.subject_preferred_name || 'Test',
    surveyTitle: survey?.survey_name || 'Test Survey',
    totalResponseCount: transformedResponses.length,
    questionBlocks,
  });

  // Show relevant part of prompt
  console.log('=== Citation Requirements in Prompt ===\n');
  const citationSection = prompt.match(/## 2\. Citation Requirements[\s\S]*?## 3\./)?.[0];
  console.log(citationSection?.slice(0, 800) || 'Not found');

  console.log('\n=== JSON Output Format in Prompt ===\n');
  const jsonSection = prompt.match(/"citations": \[[\s\S]*?\]/)?.[0];
  console.log(jsonSection?.slice(0, 500) || 'Not found');

  // Make a quick API call with just one question to test
  console.log('\n=== Testing Pass 1 with Single Question ===\n');

  const anthropic = new Anthropic();
  const testPrompt = `You are analyzing feedback. Extract ONE theme from this feedback.

RESPONSE:
[response_id: test-123]
"John always makes time for the team and provides great support during difficult projects."

Return JSON with this EXACT format (use key_phrases, NOT snippet):
{
  "themes": [{
    "theme": "Team Support",
    "support_count": 1,
    "sentiment": "positive",
    "evidence": [{
      "text": "Synthesized observation",
      "citations": [{
        "response_id": "test-123",
        "key_phrases": ["makes time for the team", "provides great support"]
      }]
    }]
  }]
}

Return ONLY the JSON, nothing else.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    temperature: 0,
    messages: [{ role: 'user', content: testPrompt }],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    console.log('API Response:');
    console.log(content.text);

    // Check if it has key_phrases or snippet
    if (content.text.includes('key_phrases')) {
      console.log('\n✓ Claude returned key_phrases as requested');
    } else if (content.text.includes('snippet')) {
      console.log('\n✗ Claude returned snippet instead of key_phrases');
    }
  }
}

main().catch(console.error);
