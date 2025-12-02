import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

interface Question {
  id: string;
  text: string;
}

interface ParseRequest {
  feedbackText: string;
  questions: Question[];
}

interface ParsedResponse {
  [questionId: string]: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[parse-survey-responses API] POST request received');

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('[parse-survey-responses API] API Key present:', !!apiKey);

    if (!apiKey) {
      console.error('[parse-survey-responses API] ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Please add it to your environment.' },
        { status: 500 }
      );
    }

    // Initialize Anthropic client with explicit API key
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const body: ParseRequest = await request.json();
    const { feedbackText, questions } = body;

    console.log('[parse-survey-responses API] Feedback length:', feedbackText?.length);
    console.log('[parse-survey-responses API] Question count:', questions?.length);

    if (!feedbackText || feedbackText.trim().length === 0) {
      console.log('[parse-survey-responses API] Error: Empty feedback');
      return NextResponse.json(
        { error: 'Feedback text is required' },
        { status: 400 }
      );
    }

    if (!questions || questions.length === 0) {
      console.log('[parse-survey-responses API] Error: No questions provided');
      return NextResponse.json(
        { error: 'Questions are required' },
        { status: 400 }
      );
    }

    console.log('[parse-survey-responses API] Calling Claude API...');

    const questionsText = questions
      .map((q, i) => `${i + 1}. (ID: ${q.id}) ${q.text}`)
      .join('\n');

    const prompt = `You are an expert HR analyst specializing in 360-degree feedback analysis. Your task is to intelligently parse free-form feedback comments and map them to specific survey questions.

USER'S FREE-FORM FEEDBACK:
"${feedbackText}"

SURVEY QUESTIONS TO ANSWER:
${questionsText}

INSTRUCTIONS:
1. Read the free-form feedback carefully
2. Identify comments, observations, and feedback related to each question
3. For each question ID, extract or synthesize a concise, well-formed response based on the relevant feedback
4. If the feedback doesn't contain information relevant to a question, use an empty string
5. Keep responses professional and constructive
6. Preserve the original sentiment (positive, constructive, etc.)
7. Combine related comments into cohesive responses

RETURN ONLY VALID JSON in this exact format (no other text):
{
  "questionId1": "synthesized response for question 1",
  "questionId2": "synthesized response for question 2",
  "questionId3": ""
}

Make sure to include ALL question IDs, even if the response is empty.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    console.log('[parse-survey-responses API] Claude response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('[parse-survey-responses API] Unexpected response type:', content.type);
      throw new Error('Unexpected response type from Claude');
    }

    console.log('[parse-survey-responses API] Claude response text length:', content.text.length);

    // Parse the JSON response
    let parsedResponses: ParsedResponse;
    try {
      parsedResponses = JSON.parse(content.text);
      console.log('[parse-survey-responses API] JSON parsed successfully');
    } catch (e) {
      console.log('[parse-survey-responses API] Initial JSON parse failed, trying to extract from text');
      // Try to extract JSON from text if parsing fails
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[parse-survey-responses API] Could not extract JSON from Claude response');
        throw new Error('Could not parse Claude response as JSON');
      }
      parsedResponses = JSON.parse(jsonMatch[0]);
      console.log('[parse-survey-responses API] JSON extracted and parsed from text');
    }

    // Ensure all question IDs are present
    const result: ParsedResponse = {};
    for (const question of questions) {
      result[question.id] = parsedResponses[question.id] || '';
    }

    console.log('[parse-survey-responses API] Returning parsed responses');
    console.log('[parse-survey-responses API] Result:', result);

    return NextResponse.json({
      success: true,
      parsedResponses: result,
    });
  } catch (error) {
    console.error('[parse-survey-responses API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse survey responses' },
      { status: 500 }
    );
  }
}
