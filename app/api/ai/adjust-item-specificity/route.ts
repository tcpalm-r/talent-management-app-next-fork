import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

interface AdjustItemRequest {
  survey_id: string;
  item: any;
  section_type: 'themes' | 'strengths' | 'development_areas' | 'key_insights';
  adjustment_type: 'specificity' | 'tone' | 'length';
  direction: 'more' | 'less' | 'harsher' | 'softer' | 'longer' | 'shorter';
  raw_responses?: any[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('[adjust-item-specificity API] POST request received');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[adjust-item-specificity API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[adjust-item-specificity API] ANTHROPIC_API_KEY is not configured');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: AdjustItemRequest = await request.json();
    const { item, section_type, adjustment_type, direction, raw_responses } = body;

    console.log('[adjust-item-specificity API] Section type:', section_type);
    console.log('[adjust-item-specificity API] Adjustment type:', adjustment_type);
    console.log('[adjust-item-specificity API] Direction:', direction);
    console.log('[adjust-item-specificity API] Raw responses count:', raw_responses?.length || 0);

    if (!item) {
      console.log('[adjust-item-specificity API] Error: Missing item');
      return NextResponse.json(
        { error: 'Item is required' },
        { status: 400 }
      );
    }

    if (!adjustment_type || !['specificity', 'tone', 'length'].includes(adjustment_type)) {
      console.log('[adjust-item-specificity API] Error: Invalid adjustment type');
      return NextResponse.json(
        { error: 'Adjustment type must be "specificity", "tone", or "length"' },
        { status: 400 }
      );
    }

    const validDirections = ['more', 'less', 'harsher', 'softer', 'longer', 'shorter'];
    if (!direction || !validDirections.includes(direction)) {
      console.log('[adjust-item-specificity API] Error: Invalid direction');
      return NextResponse.json(
        { error: `Direction must be one of: ${validDirections.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[adjust-item-specificity API] Calling Claude API...');

    let directionInstruction: string;

    switch (adjustment_type) {
      case 'specificity':
        directionInstruction = direction === 'more'
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
        break;

      case 'tone':
        directionInstruction = direction === 'harsher'
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
        break;

      case 'length':
        directionInstruction = direction === 'longer'
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
        break;

      default:
        throw new Error(`Invalid adjustment type: ${adjustment_type}`);
    }

    let itemText: string;
    let contextInfo = '';
    let sectionLabel: string;

    switch (section_type) {
      case 'themes':
        // For themes, adjust the supporting evidence bullets, NOT the theme title
        itemText = item.supporting_evidence && item.supporting_evidence.length > 0
          ? item.supporting_evidence.join('\n')
          : '';
        sectionLabel = 'theme supporting evidence';
        contextInfo = `\n\nTHEME TITLE (keep this unchanged): "${item.theme}"`;
        if (item.relationships_mentioned && item.relationships_mentioned.length > 0) {
          contextInfo += `\n\nMentioned by: ${item.relationships_mentioned.join(', ')}`;
        }
        contextInfo += `\n\nSENTIMENT: ${item.sentiment}\nFREQUENCY: Mentioned by ${item.frequency} reviewer(s)`;
        break;

      case 'strengths':
        itemText = item;
        sectionLabel = 'strength';
        contextInfo = '\n\nThis is a key strength identified from 360 feedback.';
        break;

      case 'development_areas':
        itemText = item;
        sectionLabel = 'development area';
        contextInfo = '\n\nThis is a development area identified from 360 feedback.';
        break;

      case 'key_insights':
        itemText = item;
        sectionLabel = 'insight';
        contextInfo = '\n\nThis is a key insight synthesized from 360 feedback.';
        break;

      default:
        throw new Error(`Invalid section type: ${section_type}`);
    }

    // Extract relevant response context from raw_responses
    let responseContext = '';
    if (raw_responses && raw_responses.length > 0) {
      console.log('[adjust-item-specificity API] Processing', raw_responses.length, 'raw responses');

      // Collect all response text with relationship context
      const responseTexts: string[] = [];
      raw_responses.forEach((response: any, idx: number) => {
        const relationship = response.relationship || 'Reviewer';
        const answers = response.answers || response.responses || [];

        answers.forEach((answer: any) => {
          const text = answer.answer || answer.text || answer.response || '';
          if (text && text.trim().length > 0) {
            responseTexts.push(`[${relationship}]: ${text.trim()}`);
          }
        });
      });

      if (responseTexts.length > 0) {
        responseContext = `\n\nORIGINAL SURVEY RESPONSES (you must use ONLY information from these):\n${responseTexts.slice(0, 15).join('\n\n')}`; // Limit to 15 responses to avoid token limits
        console.log('[adjust-item-specificity API] Added', responseTexts.length, 'response excerpts to context');
      }
    }

    const isThemeBullets = section_type === 'themes';

    const prompt = `You are an expert HR analyst helping refine 360-degree feedback report items. You have ${isThemeBullets ? 'supporting evidence bullet points' : `a ${sectionLabel}`} from an AI-generated report that needs to be adjusted.${responseContext}

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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      temperature: 0.2, // Lower temperature for more deterministic, less creative outputs
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('[adjust-item-specificity API] Claude response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('[adjust-item-specificity API] Unexpected response type:', content.type);
      throw new Error('Unexpected response type from Claude');
    }

    const adjustedText = content.text.trim();
    console.log('[adjust-item-specificity API] Adjusted text:', adjustedText);

    // Return the adjusted item - for themes, update supporting_evidence; for others, just the text
    let adjustedItem: any;
    if (section_type === 'themes') {
      // Parse the adjusted text back into bullet points (split by newlines and filter empty lines)
      const adjustedBullets = adjustedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      adjustedItem = {
        ...item,
        supporting_evidence: adjustedBullets,
      };
    } else {
      adjustedItem = adjustedText;
    }

    return NextResponse.json({
      success: true,
      adjusted_item: adjustedItem,
    });
  } catch (error) {
    console.error('[adjust-item-specificity API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust item specificity' },
      { status: 500 }
    );
  }
}
