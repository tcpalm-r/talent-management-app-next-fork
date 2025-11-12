/**
 * Tests for database.ts - Database Query Helpers
 */

import {
  getUserProfile,
  getUserProfileByEmail,
  getActiveUsers,
  getUsersByDepartment,
  getDirectReports,
  updateUserProfile,
  toSessionUser,
  getAssessmentsByUser,
  getAssessment,
  getPerformanceReviews,
  getActivePerformanceReviews,
  get360Questions,
  getDefault360Questions,
  get360Surveys,
  get360Survey,
  get360SurveyWithDetails,
  get360SurveyReviewers,
  get360SurveyResponses,
  get360SurveyByToken,
  getDepartments,
  getUserCountByDepartment,
  getActiveUserCount,
  userExists,
  isUserAdmin,
  isUserLeader,
  getUserManager,
} from '../database';
import { supabase } from '../supabase';
import {
  mockUserProfiles,
  mock360Questions,
  mock360Survey,
  mock360Reviewers,
  mock360Responses,
  mockAssessment,
  mockPerformanceReview,
  createMockUserProfile,
} from '../../test-utils/mockData';
import { mockSupabaseResponse, mockSupabaseQuery } from '../../test-utils/testHelpers';

// Mock the supabase client
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.MockedFunction<typeof supabase.from>;

describe('database.ts - User Profile Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should fetch user profile by ID successfully', async () => {
      const mockUser = mockUserProfiles.admin;
      const mockResponse = mockSupabaseResponse(mockUser, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserProfile(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    });

    it('should return null when user not found', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Not found' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserProfile('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Database error' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserProfile('user-id');

      expect(result).toBeNull();
    });
  });

  describe('getUserProfileByEmail', () => {
    it('should fetch user profile by email successfully', async () => {
      const mockUser = mockUserProfiles.admin;
      const mockResponse = mockSupabaseResponse(mockUser, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserProfileByEmail(mockUser.email);

      expect(result).toEqual(mockUser);
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    });

    it('should return null when no user found (PGRST116 error)', async () => {
      const mockResponse = mockSupabaseResponse(null, { code: 'PGRST116' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserProfileByEmail('nonexistent@test.com');

      expect(result).toBeNull();
    });

    it('should handle other database errors', async () => {
      const mockResponse = mockSupabaseResponse(null, { code: 'OTHER_ERROR', message: 'Error' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserProfileByEmail('test@test.com');

      expect(result).toBeNull();
    });
  });

  describe('getActiveUsers', () => {
    it('should fetch all active users', async () => {
      const activeUsers = [mockUserProfiles.admin, mockUserProfiles.leader, mockUserProfiles.user];
      const mockResponse = mockSupabaseResponse(activeUsers, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getActiveUsers();

      expect(result).toEqual(activeUsers);
      expect(result).toHaveLength(3);
    });

    it('should return empty array on error', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Error' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getActiveUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getUsersByDepartment', () => {
    it('should fetch users by department', async () => {
      const engineeringUsers = [mockUserProfiles.leader, mockUserProfiles.user];
      const mockResponse = mockSupabaseResponse(engineeringUsers, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUsersByDepartment('Engineering');

      expect(result).toEqual(engineeringUsers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for department with no users', async () => {
      const mockResponse = mockSupabaseResponse([], null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUsersByDepartment('Nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getDirectReports', () => {
    it('should fetch direct reports for a manager', async () => {
      const directReports = [mockUserProfiles.user];
      const mockResponse = mockSupabaseResponse(directReports, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getDirectReports(mockUserProfiles.leader.id);

      expect(result).toEqual(directReports);
      expect(result).toHaveLength(1);
    });

    it('should return empty array for manager with no reports', async () => {
      const mockResponse = mockSupabaseResponse([], null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getDirectReports('manager-with-no-reports');

      expect(result).toEqual([]);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const updates = { title: 'Senior Engineer' };
      const updatedUser = { ...mockUserProfiles.user, ...updates };
      const mockResponse = mockSupabaseResponse(updatedUser, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await updateUserProfile(mockUserProfiles.user.id, updates);

      expect(result).toEqual(updatedUser);
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
    });

    it('should return null on update error', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Update failed' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await updateUserProfile('user-id', { title: 'New Title' });

      expect(result).toBeNull();
    });
  });

  describe('toSessionUser', () => {
    it('should convert UserProfile to SessionUser', () => {
      const userProfile = mockUserProfiles.admin;
      const sessionUser = toSessionUser(userProfile);

      expect(sessionUser).toEqual({
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name,
        app_role: userProfile.app_role,
        app_permissions: userProfile.app_permissions,
        department: userProfile.department,
        title: userProfile.title,
      });
    });

    it('should handle missing app_role and app_permissions', () => {
      const userProfile = createMockUserProfile({
        app_role: null,
        app_permissions: null,
      });

      const sessionUser = toSessionUser(userProfile);

      expect(sessionUser.app_role).toBe('user');
      expect(sessionUser.app_permissions).toEqual({});
    });
  });
});

describe('database.ts - Assessment Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssessmentsByUser', () => {
    it('should fetch assessments for a user', async () => {
      const assessments = [mockAssessment];
      const mockResponse = mockSupabaseResponse(assessments, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getAssessmentsByUser('user-standard-001');

      expect(result).toEqual(assessments);
    });

    it('should return empty array when no assessments found', async () => {
      const mockResponse = mockSupabaseResponse([], null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getAssessmentsByUser('user-no-assessments');

      expect(result).toEqual([]);
    });
  });

  describe('getAssessment', () => {
    it('should fetch assessment by ID', async () => {
      const mockResponse = mockSupabaseResponse(mockAssessment, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getAssessment(mockAssessment.id);

      expect(result).toEqual(mockAssessment);
    });
  });
});

describe('database.ts - Performance Review Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPerformanceReviews', () => {
    it('should fetch all performance reviews', async () => {
      const reviews = [mockPerformanceReview];
      const mockResponse = mockSupabaseResponse(reviews, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getPerformanceReviews();

      expect(result).toEqual(reviews);
    });
  });

  describe('getActivePerformanceReviews', () => {
    it('should fetch only active performance reviews', async () => {
      const activeReviews = [mockPerformanceReview];
      const mockResponse = mockSupabaseResponse(activeReviews, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getActivePerformanceReviews();

      expect(result).toEqual(activeReviews);
    });
  });
});

describe('database.ts - 360 Feedback Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get360Questions', () => {
    it('should fetch all active 360 questions', async () => {
      const mockResponse = mockSupabaseResponse(mock360Questions, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await get360Questions();

      expect(result).toEqual(mock360Questions);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getDefault360Questions', () => {
    it('should fetch only default 360 questions', async () => {
      const defaultQuestions = mock360Questions.filter(q => q.is_default);
      const mockResponse = mockSupabaseResponse(defaultQuestions, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getDefault360Questions();

      expect(result).toEqual(defaultQuestions);
      expect(result.every(q => q.is_default)).toBe(true);
    });
  });

  describe('get360Surveys', () => {
    it('should fetch surveys for an employee', async () => {
      const surveys = [mock360Survey];
      const mockResponse = mockSupabaseResponse(surveys, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await get360Surveys('user-standard-001');

      expect(result).toEqual(surveys);
    });
  });

  describe('get360Survey', () => {
    it('should fetch survey by ID', async () => {
      const mockResponse = mockSupabaseResponse(mock360Survey, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await get360Survey(mock360Survey.id);

      expect(result).toEqual(mock360Survey);
    });
  });

  describe('get360SurveyReviewers', () => {
    it('should fetch reviewers for a survey', async () => {
      const mockResponse = mockSupabaseResponse(mock360Reviewers, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await get360SurveyReviewers('survey-001');

      expect(result).toEqual(mock360Reviewers);
    });
  });

  describe('get360SurveyByToken', () => {
    it('should fetch survey and reviewer by access token', async () => {
      const reviewer = mock360Reviewers[0];
      const reviewerResponse = mockSupabaseResponse(reviewer, null);
      const surveyResponse = mockSupabaseResponse(mock360Survey, null);

      mockFrom
        .mockReturnValueOnce(mockSupabaseQuery(reviewerResponse) as any)
        .mockReturnValueOnce(mockSupabaseQuery(surveyResponse) as any);

      const result = await get360SurveyByToken('token-001');

      expect(result.reviewer).toEqual(reviewer);
      expect(result.survey).toEqual(mock360Survey);
    });

    it('should return nulls when token is invalid', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Not found' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await get360SurveyByToken('invalid-token');

      expect(result.reviewer).toBeNull();
      expect(result.survey).toBeNull();
    });
  });
});

describe('database.ts - Department Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDepartments', () => {
    it('should fetch unique departments', async () => {
      const departmentData = [
        { department: 'Engineering' },
        { department: 'Engineering' },
        { department: 'Marketing' },
        { department: 'Sales' },
      ];
      const mockResponse = mockSupabaseResponse(departmentData, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getDepartments();

      expect(result).toEqual(['Engineering', 'Marketing', 'Sales']);
      expect(result.length).toBe(3);
    });

    it('should filter out null departments', async () => {
      const departmentData = [
        { department: 'Engineering' },
        { department: null },
        { department: 'Marketing' },
      ];
      const mockResponse = mockSupabaseResponse(departmentData, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getDepartments();

      expect(result).toEqual(['Engineering', 'Marketing']);
      expect(result).not.toContain(null);
    });
  });
});

describe('database.ts - Statistics Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserCountByDepartment', () => {
    it('should return user counts grouped by department', async () => {
      const userData = [
        { department: 'Engineering' },
        { department: 'Engineering' },
        { department: 'Marketing' },
        { department: 'Sales' },
        { department: 'Sales' },
        { department: 'Sales' },
      ];
      const mockResponse = mockSupabaseResponse(userData, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserCountByDepartment();

      expect(result).toEqual({
        Engineering: 2,
        Marketing: 1,
        Sales: 3,
      });
    });

    it('should return empty object on error', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Error' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserCountByDepartment();

      expect(result).toEqual({});
    });
  });

  describe('getActiveUserCount', () => {
    it('should return total count of active users', async () => {
      const mockResponse = { ...mockSupabaseResponse(null, null), count: 42 };

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getActiveUserCount();

      expect(result).toBe(42);
    });

    it('should return 0 on error', async () => {
      const mockResponse = mockSupabaseResponse(null, { message: 'Error' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getActiveUserCount();

      expect(result).toBe(0);
    });
  });
});

describe('database.ts - Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      const mockResponse = mockSupabaseResponse(mockUserProfiles.admin, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await userExists('admin@test.com');

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      const mockResponse = mockSupabaseResponse(null, { code: 'PGRST116' });

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await userExists('nonexistent@test.com');

      expect(result).toBe(false);
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for admin user', async () => {
      const mockResponse = mockSupabaseResponse(mockUserProfiles.admin, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await isUserAdmin(mockUserProfiles.admin.id);

      expect(result).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      const mockResponse = mockSupabaseResponse(mockUserProfiles.user, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await isUserAdmin(mockUserProfiles.user.id);

      expect(result).toBe(false);
    });
  });

  describe('isUserLeader', () => {
    it('should return true for leader', async () => {
      const mockResponse = mockSupabaseResponse(mockUserProfiles.leader, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await isUserLeader(mockUserProfiles.leader.id);

      expect(result).toBe(true);
    });

    it('should return true for admin (admins are also leaders)', async () => {
      const mockResponse = mockSupabaseResponse(mockUserProfiles.admin, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await isUserLeader(mockUserProfiles.admin.id);

      expect(result).toBe(true);
    });

    it('should return false for regular user', async () => {
      const mockResponse = mockSupabaseResponse(mockUserProfiles.user, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await isUserLeader(mockUserProfiles.user.id);

      expect(result).toBe(false);
    });
  });

  describe('getUserManager', () => {
    it('should return manager profile', async () => {
      const user = mockUserProfiles.user;
      const manager = mockUserProfiles.leader;

      mockFrom
        .mockReturnValueOnce(mockSupabaseQuery(mockSupabaseResponse(user, null)) as any)
        .mockReturnValueOnce(mockSupabaseQuery(mockSupabaseResponse(manager, null)) as any);

      const result = await getUserManager(user.id);

      expect(result).toEqual(manager);
    });

    it('should return null when user has no manager', async () => {
      const user = { ...mockUserProfiles.admin, manager_id: null };
      const mockResponse = mockSupabaseResponse(user, null);

      mockFrom.mockReturnValue(
        mockSupabaseQuery(mockResponse) as any
      );

      const result = await getUserManager(user.id);

      expect(result).toBeNull();
    });
  });
});
