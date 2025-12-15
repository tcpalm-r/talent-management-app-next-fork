/**
 * Adjust Item Specificity Prompt
 *
 * Used by: /api/ai/adjust-item-specificity
 * Purpose: Make SUBTLE adjustments to 360 feedback report items
 *
 * PHILOSOPHY:
 * This is a CONSTRAINED PARAPHRASING tool, NOT a content generation tool.
 * The reviewer's voice and observations are SACRED. The sponsor can only
 * adjust the PRESENTATION, never the SUBSTANCE.
 *
 * HARD RULES:
 * 1. Output format MUST match input format (1 sentence → 1 sentence, 3 bullets → 3 bullets)
 * 2. Never invent new observations - only rephrase what exists
 * 3. Never change the underlying sentiment - positive stays positive, critical stays critical
 * 4. If the adjustment is impossible without inventing content, return the original UNCHANGED
 * 5. When in doubt, return the original text - it's better to make no change than a wrong change
 */

export const adjustItemSpecificityConfig = {
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 256, // Reduced - output should never be longer than input
  temperature: 0.0, // Zero temperature for maximum consistency
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
        ? `HOW: Add a specific detail from the source data (if available). If no source data, return input unchanged.
Example: "Good at communication" → "Good at communicating project updates"`
        : `HOW: Remove specific details, use broader terms.
Example: "Excels at converting unclear directives into actionable technical plans" → "Effectively translates goals into plans"`;

    case 'tone':
      return direction === 'harsher'
        ? `HOW: Swap soft words for direct ones. Same observation, stronger language.
Word swaps: "could improve"→"needs to improve", "sometimes"→"often", "has room to grow"→"requires development"`
        : `HOW: Swap direct words for gentler ones. Same observation, softer language.
Word swaps: "struggles with"→"is developing", "fails to"→"could strengthen", "weak"→"emerging"`;

    case 'length':
      return direction === 'longer'
        ? `HOW: Add a few clarifying words. Do NOT add new information.
Example: "Great at delegating" → "Demonstrates ability to delegate tasks effectively"`
        : `HOW: Remove filler words, keep core meaning.
Example: "Consistently demonstrates strong ability to communicate" → "Communicates effectively"`;

    default:
      throw new Error(`Invalid adjustment type: ${adjustmentType}`);
  }
}

// Helper to extract text from an item that might be string or CitedStatement
function extractText(item: any): string {
  if (typeof item === 'string') return item;
  if (item?.text) return item.text;
  return '';
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
  let sentimentContext = '';

  switch (sectionType) {
    case 'themes':
      const themeItem = item as ThemeItem;
      // Handle both string[] and CitedStatement[] (objects with text property)
      itemText =
        themeItem.supporting_evidence && themeItem.supporting_evidence.length > 0
          ? themeItem.supporting_evidence.map((ev: any) => extractText(ev)).filter(t => t).join('\n')
          : '';
      sentimentContext = themeItem.sentiment === 'positive' ? 'POSITIVE' :
                         themeItem.sentiment === 'negative' ? 'CONSTRUCTIVE' : 'NEUTRAL';
      break;

    case 'strengths':
      itemText = extractText(item);
      sentimentContext = 'POSITIVE';
      break;

    case 'development_areas':
      itemText = extractText(item);
      sentimentContext = 'CONSTRUCTIVE';
      break;

    case 'key_insights':
      itemText = extractText(item);
      sentimentContext = 'NEUTRAL';
      break;

    default:
      throw new Error(`Invalid section type: ${sectionType}`);
  }

  // Count lines to enforce format
  const inputLines = itemText.split('\n').filter(l => l.trim()).length;
  const isSingleLine = inputLines === 1;

  // Only include raw responses for "more specific" direction
  let responseHint = '';
  if (direction === 'more' && rawResponses && rawResponses.length > 0) {
    const responseTexts: string[] = [];
    rawResponses.slice(0, 5).forEach((response) => {
      const answers = response.answers || response.responses || [];
      answers.slice(0, 2).forEach((answer) => {
        const text = answer.answer || answer.text || answer.response || '';
        if (text && text.trim().length > 20) {
          responseTexts.push(text.trim().substring(0, 200));
        }
      });
    });
    if (responseTexts.length > 0) {
      responseHint = `\n\nSource data (ONLY use to add specificity, do not invent):\n${responseTexts.slice(0, 3).join('\n')}`;
    }
  }

  // Create a very explicit format instruction
  const formatInstruction = isSingleLine
    ? 'CRITICAL: Your response must be EXACTLY ONE SENTENCE. No line breaks. No multiple sentences. ONE sentence only.'
    : `CRITICAL: Your response must be EXACTLY ${inputLines} separate lines, one item per line.`;

  return `Rephrase this feedback slightly. ${direction === 'more' ? 'Add specificity.' : direction === 'less' ? 'Use broader language.' : direction === 'harsher' ? 'Use more direct wording.' : direction === 'softer' ? 'Use gentler wording.' : direction === 'longer' ? 'Add clarifying words.' : 'Remove unnecessary words.'}

INPUT:
${itemText}
${responseHint}

${formatInstruction}

CONSTRAINTS:
- Same meaning, different wording
- ${sentimentContext} tone preserved
- No explanations, no formatting, no bullets
- If you can't do it without changing meaning, return the input exactly

${directionInstruction}

OUTPUT:`;
}
