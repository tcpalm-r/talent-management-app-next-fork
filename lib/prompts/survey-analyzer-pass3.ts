/**
 * 360 Survey Analyzer - Pass 3: Theme Consolidation
 *
 * Used by: lib/services/surveyAnalyzerService.ts
 * Purpose: Review themes from Pass 2, identify contradictions/overlaps, and merge them.
 *
 * This is the third pass of a three-pass pipeline:
 * - Pass 1: Extract factual summaries per question
 * - Pass 2: Synthesize question summaries into themes
 * - Pass 3 (this file): Consolidate themes - merge contradictory/overlapping themes
 *
 * Pass 3 DOES merge themes. The output replaces the Pass 2 themes.
 */

export const pass3Config = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 8000,
  temperature: 0.0,
};

interface ThemeEvidence {
  text: string;
  citations?: Array<{ response_id: string; snippet: string }>;
}

interface InputTheme {
  theme: string;
  sentiment: string;
  frequency: number;
  supporting_evidence?: ThemeEvidence[];
}

interface Pass3PromptParams {
  employeeName: string;
  themes: InputTheme[];
}

/**
 * Build Pass 3 prompt for theme consolidation.
 */
export function buildPass3Prompt({ employeeName, themes }: Pass3PromptParams): string {
  const themeSummary = themes
    .map((t, i) => {
      const evidence = t.supporting_evidence
        ?.map((e) => {
          const citationIds = e.citations?.map((c) => c.response_id).join(', ') || 'none';
          return `    - "${e.text}" [citations: ${citationIds}]`;
        })
        .join('\n') || '    (no evidence)';
      return `## Theme ${i + 1}: ${t.theme}
Sentiment: ${t.sentiment}
Frequency: ${t.frequency} reviewers
Evidence:
${evidence}`;
    })
    .join('\n\n');

  return `You are consolidating AI-generated themes from a 360 feedback report for ${employeeName}.

# INPUT THEMES

${themeSummary}

---

# YOUR TASK: CONSOLIDATE THEMES

Review these themes and produce a FINAL consolidated list. You MUST:

1. **MERGE contradictory themes** - If two themes cover the same topic with opposite sentiments (e.g., "Strong collaboration" positive + "Needs better collaboration" negative), merge them into ONE theme with sentiment "mixed"

2. **MERGE overlapping themes** - If two themes describe aspects of the same underlying skill/behavior, combine them

3. **PASS THROUGH standalone themes** - Themes that don't need merging should be included unchanged

4. **PRESERVE ALL CITATIONS** - When merging, combine all evidence and citations from both source themes

---

# MERGE RULES

## When to Merge:
- Same topic, opposite sentiments → Merge with "mixed" sentiment
- Same topic, same sentiment → Merge into single stronger theme
- Overlapping topics → Merge if combining creates clearer picture
- Same underlying dynamic, different vocabulary → Merge even if titles use different words
  - Example: "Team Support" (positive, what they DO) + "Lacks Empathy" (negative, HOW they do it)
  - These describe actions vs manner/delivery - merge into one theme about interpersonal effectiveness

## When NOT to Merge:
- Distinct topics that happen to share a word
- Already nuanced themes that stand alone well

## Merged Theme Format:
- Title should capture the nuance (e.g., "Cross-Functional Work: Strong Execution, Needs Strategic Thinking")
- Sentiment: "mixed" if combining positive + needs_work
- Evidence: Combine ALL evidence from merged themes as plain factual statements
- Add nuance_note explaining the balanced view

## Evidence Format (IMPORTANT):
- Write evidence as plain factual statements, same style as non-merged themes
- Do NOT prefix with "Strength:", "Growth area:", "Positive:", "Negative:", etc.
- The theme's sentiment and nuance_note already convey the duality
- WRONG: "Strength: Provides strong support to teammates"
- CORRECT: "Provides strong support to teammates"

---

# OUTPUT FORMAT

Return a JSON object with this exact structure:

{
  "consolidated_themes": [
    {
      "theme": "Theme title - nuanced if merged",
      "sentiment": "positive" | "needs_work" | "mixed",
      "merged_from": ["Original Theme 1", "Original Theme 2"],
      "supporting_evidence": [
        {
          "text": "Evidence statement",
          "citations": [
            { "response_id": "uuid", "snippet": "verbatim quote" }
          ]
        }
      ],
      "nuance_note": "For mixed themes: explains how both aspects coexist"
    }
  ],
  "merge_decisions": [
    {
      "merged_themes": ["Theme A", "Theme B"],
      "rationale": "Why these were merged",
      "new_theme_title": "The resulting theme title"
    }
  ],
  "coherence_summary": "Brief overview of the consolidated themes and any patterns"
}

## JSON Rules:
- consolidated_themes MUST include ALL themes (merged or unchanged)
- For unchanged themes: omit merged_from, keep original structure
- For merged themes: merged_from lists exact original theme names
- supporting_evidence must preserve ALL citations from source themes
- Response must be ONLY the JSON object, no markdown or commentary

---

# EXAMPLE

Input themes:
- "Team Collaboration" (positive, 8 reviewers)
- "Needs to Improve Team Communication" (needs_work, 4 reviewers)
- "Technical Excellence" (positive, 6 reviewers)

Output:
{
  "consolidated_themes": [
    {
      "theme": "Team Collaboration and Communication: Strong Support, Communication Gaps",
      "sentiment": "mixed",
      "merged_from": ["Team Collaboration", "Needs to Improve Team Communication"],
      "supporting_evidence": [
        { "text": "Provides strong support to teammates and creates collaborative environment", "citations": [...] },
        { "text": "Could communicate status updates more proactively to keep team informed", "citations": [...] }
      ],
      "nuance_note": "Strong at collaborative work and supporting others, but communication could be more proactive and frequent"
    },
    {
      "theme": "Technical Excellence",
      "sentiment": "positive",
      "supporting_evidence": [...]
    }
  ],
  "merge_decisions": [
    {
      "merged_themes": ["Team Collaboration", "Needs to Improve Team Communication"],
      "rationale": "Both themes address teamwork/communication - one highlights strengths, one highlights gaps. Merging creates balanced view.",
      "new_theme_title": "Team Collaboration and Communication: Strong Support, Communication Gaps"
    }
  ],
  "coherence_summary": "Consolidated from 3 to 2 themes. Team-related feedback merged to show balanced picture of strong collaboration with room for communication improvement."
}

---

Now analyze the input themes and return the consolidated JSON:`;
}

/**
 * Types for Pass 3 output
 */
export interface ConsolidatedTheme {
  theme: string;
  sentiment: 'positive' | 'needs_work' | 'mixed';
  merged_from?: string[];
  supporting_evidence: Array<{
    text: string;
    citations?: Array<{ response_id: string; snippet: string }>;
  }>;
  nuance_note?: string;
}

export interface MergeDecision {
  merged_themes: string[];
  rationale: string;
  new_theme_title: string;
}

export interface Pass3Result {
  consolidated_themes: ConsolidatedTheme[];
  merge_decisions: MergeDecision[];
  coherence_summary: string;
}

// Legacy types for backward compatibility
export interface ThemeContradiction {
  theme_a: string;
  theme_b: string;
  nature: string;
  resolution: string;
}

export interface ThemeRelationship {
  themes: string[];
  relationship: string;
}

export interface ThemeAnnotation {
  related_to?: string[];
  tension_with?: string;
  context_note?: string;
}
