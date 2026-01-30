import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { jsonrepair } from 'jsonrepair';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  harshFeedbackConfig,
  buildHarshFeedbackPrompt,
  type HarshFeedbackResponse,
  type HarshFeedbackResult,
} from '@/lib/prompts/identify-harsh-feedback';

export const dynamic = 'force-dynamic';

interface HarshFeedbackRequest {
  surveyId: string;
  employeeName: string;
  responses: HarshFeedbackResponse[];
}

/**
 * Extract JSON object from response with error recovery using jsonrepair
 */
function extractJsonFromResponse(text: string): HarshFeedbackResult {
  let jsonText = text.trim();

  // Try to find JSON in code blocks first
  const jsonBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
  } else {
    // Try to find raw JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  // First attempt: parse as-is
  try {
    return JSON.parse(jsonText);
  } catch (firstError) {
    console.log('[identify-harsh-feedback] First parse attempt failed, using jsonrepair...');

    // Log context around the error position if available
    const errorMatch = String(firstError).match(/position (\d+)/);
    if (errorMatch) {
      const pos = parseInt(errorMatch[1], 10);
      console.log('[identify-harsh-feedback] Error context:', jsonText.substring(Math.max(0, pos - 50), pos + 50));
    }

    // Use jsonrepair library to fix malformed JSON
    try {
      const repaired = jsonrepair(jsonText);
      console.log('[identify-harsh-feedback] jsonrepair succeeded');
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error('[identify-harsh-feedback] jsonrepair failed:', repairError);
      console.error('[identify-harsh-feedback] Raw response (first 500 chars):', jsonText.substring(0, 500));
      throw firstError;
    }
  }
}

/**
 * GET /api/ai/identify-harsh-feedback?surveyId=xxx
 * Fetch cached harsh feedback analysis for a survey (if exists)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check - admin only
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authData.user.app_role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const surveyId = request.nextUrl.searchParams.get('surveyId');
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Missing required parameter: surveyId' },
        { status: 400 }
      );
    }

    // Check for cached result in database
    const { data: cached, error } = await supabaseAdmin
      .from('feedback_360_harsh_feedback')
      .select('result, analyzed_at')
      .eq('survey_id', surveyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('[identify-harsh-feedback] Database error:', error);
      throw error;
    }

    if (cached) {
      return NextResponse.json({
        success: true,
        result: cached.result,
        cached: true,
        analyzedAt: cached.analyzed_at,
      });
    }

    // No cached result
    return NextResponse.json({
      success: true,
      result: null,
      cached: false,
    });
  } catch (error) {
    console.error('[identify-harsh-feedback GET] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch cached analysis',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/identify-harsh-feedback
 * Analyze survey responses for harsh feedback, with database caching
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - admin only
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authData.user.app_role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body: HarshFeedbackRequest = await request.json();
    const { surveyId, employeeName, responses } = body;

    if (!surveyId || !employeeName || !responses || responses.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: surveyId, employeeName, responses' },
        { status: 400 }
      );
    }

    // Check for cached result in database first
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from('feedback_360_harsh_feedback')
      .select('result, analyzed_at')
      .eq('survey_id', surveyId)
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error('[identify-harsh-feedback] Cache lookup error:', cacheError);
      // Continue with analysis if cache lookup fails
    }

    if (cached) {
      console.log(`[identify-harsh-feedback] Returning cached result for survey ${surveyId}`);
      return NextResponse.json({
        success: true,
        result: cached.result,
        cached: true,
        analyzedAt: cached.analyzed_at,
      });
    }

    // No cached result - run analysis
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Filter to only text responses with content
    const textResponses = responses.filter(
      (r) => r.response_text && r.response_text.trim().length > 0
    );

    if (textResponses.length === 0) {
      const emptyResult: HarshFeedbackResult = {
        summary: {
          total_responses_analyzed: 0,
          responses_with_harsh_content: 0,
          severity_breakdown: { mild: 0, moderate: 0, harsh: 0 },
        },
        findings: [],
      };

      // Cache empty result too
      await supabaseAdmin
        .from('feedback_360_harsh_feedback')
        .upsert({
          survey_id: surveyId,
          result: emptyResult,
          analyzed_by: authData.dbUserId || null,
        });

      return NextResponse.json({
        success: true,
        result: emptyResult,
        cached: false,
      });
    }

    const anthropic = new Anthropic({ apiKey });
    const prompt = buildHarshFeedbackPrompt({
      employeeName,
      responses: textResponses,
    });

    console.log(
      `[identify-harsh-feedback] Analyzing ${textResponses.length} responses for ${employeeName}`
    );

    const response = await anthropic.messages.create({
      model: harshFeedbackConfig.model,
      max_tokens: harshFeedbackConfig.maxTokens,
      temperature: harshFeedbackConfig.temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response with robust error recovery
    const result = extractJsonFromResponse(content.text);

    console.log(
      `[identify-harsh-feedback] Found ${result.findings?.length || 0} harsh feedback items`
    );

    // Cache result in database
    const { error: insertError } = await supabaseAdmin
      .from('feedback_360_harsh_feedback')
      .upsert({
        survey_id: surveyId,
        result: result,
        analyzed_by: authData.dbUserId || null,
      });

    if (insertError) {
      console.error('[identify-harsh-feedback] Failed to cache result:', insertError);
      // Don't fail the request if caching fails - just log it
    } else {
      console.log(`[identify-harsh-feedback] Cached result for survey ${surveyId}`);
    }

    return NextResponse.json({
      success: true,
      result,
      cached: false,
    });
  } catch (error) {
    console.error('[identify-harsh-feedback API] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to analyze feedback',
      },
      { status: 500 }
    );
  }
}
