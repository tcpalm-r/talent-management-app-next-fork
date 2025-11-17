/**
 * Database Query Helpers
 *
 * This file provides convenient helper functions for common database operations.
 * All functions use the existing Supabase database connection.
 *
 * SAFETY: These are query helpers only - NO database structure modifications.
 */

import { supabase } from './supabase';
import {
  UserProfile,
  Employee,
  Assessment,
  AssessmentResponse,
  PerformanceReview,
  Feedback360Survey,
  Feedback360Question,
  Feedback360Response,
  Feedback360SurveyReviewer,
  SessionUser,
} from './schema';

// ============================================================================
// USER PROFILE QUERIES
// ============================================================================

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Get user profile by email
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching user profile by email:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Get all active users
 */
export async function getActiveUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    console.error('Error fetching active users:', error);
    return [];
  }

  return data as UserProfile[];
}

/**
 * Get users by department
 */
export async function getUsersByDepartment(department: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('department', department)
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    console.error('Error fetching users by department:', error);
    return [];
  }

  return data as UserProfile[];
}

/**
 * Get direct reports for a manager
 */
export async function getDirectReports(managerId: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('manager_id', managerId)
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    console.error('Error fetching direct reports:', error);
    return [];
  }

  return data as UserProfile[];
}

/**
 * Get manager for an employee
 */
export async function getManager(employeeId: string): Promise<UserProfile | null> {
  // First get the employee to find their manager_id
  const employee = await getUserProfile(employeeId);
  if (!employee || !employee.manager_id) {
    return null;
  }

  // Then fetch the manager
  return await getUserProfile(employee.manager_id);
}

/**
 * Get SLT members (excluding a specific employee if provided)
 */
export async function getSLTMembers(excludeEmployeeId?: string): Promise<UserProfile[]> {
  let query = supabase
    .from('user_profiles')
    .select('*')
    .eq('app_role', 'slt')
    .eq('is_active', true)
    .order('full_name');

  if (excludeEmployeeId) {
    query = query.neq('id', excludeEmployeeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching SLT members:', error);
    return [];
  }

  return data as UserProfile[];
}

/**
 * Search employees by name, email, or title
 */
export async function searchEmployees(
  searchTerm: string,
  excludeEmployeeId?: string
): Promise<UserProfile[]> {
  let query = supabase
    .from('user_profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name');

  if (excludeEmployeeId) {
    query = query.neq('id', excludeEmployeeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error searching employees:', error);
    return [];
  }

  // Client-side filtering for multiple fields
  const searchLower = searchTerm.toLowerCase();
  return (data as UserProfile[]).filter(emp =>
    emp.full_name?.toLowerCase().includes(searchLower) ||
    emp.email?.toLowerCase().includes(searchLower) ||
    emp.title?.toLowerCase().includes(searchLower)
  );
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  const { data, error } = await supabase
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
    return null;
  }

  return data as UserProfile;
}

/**
 * Create session user from user profile
 * Useful for auth context
 */
export function toSessionUser(profile: UserProfile): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    app_role: profile.app_role || 'user',
    app_permissions: profile.app_permissions || {},
    department: profile.department,
    title: profile.title,
  };
}

// ============================================================================
// ASSESSMENT QUERIES
// ============================================================================

/**
 * Get assessments for a user
 */
export async function getAssessmentsByUser(userId: string): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assessments:', error);
    return [];
  }

  return data as Assessment[];
}

/**
 * Get assessment by ID
 */
export async function getAssessment(assessmentId: string): Promise<Assessment | null> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('id', assessmentId)
    .single();

  if (error) {
    console.error('Error fetching assessment:', error);
    return null;
  }

  return data as Assessment;
}

/**
 * Get assessment responses for an assessment
 */
export async function getAssessmentResponses(
  assessmentId: string
): Promise<AssessmentResponse[]> {
  const { data, error } = await supabase
    .from('assessment_responses')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('virtue, attribute');

  if (error) {
    console.error('Error fetching assessment responses:', error);
    return [];
  }

  return data as AssessmentResponse[];
}

// ============================================================================
// PERFORMANCE REVIEW QUERIES
// ============================================================================

/**
 * Get all performance reviews
 */
export async function getPerformanceReviews(): Promise<PerformanceReview[]> {
  const { data, error } = await supabase
    .from('performance_reviews')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching performance reviews:', error);
    return [];
  }

  return data as PerformanceReview[];
}

/**
 * Get active performance reviews
 */
export async function getActivePerformanceReviews(): Promise<PerformanceReview[]> {
  const { data, error } = await supabase
    .from('performance_reviews')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active performance reviews:', error);
    return [];
  }

  return data as PerformanceReview[];
}

/**
 * Get performance review by ID
 */
export async function getPerformanceReview(
  reviewId: string
): Promise<PerformanceReview | null> {
  const { data, error } = await supabase
    .from('performance_reviews')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (error) {
    console.error('Error fetching performance review:', error);
    return null;
  }

  return data as PerformanceReview;
}

// ============================================================================
// 360 FEEDBACK QUERIES
// ============================================================================

/**
 * Get all 360 feedback questions
 */
export async function get360Questions(): Promise<Feedback360Question[]> {
  const { data, error } = await supabase
    .from('feedback_360_questions')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching 360 questions:', error);
    return [];
  }

  return data as Feedback360Question[];
}

/**
 * Get default 360 feedback questions
 */
export async function getDefault360Questions(): Promise<Feedback360Question[]> {
  const { data, error } = await supabase
    .from('feedback_360_questions')
    .select('*')
    .eq('is_default', true)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching default 360 questions:', error);
    return [];
  }

  return data as Feedback360Question[];
}

/**
 * Get 360 surveys for an employee
 */
export async function get360Surveys(employeeId: string): Promise<Feedback360Survey[]> {
  const { data, error } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching 360 surveys:', error);
    return [];
  }

  return data as Feedback360Survey[];
}

/**
 * Get 360 survey by ID
 */
export async function get360Survey(surveyId: string): Promise<Feedback360Survey | null> {
  const { data, error } = await supabase
    .from('feedback_360_surveys')
    .select('*')
    .eq('id', surveyId)
    .single();

  if (error) {
    console.error('Error fetching 360 survey:', error);
    return null;
  }

  return data as Feedback360Survey;
}

/**
 * Get 360 survey with all related data
 */
export async function get360SurveyWithDetails(surveyId: string) {
  const [survey, reviewers, responses, questions] = await Promise.all([
    get360Survey(surveyId),
    get360SurveyReviewers(surveyId),
    get360SurveyResponses(surveyId),
    get360SurveyQuestions(surveyId),
  ]);

  return {
    survey,
    reviewers,
    responses,
    questions,
  };
}

/**
 * Get reviewers for a 360 survey
 */
export async function get360SurveyReviewers(
  surveyId: string
): Promise<Feedback360SurveyReviewer[]> {
  const { data, error } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('survey_id', surveyId)
    .order('created_at');

  if (error) {
    console.error('Error fetching 360 survey reviewers:', error);
    return [];
  }

  return data as Feedback360SurveyReviewer[];
}

/**
 * Get responses for a 360 survey
 */
export async function get360SurveyResponses(
  surveyId: string
): Promise<Feedback360Response[]> {
  const { data, error } = await supabase
    .from('feedback_360_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .order('created_at');

  if (error) {
    console.error('Error fetching 360 survey responses:', error);
    return [];
  }

  return data as Feedback360Response[];
}

/**
 * Get questions for a 360 survey
 */
export async function get360SurveyQuestions(surveyId: string) {
  const { data, error } = await supabase
    .from('feedback_360_survey_questions')
    .select(`
      *,
      feedback_360_questions (*)
    `)
    .eq('survey_id', surveyId)
    .order('question_order');

  if (error) {
    console.error('Error fetching 360 survey questions:', error);
    return [];
  }

  return data;
}

/**
 * Get 360 survey by access token (for public survey access)
 */
export async function get360SurveyByToken(
  token: string
): Promise<{
  survey: Feedback360Survey | null;
  reviewer: Feedback360SurveyReviewer | null;
}> {
  // First get the reviewer by token
  const { data: reviewerData, error: reviewerError } = await supabase
    .from('feedback_360_survey_reviewers')
    .select('*')
    .eq('access_token', token)
    .single();

  if (reviewerError || !reviewerData) {
    console.error('Error fetching reviewer by token:', reviewerError);
    return { survey: null, reviewer: null };
  }

  const reviewer = reviewerData as Feedback360SurveyReviewer;

  // Then get the survey
  const survey = await get360Survey(reviewer.survey_id);

  return { survey, reviewer };
}

// ============================================================================
// DEPARTMENT QUERIES
// ============================================================================

/**
 * Get all departments (distinct values from user_profiles)
 */
export async function getDepartments(): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('department')
    .not('department', 'is', null)
    .order('department');

  if (error) {
    console.error('Error fetching departments:', error);
    return [];
  }

  // Get unique departments
  const departments = [...new Set(data.map((d) => d.department).filter(Boolean))];
  return departments as string[];
}

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Get user count by department
 */
export async function getUserCountByDepartment(): Promise<
  Record<string, number>
> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('department')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching user count by department:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  data.forEach((user) => {
    if (user.department) {
      counts[user.department] = (counts[user.department] || 0) + 1;
    }
  });

  return counts;
}

/**
 * Get total active user count
 */
export async function getActiveUserCount(): Promise<number> {
  const { count, error } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching active user count:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user exists by email
 */
export async function userExists(email: string): Promise<boolean> {
  const profile = await getUserProfileByEmail(email);
  return profile !== null;
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.app_role === 'admin';
}

/**
 * Check if user is leader or admin
 */
export async function isUserLeader(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.app_role === 'leader' || profile?.app_role === 'admin';
}

/**
 * Get user's manager
 */
export async function getUserManager(userId: string): Promise<UserProfile | null> {
  const user = await getUserProfile(userId);
  if (!user || !user.manager_id) {
    return null;
  }

  return getUserProfile(user.manager_id);
}
