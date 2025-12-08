/**
 * 360 Survey Analyzer Prompt
 *
 * Used by: lib/survey360Analyzer.ts
 * Purpose: Analyze 360 survey responses to identify themes, insights, and recommendations
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
  structuredResponses: string;
  tone?: 'standard' | 'softer';
}

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

RESPONSES BY RELATIONSHIP TYPE:
${structuredResponses}

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON object. Return exactly this structure:

{
  "executive_summary": "A concise 2-3 sentence overview using the employee's actual name (${employeeName}) describing their overall performance, key strengths, and primary development opportunities based on the 360 feedback. This should provide a high-level snapshot of the entire review.",
  "themes": [
    {
      "theme": "Concise theme name (e.g., 'Strong Communication Skills')",
      "sentiment": "very_positive" | "positive" | "mixed" | "needs_work" | "critical",
      "supporting_evidence": ["Synthesized summary of feedback (NO direct quotes)", "Another paraphrased observation"]
    }
  ],
  "overall_strengths": [
    "Specific strength mentioned by multiple participants",
    "Another key strength with consensus"
  ],
  "development_areas": [
    "Area for improvement with supporting evidence",
    "Another development opportunity"
  ],
  "recommendations": [
    "Actionable recommendation based on feedback",
    "Another specific action to take"
  ],
  "sentiment_by_relationship": {
    "overall": 0.84,
    "manager": 0.85,
    "peer": 0.78,
    "direct_report": 0.92,
    "cross_functional": 0.80
  },
  "key_insights": [
    "Important pattern or insight from the data",
    "Another significant observation"
  ],
  "consensus_areas": [
    "Area where most participants strongly agree",
    "Another point of consensus"
  ],
  "outlier_opinions": [
    "Unique or contrasting perspective worth noting",
    "Another divergent viewpoint"
  ]
}

CRITICAL - ANONYMITY & AGGREGATION REQUIREMENTS:
- NEVER include direct quotes or verbatim text from responses
- ALWAYS paraphrase and synthesize feedback across ALL sources (never separated by relationship type)
- NEVER mention specific relationship types like "manager specifically noted" or "direct reports said"
- NEVER provide counts or breakdowns by relationship type (e.g., "mentioned by 6 managers and 4 peers")
- Use only general, aggregated attributions:
  * "Feedback consistently indicated..."
  * "Multiple reviewers noted..."
  * "A common theme across feedback..."
  * "Many shared perspective..."
  * "Several mentioned..."
  * "A unique perspective was..."
- Combine ALL feedback into unified, anonymized observations regardless of reviewer relationship
- The sentiment_by_relationship field should contain BOTH:
  * An "overall" score (0-1) representing aggregate sentiment across all reviewers
  * Individual scores for each relationship type that provided feedback: "manager", "peer", "direct_report", "cross_functional"
  * Calculate each relationship score based on the tone, positivity, and constructiveness of that group's responses
  * If a relationship type had no responses, omit that key from the object

ANALYSIS GUIDELINES:
1. **Executive Summary**: Write a concise 2-3 sentence overview that uses the employee's actual name (${employeeName}) and captures their overall performance trajectory, highlighting their top 1-2 strengths and 1-2 key development areas. This should give a reader an immediate understanding of the review's key takeaways.
2. **Themes**: Identify 5-8 major themes. Look for patterns across all responses combined.
3. **Supporting Evidence**: Paraphrase and synthesize feedback (NO direct quotes). Combine observations from all reviewers into unified statements.
4. **Sentiment Classification**: Use constructive language:
   - "very_positive": Exceptional strengths with strong consensus
   - "positive": Clear strengths recognized widely
   - "mixed": Balance of positive and constructive feedback
   - "needs_work": Areas requiring attention and development
   - "critical": Serious concerns requiring immediate action
5. **Sentiment Scores**: Calculate sentiment scores (0-1 scale) based on overall tone and constructiveness:
   - Overall: Aggregate sentiment across all reviewers
   - Per-relationship: Calculate separate scores for manager, peer, direct_report, and cross_functional groups
   - Base scores on positivity, constructiveness, and supportiveness of feedback from each group
6. **Strengths**: List 3-5 clear strengths. Synthesize feedback from all sources into unified statements.
7. **Development Areas**: Identify 3-5 areas for growth. Use paraphrased, aggregated summaries.
8. **Recommendations**: Provide 4-6 specific, actionable steps based on synthesized feedback.
9. **Key Insights**: Surface 3-5 important patterns or observations from all feedback combined.
10. **Consensus**: Highlight areas where there is broad agreement.
11. **Outliers**: Note any unique or contrasting perspectives, but do NOT attribute to specific relationship types.

ABSOLUTELY MAINTAIN STRICT ANONYMITY: Never reveal who said what, how many people in each role responded, or any breakdown by relationship type.`;
}

