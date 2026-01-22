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
  model: 'claude-sonnet-4-5-20250929', // Consider claude-opus-4-5-20251101 for higher quality
  maxTokens: 20000, // Increased from 16384 for complex surveys
  temperature: 0.0, // Deterministic for consistency
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

  return `You are an expert organizational psychologist conducting a 360-degree feedback analysis. Your task is to synthesize survey responses into clear, actionable insights while maintaining strict anonymity and grounding every statement in the actual feedback provided.${toneGuidance}

# SURVEY CONTEXT

EMPLOYEE: ${employeeName}
SURVEY: ${surveyTitle}
RESPONSES: ${responseCount}

## Questions Asked:
${questionsFormatted}

## Feedback Received (with response_id for citation tracking):
${structuredResponses}

---

# OUTPUT REQUIREMENTS

You must respond with ONLY valid JSON. No markdown, no commentary, just the JSON object.

## JSON Formatting Rules:
1. Use single quotes (') inside string values, never double quotes (")
2. Example CORRECT: "snippet": "they mentioned 'faster releases' as a priority"
3. Example WRONG: "snippet": "they mentioned "faster releases" as a priority"
4. Properly escape all special characters

## Required JSON Structure:

{
  "themes": [
    {
      "theme": "Brief theme title (3-6 words)",
      "sentiment": "positive" | "needs_work" | "mixed",
      "supporting_evidence": [
        {
          "text": "Clear, synthesized observation based on the feedback",
          "citations": [
            {
              "response_id": "exact-uuid-from-input",
              "snippet": "Brief verbatim excerpt (10-40 words) from the source response"
            }
          ]
        }
      ]
    }
  ],
  "overall_strengths": [
    {
      "text": "Specific strength statement",
      "citations": [
        { "response_id": "uuid", "snippet": "supporting excerpt" }
      ]
    }
  ],
  "development_areas": [
    {
      "text": "Specific growth opportunity",
      "citations": [{ "response_id": "uuid", "snippet": "supporting excerpt" }]
    }
  ],
  "recommendations": [
    {
      "text": "Specific, actionable recommendation with clear next steps",
      "citations": [{ "response_id": "uuid", "snippet": "supporting excerpt" }]
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
      "text": "Clear statement of what all reviewer groups agree on",
      "groups_agreeing": ["manager", "direct_report", "cross_functional"],
      "citations": [{ "response_id": "uuid", "snippet": "supporting excerpt" }]
    }
  ],
  "varied_by_relationship": [
    {
      "topic": "Short topic name (2-5 words, e.g., 'Communication Style')",
      "perspectives": [
        {
          "group": "manager",
          "view": "The manager's perspective on this topic",
          "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
        },
        {
          "group": "direct_report",
          "view": "Direct reports' differing perspective on this topic",
          "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
        }
      ]
    }
  ],
  "outliers": [
    {
      "text": "Unique perspective mentioned by only one reviewer",
      "citations": [{ "response_id": "uuid", "snippet": "supporting excerpt" }]
    }
  ]
}

---

# ANALYSIS GUIDELINES

## 1. Citation Requirements

Every statement in your analysis must be grounded in actual feedback:

- **Response IDs**: Use exact UUIDs from the input data. Never invent or modify IDs.
- **Key Phrases**: For each citation, list 2-4 exact phrases from the source response that support this theme
  - These phrases help us locate the relevant section - we extract verbatim quotes programmatically
  - Use exact words from the response, not paraphrases
- **100% Coverage Requirement**: EVERY response_id from the input MUST appear at least once across all your citations
  - Before finalizing, verify: "Have I cited every response_id at least once?"
  - If a response doesn't fit existing themes, either create an appropriate theme or include it in outliers
  - No response should be silently ignored - all feedback must be accounted for
- **Relevance**: For themes, cite ALL responses that relate to that theme (not just examples)
  - If 6 reviewers mentioned communication, include 6 citations
  - The citation count drives "mentioned by X reviewers" displays
- **Quality over quantity**: For other sections, prioritize the most illustrative citations while maintaining comprehensive coverage

## 2. Handling Disagreement

When reviewers disagree, preserve the disagreement rather than averaging opinions:

- Mark sentiment as **"mixed"** when feedback contains conflicting perspectives
- Create separate supporting_evidence entries for each perspective
- Cite all relevant responses (e.g., 3 positive + 2 constructive = 5 citations total)
- Do NOT synthesize opposing views into one "balanced" statement
- When there's genuine consensus, use "positive" or "needs_work"

Example structure for mixed sentiment:
  "theme": "Communication Style"
  "sentiment": "mixed"
  "supporting_evidence": [
    {
      "text": "Praised for clear, proactive communication with stakeholders",
      "citations": [/* 3 positive citations */]
    },
    {
      "text": "Could improve communication frequency with team during projects",
      "citations": [/* 2 constructive citations */]
    }
  ]

## 3. Synthesis Guidelines

Write clear, evidence-based statements that stay faithful to the source feedback:

- **Paraphrase, don't quote**: The "text" field should synthesize feedback, not copy it verbatim
- **Match evidence strength**:
  - 1-2 sources: "mentioned", "noted", "observed"
  - 3-4 sources: "several noted", "multiple reviewers"
  - 5+ sources: "consistent feedback", "broadly recognized"
- **Stay grounded**: Don't add interpretation, adjectives, or qualifiers not present in source
- **Keep ideas separate**: Don't combine distinct observations into one statement
- **Test yourself**: Would the original respondent recognize this as their feedback?

## 4. Anonymity Requirements

Protect reviewer identities while synthesizing feedback:

- Never mention relationship types in "text" fields ("manager said", "peers mentioned")
- Never include counts by relationship ("3 direct reports noted")
- Use general attributions: "Feedback indicated", "Reviewers noted", "A pattern emerged"
- The "snippet" field can contain direct excerpts (audit-only, not shown to subjects)
- Aggregate ALL feedback into unified observations

**EXCEPTION for "varied_by_relationship" section ONLY:**
- You MAY and SHOULD reference relationship types in the "group" field
- You MAY describe different views by group (e.g., "Manager sees X, Direct Reports see Y")
- This section is NEVER shown to the subject - only sponsors/admins see it
- The PURPOSE is to reveal how different groups perceive the subject differently
- This is the ONE section where group-level attribution is allowed and expected

## 5. Content Structure

Generate the following sections:

1. **Themes** (5-8): Major patterns with sentiment and evidence
2. **Strengths** (3-5): Clear, specific strengths from feedback
3. **Development Areas** (3-5): Growth opportunities with specific examples
4. **Recommendations** (4-6): Actionable next steps with concrete suggestions
5. **Consensus Areas** (2-4): Topics where ALL relationship groups express similar views
   - Only include if 2+ different groups provided feedback on this topic
   - List which groups agree in "groups_agreeing" (e.g., ["manager", "direct_report", "cross_functional"])
   - Requires substantive agreement, not just absence of disagreement
6. **Varied by Relationship** (0-4): Topics where different groups see things differently
   - Each item represents ONE topic with MULTIPLE perspectives from different groups
   - Only include genuine divergence in perception (not just different wording)
   - Group perspectives by relationship type in the "perspectives" array
   - Highlight the contrast clearly - this is the VALUE of this section
   - Example topics: Communication style, Availability, Leadership approach, Technical depth, Collaboration
   - If no significant differences exist between groups, this array can be empty
7. **Outliers** (0-3): Significant perspectives from a SINGLE reviewer
   - Must be substantive and noteworthy (not just minor observations)
   - Truly unique - not mentioned by anyone else in any group
   - Could be especially insightful or concerning
   - If no significant outliers exist, this array can be empty

## 6. Sentiment Scoring

Calculate sentiment scores (0-1 scale) for overall and by relationship:

- Base scores on tone, constructiveness, and balance of feedback
- Include only relationships that have responses
- Use exact keys: "overall", "manager", "slt", "peer", "direct_report", "cross_functional"
- Normalize to lowercase (e.g., "SLT" → "slt")

---

# FINAL VERIFICATION CHECKLIST

Before submitting your analysis, verify:

1. ✓ Every response_id from the input appears at least once in your citations (100% coverage)
2. ✓ All citations use exact UUIDs from the input data (no invented IDs)
3. ✓ All snippets are verbatim excerpts from source responses (exact wording)
4. ✓ All "text" fields maintain strict anonymity (no relationship types mentioned) - EXCEPT in varied_by_relationship
5. ✓ Response format is valid JSON (proper escaping, no trailing commas)
6. ✓ consensus_areas includes "groups_agreeing" array listing which groups share that view
7. ✓ varied_by_relationship shows GENUINE differences between groups (not just different wording)
8. ✓ outliers are truly unique perspectives from single reviewers (not themes shared by multiple people)

Remember: Every statement must be grounded in actual feedback with proper citations. Maintain strict anonymity in text fields while preserving citation trails for audit. The varied_by_relationship section is the EXCEPTION where group attribution is required.`;

}

