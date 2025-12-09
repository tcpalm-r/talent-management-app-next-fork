/**
 * Adjust Item Specificity Prompt
 *
 * Used by: /api/ai/adjust-item-specificity
 * Purpose: Adjust specificity, tone, or length of 360 feedback report items
 */

export const adjustItemSpecificityConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 512,
  temperature: 0.2,
};

type SectionType = 'themes' | 'strengths' | 'development_areas' | 'key_insights';
type AdjustmentType = 'specificity' | 'tone' | 'length';
type Direction = 'more' | 'less' | 'harsher' | 'softer' | 'longer' | 'shorter';

interface ThemeItem {
  theme: string;
  supporting_evidence?: string[];
  relationships_mentioned?: string[];
  sentiment?: string;
  frequency?: number;
}

interface RawResponse {
  relationship?: string;
  answers?: Array<{ answer?: string; text?: string; response?: string }>;
  responses?: Array<{ answer?: string; text?: string; response?: string }>;
}

interface AdjustItemSpecificityPromptParams {
  item: ThemeItem | string;
  sectionType: SectionType;
  adjustmentType: AdjustmentType;
  direction: Direction;
  rawResponses?: RawResponse[];
}

function getDirectionInstruction(adjustmentType: AdjustmentType, direction: Direction): string {
  switch (adjustmentType) {
    case 'specificity':
      return direction === 'more'
        ? `Make the item MORE SPECIFIC by:
- Adding concrete examples, behaviors, or situations
- Being more precise about what the feedback is referring to
- Including specific skills, actions, or outcomes
- Making it more actionable and detailed
- Using specific terminology from the supporting evidence`
        : `Make the item LESS SPECIFIC by:
- Using broader, more general language
- Removing overly specific examples or details
- Making it more high-level and conceptual
- Focusing on the overarching pattern rather than individual instances
- Making it more universally applicable`;

    case 'tone':
      return direction === 'harsher'
        ? `Make the item HARSHER by:
- Using more direct and critical language
- Being more frank about weaknesses or issues
- Emphasizing areas that need urgent attention
- Using stronger, more impactful words
- Being less diplomatic and more straightforward
- Highlighting the severity or importance of the issue`
        : `Make the item SOFTER by:
- Using more gentle and constructive language
- Framing critiques more diplomatically
- Emphasizing potential and opportunity rather than criticism
- Using softer, more supportive words
- Being more encouraging and less harsh
- Focusing on growth rather than shortcomings`;

    case 'length':
      return direction === 'longer'
        ? `Make the item LONGER by:
- Adding more detail and context
- Expanding on key points with additional explanation
- Including more examples or supporting details
- Providing more comprehensive coverage
- Elaborating on the implications or impact
- Adding nuance and depth to the description`
        : `Make the item SHORTER by:
- Being more concise and removing unnecessary words
- Focusing only on the most essential points
- Eliminating redundant or repetitive information
- Using more compact phrasing
- Getting straight to the point
- Keeping only the core message`;

    default:
      throw new Error(`Invalid adjustment type: ${adjustmentType}`);
  }
}

export function buildAdjustItemSpecificityPrompt({
  item,
  sectionType,
  adjustmentType,
  direction,
  rawResponses,
}: AdjustItemSpecificityPromptParams): string {
  const directionInstruction = getDirectionInstruction(adjustmentType, direction);

  let itemText: string;
  let contextInfo = '';
  let sectionLabel: string;

  switch (sectionType) {
    case 'themes':
      const themeItem = item as ThemeItem;
      itemText =
        themeItem.supporting_evidence && themeItem.supporting_evidence.length > 0
          ? themeItem.supporting_evidence.join('\n')
          : '';
      sectionLabel = 'theme supporting evidence';
      contextInfo = `\n\nTHEME TITLE (keep this unchanged): "${themeItem.theme}"`;
      if (themeItem.relationships_mentioned && themeItem.relationships_mentioned.length > 0) {
        contextInfo += `\n\nMentioned by: ${themeItem.relationships_mentioned.join(', ')}`;
      }
      contextInfo += `\n\nSENTIMENT: ${themeItem.sentiment}\nFREQUENCY: Mentioned by ${themeItem.frequency} reviewer(s)`;
      break;

    case 'strengths':
      itemText = item as string;
      sectionLabel = 'strength';
      contextInfo = '\n\nThis is a key strength identified from 360 feedback.';
      break;

    case 'development_areas':
      itemText = item as string;
      sectionLabel = 'development area';
      contextInfo = '\n\nThis is a development area identified from 360 feedback.';
      break;

    case 'key_insights':
      itemText = item as string;
      sectionLabel = 'insight';
      contextInfo = '\n\nThis is a key insight synthesized from 360 feedback.';
      break;

    default:
      throw new Error(`Invalid section type: ${sectionType}`);
  }

  // Extract relevant response context from raw_responses
  let responseContext = '';
  if (rawResponses && rawResponses.length > 0) {
    const responseTexts: string[] = [];
    rawResponses.forEach((response) => {
      const relationship = response.relationship || 'Reviewer';
      const answers = response.answers || response.responses || [];

      answers.forEach((answer) => {
        const text = answer.answer || answer.text || answer.response || '';
        if (text && text.trim().length > 0) {
          responseTexts.push(`[${relationship}]: ${text.trim()}`);
        }
      });
    });

    if (responseTexts.length > 0) {
      responseContext = `\n\nORIGINAL SURVEY RESPONSES (you must use ONLY information from these):\n${responseTexts.slice(0, 15).join('\n\n')}`;
    }
  }

  const isThemeBullets = sectionType === 'themes';

  return `You are an expert HR analyst helping refine 360-degree feedback report items. You have ${isThemeBullets ? 'supporting evidence bullet points' : `a ${sectionLabel}`} from an AI-generated report that needs to be adjusted.${responseContext}

CURRENT ${sectionLabel.toUpperCase()}:
${isThemeBullets ? itemText : `"${itemText}"`}${contextInfo}

YOUR TASK:
${directionInstruction}

CRITICAL ANTI-HALLUCINATION RULES:
- DO NOT add information that is not present in the original survey responses above
- DO NOT invent examples, names, behaviors, or details
- DO NOT embellish or exaggerate beyond what the responses state
- ONLY rephrase, reorganize, or adjust the tone/length of EXISTING information
- If making something "more specific," use ONLY details from the actual responses
- If no survey responses are available, maintain the current text with minimal changes

IMPORTANT GUIDELINES:
1. Maintain the same sentiment and general meaning
2. ${isThemeBullets ? 'Keep each bullet point concise and clear' : `Keep the ${sectionLabel} concise (1-2 sentences typically)`}
3. Ground all content in the original survey responses provided above
4. Make sure it's appropriate for a professional 360 feedback report
5. The adjusted ${sectionLabel} should feel natural and well-written
6. For strengths, maintain a positive tone
7. For development areas, maintain a constructive tone
8. For insights, maintain an analytical tone
9. For themes, maintain consistency with the sentiment rating
${isThemeBullets ? '10. DO NOT change or mention the theme title - only adjust the bullet points' : ''}

Return ONLY the adjusted ${sectionLabel} text. ${isThemeBullets ? 'Return each bullet point on a new line without numbering or bullet symbols.' : 'Do not include any preamble, explanation, quotes, or additional formatting. Just the adjusted text itself.'}`;
}



