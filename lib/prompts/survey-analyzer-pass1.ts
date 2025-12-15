/**
 * 360 Survey Analyzer - Pass 1: Question-Level Extraction
 *
 * Used by: lib/services/surveyAnalyzerService.ts
 * Purpose: Analyze 360 survey responses question-by-question to extract
 * themes, strengths, gaps, and concrete examples with citation tracking.
 *
 * This is the first pass of a two-pass pipeline designed to reduce hallucination:
 * - Pass 1 (this file): Extract factual summaries per question
 * - Pass 2: Synthesize question summaries into final report
 *
 * The key constraint: Pass 2 will ONLY see the output of Pass 1, not raw responses.
 * This prevents the model from introducing themes not grounded in actual feedback.
 */

export const pass1Config = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 20000,
  temperature: 0.0, // Deterministic for consistency
};

interface Pass1PromptParams {
  employeeName: string;
  surveyTitle: string;
  totalResponseCount: number;
  /** Questions with their responses, grouped by question */
  questionBlocks: string;
}

/**
 * Build Pass 1 prompt for question-level analysis.
 * Each question's responses are analyzed independently to extract themes.
 */
export function buildPass1Prompt({
  employeeName,
  surveyTitle,
  totalResponseCount,
  questionBlocks,
}: Pass1PromptParams): string {
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
- Test: Would the original reviewer recognize this as their feedback?

## 2. Citation Requirements
- Every theme/strength/gap MUST have citations with exact response_ids from input
- Use verbatim 10-40 word snippets from the source response
- **100% Coverage**: Every response_id must appear at least once across all your citations
- Before submitting, verify you haven't silently ignored any response

## 3. Count Support Accurately
- \`support_count\` = number of UNIQUE response_ids that mention this theme
- Each response_id counts only once per theme, even if cited multiple times
- Higher support_count = more reviewers mentioned this (stronger signal for Pass 2)

## 4. Use Aggregate Language ONLY
- ✅ CORRECT: "Reviewers noted", "Feedback indicated", "Observations suggest"
- ❌ WRONG: "The manager said", "Direct reports mentioned", "3 peers noted"
- Never mention relationship types in text fields
- Never include counts by relationship type

## 5. Preserve Concrete Details
- When responses mention specific metrics, include them: "60% reduction", "Q3 2024"
- When responses mention project/initiative names, include them
- These specifics make the final report more credible and actionable

## 6. Handle Short/Rating Responses
- Numeric ratings (e.g., "4/5") should be noted but may not generate themes
- Very short responses ("Good", "Fine") may only warrant citation, not a theme
- Don't inflate sparse feedback into substantial themes

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
            "text": "Synthesized observation based on the responses (not a direct quote)",
            "citations": [
              {
                "response_id": "uuid-1",
                "snippet": "verbatim excerpt 10-40 words from this response"
              },
              {
                "response_id": "uuid-2",
                "snippet": "verbatim excerpt from another response"
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
      "Reduced deployment time from 2 hours to 15 minutes",
      "Mentored 3 engineers who were promoted"
    ]
  }
]
\`\`\`

## Sentiment Values
- \`"positive"\` - Strength or positive pattern
- \`"needs_work"\` - Area for improvement
- \`"mixed"\` - Both positive and constructive feedback present

## JSON Rules
- Use single quotes (') inside strings, never double quotes
- Properly escape special characters
- No trailing commas
- Response must be ONLY the JSON array, no markdown or commentary

---

# VERIFICATION CHECKLIST

Before submitting, verify:

1. ✓ Every question from input has a corresponding object in output
2. ✓ Every response_id from input appears at least once in citations (100% coverage)
3. ✓ All response_ids are exact UUIDs from input (no invented IDs)
4. ✓ All snippets are verbatim excerpts from source responses
5. ✓ support_count accurately reflects unique response_ids per theme
6. ✓ No relationship types mentioned in any text fields
7. ✓ Concrete examples extracted when present in responses
8. ✓ Output is valid JSON array

Now analyze each question and return the JSON array:`;
}

/**
 * Prepare responses grouped by question for Pass 1 analysis.
 * Unlike the current system (grouped by relationship), Pass 1 groups by question.
 */
export function preparePass1Input(
  responses: Array<{
    participant_id: string;
    responses: Record<string, unknown>;
    response_ids?: Record<string, string>;
  }>,
  questions: Array<{
    id: string;
    question: string;
    type: string;
    scale_max?: number;
  }>
): string {
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
        // Get the specific response ID for this question-answer pair
        const responseId = response.response_ids?.[question.id] || response.participant_id;

        output += `[response_id: ${responseId}]\n`;

        if (question.type === 'rating') {
          output += `Answer: ${answer}/${question.scale_max || 5}\n`;
        } else if (question.type === 'text') {
          output += `Answer: "${answer}"\n`;
        } else {
          output += `Answer: ${answer}\n`;
        }
        output += '\n';
      }
    });

    if (responseCount === 0) {
      output += `(No responses for this question)\n\n`;
    }

    output += `---\n\n`;
  });

  return output;
}
