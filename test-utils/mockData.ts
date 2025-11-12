/**
 * Mock Data Fixtures
 *
 * Reusable test data for consistent testing across the application
 */

import type {
  UserProfile,
  SessionUser,
  Survey360,
  Survey360Response,
  Survey360Participant,
  Feedback360Question,
  Feedback360Survey,
  Feedback360SurveyReviewer,
  Assessment,
  PerformanceReview,
} from '@/lib/schema';
import { mockUuid, mockDate } from './testHelpers';

// ============================================================================
// USER PROFILES & SESSION
// ============================================================================

export const mockUserProfiles = {
  admin: {
    id: 'user-admin-001',
    auth0_id: 'auth0|admin',
    email: 'admin@test.com',
    full_name: 'Admin User',
    given_name: 'Admin',
    family_name: 'User',
    picture: null,
    avatar_url: null,
    global_role: 'admin',
    app_role: 'admin',
    role: 'admin',
    app_permissions: {
      manage_users: true,
      manage_reviews: true,
      manage_surveys: true,
      view_analytics: true,
    },
    app_access: true,
    capabilities: null,
    local_permissions: null,
    department: 'Engineering',
    title: 'CTO',
    job_title: 'Chief Technology Officer',
    phone: '555-0001',
    location: 'San Francisco',
    manager_id: null,
    manager_email: null,
    employee_number: 'EMP001',
    cost_center: 'CC001',
    external_id: 'ext-001',
    has_logged_in: true,
    first_login_at: mockDate(-30),
    last_login_at: mockDate(-1),
    sync_method: 'manual',
    last_sync: mockDate(-1),
    is_active: true,
    scim_active: true,
    created_at: mockDate(-90),
    updated_at: mockDate(-1),
    created_by: null,
    last_updated_by: null,
    idx: 1,
  } as UserProfile,

  leader: {
    id: 'user-leader-001',
    auth0_id: 'auth0|leader',
    email: 'leader@test.com',
    full_name: 'Leader User',
    given_name: 'Leader',
    family_name: 'User',
    picture: null,
    avatar_url: null,
    global_role: 'leader',
    app_role: 'leader',
    role: 'leader',
    app_permissions: {
      manage_surveys: true,
      view_analytics: true,
    },
    app_access: true,
    capabilities: null,
    local_permissions: null,
    department: 'Engineering',
    title: 'Engineering Manager',
    job_title: 'Engineering Manager',
    phone: '555-0002',
    location: 'San Francisco',
    manager_id: 'user-admin-001',
    manager_email: 'admin@test.com',
    employee_number: 'EMP002',
    cost_center: 'CC001',
    external_id: 'ext-002',
    has_logged_in: true,
    first_login_at: mockDate(-25),
    last_login_at: mockDate(-1),
    sync_method: 'manual',
    last_sync: mockDate(-1),
    is_active: true,
    scim_active: true,
    created_at: mockDate(-80),
    updated_at: mockDate(-1),
    created_by: null,
    last_updated_by: null,
    idx: 2,
  } as UserProfile,

  user: {
    id: 'user-standard-001',
    auth0_id: 'auth0|user',
    email: 'user@test.com',
    full_name: 'Standard User',
    given_name: 'Standard',
    family_name: 'User',
    picture: null,
    avatar_url: null,
    global_role: 'user',
    app_role: 'user',
    role: 'user',
    app_permissions: {},
    app_access: true,
    capabilities: null,
    local_permissions: null,
    department: 'Engineering',
    title: 'Software Engineer',
    job_title: 'Software Engineer',
    phone: '555-0003',
    location: 'San Francisco',
    manager_id: 'user-leader-001',
    manager_email: 'leader@test.com',
    employee_number: 'EMP003',
    cost_center: 'CC001',
    external_id: 'ext-003',
    has_logged_in: true,
    first_login_at: mockDate(-20),
    last_login_at: mockDate(-2),
    sync_method: 'manual',
    last_sync: mockDate(-2),
    is_active: true,
    scim_active: true,
    created_at: mockDate(-70),
    updated_at: mockDate(-2),
    created_by: null,
    last_updated_by: null,
    idx: 3,
  } as UserProfile,

  inactive: {
    id: 'user-inactive-001',
    auth0_id: 'auth0|inactive',
    email: 'inactive@test.com',
    full_name: 'Inactive User',
    given_name: 'Inactive',
    family_name: 'User',
    picture: null,
    avatar_url: null,
    global_role: 'user',
    app_role: 'user',
    role: 'user',
    app_permissions: {},
    app_access: false,
    capabilities: null,
    local_permissions: null,
    department: 'Engineering',
    title: 'Software Engineer',
    job_title: 'Software Engineer',
    phone: '555-0004',
    location: 'San Francisco',
    manager_id: 'user-leader-001',
    manager_email: 'leader@test.com',
    employee_number: 'EMP004',
    cost_center: 'CC001',
    external_id: 'ext-004',
    has_logged_in: false,
    first_login_at: null,
    last_login_at: null,
    sync_method: 'manual',
    last_sync: mockDate(-30),
    is_active: false,
    scim_active: false,
    created_at: mockDate(-60),
    updated_at: mockDate(-30),
    created_by: null,
    last_updated_by: null,
    idx: 4,
  } as UserProfile,
};

export const mockSessionUsers = {
  admin: {
    id: 'user-admin-001',
    email: 'admin@test.com',
    full_name: 'Admin User',
    app_role: 'admin',
    app_permissions: {
      manage_users: true,
      manage_reviews: true,
      manage_surveys: true,
      view_analytics: true,
    },
    department: 'Engineering',
    title: 'CTO',
  } as SessionUser,

  leader: {
    id: 'user-leader-001',
    email: 'leader@test.com',
    full_name: 'Leader User',
    app_role: 'leader',
    app_permissions: {
      manage_surveys: true,
      view_analytics: true,
    },
    department: 'Engineering',
    title: 'Engineering Manager',
  } as SessionUser,

  user: {
    id: 'user-standard-001',
    email: 'user@test.com',
    full_name: 'Standard User',
    app_role: 'user',
    app_permissions: {},
    department: 'Engineering',
    title: 'Software Engineer',
  } as SessionUser,
};

// ============================================================================
// 360 FEEDBACK
// ============================================================================

export const mock360Questions: Feedback360Question[] = [
  {
    id: 'q-001',
    question_text: 'What are this person\'s greatest strengths?',
    category: 'general',
    is_default: true,
    is_active: true,
    display_order: 1,
    created_by: 'user-admin-001',
    created_at: mockDate(-90),
    updated_at: mockDate(-90),
    updated_by: null,
  },
  {
    id: 'q-002',
    question_text: 'What areas could this person improve?',
    category: 'general',
    is_default: true,
    is_active: true,
    display_order: 2,
    created_by: 'user-admin-001',
    created_at: mockDate(-90),
    updated_at: mockDate(-90),
    updated_by: null,
  },
  {
    id: 'q-003',
    question_text: 'How well does this person collaborate with others?',
    category: 'collaboration',
    is_default: false,
    is_active: true,
    display_order: 3,
    created_by: 'user-admin-001',
    created_at: mockDate(-90),
    updated_at: mockDate(-90),
    updated_by: null,
  },
];

export const mock360Survey: Feedback360Survey = {
  id: 'survey-001',
  employee_id: 'user-standard-001',
  created_by: 'user-leader-001',
  status: 'active',
  survey_name: 'Q1 2024 360 Review - Standard User',
  due_date: mockDate(30),
  sent_at: mockDate(-7),
  completed_at: null,
  flagged_for_admin: false,
  flagged_for_reanalysis: false,
  reanalysis_requested_at: null,
  reanalysis_requested_by: null,
  is_anonymous: true,
  created_at: mockDate(-14),
  updated_at: mockDate(-7),
};

export const mock360Reviewers: Feedback360SurveyReviewer[] = [
  {
    id: 'reviewer-001',
    survey_id: 'survey-001',
    reviewer_email: 'peer1@test.com',
    reviewer_name: 'Peer One',
    status: 'completed',
    access_token: 'token-001',
    invited_at: mockDate(-7),
    started_at: mockDate(-5),
    completed_at: mockDate(-3),
    email_sent_at: mockDate(-7),
    email_error: null,
    last_reminder_sent_at: null,
    last_reminder_at: null,
    reminder_count: 0,
    created_at: mockDate(-7),
  },
  {
    id: 'reviewer-002',
    survey_id: 'survey-001',
    reviewer_email: 'peer2@test.com',
    reviewer_name: 'Peer Two',
    status: 'pending',
    access_token: 'token-002',
    invited_at: mockDate(-7),
    started_at: null,
    completed_at: null,
    email_sent_at: mockDate(-7),
    email_error: null,
    last_reminder_sent_at: mockDate(-1),
    last_reminder_at: mockDate(-1),
    reminder_count: 1,
    created_at: mockDate(-7),
  },
];

export const mock360Responses: Survey360Response[] = [
  {
    id: 'response-001',
    survey_id: 'survey-001',
    participant_id: 'reviewer-001',
    responses: {
      'q-001': 'Great communication skills and team player',
      'q-002': 'Could improve time management',
      'q-003': 'Excellent collaborator, always willing to help',
    },
    submitted_at: mockDate(-3),
    created_at: mockDate(-3),
    updated_at: mockDate(-3),
  },
];

// ============================================================================
// ASSESSMENTS & PERFORMANCE REVIEWS
// ============================================================================

export const mockAssessment: Assessment = {
  id: 'assessment-001',
  user_id: 'user-standard-001',
  assessment_type: 'self_assessment',
  assessor_id: 'user-standard-001',
  performance_review_id: 'review-001',
  framework_type: 'ideal_team_player',
  status: 'completed',
  submitted_at: mockDate(-5),
  created_at: mockDate(-10),
  updated_at: mockDate(-5),
};

export const mockPerformanceReview: PerformanceReview = {
  id: 'review-001',
  name: 'Q1 2024 Performance Review',
  description: 'Quarterly performance review cycle',
  review_type: 'quarterly',
  framework: 'ideal_team_player',
  status: 'active',
  start_date: mockDate(-30),
  end_date: mockDate(30),
  settings: {
    allow_self_assessment: true,
    require_manager_assessment: true,
  },
  created_by: 'user-admin-001',
  created_at: mockDate(-40),
  updated_at: mockDate(-30),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a custom mock user profile
 */
export function createMockUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    ...mockUserProfiles.user,
    id: mockUuid('user'),
    email: `test-${mockUuid()}@test.com`,
    ...overrides,
  };
}

/**
 * Create a custom mock session user
 */
export function createMockSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    ...mockSessionUsers.user,
    id: mockUuid('user'),
    email: `test-${mockUuid()}@test.com`,
    ...overrides,
  };
}

/**
 * Create a custom mock 360 survey
 */
export function createMock360Survey(overrides: Partial<Feedback360Survey> = {}): Feedback360Survey {
  return {
    ...mock360Survey,
    id: mockUuid('survey'),
    ...overrides,
  };
}

/**
 * Create a list of mock users for testing
 */
export function createMockUserList(count: number): UserProfile[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUserProfile({
      id: `user-${i + 1}`,
      email: `user${i + 1}@test.com`,
      full_name: `Test User ${i + 1}`,
      employee_number: `EMP${String(i + 1).padStart(3, '0')}`,
    })
  );
}
