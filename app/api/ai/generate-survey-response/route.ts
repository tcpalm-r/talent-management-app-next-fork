import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { surveyResponseConfig, buildSurveyResponsePrompt } from '@/lib/prompts';

export const dynamic = 'force-dynamic';

interface GenerateRequest {
  questionText: string;
  userThoughts: string;
  subjectName: string;
  originalInput?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[generate-survey-response API] POST request received');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[generate-survey-response API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[generate-survey-response API] ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: GenerateRequest = await request.json();
    const { questionText, userThoughts, subjectName, originalInput } = body;

    console.log('[generate-survey-response API] Question:', questionText);
    console.log('[generate-survey-response API] User thoughts length:', userThoughts?.length);
    console.log('[generate-survey-response API] Subject name:', subjectName);
    console.log('[generate-survey-response API] Has original input:', !!originalInput);

    if (!questionText || questionText.trim().length === 0) {
      console.log('[generate-survey-response API] Error: Empty question');
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    if (!userThoughts || userThoughts.trim().length === 0) {
      console.log('[generate-survey-response API] Error: Empty user thoughts');
      return NextResponse.json({ error: 'User thoughts are required' }, { status: 400 });
    }

    // Validate word count (minimum 30 words to avoid AI embellishment)
    const wordCount = userThoughts
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    if (wordCount < 30) {
      console.log('[generate-survey-response API] Error: Not enough words', wordCount);
      return NextResponse.json(
        {
          error: `Not enough detail provided. Please provide at least 30 words (you have ${wordCount}). The AI needs sufficient context to create a meaningful response without adding information.`,
        },
        { status: 400 }
      );
    }

    console.log('[generate-survey-response API] Calling Claude API...');

    const prompt = buildSurveyResponsePrompt({
      questionText,
      userThoughts,
      subjectName,
      originalInput,
    });

    const response = await anthropic.messages.create({
      model: surveyResponseConfig.model,
      max_tokens: surveyResponseConfig.maxTokens,
      temperature: surveyResponseConfig.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('[generate-survey-response API] Claude response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('[generate-survey-response API] Unexpected response type:', content.type);
      throw new Error('Unexpected response type from Claude');
    }

    const generatedResponse = content.text.trim();
    console.log('[generate-survey-response API] Generated response length:', generatedResponse.length);

    return NextResponse.json({
      success: true,
      response: generatedResponse,
    });
  } catch (error) {
    console.error('[generate-survey-response API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate survey response' },
      { status: 500 }
    );
  }
}
