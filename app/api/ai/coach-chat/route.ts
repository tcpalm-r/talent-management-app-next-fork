import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

interface CoachChatRequest {
  question: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[coach-chat API] POST request received');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[coach-chat API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[coach-chat API] ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: CoachChatRequest = await request.json();
    const { question, conversationHistory } = body;

    console.log('[coach-chat API] Question:', question);
    console.log('[coach-chat API] Conversation history length:', conversationHistory?.length || 0);

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are the AI assistant inside the Sonance Talent Management platform. You help users manage talent, conduct performance reviews, create development plans, and optimize their HR workflows.

Key features to reference:
- Evaluate tab: Assess employees on the 9-box grid (performance vs potential)
- Prepare tab: Draft and import performance reviews
- Calibrate tab: Align ratings across teams
- Follow Through tab: Track development plans and action items
- People tab: View all employees and their details
- Command Center: Executive dashboard with key metrics

Be conversational, helpful, and remember the context of the conversation. Answer succinctly (150 words or fewer) with actionable guidance.`;

    // Build messages array from conversation history
    const messages = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add current question
    messages.push({
      role: 'user',
      content: question.trim(),
    });

    console.log('[coach-chat API] Calling Claude API...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 600,
      temperature: 0.5,
      system: systemPrompt,
      messages: messages as any,
    });

    console.log('[coach-chat API] Claude API response received');

    const content = response.content[0];
    if (content.type === 'text') {
      const answer = content.text.trim();
      return NextResponse.json({ answer });
    }

    throw new Error('Unexpected response format from Claude');
  } catch (error: any) {
    console.error('[coach-chat API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}

