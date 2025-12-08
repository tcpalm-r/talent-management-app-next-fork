import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { generateNarrativeConfig, buildGenerateNarrativePrompt } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

interface NarrativeRequest {
  surveyId: string;
  subjectName: string;
  rawResponses: Array<{
    question: string;
    responses: string[];
  }>;
  reportData: {
    executive_summary?: string;
    themes?: Array<{ theme: string; description: string }>;
    strengths?: string[];
    development_areas?: string[];
    key_insights?: string[];
    recommendations?: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('[generate-narrative API] POST request received');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[generate-narrative API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[generate-narrative API] ANTHROPIC_API_KEY is not configured');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: NarrativeRequest = await request.json();
    const { subjectName, rawResponses, reportData } = body;

    console.log('[generate-narrative API] Subject:', subjectName);
    console.log('[generate-narrative API] Raw responses count:', rawResponses?.length);

    if (!subjectName || !rawResponses || !reportData) {
      return NextResponse.json(
        { error: 'Missing required fields: subjectName, rawResponses, or reportData' },
        { status: 400 }
      );
    }

    console.log('[generate-narrative API] Calling Claude API...');

    const prompt = buildGenerateNarrativePrompt({ subjectName, rawResponses, reportData });

    const response = await anthropic.messages.create({
      model: generateNarrativeConfig.model,
      max_tokens: generateNarrativeConfig.maxTokens,
      temperature: generateNarrativeConfig.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('[generate-narrative API] Claude response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('[generate-narrative API] Unexpected response type:', content.type);
      throw new Error('Unexpected response type from Claude');
    }

    // Clean up the narrative text
    let narrative = content.text.trim();

    // Remove any markdown headers or formatting that Claude might have added
    narrative = narrative
      .replace(/^\*\*360-Degree Feedback Report:?\s*Executive Summary\*\*\s*/i, '')
      .replace(/^\*\*Executive Summary\*\*\s*/i, '')
      .replace(/^#+ .*\n/gm, '') // Remove any markdown headers
      .trim();

    console.log('[generate-narrative API] Narrative generated, length:', narrative.length);

    return NextResponse.json({
      success: true,
      narrative: narrative,
    });
  } catch (error) {
    console.error('[generate-narrative API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate narrative' },
      { status: 500 }
    );
  }
}
