import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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
      return NextResponse.json(
        { error: 'Question text is required' },
        { status: 400 }
      );
    }

    if (!userThoughts || userThoughts.trim().length === 0) {
      console.log('[generate-survey-response API] Error: Empty user thoughts');
      return NextResponse.json(
        { error: 'User thoughts are required' },
        { status: 400 }
      );
    }

    // Validate word count (minimum 30 words to avoid AI embellishment)
    const wordCount = userThoughts.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 30) {
      console.log('[generate-survey-response API] Error: Not enough words', wordCount);
      return NextResponse.json(
        { error: `Not enough detail provided. Please provide at least 30 words (you have ${wordCount}). The AI needs sufficient context to create a meaningful response without adding information.` },
        { status: 400 }
      );
    }

    console.log('[generate-survey-response API] Calling Claude API...');

    // Build prompt with clear structure and explicit sections
    const isRegeneration = originalInput && originalInput !== userThoughts;

    // Shared sections (to reduce redundancy and token usage)
    const sharedInstructions = `--- INSTRUCTIONS ---
1. Read the user's raw thoughts carefully - they may be bullet points, keywords, informal notes, or casual observations
2. Transform these thoughts into a clear, constructive feedback response about ${subjectName}
3. Use ${subjectName}'s name naturally in the response (not "this employee" or "they" - use the actual name)
4. Keep the original sentiment and meaning intact (positive, constructive criticism, etc.)
5. CRITICAL: Do NOT add information, examples, or details that weren't in the user's thoughts. Only clarify, structure, and professionalize what they provided.
6. CRITICAL: Do NOT embellish or make assumptions. If the user provided specific examples, use them. If not, don't invent any.
7. Use specific examples or observations the user mentioned (but don't add new ones)
8. Keep a professional but warm tone appropriate for 360 feedback
9. If the thoughts are already well-formed, you can make minor improvements but don't over-edit

--- WHAT NOT TO DO (EXAMPLE) ---
USER INPUT: "good communicator"
❌ WRONG: "Elliott excels at communication, regularly presenting to stakeholders and crafting detailed reports..."
✅ RIGHT: "Elliott is a strong communicator who supports the team effectively."

--- PRE-RESPONSE VALIDATION ---
Before responding, verify:
- No invented examples or details
- Original sentiment preserved
- Employee name used (not pronouns)
- Word count between 50-100
- Professional but warm tone
- All details trace back to user input

--- FINAL CONSTRAINT ---
Response MUST be 50-100 words. If you cannot express the feedback meaningfully within this range, stop and output: [CONTENT_TOO_VAGUE]

--- OUTPUT FORMAT ---
Return ONLY the generated response text. Do not include any preamble, explanation, quotes, or additional formatting. Just the feedback response itself.`;

    // Build input section based on mode
    let inputSection = '';

    if (isRegeneration) {
      // Regeneration mode: prioritize original input
      inputSection = `--- USER INPUT (REGENERATION MODE) ---

ORIGINAL THOUGHTS (PRIMARY SOURCE - foundation of response):
"${originalInput}"

REFINEMENTS/ADDITIONS (incorporate selectively):
"${userThoughts}"

--- REGENERATION PRIORITY ---
If ORIGINAL THOUGHTS and REFINEMENTS are identical, treat as first-generation scenario and regenerate with fresh perspective (same word count, no forced changes).

If original and refinements conflict, prioritize original.
If refinements add new information, weave in only if they enhance without changing core meaning.

MODE: Regenerating response. Keep the original response's core but weave in refinements naturally without changing the original meaning or overemphasizing new details.`;
    } else {
      // First generation mode
      inputSection = `--- USER INPUT (FIRST GENERATION) ---

USER THOUGHTS:
"${userThoughts}"

MODE: Generating initial response from user's raw thoughts.`;
    }

    const prompt = `--- ROLE ---
You are an expert HR consultant helping someone provide thoughtful 360-degree feedback about ${subjectName}.

--- CONTEXT ---
Your task is to take raw thoughts, ideas, or notes and transform them into a well-structured, professional response to a 360-degree feedback question. This feedback will be aggregated with other responses to provide developmental insights.

--- EMPLOYEE BEING REVIEWED ---
${subjectName}

--- FEEDBACK QUESTION ---
"${questionText}"

${inputSection}

${sharedInstructions}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      temperature: 0.3,
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
