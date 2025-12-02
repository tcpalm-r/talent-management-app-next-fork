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
  app_role: string | null; // Application role: 'admin', 'leader', 'slt', or 'user'
  role: string | null; // 360 Review role: 'admin', 'leader', 'slt', or 'user'
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
  auth0_id?: string | null;
  email: string;
  full_name: string;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  app_role: string;
  app_permissions: Record<string, any>;
  global_role?: string | null;
  capabilities?: any;
  app_access?: boolean;
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
  min_words: number | null;
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
  created_by_email: string | null;
  status: string | null;
  survey_name: string | null;
  due_date: string | null;
  sent_at: string | null;
  completed_at: string | null;
  flagged_for_admin: boolean | null;
  flagged_for_reanalysis: boolean | null;
  reanalysis_requested_at: string | null;
  reanalysis_requested_by: string | null;
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

/**
 * 360 Feedback Report - AI-generated analysis
 *
 * Stores AI-generated analysis of survey responses with role-based access:
 * - Sponsors/Admins: See full report including sentiment_by_relationship breakdown
 * - Subjects: See filtered report with only aggregated sentiment (no per-relationship data)
 */
export interface Feedback360Report {
  id: string;
  survey_id: string;
  themes: Array<{
    theme: string;
    sentiment: 'very_positive' | 'positive' | 'mixed' | 'needs_work' | 'critical';
    frequency: number;
    supporting_evidence?: string[];
    relationships_mentioned?: string[]; // Filtered out for subjects
  }>;
  overall_strengths: string[];
  development_areas: string[];
  recommendations: string[];
  sentiment_by_relationship: {
    overall: number;
    manager?: number; // Only shown to sponsors/admins
    peer?: number; // Only shown to sponsors/admins
    direct_report?: number; // Only shown to sponsors/admins
    cross_functional?: number; // Only shown to sponsors/admins
  };
  key_insights: string[];
  consensus_areas: string[];
  outlier_opinions: string[];
  generated_by: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

// ============================================================================
// SYSTEM TYPES (Note: Most system tables have been removed in database cleanup)
// ============================================================================
// HR Module, Sync History, User Profile Changes tables were removed as unused

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
export type AppRole = 'admin' | 'slt' | 'leader' | 'user';
export type GlobalRole = 'admin' | 'slt' | 'leader' | 'user';

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
export type ParticipantRole = 'employee' | 'manager' | 'slt' | 'direct_report' | 'cross_functional';

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
 * 
 * Derives permissions from app_role (single source of truth).
 * Ignores app_permissions column (zombie code from AI Intranet template).
 */
export function hasPermission(user: UserProfile | SessionUser, permission: string): boolean {
  if (!user || !user.app_role) return false;
  
  // Admin has all permissions
  if (user.app_role === 'admin') return true;
  
  // Derive permissions from role
  if (permission === 'admin') {
    return user.app_role === 'admin';
  }
  
  if (permission === 'write') {
    return ['admin', 'slt', 'leader'].includes(user.app_role);
  }
  
  if (permission === 'read') {
    return true;
  }
  
  return false;
}
