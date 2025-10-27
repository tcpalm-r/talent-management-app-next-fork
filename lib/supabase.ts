/**
 * Supabase Client & Database Utilities
 *
 * This file provides the main Supabase client for client-side operations
 * and re-exports database utilities for convenience.
 *
 * IMPORTANT: This file maintains backward compatibility.
 * All existing imports will continue to work.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// ============================================================================
// MAIN SUPABASE CLIENT (Client-side, respects RLS)
// ============================================================================

/**
 * Main Supabase client for client-side operations
 * - Respects Row Level Security (RLS) policies
 * - Safe to use in client components
 * - Uses anonymous key for authentication
 *
 * EXISTING EXPORT - DO NOT MODIFY
 * All existing code depends on this export
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// These are additive - they don't break any existing imports
// ============================================================================

/**
 * Re-export all type definitions from schema.ts
 * Usage: import { UserProfile, Employee } from '@/lib/supabase'
 */
export type {
  // User & Auth Types
  UserProfile,
  Employee,
  SessionUser,

  // Assessment Types
  Assessment,
  AssessmentResponse,

  // Performance Review Types
  PerformanceReview,
  PerformanceReviewParticipant,
  PerformanceReviewDeadline,
  IdealTeamPlayerMatrix,

  // 360 Feedback Types
  Feedback360Question,
  Feedback360Survey,
  Feedback360SurveyQuestion,
  Feedback360SurveyReviewer,
  Feedback360Response,

  // System Types
  HRModule,
  SyncHistory,
  UserProfileChange,

  // View Types
  ActiveUser,
  PendingUser,
  ActivePerformanceReview,

  // Insert/Update Types
  InsertUserProfile,
  InsertAssessment,
  InsertAssessmentResponse,
  InsertPerformanceReview,
  InsertFeedback360Survey,
  InsertFeedback360Question,
  InsertFeedback360Response,
  UpdateUserProfile,
  UpdateAssessment,
  UpdatePerformanceReview,
  UpdateFeedback360Survey,

  // Utility Types
  AppRole,
  GlobalRole,
  AssessmentStatus,
  SurveyStatus,
  ReviewStatus,
  ParticipantRole,
  ReviewerStatus,
} from './schema';

/**
 * Re-export type guard helpers
 * Usage: import { isAdmin, isLeader } from '@/lib/supabase'
 */
export { isAdmin, isLeader, hasPermission } from './schema';

/**
 * Re-export all query helper functions from database.ts
 * Usage: import { getUserProfile, get360Surveys } from '@/lib/supabase'
 */
export {
  // User Profile Queries
  getUserProfile,
  getUserProfileByEmail,
  getActiveUsers,
  getUsersByDepartment,
  getDirectReports,
  updateUserProfile,
  toSessionUser,

  // Assessment Queries
  getAssessmentsByUser,
  getAssessment,
  getAssessmentResponses,

  // Performance Review Queries
  getPerformanceReviews,
  getActivePerformanceReviews,
  getPerformanceReview,

  // 360 Feedback Queries
  get360Questions,
  getDefault360Questions,
  get360Surveys,
  get360Survey,
  get360SurveyWithDetails,
  get360SurveyReviewers,
  get360SurveyResponses,
  get360SurveyQuestions,
  get360SurveyByToken,

  // Department Queries
  getDepartments,

  // Statistics Queries
  getUserCountByDepartment,
  getActiveUserCount,

  // Utility Functions
  userExists,
  isUserAdmin,
  isUserLeader,
  getUserManager,
} from './database';

// ============================================================================
// ADMIN CLIENT (Server-side only)
// ============================================================================

/**
 * Server-only admin helpers
 *
 * To use the privileged Supabase client or any admin helpers, import them
 * directly from `@/lib/supabase-admin`. Keeping those imports out of this file
 * prevents the admin client (and its required secrets) from being bundled into
 * client code.
 */

// ============================================================================
// DRIZZLE ORM NOTE
// ============================================================================

/**
 * DRIZZLE ORM - Server-side Only
 *
 * Drizzle ORM clients are NOT re-exported from this file because:
 * 1. This file (lib/supabase.ts) is imported in client components
 * 2. Drizzle uses the postgres client which is Node.js only
 * 3. Including it here causes build errors
 *
 * For Drizzle ORM, import directly from lib/db.ts in SERVER components/routes:
 * ```typescript
 * // In API routes or server components only
 * import { db, withTransaction } from '@/lib/db';
 *
 * const users = await db.select().from(userProfiles).limit(10);
 * ```
 *
 * Available exports from lib/db.ts:
 * - db: Main Drizzle instance
 * - txDb: Transaction-specific instance
 * - withTransaction: Transaction helper
 * - executeRawQuery: Raw SQL query
 * - testConnection: Test database connection
 * - closeConnections: Close all connections
 */
