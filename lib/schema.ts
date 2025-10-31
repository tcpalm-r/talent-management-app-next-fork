/**
 * Database Schema Type Definitions
 *
 * This file contains TypeScript interfaces that describe the existing database structure.
 * These are type definitions ONLY - no database operations or schema creation.
 *
 * NOTE: These interfaces match the existing Supabase database tables.
 * DO NOT modify the database structure to match these types.
 */

import { Tables } from '@/types/supabase';

// ============================================================================
// USER & AUTH TYPES (for future auth integration)
// These types are prepared for Phase 3 auth integration
// ============================================================================

/**
 * User Profile - Core user data
 * Maps to existing user_profiles table
 */
export interface UserProfile {
  id: string;
  auth0_id: string | null;
  email: string;
  full_name: string;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
  avatar_url: string | null;

  // Roles and permissions
  global_role: string | null;
  app_role: string | null;
  role: string | null; // 360 Review role: 'admin', 'leader', or 'user'
  app_permissions: Record<string, any> | null;
  app_access: boolean | null;
  capabilities: any | null;
  local_permissions: Record<string, any> | null;

  // Organizational info
  department: string | null;
  title: string | null;
  job_title: string | null;
  phone: string | null;
  location: string | null;
  manager_id: string | null;
  manager_email: string | null;
  employee_number: string | null;
  cost_center: string | null;
  external_id: string | null;

  // Login tracking
  has_logged_in: boolean | null;
  first_login_at: string | null;
  last_login_at: string | null;
  sync_method: string | null;

  // Metadata
  last_sync: string | null;
  is_active: boolean | null;
  scim_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  last_updated_by: string | null;
  idx: number;
}

/**
 * Session User - Simplified user info for session management
 * Use this for authenticated user context
 */
export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  app_role: string;
  app_permissions: Record<string, any>;
  department: string | null;
  title: string | null;
}

// ============================================================================
// TALENT MANAGEMENT TYPES
// These match existing database tables
// ============================================================================

/**
 * Employee - Alias for UserProfile for talent management context
 */
export type Employee = UserProfile;

/**
 * Assessment - Performance/360 assessments
 */
export interface Assessment {
  id: string;
  user_id: string;
  assessment_type: string;
  assessor_id: string | null;
  performance_review_id: string | null;
  framework_type: string | null;
  status: string;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Assessment Response - Individual assessment ratings
 */
export interface AssessmentResponse {
  id: string;
  assessment_id: string;
  virtue: string;
  attribute: string;
  rating: number;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Performance Review - Annual/periodic reviews
 */
export interface PerformanceReview {
  id: string;
  name: string;
  description: string | null;
  review_type: string;
  framework: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  settings: any | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Performance Review Participant
 */
export interface PerformanceReviewParticipant {
  id: string;
  performance_review_id: string | null;
  user_id: string;
  role: string | null;
  status: string | null;
  invited_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Performance Review Deadline
 */
export interface PerformanceReviewDeadline {
  id: string;
  performance_review_id: string | null;
  deadline_type: string;
  due_date: string;
  reminder_days: number[] | null;
  created_at: string | null;
}

/**
 * Ideal Team Player Matrix
 */
export interface IdealTeamPlayerMatrix {
  id: number;
  performance_review_id: string | null;
  virtue: string;
  attribute: string;
  living: string;
  not_living: string;
  role_modeling: string;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// 360 FEEDBACK TYPES
// ============================================================================

/**
 * 360 Feedback Question
 */
export interface Feedback360Question {
  id: string;
  question_text: string;
  category: string | null;
  is_default: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

/**
 * 360 Feedback Survey
 */
export interface Feedback360Survey {
  id: string;
  employee_id: string;
  created_by: string;
  status: string | null;
  survey_name: string | null;
  due_date: string | null;
  sent_at: string | null;
  completed_at: string | null;
  flagged_for_admin: boolean | null;
  resolved_by_hr: boolean | null;
  resolved_by: string | null;
  resolved_at: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 360 Survey Question (junction table)
 */
export interface Feedback360SurveyQuestion {
  id: string;
  survey_id: string;
  question_id: string;
  question_order: number;
  created_at: string | null;
}

/**
 * 360 Survey Reviewer
 */
export interface Feedback360SurveyReviewer {
  id: string;
  survey_id: string;
  reviewer_email: string;
  reviewer_name: string | null;
  status: string;
  access_token: string | null;
  invited_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  last_reminder_sent_at: string | null;
  last_reminder_at: string | null;
  reminder_count: number | null;
  created_at: string | null;
}

/**
 * 360 Feedback Response
 */
export interface Feedback360Response {
  id: string;
  survey_id: string;
  question_id: string;
  reviewer_email: string;
  response_text: string | null;
  rating: number | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

/**
 * HR Module Configuration
 */
export interface HRModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  icon_color: string;
  bg_gradient: string;
  status: string;
  features: any;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Sync History - Track data synchronization operations
 */
export interface SyncHistory {
  id: string;
  sync_type: string;
  sync_source: string | null;
  status: string | null;
  sync_start_time: string;
  sync_end_time: string | null;
  sync_duration_ms: number | null;
  total_users: number | null;
  users_created: number | null;
  users_updated: number | null;
  users_failed: number | null;
  managers_resolved: number | null;
  orphaned_managers: any | null;
  circular_dependencies: any | null;
  errors: any | null;
  metadata: any | null;
  initiated_by: string | null;
  created_at: string | null;
}

/**
 * User Profile Change - Track changes to user profiles
 */
export interface UserProfileChange {
  id: string;
  user_email: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string | null;
  change_source: string | null;
}

// ============================================================================
// VIEW TYPES (Database Views)
// ============================================================================

/**
 * Active Users View
 */
export interface ActiveUser {
  id: string | null;
  email: string | null;
  full_name: string | null;
  title: string | null;
  department: string | null;
  manager_email: string | null;
  has_logged_in: boolean | null;
  first_login_at: string | null;
  last_login_at: string | null;
  days_since_login: number | null;
}

/**
 * Pending Users View
 */
export interface PendingUser {
  id: string | null;
  email: string | null;
  full_name: string | null;
  title: string | null;
  department: string | null;
  manager_email: string | null;
  sync_method: string | null;
  synced_at: string | null;
  days_since_sync: number | null;
}

/**
 * Active Performance Review View
 */
export interface ActivePerformanceReview {
  id: string | null;
  name: string | null;
  description: string | null;
  review_type: string | null;
  framework: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  settings: any | null;
  total_participants: number | null;
  completed_participants: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// INSERT/UPDATE TYPES
// These are for creating or updating records
// ============================================================================

/**
 * Insert types - for creating new records
 */
export type InsertUserProfile = Omit<UserProfile, 'id' | 'created_at' | 'updated_at' | 'idx'>;
export type InsertAssessment = Omit<Assessment, 'id' | 'created_at' | 'updated_at'>;
export type InsertAssessmentResponse = Omit<AssessmentResponse, 'id' | 'created_at' | 'updated_at'>;
export type InsertPerformanceReview = Omit<PerformanceReview, 'id' | 'created_at' | 'updated_at'>;
export type InsertFeedback360Survey = Omit<Feedback360Survey, 'id' | 'created_at' | 'updated_at'>;
export type InsertFeedback360Question = Omit<Feedback360Question, 'id' | 'created_at' | 'updated_at'>;
export type InsertFeedback360Response = Omit<Feedback360Response, 'id' | 'created_at' | 'updated_at'>;

/**
 * Update types - for updating existing records (all fields optional)
 */
export type UpdateUserProfile = Partial<Omit<UserProfile, 'id' | 'idx'>>;
export type UpdateAssessment = Partial<Omit<Assessment, 'id'>>;
export type UpdatePerformanceReview = Partial<Omit<PerformanceReview, 'id'>>;
export type UpdateFeedback360Survey = Partial<Omit<Feedback360Survey, 'id'>>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Role types for user permissions
 */
export type AppRole = 'admin' | 'leader' | 'user';
export type GlobalRole = 'admin' | 'leader' | 'user';

/**
 * Assessment status types
 */
export type AssessmentStatus = 'draft' | 'in_progress' | 'submitted' | 'completed';

/**
 * Survey status types
 */
export type SurveyStatus = 'draft' | 'active' | 'completed' | 'cancelled';

/**
 * Review status types
 */
export type ReviewStatus = 'draft' | 'active' | 'completed' | 'archived';

/**
 * Participant role types
 */
export type ParticipantRole = 'employee' | 'manager' | 'peer' | 'direct_report';

/**
 * Reviewer status types
 */
export type ReviewerStatus = 'pending' | 'in_progress' | 'completed';

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a user is an admin
 */
export function isAdmin(user: UserProfile | SessionUser): boolean {
  return user.app_role === 'admin';
}

/**
 * Type guard to check if a user is a leader
 */
export function isLeader(user: UserProfile | SessionUser): boolean {
  return user.app_role === 'leader' || user.app_role === 'admin';
}

/**
 * Type guard to check if a user has specific permission
 */
export function hasPermission(user: UserProfile | SessionUser, permission: string): boolean {
  if (!user.app_permissions) return false;
  return user.app_permissions[permission] === true;
}
