/**
 * Survey Response Generation API v2 - Using Anthropic Skills
 *
 * This version uses the custom Survey Response Generator skill for
 * consistent, anti-hallucination response generation.
 *
 * Requires:
 * - ANTHROPIC_API_KEY environment variable
 * - SURVEY_SKILL_ID environment variable (from skill upload)
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

/**
 * Extract just the feedback response from Claude's full output.
 * The skill returns reasoning + response, we only want the response.
 */
function extractFeedbackResponse(fullText: string): string {
  // Try to find the response after common markers
  const markers = [
    /## Generated Feedback Response:\s*\n+([\s\S]*?)(?:\n---|\n\*\*|$)/i,
    /## Response:\s*\n+([\s\S]*?)(?:\n---|\n\*\*|$)/i,
    /final response:\s*\n+([\s\S]*?)(?:\n---|\n\*\*|$)/i,
    /output the final response:\s*\n+([\s\S]*?)(?:\n---|\n\*\*|$)/i,
    /here(?:'s| is) the (?:generated |final )?(?:feedback )?response:\s*\n+([\s\S]*?)(?:\n---|\n\*\*|$)/i,
  ];

  for (const marker of markers) {
    const match = fullText.match(marker);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Make sure we got something substantial
      if (extracted.length > 20) {
        console.log('[extractFeedbackResponse] Found response via marker');
        return extracted;
      }
    }
  }

  // If the response is short and doesn't have markers, it might be direct
  // Check if it's under 500 chars and looks like a direct response (no reasoning)
  if (fullText.length < 500 && !fullText.includes('Let me') && !fullText.includes('I\'ll')) {
    console.log('[extractFeedbackResponse] Response appears to be direct output');
    return fullText;
  }

  // Last resort: look for the last paragraph that looks like feedback
  const paragraphs = fullText.split(/\n\n+/);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const p = paragraphs[i].trim();
    // Skip metadata lines
    if (p.startsWith('**') || p.startsWith('---') || p.startsWith('- ')) continue;
    // Skip reasoning
    if (p.includes('Let me') || p.includes('I\'ll') || p.includes('I will')) continue;
    // Found a good candidate
    if (p.length > 50 && p.length < 800) {
      console.log('[extractFeedbackResponse] Using last substantial paragraph');
      return p;
    }
  }

  // Fallback: return everything (will be cleaned up by word count validation)
  console.log('[extractFeedbackResponse] Could not extract, returning full text');
  return fullText;
}

interface GenerateRequest {
  questionText: string;
  userThoughts: string;
  subjectName: string;
  originalInput?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[generate-survey-response-v2] POST request received');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const skillId = process.env.SURVEY_SKILL_ID;

    if (!apiKey) {
      console.error('[generate-survey-response-v2] ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    if (!skillId) {
      console.error('[generate-survey-response-v2] SURVEY_SKILL_ID is not set');
      return NextResponse.json(
        {
          error:
            'SURVEY_SKILL_ID is not configured. Run: npx ts-node scripts/upload-survey-skill.ts',
        },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const body: GenerateRequest = await request.json();
    const { questionText, userThoughts, subjectName, originalInput } = body;

    console.log('[generate-survey-response-v2] Question:', questionText);
    console.log('[generate-survey-response-v2] User thoughts length:', userThoughts?.length);
    console.log('[generate-survey-response-v2] Subject:', subjectName);
    console.log('[generate-survey-response-v2] Skill ID:', skillId);

    // Validation
    if (!questionText?.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    if (!userThoughts?.trim()) {
      return NextResponse.json({ error: 'User thoughts are required' }, { status: 400 });
    }

    // Word count validation (30 word minimum)
    const wordCount = userThoughts
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    if (wordCount < 30) {
      return NextResponse.json(
        {
          error: `Not enough detail provided. Please provide at least 30 words (you have ${wordCount}). The AI needs sufficient context to create a meaningful response without adding information.`,
        },
        { status: 400 }
      );
    }

    const isRegeneration = originalInput && originalInput !== userThoughts;

    // Prepare skill input as JSON
    const skillInput = JSON.stringify({
      questionText,
      userThoughts,
      subjectName,
      originalInput: originalInput || null,
      isRegeneration,
    });

    console.log('[generate-survey-response-v2] Calling Claude with skill...');

    // Call Claude with the custom skill
    const response = await client.beta.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      betas: ['code-execution-2025-08-25', 'skills-2025-10-02'],
      container: {
        skills: [
          {
            type: 'custom',
            skill_id: skillId,
            version: 'latest',
          },
        ],
      },
      messages: [
        {
          role: 'user',
          content: `Generate a 360 feedback response using the Survey Response Generator skill.

Input:
${skillInput}

Generate the response now.`,
        },
      ],
      tools: [
        {
          type: 'code_execution_20250825',
          name: 'code_execution',
        },
      ],
    });

    console.log('[generate-survey-response-v2] Response received');

    // Extract the text response
    let fullResponse = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        fullResponse += block.text;
      }
    }

    fullResponse = fullResponse.trim();
    console.log('[generate-survey-response-v2] Full response length:', fullResponse.length);

    // Parse out just the actual feedback response from Claude's reasoning
    let generatedResponse = extractFeedbackResponse(fullResponse);

    // Check for vague content marker
    if (generatedResponse.includes('[CONTENT_TOO_VAGUE]')) {
      return NextResponse.json(
        {
          error:
            'The provided thoughts are too vague to generate meaningful feedback. Please add more specific details or examples.',
        },
        { status: 400 }
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`[generate-survey-response-v2] Generated in ${elapsed}ms`);
    console.log('[generate-survey-response-v2] Response length:', generatedResponse.length);

    return NextResponse.json({
      success: true,
      response: generatedResponse,
      meta: {
        version: 'v2-skill',
        skillId,
        elapsedMs: elapsed,
      },
    });
  } catch (error) {
    console.error('[generate-survey-response-v2] Error:', error);

    // Check for specific API errors
    if (error instanceof Error) {
      // Handle skill not found
      if (error.message.includes('skill') && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Survey skill not found. Please run: npx ts-node scripts/upload-survey-skill.ts',
          },
          { status: 500 }
        );
      }

      // Handle beta feature errors
      if (error.message.includes('beta') || error.message.includes('not available')) {
        return NextResponse.json(
          {
            error: 'Skills API beta feature not available. Falling back to v1 may be needed.',
            fallbackUrl: '/api/ai/generate-survey-response',
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate survey response' },
      { status: 500 }
    );
  }
}
