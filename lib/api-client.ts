/**
 * API Client with Response Validation
 *
 * Provides a type-safe fetch wrapper with runtime validation using Zod.
 *
 * Features:
 * - Automatic response validation
 * - Type-safe return values
 * - Dev vs Production error handling
 * - Toast notifications for errors
 * - Graceful degradation
 *
 * Usage:
 * ```typescript
 * const data = await fetchWithValidation(
 *   SurveyListResponseSchema,
 *   '/api/surveys/list?organization_id=123'
 * );
 * // data is now fully type-safe and validated
 * ```
 */

import { z } from 'zod';
import { validateSchema, ErrorResponseSchema } from './api-schemas';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Check if we're in development mode
 * In dev: throw errors immediately (fail fast)
 * In prod: log errors and return null (graceful degradation)
 */
const isDevelopment = process.env.NODE_ENV === 'development';

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public zodError: z.ZodError,
    public response: Response,
    public data: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response: Response,
    public data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// ============================================================================
// FETCH WITH VALIDATION
// ============================================================================

/**
 * Fetch with automatic response validation
 *
 * @param schema - Zod schema to validate response against
 * @param url - URL to fetch (absolute or relative)
 * @param options - Standard fetch options
 * @returns Validated, type-safe response data
 *
 * @throws ValidationError if response doesn't match schema (dev mode only)
 * @throws APIError if HTTP status is not OK
 * @returns null if validation fails in production (with console error)
 *
 * @example
 * ```typescript
 * // Fetch and validate survey list
 * const result = await fetchWithValidation(
 *   SurveyListResponseSchema,
 *   '/api/surveys/list?organization_id=abc'
 * );
 *
 * if (result) {
 *   // result.surveys is fully typed and validated
 *   console.log(result.surveys);
 * }
 * ```
 */
export async function fetchWithValidation<T>(
  schema: z.ZodSchema<T>,
  url: string,
  options?: RequestInit
): Promise<T | null> {
  const context = `${options?.method || 'GET'} ${url}`;

  try {
    // Make fetch request
    const response = await fetch(url, options);

    // Parse JSON response
    let data: unknown;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error(`[API Client] Failed to parse JSON (${context}):`, parseError);
      throw new APIError(
        'Invalid JSON response from server',
        response.status,
        response
      );
    }

    // Check HTTP status
    if (!response.ok) {
      // Try to parse as error response
      const errorResult = validateSchema(ErrorResponseSchema, data, context);
      const errorMessage = errorResult.success
        ? errorResult.data.error || errorResult.data.message || 'Unknown error'
        : `HTTP ${response.status}: ${response.statusText}`;

      console.error(`[API Client] HTTP error (${context}):`, {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        data,
      });

      throw new APIError(errorMessage, response.status, response, data);
    }

    // Validate response against schema
    const validationResult = validateSchema(schema, data, context);

    if (validationResult.success) {
      // ✅ Validation passed - return typed data
      return validationResult.data;
    }

    // ❌ Validation failed
    const validationError = new ValidationError(
      `Response validation failed for ${context}`,
      validationResult.error,
      response,
      data
    );

    if (isDevelopment) {
      // In development: throw error to catch issues immediately
      console.error('[API Client] VALIDATION FAILED (throwing in dev mode):', {
        url,
        issues: validationResult.error.issues, // Zod 4 uses 'issues' instead of 'errors'
        data,
      });
      throw validationError;
    } else {
      // In production: log error but don't crash
      console.error('[API Client] VALIDATION FAILED (graceful degradation):', {
        url,
        issues: validationResult.error.issues?.slice(0, 5), // Zod 4 uses 'issues', limit to first 5
        dataPreview: JSON.stringify(data).slice(0, 200), // Limit to 200 chars
      });

      // Return null to signal validation failure
      // Components should handle null gracefully
      return null;
    }
  } catch (error) {
    // Handle fetch errors, network errors, etc.
    if (error instanceof ValidationError || error instanceof APIError) {
      // Re-throw our custom errors
      throw error;
    }

    // Network error or other fetch failure
    console.error(`[API Client] Fetch failed (${context}):`, error);
    throw new APIError(
      error instanceof Error ? error.message : 'Network request failed',
      0,
      new Response(),
      undefined
    );
  }
}

/**
 * Fetch with validation and automatic fallback
 *
 * Like fetchWithValidation but returns a fallback value instead of null
 * on validation failure. Never throws in production.
 *
 * @param schema - Zod schema to validate response against
 * @param url - URL to fetch
 * @param fallback - Value to return if validation fails
 * @param options - Standard fetch options
 * @returns Validated data or fallback value
 *
 * @example
 * ```typescript
 * // Always returns a valid array, even on error
 * const surveys = await fetchWithFallback(
 *   SurveyListResponseSchema,
 *   '/api/surveys/list',
 *   { surveys: [], count: 0, role: 'user' }
 * );
 * ```
 */
export async function fetchWithFallback<T>(
  schema: z.ZodSchema<T>,
  url: string,
  fallback: T,
  options?: RequestInit
): Promise<T> {
  try {
    const result = await fetchWithValidation(schema, url, options);
    return result ?? fallback;
  } catch (error) {
    console.error(`[API Client] Request failed, using fallback:`, {
      url,
      error: error instanceof Error ? error.message : error,
    });
    return fallback;
  }
}

// ============================================================================
// TYPE-SAFE FETCH HELPERS
// ============================================================================

/**
 * Helper for GET requests with validation
 */
export async function fetchGet<T>(
  schema: z.ZodSchema<T>,
  url: string
): Promise<T | null> {
  return fetchWithValidation(schema, url, { method: 'GET' });
}

/**
 * Helper for POST requests with validation
 */
export async function fetchPost<T>(
  schema: z.ZodSchema<T>,
  url: string,
  body: unknown
): Promise<T | null> {
  return fetchWithValidation(schema, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper for PATCH requests with validation
 */
export async function fetchPatch<T>(
  schema: z.ZodSchema<T>,
  url: string,
  body: unknown
): Promise<T | null> {
  return fetchWithValidation(schema, url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Helper for DELETE requests with validation
 */
export async function fetchDelete<T>(
  schema: z.ZodSchema<T>,
  url: string
): Promise<T | null> {
  return fetchWithValidation(schema, url, { method: 'DELETE' });
}
