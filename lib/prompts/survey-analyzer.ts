/**
 * 360 Survey Analyzer Prompt
 *
 * Used by: lib/services/surveyAnalyzerService.ts
 * Purpose: Analyze 360 survey responses to identify themes, insights, and recommendations
 *
 * This prompt uses citation tracking for audit trail - citations are always generated
 * but only shown to admins in the UI.
 */

export const surveyAnalyzerConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 8192,
  temperature: 0.3,
};

interface SurveyAnalyzerPromptParams {
  employeeName: string;
  surveyTitle: string;
  responseCount: number;
  questionsFormatted: string;
  /** Structured responses must include [response_id: uuid] markers for each answer */
  structuredResponses: string;
  tone?: 'standard' | 'softer';
}

/**
 * Build survey analyzer prompt with citation support.
 * Each statement in the output will include citations linking back to source response IDs.
 * This enables the audit trail feature for HR admins.
 */
export function buildSurveyAnalyzerPrompt({
  employeeName,
  surveyTitle,
  responseCount,
  questionsFormatted,
  structuredResponses,
  tone = 'standard',
}: SurveyAnalyzerPromptParams): string {
  const toneGuidance =
    tone === 'softer'
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

