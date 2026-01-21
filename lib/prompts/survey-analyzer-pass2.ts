/**
 * 360 Survey Analyzer - Pass 2: Global Synthesis
 *
 * Used by: lib/services/surveyAnalyzerService.ts
 * Purpose: Synthesize question-level summaries into a comprehensive report
 * with cross-cutting themes, recommendations, and group-level analysis.
 *
 * This is the second pass of a two-pass pipeline designed to reduce hallucination:
 * - Pass 1: Extract factual summaries per question (with citations)
 * - Pass 2 (this file): Synthesize summaries into final report
 *
 * CRITICAL: This prompt receives ONLY the Pass 1 summaries, NOT raw responses.
 * This prevents introducing themes not grounded in actual feedback.
 */

import type { QuestionSummary, ParticipantRelationship } from '../../types';

export const pass2Config = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 20000,
  temperature: 0.0, // Deterministic for consistency
};

interface Pass2PromptParams {
  employeeName: string;
  surveyTitle: string;
  totalResponseCount: number;
  /** Relationship types that provided responses (for sentiment calculation) */
  relationshipsWithResponses: ParticipantRelationship[];
  /** Formatted question summaries from Pass 1 */
  questionSummariesFormatted: string;
  tone?: 'standard' | 'softer';
}

/**
 * Build Pass 2 prompt for global synthesis from question summaries.
 */
export function buildPass2Prompt({
  employeeName,
  surveyTitle,
  totalResponseCount,
  relationshipsWithResponses,
  questionSummariesFormatted,
  tone = 'standard',
}: Pass2PromptParams): string {
  const toneGuidance =
    tone === 'softer'
      ? '\n\nTONE GUIDANCE: Use a supportive and constructive tone. Frame challenges as growth opportunities. Balance criticism with encouragement. Focus on potential and progress rather than deficiencies.'
      : '';

  return `You are synthesizing 360-degree feedback analysis for ${employeeName}.${toneGuidance}

# TASK: SYNTHESIZE QUESTION SUMMARIES INTO FINAL REPORT

You are receiving pre-analyzed question summaries from Pass 1. Your job is to:
1. Identify **cross-cutting themes** that appear across multiple questions
2. Synthesize **overall strengths** and **development areas**
3. Generate **actionable recommendations** based on the themes
4. Analyze **group-level patterns** (consensus, varied perspectives, outliers)
5. Calculate **sentiment scores** by relationship type

# SURVEY CONTEXT

EMPLOYEE: ${employeeName}
SURVEY: ${surveyTitle}
TOTAL RESPONSES: ${totalResponseCount}
RELATIONSHIPS WITH RESPONSES: ${relationshipsWithResponses.join(', ')}

# QUESTION SUMMARIES FROM PASS 1

${questionSummariesFormatted}

---

# CRITICAL RULES

## 1. ONLY Synthesize From Summaries Above
- **Do NOT add new themes** not present in the question summaries
- **Do NOT reference raw responses** - you don't have access to them
- Every theme/strength/area must trace back to Pass 1 summaries
- If it's not in the summaries above, it doesn't exist

## 2. Aggregate and Prioritize by Support Count
- When similar themes appear across multiple questions, MERGE them into one cross-cutting theme
- Sum the support_counts from each question to get total frequency
- Count UNIQUE response_ids across all citations - this is the true reviewer count
- Themes with higher total frequency = stronger consensus = more prominent in report
- Use language that reflects evidence strength:
  - 1-2 sources: "noted", "mentioned", "observed"
  - 3-4 sources: "several noted", "multiple reviewers observed"
  - 5+ sources: "consistent feedback", "broadly recognized", "clear pattern"

## 3. Preserve All Citations
- When referencing themes, carry forward the citations from Pass 1
- The \`response_id\` and \`snippet\` must be exact matches from Pass 1 summaries
- Do NOT invent new citations or modify existing ones

## 4. Aggregate Language (With Exceptions)
- **In most sections**: Use aggregate language, no relationship attribution
  - ✅ "Reviewers noted", "Feedback indicated"
  - ❌ "The manager said", "Direct reports mentioned"

- **EXCEPTION - These sections MAY reference relationships** (admin/sponsor only):
  - \`consensus_areas\`: List which groups agree in \`groups_agreeing\`
  - \`varied_by_relationship\`: Show different perspectives by group
  - \`outliers\`: Note unique single-reviewer perspectives

## 5. Cross-Cutting Analysis
- Look for themes that appear in MULTIPLE question summaries
- Note when the same strength/gap shows up across different questions
- Recommendations should address patterns, not isolated comments

## 6. Write Lean Prose
- Remove filler adjectives that don't add meaning (genuine, considerable, exceptional, remarkable, tremendous, outstanding, unwavering, profound, significant)
- Example: "considerable strategic expertise" → "strategic expertise"
- If an adjective can be deleted without losing information, delete it

---

# OUTPUT FORMAT

Return a JSON object matching this exact structure:

\`\`\`json
{
  "themes": [
    {
      "theme": "Brief Theme Title (3-6 words)",
      "sentiment": "positive" | "needs_work" | "mixed",
      "frequency": 12,
      "supporting_evidence": [
        {
          "text": "Synthesized observation from question summaries",
          "citations": [
            { "response_id": "uuid-from-pass1", "snippet": "exact-snippet-from-pass1" }
          ]
        }
      ]
    }
  ],
  "overall_strengths": [
    {
      "text": "Clear, specific strength statement",
      "citations": [
        { "response_id": "uuid", "snippet": "supporting excerpt" }
      ]
    }
  ],
  "development_areas": [
    {
      "text": "Specific growth opportunity",
      "citations": [
        { "response_id": "uuid", "snippet": "supporting excerpt" }
      ]
    }
  ],
  "recommendations": [
    {
      "text": "Actionable recommendation derived from themes above",
      "citations": [
        { "response_id": "uuid", "snippet": "supporting excerpt" }
      ]
    }
  ],
  "sentiment_by_relationship": {
    "overall": 0.84,
    "manager": 0.85,
    "slt": 0.82,
    "direct_report": 0.92,
    "cross_functional": 0.80
  },
  "consensus_areas": [
    {
      "text": "What multiple reviewer groups agree on",
      "groups_agreeing": ["manager", "direct_report", "cross_functional"],
      "citations": [
        { "response_id": "uuid", "snippet": "supporting excerpt" }
      ]
    }
  ],
  "varied_by_relationship": [
    {
      "topic": "Communication Style",
      "perspectives": [
        {
          "group": "manager",
          "view": "Manager's perspective on this topic",
          "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
        },
        {
          "group": "direct_report",
          "view": "Direct reports' different perspective",
          "citations": [{ "response_id": "uuid", "snippet": "excerpt" }]
        }
      ]
    }
  ],
  "outliers": [
    {
      "text": "Unique perspective from single reviewer",
      "citations": [
        { "response_id": "uuid", "snippet": "supporting excerpt" }
      ]
    }
  ]
}
\`\`\`

---

# SECTION GUIDELINES

## Themes (5-8)
- Cross-cutting patterns that appear in MULTIPLE question summaries
- MERGE similar themes from different questions into one (e.g., "strategic thinking" from Q1 and "big picture vision" from Q3 become one theme)
- \`frequency\` = count of UNIQUE response_ids across all merged citations (not sum of support_counts, which may double-count)
- Mark sentiment based on whether theme is strength or concern
- Include ALL evidence from relevant question summaries

## Overall Strengths (3-5)
- Most significant positive patterns
- Prioritize by total support_count across questions
- Be specific, not generic

## Development Areas (3-5)
- Most significant improvement opportunities
- Frame constructively (opportunity language)
- Prioritize by total support_count

## Recommendations (4-6)
- Actionable next steps derived from themes
- Must connect to specific themes/gaps identified
- Do NOT invent actions not supported by feedback

## Sentiment by Relationship (0-1 scale)
- Calculate based on sentiment distribution in question summaries
- Only include relationships from: ${relationshipsWithResponses.join(', ')}
- Keys must be lowercase: "manager", "slt", "direct_report", "cross_functional"

## Consensus Areas (2-4)
- Topics where 2+ different relationship groups express similar views
- Must show genuine agreement, not just absence of disagreement
- List agreeing groups in \`groups_agreeing\` array

## Varied by Relationship (0-4)
- Topics where different groups perceive differently
- Only include GENUINE divergence (not just different wording)
- Show the contrast clearly - this is valuable insight
- Can be empty if no significant differences exist

## Outliers (0-3)
- Truly unique perspectives mentioned by only ONE reviewer
- Must be substantive and noteworthy
- Can be empty if no significant outliers exist

---

# JSON RULES

- Use single quotes (') inside strings, never double quotes
- Properly escape special characters
- No trailing commas
- Response must be ONLY the JSON object, no markdown or commentary

---

# VERIFICATION CHECKLIST

Before submitting, verify:

1. ✓ Every theme traces back to Pass 1 question summaries
2. ✓ All citations use exact response_ids and snippets from Pass 1
3. ✓ No new themes invented that weren't in summaries
4. ✓ Recommendations connect to identified themes/gaps
5. ✓ Sentiment scores only include relationships that had responses
6. ✓ Group attribution ONLY in consensus/varied/outliers sections
7. ✓ Output is valid JSON object

Now synthesize the question summaries into the final report JSON:`;
}

/**
 * Format question summaries for Pass 2 input.
 * Converts the structured QuestionSummary[] into a readable format for the prompt.
 */
export function formatQuestionSummaries(summaries: QuestionSummary[]): string {
  return summaries
    .map((summary, idx) => {
      const themesText = summary.themes
        .map((theme) => {
          const evidenceText = theme.evidence
            .map((ev) => {
              const citationIds = ev.citations.map((c) => c.response_id).join(', ');
              return `      - "${ev.text}" [cites: ${citationIds}]`;
            })
            .join('\n');
          return `    - "${theme.theme}" (support: ${theme.support_count}, sentiment: ${theme.sentiment})
${evidenceText}`;
        })
        .join('\n');

      const strengthsText = summary.strengths
        .map((s) => {
          const citationIds = s.citations.map((c) => c.response_id).join(', ');
          return `    - "${s.text}" [cites: ${citationIds}]`;
        })
        .join('\n');

      const gapsText = summary.gaps
        .map((g) => {
          const citationIds = g.citations.map((c) => c.response_id).join(', ');
          return `    - "${g.text}" [cites: ${citationIds}]`;
        })
        .join('\n');

      const examplesText =
        summary.examples.length > 0 ? `  Examples: ${summary.examples.join('; ')}` : '';

      return `## Question ${idx + 1}: ${summary.question_text}
  Question ID: ${summary.question_id}
  Response Count: ${summary.response_count}

  ### Themes:
${themesText || '    (none identified)'}

  ### Strengths:
${strengthsText || '    (none identified)'}

  ### Gaps:
${gapsText || '    (none identified)'}
${examplesText}

---`;
    })
    .join('\n\n');
}
