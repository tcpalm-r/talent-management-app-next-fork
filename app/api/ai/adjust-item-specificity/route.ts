import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adjustItemSpecificityConfig, buildAdjustItemSpecificityPrompt } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

interface AdjustItemRequest {
  survey_id: string;
  item: any;
  section_type: 'themes' | 'strengths' | 'development_areas' | 'key_insights';
  adjustment_type: 'specificity' | 'tone' | 'length';
  direction: 'more' | 'less' | 'harsher' | 'softer' | 'longer' | 'shorter';
  raw_responses?: any[];
  /** Citation snippets directly related to this item - provides exact grounding context */
  item_citations?: Array<{ response_id: string; snippet: string }>;
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
    const { item, section_type, adjustment_type, direction, raw_responses, item_citations } = body;

    console.log('[adjust-item-specificity API] Section type:', section_type);
    console.log('[adjust-item-specificity API] Adjustment type:', adjustment_type);
    console.log('[adjust-item-specificity API] Direction:', direction);
    console.log('[adjust-item-specificity API] Raw responses count:', raw_responses?.length || 0);
    console.log('[adjust-item-specificity API] Item citations count:', item_citations?.length || 0);

    if (!item) {
      console.log('[adjust-item-specificity API] Error: Missing item');
      return NextResponse.json({ error: 'Item is required' }, { status: 400 });
    }

    if (!adjustment_type || !['specificity', 'tone', 'length'].includes(adjustment_type)) {
      console.log('[adjust-item-specificity API] Error: Invalid adjustment type');
      return NextResponse.json({ error: 'Adjustment type must be "specificity", "tone", or "length"' }, { status: 400 });
    }

    const validDirections = ['more', 'less', 'harsher', 'softer', 'longer', 'shorter'];
    if (!direction || !validDirections.includes(direction)) {
      console.log('[adjust-item-specificity API] Error: Invalid direction');
      return NextResponse.json({ error: `Direction must be one of: ${validDirections.join(', ')}` }, { status: 400 });
    }

    console.log('[adjust-item-specificity API] Calling Claude API...');

    const prompt = buildAdjustItemSpecificityPrompt({
      item,
      sectionType: section_type,
      adjustmentType: adjustment_type,
      direction,
      rawResponses: raw_responses,
      itemCitations: item_citations,
    });

    const response = await anthropic.messages.create({
      model: adjustItemSpecificityConfig.model,
      max_tokens: adjustItemSpecificityConfig.maxTokens,
      temperature: adjustItemSpecificityConfig.temperature,
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
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

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
