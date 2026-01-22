/**
 * Generate Narrative Prompt
 *
 * Used by: /api/ai/generate-narrative
 * Purpose: Create comprehensive one-page narrative for 360 feedback reports
 */

export const generateNarrativeConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
  temperature: 0.2, // Lowered from 0.4 for more consistent regenerations
};

interface Theme {
  theme: string;
  description: string;
}

interface CitedStatement {
  text: string;
  citations?: Array<{
    response_id: string;
    snippet: string;
  }>;
}

interface ThemeWithCitations {
  theme: string;
  sentiment?: 'positive' | 'needs_work' | 'mixed';
  supporting_evidence?: CitedStatement[];
  frequency?: number;
}

interface ReportData {
  executive_summary?: string;
  themes?: Theme[] | ThemeWithCitations[];
  strengths?: string[] | CitedStatement[];
  development_areas?: string[] | CitedStatement[];
  key_insights?: string[];
  recommendations?: string[] | CitedStatement[];
}

interface RawResponse {
  question: string;
  responses: string[];
}

interface GenerateNarrativePromptParams {
  subjectName: string;
  rawResponses: RawResponse[];
  reportData: ReportData;
  /** Optional citation metadata for grounding */
  citationContext?: {
    totalCitations: number;
    citationCoverage: number; // 0-100
  };
}

// Helper to extract text from string or CitedStatement
function extractItemText(item: string | CitedStatement): string {
  if (typeof item === 'string') return item;
  return item.text || '';
}

// Helper to extract citation snippets from CitedStatement
function extractCitationSnippets(item: string | CitedStatement): string[] {
  if (typeof item === 'string') return [];
  return item.citations?.map(c => c.snippet).filter(Boolean) || [];
}

// Helper to format a section with citation context
function formatSectionWithCitations(
  items: string[] | CitedStatement[] | undefined,
  sectionName: string
): string {
  if (!items || items.length === 0) return '';

  const formattedItems = items.map((item, i) => {
    const text = extractItemText(item);
    const snippets = extractCitationSnippets(item);

    if (snippets.length > 0) {
      // Include up to 2 citation snippets for grounding context
      const snippetText = snippets.slice(0, 2).map(s => `"${s}"`).join(', ');
      return `${i + 1}. ${text}\n   [Grounded in feedback: ${snippetText}]`;
    }
    return `${i + 1}. ${text}`;
  }).join('\n');

  return `${sectionName}:\n${formattedItems}`;
}

export function buildGenerateNarrativePrompt({
  subjectName,
  rawResponses,
  reportData,
  citationContext,
}: GenerateNarrativePromptParams): string {
  // Format raw responses for the prompt
  const rawResponsesText = rawResponses
    .map((item, idx) => {
      const responsesText = item.responses
        .filter((r) => r && r.trim())
        .map((r, i) => `   ${i + 1}. ${r}`)
        .join('\n');
      return `${idx + 1}. ${item.question}\n${responsesText || '   (No responses)'}`;
    })
    .join('\n\n');

  // Format report data sections with citation context
  const reportSections: string[] = [];

  if (reportData.executive_summary) {
    reportSections.push(`EXECUTIVE SUMMARY:\n${reportData.executive_summary}`);
  }

  if (reportData.themes && reportData.themes.length > 0) {
    const themesText = reportData.themes.map((t, i) => {
      const themeWithCitations = t as ThemeWithCitations;
      const baseText = `${i + 1}. ${t.theme}`;

      // Include sentiment and frequency if available
      const meta: string[] = [];
      if (themeWithCitations.sentiment) {
        meta.push(`sentiment: ${themeWithCitations.sentiment}`);
      }
      if (themeWithCitations.frequency && themeWithCitations.frequency > 0) {
        meta.push(`mentioned by ${themeWithCitations.frequency} reviewers`);
      }

      // Include supporting evidence text
      let evidenceText = '';
      if (themeWithCitations.supporting_evidence && themeWithCitations.supporting_evidence.length > 0) {
        const evidenceItems = themeWithCitations.supporting_evidence
          .map(ev => extractItemText(ev))
          .filter(Boolean)
          .slice(0, 3); // Limit to 3 evidence points per theme
        if (evidenceItems.length > 0) {
          evidenceText = `\n   Evidence: ${evidenceItems.join('; ')}`;
        }
      } else if ('description' in t && t.description) {
        evidenceText = `: ${t.description}`;
      }

      const metaText = meta.length > 0 ? ` (${meta.join(', ')})` : '';
      return `${baseText}${metaText}${evidenceText}`;
    }).join('\n');
    reportSections.push(`KEY THEMES:\n${themesText}`);
  }

  // Use helper for sections that may have citations
  const strengthsSection = formatSectionWithCitations(reportData.strengths, 'STRENGTHS');
  if (strengthsSection) reportSections.push(strengthsSection);

  const devAreasSection = formatSectionWithCitations(reportData.development_areas, 'DEVELOPMENT AREAS');
  if (devAreasSection) reportSections.push(devAreasSection);

  if (reportData.key_insights && reportData.key_insights.length > 0) {
    const insightsText = reportData.key_insights.map((insight, i) => `${i + 1}. ${insight}`).join('\n');
    reportSections.push(`KEY INSIGHTS:\n${insightsText}`);
  }

  const recsSection = formatSectionWithCitations(reportData.recommendations, 'RECOMMENDED ACTIONS');
  if (recsSection) reportSections.push(recsSection);

  const reportDataText = reportSections.join('\n\n');

  // Add citation context guidance if available
  const citationGuidance = citationContext
    ? `\n\nCITATION CONTEXT: This analysis is grounded in ${citationContext.totalCitations} citations from the raw feedback, with ${citationContext.citationCoverage}% coverage. Themes with higher frequency (more reviewers mentioning them) should be given more prominence in the narrative.`
    : '';

  return `You are an expert executive coach and leadership development specialist. You have been asked to create a comprehensive one-page narrative for ${subjectName}'s 360-degree feedback report.

This narrative will be the first page of the final report that ${subjectName} receives. It should be professionally written, developmental in tone, balanced, and approximately 500-700 words. Use direct, factual language throughout.

Your narrative should synthesize both the raw feedback data AND the analyzed report sections to create a cohesive, insightful summary that will help ${subjectName} understand their strengths, growth opportunities, and recommended next steps.${citationGuidance}

---

RAW FEEDBACK RESPONSES:
${rawResponsesText}

---

ANALYZED REPORT DATA:
${reportDataText}

---

INSTRUCTIONS:
1. Write a clear, professionally crafted narrative (550-750 words) that synthesizes ALL the data above
2. Begin with an opening paragraph that sets a professional, developmental tone
3. Weave together themes, strengths, and development areas into a cohesive story
4. Reference specific feedback points from the raw responses as your PRIMARY source of examples. Use exact details (names of initiatives, metrics, specific situations) from the raw feedback. The analyzed report data provides structure; the raw responses provide the authentic voice and specifics.
5. Include concrete, actionable insights and recommendations
6. End with a forward-looking closing that notes development opportunities
7. Use third person perspective (e.g., "${subjectName} demonstrates...")
8. Maintain a professional, direct tone - factual and constructive without being effusive or overly encouraging
9. Write lean prose. Remove filler adjectives that don't add meaning (genuine, considerable, exceptional, remarkable, tremendous, outstanding, unwavering, profound, significant). Example: "considerable strategic expertise" → "strategic expertise". If the adjective can be deleted without losing information, delete it.
10. ANONYMITY: Never single out individual reviewers. Do NOT use phrases like "one team member noted", "a colleague observed", "one reviewer mentioned". Always use aggregate language: "reviewers noted", "feedback indicated", "the team observed". If a point was made by only one person, present it without attribution or skip it if it risks identification.
11. DO NOT use section headers, titles, bullet points, or markdown formatting (no **, ##, etc.) - this should be flowing narrative prose only
12. DO NOT include any title like "Executive Summary" or "360-Degree Feedback Report" - start directly with the narrative content
13. Make it feel personalized and specific to ${subjectName}, not generic
14. PRIORITIZATION: Give more weight to themes mentioned by more reviewers (higher frequency) - these represent stronger consensus
15. COVERAGE: Include at least one specific example from EACH of the raw feedback questions above. Every question category (value creation, skills to develop, "I wish they knew", systems/processes) should have representation in the narrative.
16. SPECIFICITY: When the raw feedback mentions specific metrics (e.g., "60% reduction", "double the impact"), project names, or concrete outcomes, prefer including these over generic statements. Specifics make the narrative more credible and actionable.
17. BALANCE: Ensure the narrative doesn't over-index on a few dramatic examples. Include at least one reference to process/systems improvements and learning/knowledge-sharing behaviors.

Write the narrative now (plain text only, no formatting):`;
}

