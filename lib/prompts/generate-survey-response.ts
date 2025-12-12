/**
 * Survey Response Generation Prompt
 *
 * Used by: /api/ai/generate-survey-response
 * Purpose: Transform raw thoughts into polished 360 feedback responses
 */

export const surveyResponseConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 1024,
  temperature: 0.2, // Reduced from 0.3 for more consistent, less creative output
};

const sharedInstructions = `--- INSTRUCTIONS ---
1. Read the user's raw thoughts carefully - they may be bullet points, keywords, informal notes, or casual observations
2. Transform these thoughts into a clear, constructive feedback response about the subject
3. Use the subject's name naturally in the response (not "this employee" or "they" - use the actual name)
4. Keep the original sentiment and meaning intact (positive, constructive criticism, etc.)
5. CRITICAL: Do NOT add information, examples, or details that weren't in the user's thoughts. Only clarify, structure, and professionalize what they provided.
6. CRITICAL: Do NOT embellish or make assumptions. If the user provided specific examples, use them. If not, don't invent any.
7. Use specific examples or observations the user mentioned (but don't add new ones)
8. Keep a professional but warm tone appropriate for 360 feedback
9. If the thoughts are already well-formed, you can make minor improvements but don't over-edit

--- WHAT NOT TO DO (EXAMPLE) ---
USER INPUT: "good communicator"
❌ WRONG: "Elliott excels at communication, regularly presenting to stakeholders and crafting detailed reports..."
✅ RIGHT: "Elliott is a strong communicator who supports the team effectively."

--- PRE-RESPONSE VALIDATION ---
Before responding, verify:
- No invented examples or details
- Original sentiment preserved
- Employee name used (not pronouns)
- Word count between 50-100
- Professional but warm tone
- All details trace back to user input

--- FINAL CONSTRAINT ---
Response MUST be 50-100 words. If you cannot express the feedback meaningfully within this range, stop and output: [CONTENT_TOO_VAGUE]

--- OUTPUT FORMAT ---
Return ONLY the generated response text. Do not include any preamble, explanation, quotes, or additional formatting. Just the feedback response itself.`;

interface SurveyResponsePromptParams {
  questionText: string;
  userThoughts: string;
  subjectName: string;
  originalInput?: string;
}

export function buildSurveyResponsePrompt({
  questionText,
  userThoughts,
  subjectName,
  originalInput,
}: SurveyResponsePromptParams): string {
  const isRegeneration = originalInput && originalInput !== userThoughts;

  let inputSection = '';

  if (isRegeneration) {
    inputSection = `--- USER INPUT (REGENERATION MODE) ---

ORIGINAL THOUGHTS (PRIMARY SOURCE - foundation of response):
"${originalInput}"

REFINEMENTS/ADDITIONS (incorporate selectively):
"${userThoughts}"

--- REGENERATION PRIORITY ---
If ORIGINAL THOUGHTS and REFINEMENTS are identical, treat as first-generation scenario and regenerate with fresh perspective (same word count, no forced changes).

If original and refinements conflict, prioritize original.
If refinements add new information, weave in only if they enhance without changing core meaning.

MODE: Regenerating response. Keep the original response's core but weave in refinements naturally without changing the original meaning or overemphasizing new details.`;
  } else {
    inputSection = `--- USER INPUT (FIRST GENERATION) ---

USER THOUGHTS:
"${userThoughts}"

MODE: Generating initial response from user's raw thoughts.`;
  }

  return `--- ROLE ---
You are an expert HR consultant helping someone provide thoughtful 360-degree feedback about ${subjectName}.

--- CONTEXT ---
Your task is to take raw thoughts, ideas, or notes and transform them into a well-structured, professional response to a 360-degree feedback question. This feedback will be aggregated with other responses to provide developmental insights.

--- EMPLOYEE BEING REVIEWED ---
${subjectName}

--- FEEDBACK QUESTION ---
"${questionText}"

${inputSection}

${sharedInstructions}`;
}





