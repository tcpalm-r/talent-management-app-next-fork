/**
 * Identify Harsh Feedback Prompt
 *
 * Used by: /api/ai/identify-harsh-feedback
 * Purpose: Analyze raw 360 survey responses to identify harsh/critical feedback
 *          that may have been softened in the final report narrative
 */

export const harshFeedbackConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 8192,
  temperature: 0.0, // Deterministic for consistent results
};

export interface HarshFeedbackResponse {
  response_id: string;
  reviewer_name: string;
  reviewer_email: string;
  relationship: string;
  question_text: string;
  response_text: string;
}

export interface HarshFeedbackPromptParams {
  employeeName: string;
  responses: HarshFeedbackResponse[];
}

export interface HarshFinding {
  response_id: string;
  reviewer_name: string;
  relationship: string;
  question_text: string;
  verbatim_quote: string;
  severity: 'mild' | 'moderate' | 'harsh';
  context: string;
}

export interface HarshFeedbackResult {
  summary: {
    total_responses_analyzed: number;
    responses_with_harsh_content: number;
    severity_breakdown: {
      mild: number;
      moderate: number;
      harsh: number;
    };
  };
  findings: HarshFinding[];
}

export function buildHarshFeedbackPrompt({
  employeeName,
  responses,
}: HarshFeedbackPromptParams): string {
  // Format responses for analysis
  const responsesText = responses
    .map(
      (r, i) => `
[Response ${i + 1}]
response_id: ${r.response_id}
reviewer_name: ${r.reviewer_name}
relationship: ${r.relationship}
question: ${r.question_text}
answer: "${r.response_text}"
`
    )
    .join('\n---\n');

  return `You are an HR sentiment analyst reviewing raw 360-degree feedback responses for ${employeeName}.

# TASK
Identify feedback that contains harsh, critical, or potentially hurtful language that may have been softened in the final report. Focus on:

1. **Harsh criticism** - Direct negative statements about performance, behavior, or character
2. **Blunt language** - Unfiltered observations that might hurt if read directly
3. **Frustrated tone** - Feedback expressing irritation, disappointment, or exasperation
4. **Concerning patterns** - Red flags about interpersonal issues or problematic behavior

# RESPONSES TO ANALYZE

${responsesText}

# INSTRUCTIONS

1. Analyze each response for harsh or critical sentiment
2. For each harsh item found, extract the EXACT verbatim quote (do not paraphrase)
3. Rate severity: "mild" (blunt but fair), "moderate" (could sting), "harsh" (potentially hurtful)
4. Only include responses that contain notable criticism - skip purely positive feedback
5. If a response contains multiple harsh elements, include each as a separate finding

# OUTPUT FORMAT

Return a JSON object with this exact structure:

\`\`\`json
{
  "summary": {
    "total_responses_analyzed": number,
    "responses_with_harsh_content": number,
    "severity_breakdown": {
      "mild": number,
      "moderate": number,
      "harsh": number
    }
  },
  "findings": [
    {
      "response_id": "uuid from input",
      "reviewer_name": "Name from input",
      "relationship": "relationship from input",
      "question_text": "Question asked",
      "verbatim_quote": "EXACT text from response - do not modify",
      "severity": "mild" | "moderate" | "harsh",
      "context": "Brief explanation of why this was flagged (1-2 sentences)"
    }
  ]
}
\`\`\`

# CRITICAL RULES

1. **VERBATIM ONLY**: The verbatim_quote field MUST contain exact text from the response. Do not clean up, paraphrase, or soften the language.
2. **Include reviewer info**: Always include the reviewer name and relationship for admin context
3. **No false positives**: Only flag genuinely harsh content, not constructive criticism phrased professionally
4. **Empty is OK**: If no harsh feedback exists, return an empty findings array

Return ONLY the JSON object, no additional text or markdown formatting.`;
}
