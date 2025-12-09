/**
 * Parse Survey Responses Prompt
 *
 * DEAD CODE: This prompt is not used by any frontend component.
 * The API route exists but is never called.
 * Kept for potential future use or reference.
 *
 * Used by: /api/ai/parse-survey-responses (unused)
 * Purpose: Parse free-form feedback and map to specific survey questions
 */

export const parseSurveyResponsesConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 2048,
  temperature: 0.3,
};

interface Question {
  id: string;
  text: string;
}

interface ParseSurveyResponsesPromptParams {
  feedbackText: string;
  questions: Question[];
}

export function buildParseSurveyResponsesPrompt({
  feedbackText,
  questions,
}: ParseSurveyResponsesPromptParams): string {
  const questionsText = questions.map((q, i) => `${i + 1}. (ID: ${q.id}) ${q.text}`).join('\n');

  return `You are an expert HR analyst specializing in 360-degree feedback analysis. Your task is to intelligently parse free-form feedback comments and map them to specific survey questions.

USER'S FREE-FORM FEEDBACK:
"${feedbackText}"

SURVEY QUESTIONS TO ANSWER:
${questionsText}

INSTRUCTIONS:
1. Read the free-form feedback carefully
2. Identify comments, observations, and feedback related to each question
3. For each question ID, extract or synthesize a concise, well-formed response based on the relevant feedback
4. If the feedback doesn't contain information relevant to a question, use an empty string
5. Keep responses professional and constructive
6. Preserve the original sentiment (positive, constructive, etc.)
7. Combine related comments into cohesive responses

RETURN ONLY VALID JSON in this exact format (no other text):
{
  "questionId1": "synthesized response for question 1",
  "questionId2": "synthesized response for question 2",
  "questionId3": ""
}

Make sure to include ALL question IDs, even if the response is empty.`;
}

