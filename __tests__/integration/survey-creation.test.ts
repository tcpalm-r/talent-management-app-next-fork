/**
 * Integration Tests: Survey Creation & Authentication
 * 
 * These tests catch issues like the RLS refactoring bug where surveys
 * were created with wrong created_by values and disappeared.
 * 
 * Run with: npm test __tests__/integration/survey-creation.test.ts
 */

import { NextRequest } from 'next/server';
import { POST as createSurvey } from '@/app/api/surveys/create/route';
import { POST as saveDraft } from '@/app/api/surveys/save-draft/route';
import { GET as listSurveys } from '@/app/api/surveys/list/route';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

// Mock the auth wrapper to simulate authenticated users
jest.mock('@/lib/auth-wrapper');

// Mock Supabase
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

const mockAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;

describe('Survey Creation Integration Tests', () => {
  const mockProfile = {
    id: 'test-user-uuid-123',
    email: 'test@example.com',
    full_name: 'Test User',
    app_role: 'admin',
    app_permissions: {},
    department: 'Engineering',
    title: 'Engineer',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockUser = {
    id: mockProfile.id,
    email: mockProfile.email,
    full_name: mockProfile.full_name,
    app_role: mockProfile.app_role,
    app_permissions: mockProfile.app_permissions,
    department: mockProfile.department,
    title: mockProfile.title,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/surveys/create', () => {
    it('should use authenticated user ID, not client-provided ID', async () => {
      // Mock authentication
      mockAuthenticatedUser.mockResolvedValue({
        user: mockUser,
        profile: mockProfile as any,
      });

      // Mock Supabase insert
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'survey-123',
              employee_id: 'employee-456',
              survey_name: 'Test Survey',
              status: 'draft',
              created_by: mockProfile.id, // Should use authenticated user's ID
            },
            error: null,
          }),
        }),
      });

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        insert: mockInsert,
      });

      // Create request with WRONG user ID (simulating client tampering)
      const request = new NextRequest('http://localhost:3000/api/surveys/create', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'employee-456',
          surveyName: 'Test Survey',
          dueDate: '2024-12-31',
          requiredQuestions: ['Question 1'],
          customQuestions: [],
          raters: [{ name: 'Reviewer', email: 'reviewer@example.com', relationship: 'peer' }],
          // NOTE: No createdBy field should be sent by client
        }),
      });

      const response = await createSurvey(request);
      const data = await response.json();

      // Verify authentication was checked
      expect(mockAuthenticatedUser).toHaveBeenCalledWith(request);

      // Verify insert was called with authenticated user's ID
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: mockProfile.id, // Should use authenticated user's ID
        })
      );

      // Verify response is successful
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      // Mock failed authentication
      mockAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/surveys/create', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'employee-456',
          surveyName: 'Test Survey',
          dueDate: '2024-12-31',
          requiredQuestions: ['Question 1'],
          customQuestions: [],
          raters: [],
        }),
      });

      const response = await createSurvey(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should NOT accept client-provided createdBy field', async () => {
      mockAuthenticatedUser.mockResolvedValue({
        user: mockUser,
        profile: mockProfile as any,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'survey-123',
              created_by: mockProfile.id,
            },
            error: null,
          }),
        }),
      });

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        insert: mockInsert,
      });

      // Try to send a fake createdBy (client tampering attempt)
      const request = new NextRequest('http://localhost:3000/api/surveys/create', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'employee-456',
          surveyName: 'Test Survey',
          dueDate: '2024-12-31',
          createdBy: 'HACKER-ID', // Client tries to set wrong ID
          requiredQuestions: ['Question 1'],
          customQuestions: [],
          raters: [],
        }),
      });

      await createSurvey(request);

      // Verify the HACKER-ID was ignored and authenticated ID was used
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: mockProfile.id, // Should use authenticated user's ID, not 'HACKER-ID'
        })
      );
    });
  });

  describe('POST /api/surveys/save-draft', () => {
    it('should use authenticated user ID for draft surveys', async () => {
      mockAuthenticatedUser.mockResolvedValue({
        user: mockUser,
        profile: mockProfile as any,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'draft-survey-123',
              created_by: mockProfile.id,
              status: 'draft',
            },
            error: null,
          }),
        }),
      });

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        insert: mockInsert,
      });

      const request = new NextRequest('http://localhost:3000/api/surveys/save-draft', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: 'org-123',
          employeeId: 'employee-456',
          surveyTitle: 'Draft Survey',
          dueDate: '2024-12-31',
          requiredQuestions: ['Question 1'],
          customQuestions: [],
          raters: [],
          questionsConfirmed: false,
        }),
      });

      const response = await saveDraft(request);

      // Verify authentication was checked
      expect(mockAuthenticatedUser).toHaveBeenCalledWith(request);

      // Verify created_by uses authenticated user's ID
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: mockProfile.id,
        })
      );

      expect(response.status).toBe(200);
    });

    it('should reject unauthenticated draft save requests', async () => {
      mockAuthenticatedUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/surveys/save-draft', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: 'employee-456',
          surveyTitle: 'Draft Survey',
        }),
      });

      const response = await saveDraft(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Survey Visibility After Creation', () => {
    it('should make surveys visible to their creator immediately', async () => {
      // Mock authentication
      mockAuthenticatedUser.mockResolvedValue({
        user: mockUser,
        profile: mockProfile as any,
      });

      // Mock survey creation
      const createdSurvey = {
        id: 'survey-123',
        survey_name: 'Test Survey',
        status: 'draft',
        created_by: mockProfile.id, // Created with authenticated user's ID
        employee_id: 'employee-456',
        reviewers: [],
      };

      // Mock list query
      const mockOrder = jest.fn().mockResolvedValue({
        data: [createdSurvey],
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        select: mockSelect,
      });

      // List surveys
      const request = new NextRequest('http://localhost:3000/api/surveys/list');
      const response = await listSurveys(request);
      const data = await response.json();

      // Verify the survey is in the list (filtered by role)
      expect(data.surveys).toBeDefined();
      
      // For admin user, should see the survey
      const visibleSurvey = data.surveys.find((s: any) => s.id === createdSurvey.id);
      expect(visibleSurvey).toBeDefined();
      expect(visibleSurvey.created_by).toBe(mockProfile.id);
    });

    it('should filter out surveys with invalid created_by values', async () => {
      const regularUser = {
        ...mockUser,
        app_role: 'user',
      };
      const regularProfile = {
        ...mockProfile,
        app_role: 'user',
      };

      mockAuthenticatedUser.mockResolvedValue({
        user: regularUser,
        profile: regularProfile as any,
      });

      // Mock surveys - one valid, one with wrong created_by
      const surveys = [
        {
          id: 'valid-survey',
          survey_name: 'Valid Survey',
          created_by: mockProfile.id, // Correct
          employee_id: 'someone-else',
          status: 'draft',
          reviewers: [],
        },
        {
          id: 'invalid-survey',
          survey_name: 'Invalid Survey',
          created_by: 'unknown', // WRONG - should be filtered out
          employee_id: 'someone-else',
          status: 'draft',
          reviewers: [],
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({
        data: surveys,
        error: null,
      });

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: mockOrder,
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/surveys/list');
      const response = await listSurveys(request);
      const data = await response.json();

      // Should only see the valid survey
      expect(data.surveys).toHaveLength(1);
      expect(data.surveys[0].id).toBe('valid-survey');
      
      // Invalid survey should be filtered out
      const invalidSurvey = data.surveys.find((s: any) => s.id === 'invalid-survey');
      expect(invalidSurvey).toBeUndefined();
    });
  });

  describe('Role-Based Filtering', () => {
    it('admin should see all surveys regardless of created_by', async () => {
      const adminUser = {
        ...mockUser,
        app_role: 'admin',
      };
      const adminProfile = {
        ...mockProfile,
        app_role: 'admin',
      };

      mockAuthenticatedUser.mockResolvedValue({
        user: adminUser,
        profile: adminProfile as any,
      });

      const surveys = [
        { id: '1', created_by: 'other-user-1', employee_id: 'emp-1', reviewers: [] },
        { id: '2', created_by: 'other-user-2', employee_id: 'emp-2', reviewers: [] },
        { id: '3', created_by: adminProfile.id, employee_id: 'emp-3', reviewers: [] },
      ];

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: surveys,
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/surveys/list');
      const response = await listSurveys(request);
      const data = await response.json();

      // Admin should see ALL surveys
      expect(data.surveys).toHaveLength(3);
      expect(data.role).toBe('admin');
    });

    it('regular user should only see their own surveys', async () => {
      const regularUser = {
        ...mockUser,
        app_role: 'user',
      };
      const regularProfile = {
        ...mockProfile,
        app_role: 'user',
      };

      mockAuthenticatedUser.mockResolvedValue({
        user: regularUser,
        profile: regularProfile as any,
      });

      const surveys = [
        { id: '1', created_by: regularProfile.id, employee_id: 'emp-1', status: 'draft', reviewers: [] },
        { id: '2', created_by: 'other-user', employee_id: 'emp-2', status: 'draft', reviewers: [] },
        { id: '3', created_by: 'other-user', employee_id: regularProfile.id, status: 'finalized', reviewers: [] },
      ];

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: surveys,
            error: null,
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/surveys/list');
      const response = await listSurveys(request);
      const data = await response.json();

      // User should see: their own survey + finalized survey where they're subject
      expect(data.surveys).toHaveLength(2);
      expect(data.surveys.some((s: any) => s.id === '1')).toBe(true); // Own survey
      expect(data.surveys.some((s: any) => s.id === '3')).toBe(true); // Subject of finalized
      expect(data.surveys.some((s: any) => s.id === '2')).toBe(false); // Should not see
    });
  });
});

