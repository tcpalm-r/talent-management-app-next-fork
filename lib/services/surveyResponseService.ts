/**
 * Survey Response Generation Service
 *
 * Handles API calls with automatic fallback from v2 (skill-based) to v1 (prompt-based).
 * Provides notification callbacks for monitoring fallback events.
 */

export interface GenerateResponseRequest {
  questionText: string;
  userThoughts: string;
  subjectName: string;
  originalInput?: string;
}

export interface GenerateResponseResult {
  success: boolean;
  response?: string;
  error?: string;
  meta?: {
    version: 'v1-prompt' | 'v2-skill';
    skillId?: string;
    elapsedMs?: number;
    fallbackUsed?: boolean;
    fallbackReason?: string;
  };
}

export type FallbackNotifyFn = (reason: string, originalError: string) => void;

// Default no-op notification
const defaultNotify: FallbackNotifyFn = () => {};

// Environment flag to enable/disable v2 skill-based generation
const USE_SKILL_API = process.env.NEXT_PUBLIC_USE_SURVEY_SKILL === 'true';

/**
 * Generate a survey response with automatic fallback
 *
 * @param request - The generation request
 * @param onFallback - Optional callback when fallback to v1 occurs
 * @returns The generation result
 */
export async function generateSurveyResponse(
  request: GenerateResponseRequest,
  onFallback: FallbackNotifyFn = defaultNotify
): Promise<GenerateResponseResult> {
  const startTime = Date.now();

  // If skill API is disabled, go straight to v1
  if (!USE_SKILL_API) {
    return callV1Api(request, startTime);
  }

  // Try v2 (skill-based) first
  try {
    const v2Result = await callV2Api(request, startTime);

    if (v2Result.success) {
      return v2Result;
    }

    // v2 returned an error response (not a network/server error)
    // Check if it's a fallback-worthy error
    if (v2Result.error?.includes('skill not found') || v2Result.error?.includes('not available')) {
      const reason = 'Skill API not available';
      onFallback(reason, v2Result.error);

      console.warn('[surveyResponseService] v2 skill unavailable, falling back to v1:', v2Result.error);

      const v1Result = await callV1Api(request, startTime);
      return {
        ...v1Result,
        meta: {
          ...v1Result.meta,
          fallbackUsed: true,
          fallbackReason: reason,
        },
      };
    }

    // Non-fallback error (e.g., validation error) - return as-is
    return v2Result;
  } catch (error) {
    // Network error or unexpected failure - fallback to v1
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const reason = 'v2 API request failed';

    onFallback(reason, errorMessage);

    console.warn('[surveyResponseService] v2 request failed, falling back to v1:', errorMessage);

    try {
      const v1Result = await callV1Api(request, startTime);
      return {
        ...v1Result,
        meta: {
          ...v1Result.meta,
          fallbackUsed: true,
          fallbackReason: reason,
        },
      };
    } catch (v1Error) {
      // Both failed - return the original error
      return {
        success: false,
        error: errorMessage,
        meta: {
          version: 'v2-skill',
          fallbackUsed: true,
          fallbackReason: 'Both v2 and v1 failed',
        },
      };
    }
  }
}

/**
 * Call the v1 (prompt-based) API
 */
async function callV1Api(
  request: GenerateResponseRequest,
  startTime: number
): Promise<GenerateResponseResult> {
  const response = await fetch('/api/ai/generate-survey-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  const elapsedMs = Date.now() - startTime;

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to generate response',
      meta: {
        version: 'v1-prompt',
        elapsedMs,
      },
    };
  }

  return {
    success: true,
    response: data.response,
    meta: {
      version: 'v1-prompt',
      elapsedMs,
    },
  };
}

/**
 * Call the v2 (skill-based) API
 */
async function callV2Api(
  request: GenerateResponseRequest,
  startTime: number
): Promise<GenerateResponseResult> {
  const response = await fetch('/api/ai/generate-survey-response-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  const elapsedMs = Date.now() - startTime;

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to generate response',
      meta: {
        version: 'v2-skill',
        skillId: data.meta?.skillId,
        elapsedMs,
      },
    };
  }

  return {
    success: true,
    response: data.response,
    meta: {
      version: 'v2-skill',
      skillId: data.meta?.skillId,
      elapsedMs,
    },
  };
}

/**
 * Check if the skill API is currently enabled
 */
export function isSkillApiEnabled(): boolean {
  return USE_SKILL_API;
}
