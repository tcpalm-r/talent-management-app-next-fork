/**
 * Supabase Admin Client
 *
 * This file provides a Supabase client with service role privileges
 * for server-side operations that need to bypass Row Level Security (RLS).
 *
 * IMPORTANT SAFETY NOTES:
 * - ONLY use this in server-side code (API routes, server components)
 * - NEVER expose this to the client
 * - NEVER import this in client components
 * - This bypasses all RLS policies - use with caution
 *
 * Use the regular supabase client (lib/supabase.ts) for client-side operations.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

/**
 * Admin Supabase client with service role privileges
 *
 * This client:
 * - Bypasses Row Level Security (RLS) policies
 * - Has full access to all data
 * - Should ONLY be used in server-side code
 *
 * Example usage in API route:
 * ```typescript
 * import { supabaseAdmin } from '@/lib/supabase-admin';
 *
 * export async function POST(request: Request) {
 *   // Server-side only - bypasses RLS
 *   const { data, error } = await supabaseAdmin
 *     .from('user_profiles')
 *     .select('*');
 *
 *   return Response.json({ data });
 * }
 * ```
 */
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ============================================================================
// ADMIN HELPER FUNCTIONS
// These functions use the admin client for privileged operations
// ============================================================================

/**
 * Create a new user profile (admin only)
 * Bypasses RLS to create users programmatically
 */
export async function createUserProfile(userData: {
  email: string;
  full_name: string;
  department?: string;
  title?: string;
  manager_id?: string;
  app_role?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      email: userData.email,
      full_name: userData.full_name,
      department: userData.department || null,
      title: userData.title || null,
      manager_id: userData.manager_id || null,
      app_role: userData.app_role || 'user',
      app_access: true,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }

  return data;
}

/**
 * Bulk create user profiles (admin only)
 * Useful for importing multiple users at once
 */
export async function bulkCreateUserProfiles(
  users: Array<{
    email: string;
    full_name: string;
    department?: string;
    title?: string;
    manager_id?: string;
    app_role?: string;
  }>
) {
  const usersToInsert = users.map((user) => ({
    email: user.email,
    full_name: user.full_name,
    department: user.department || null,
    title: user.title || null,
    manager_id: user.manager_id || null,
    app_role: user.app_role || 'user',
    app_access: true,
    is_active: true,
  }));

  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .insert(usersToInsert)
    .select();

  if (error) {
    console.error('Error bulk creating user profiles:', error);
    throw error;
  }

  return data;
}

/**
 * Update user profile (admin only)
 * Bypasses RLS for administrative updates
 */
export async function adminUpdateUserProfile(
  userId: string,
  updates: Partial<{
    email: string;
    full_name: string;
    department: string;
    title: string;
    manager_id: string;
    app_role: string;
    app_access: boolean;
    is_active: boolean;
  }>
) {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }

  return data;
}

/**
 * Delete user profile (admin only)
 * Permanently removes a user - use with extreme caution
 */
export async function deleteUserProfile(userId: string) {
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('Error deleting user profile:', error);
    throw error;
  }

  return { success: true };
}

/**
 * Get all users including inactive (admin only)
 */
export async function adminGetAllUsers() {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .order('full_name');

  if (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }

  return data;
}

/**
 * Deactivate user (admin only)
 * Soft delete - sets is_active to false
 */
export async function deactivateUser(userId: string) {
  return adminUpdateUserProfile(userId, { is_active: false });
}

/**
 * Reactivate user (admin only)
 */
export async function reactivateUser(userId: string) {
  return adminUpdateUserProfile(userId, { is_active: true });
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  role: 'admin' | 'leader' | 'user'
) {
  return adminUpdateUserProfile(userId, { app_role: role });
}

/**
 * Grant app access (admin only)
 */
export async function grantAppAccess(userId: string) {
  return adminUpdateUserProfile(userId, { app_access: true });
}

/**
 * Revoke app access (admin only)
 */
export async function revokeAppAccess(userId: string) {
  return adminUpdateUserProfile(userId, { app_access: false });
}

// ============================================================================
// 360 FEEDBACK ADMIN FUNCTIONS
// ============================================================================

/**
 * Create 360 survey (admin/manager)
 */
export async function adminCreate360Survey(surveyData: {
  employee_id: string;
  created_by: string;
  survey_name?: string;
  due_date?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('feedback_360_surveys')
    .insert({
      employee_id: surveyData.employee_id,
      created_by: surveyData.created_by,
      survey_name: surveyData.survey_name || null,
      due_date: surveyData.due_date || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating 360 survey:', error);
    throw error;
  }

  return data;
}

/**
 * Update 360 survey status (admin only)
 */
export async function adminUpdate360SurveyStatus(
  surveyId: string,
  status: 'draft' | 'active' | 'completed' | 'cancelled'
) {
  const { data, error } = await supabaseAdmin
    .from('feedback_360_surveys')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'active' && { sent_at: new Date().toISOString() }),
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
    })
    .eq('id', surveyId)
    .select()
    .single();

  if (error) {
    console.error('Error updating 360 survey status:', error);
    throw error;
  }

  return data;
}

/**
 * Delete 360 survey (admin only)
 */
export async function adminDelete360Survey(surveyId: string) {
  const { error } = await supabaseAdmin
    .from('feedback_360_surveys')
    .delete()
    .eq('id', surveyId);

  if (error) {
    console.error('Error deleting 360 survey:', error);
    throw error;
  }

  return { success: true };
}

// ============================================================================
// PERFORMANCE REVIEW ADMIN FUNCTIONS
// ============================================================================

/**
 * Create performance review (admin only)
 */
export async function adminCreatePerformanceReview(reviewData: {
  name: string;
  description?: string;
  review_type: string;
  framework: string;
  start_date?: string;
  end_date?: string;
  created_by?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('performance_reviews')
    .insert({
      name: reviewData.name,
      description: reviewData.description || null,
      review_type: reviewData.review_type,
      framework: reviewData.framework,
      start_date: reviewData.start_date || null,
      end_date: reviewData.end_date || null,
      created_by: reviewData.created_by || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating performance review:', error);
    throw error;
  }

  return data;
}

/**
 * Update performance review status (admin only)
 */
export async function adminUpdatePerformanceReviewStatus(
  reviewId: string,
  status: 'draft' | 'active' | 'completed' | 'archived'
) {
  const { data, error } = await supabaseAdmin
    .from('performance_reviews')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) {
    console.error('Error updating performance review status:', error);
    throw error;
  }

  return data;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if this is running in a server context
 * Helps prevent accidental client-side usage
 */
export function isServerContext(): boolean {
  return typeof window === 'undefined';
}

/**
 * Ensure admin client is only used server-side
 * Call this at the start of functions using admin client
 */
export function requireServerContext(functionName: string): void {
  if (!isServerContext()) {
    throw new Error(
      `${functionName} can only be called in server-side code. ` +
      `Do not import supabase-admin in client components.`
    );
  }
}
