/**
 * API Response Validation Schemas
 *
 * Zod schemas for validating API responses at runtime.
 * These schemas match the existing TypeScript interfaces exactly
 * to ensure type safety while providing runtime validation.
 *
 * Usage:
 * - Server-side: Validate responses before sending (observability)
 * - Client-side: Validate responses after fetching (safety)
 *
 * All schemas use .passthrough() to allow extra fields,
 * making them resilient to API evolution.
 */

import { z } from 'zod';

// ============================================================================
// CORE SCHEMAS
// ============================================================================

/**
 * Reviewer Schema
 * Matches the Reviewer interface from Feedback360Dashboard
 *
 * Note: Some fields are optional because the API may return
 * minimal reviewer objects (only id, email, status, access_token)
 */
export const ReviewerSchema = z.object({
  id: z.string(),
  reviewer_name: z.string().nullable().optional(),
  reviewer_email: z.string(),
  relationship: z.string().optional(),
  status: z.string(),
  email_sent_at: z.string().nullable().optional(),
  access_token: z.string().optional(),
}).passthrough();

/**
 * Employee Schema (simplified for survey context)
 * Matches the Employee interface from types/index.ts
 */
export const EmployeeSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  employee_id: z.string().nullable(),
  name: z.string(),
  email: z.string().nullable(),
  department_id: z.string().nullable(),
  manager_name: z.string().nullable(),
  title: z.string().nullable(),
  location: z.string().nullable(),
  role: z.string().optional(),
  app_role: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

/**
 * Survey Schema
 * Matches the Survey interface from Feedback360Dashboard
 *
 * Fields marked as nullable/optional to match database reality:
 * - survey_name: can be null for drafts
 * - status: can be null (though unusual)
 * - due_date: optional field
 * - created_by: optional (should always exist but defensive)
 * - flags: optional booleans
 */
export const SurveySchema = z.object({
  id: z.string(),
  survey_name: z.string().nullable(),
  status: z.string().nullable(),
  due_date: z.string().nullable(),
  created_at: z.string().nullable(),
  employee_id: z.string(),
  employee: EmployeeSchema.optional(),
  reviewers_count: z.number().optional(),
  completed_count: z.number().optional(),
  created_by: z.string().optional(),
  reviewers: z.array(ReviewerSchema).optional(),
  flagged_for_admin: z.boolean().nullable().optional(),
  flagged_for_reanalysis: z.boolean().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  organization_id: z.string().optional(),
  ai_report_generated: z.boolean().optional(),
  report_data: z.any().optional(),
}).passthrough();

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

/**
 * Survey List Response
 * From /api/surveys/list
 */
export const SurveyListResponseSchema = z.object({
  surveys: z.array(SurveySchema),
  count: z.number(),
  role: z.string(),
}).passthrough();

/**
 * Survey Detail Response
 * From /api/surveys/[id] and /api/surveys/[id]/details
 */
export const SurveyDetailResponseSchema = z.object({
  survey: SurveySchema,
  message: z.string().optional(),
}).passthrough();

/**
 * Survey Create Response
 * From /api/surveys/create and /api/surveys/save-draft
 */
export const SurveyCreateResponseSchema = z.object({
  success: z.boolean(),
  survey: SurveySchema,
  message: z.string().optional(),
}).passthrough();

/**
 * Survey Update Response
 * From /api/surveys/[id] (PATCH)
 */
export const SurveyUpdateResponseSchema = z.object({
  survey: SurveySchema,
  message: z.string().optional(),
}).passthrough();

/**
 * Survey Delete Response
 * From /api/surveys/[id] (DELETE)
 */
export const SurveyDeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}).passthrough();

/**
 * Reviewers List Response
 * From /api/surveys/[id]/reviewers
 */
export const ReviewersListResponseSchema = z.object({
  reviewers: z.array(ReviewerSchema),
  count: z.number().optional(),
}).passthrough();

/**
 * Generic Success Response
 * Used by various endpoints that return simple success/error
 */
export const GenericSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
}).passthrough();

/**
 * 360 Report Response
 * From /api/360-generate-report
 */
export const Report360ResponseSchema = z.object({
  report: z.any(), // Report structure is complex and varies
  survey: SurveySchema.optional(),
  message: z.string().optional(),
}).passthrough();

/**
 * Error Response Schema
 * Standard error response format
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.any().optional(),
  message: z.string().optional(),
}).passthrough();

// ============================================================================
// TYPE EXPORTS (inferred from schemas)
// ============================================================================

export type Reviewer = z.infer<typeof ReviewerSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type Survey = z.infer<typeof SurveySchema>;
export type SurveyListResponse = z.infer<typeof SurveyListResponseSchema>;
export type SurveyDetailResponse = z.infer<typeof SurveyDetailResponseSchema>;
export type SurveyCreateResponse = z.infer<typeof SurveyCreateResponseSchema>;
export type SurveyUpdateResponse = z.infer<typeof SurveyUpdateResponseSchema>;
export type SurveyDeleteResponse = z.infer<typeof SurveyDeleteResponseSchema>;
export type ReviewersListResponse = z.infer<typeof ReviewersListResponseSchema>;
export type GenericSuccessResponse = z.infer<typeof GenericSuccessResponseSchema>;
export type Report360Response = z.infer<typeof Report360ResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate data against a schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param context - Optional context string for error messages
 * @returns Validation result with parsed data or error
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[Schema Validation] Failed${context ? ` (${context})` : ''}:`, {
        errors: error.errors,
        data: JSON.stringify(data, null, 2),
      });
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Safely parse data with a schema
 * Returns parsed data or null if validation fails
 * Logs errors in development, silent in production
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T | null {
  const result = validateSchema(schema, data, context);
  if (result.success) {
    return result.data;
  }

  // In production, fail silently (already logged by validateSchema)
  return null;
}
