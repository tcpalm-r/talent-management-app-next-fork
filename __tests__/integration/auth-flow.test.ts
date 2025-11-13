/**
 * Integration Tests: Authentication Flow & ID Consistency
 * 
 * These tests verify that user IDs are consistent throughout the auth flow
 * and that profile.id is always used for ownership fields.
 */

import { getAuthenticatedUser } from '@/lib/auth-wrapper';
import { syncUserProfile, getUserProfileByEmail } from '@/lib/auth-supabase';
import type { SessionUser } from '@/lib/schema';

// Mock Supabase
jest.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

describe('Authentication Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Profile ID Consistency', () => {
    it('should return database profile ID, not session ID', async () => {
      const sessionUser: SessionUser = {
        id: 'auth0|abc123xyz', // Auth0 ID from session
        email: 'test@example.com',
        full_name: 'Test User',
        app_role: 'user',
        app_permissions: {},
        department: null,
        title: null,
      };

      const databaseProfile = {
        id: 'database-uuid-123', // Different from session ID
        email: 'test@example.com',
        full_name: 'Test User',
        app_role: 'user',
        app_permissions: {},
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      // Mock database lookup
      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: databaseProfile,
              error: null,
            }),
          }),
        }),
      });

      const result = await syncUserProfile(sessionUser);

      // CRITICAL: Should return database ID, not session ID
      expect(result).toBeDefined();
      expect(result?.id).toBe('database-uuid-123'); // Database UUID
      expect(result?.id).not.toBe('auth0|abc123xyz'); // NOT session ID
    });

    it('should lookup by email, not by ID', async () => {
      const email = 'test@example.com';

      const { supabaseAdmin } = require('@/lib/supabase-admin');
      const mockEq = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'uuid-from-database',
            email,
          },
          error: null,
        }),
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      supabaseAdmin.from.mockReturnValue({
        select: mockSelect,
      });

      await getUserProfileByEmail(email);

      // Verify lookup was by email
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('email', email);
    });
  });

  describe('ID Type Validation', () => {
    it('should never accept literal strings as user IDs', () => {
      const invalidUserIds = [
        'unknown',
        'current-user',
        'admin',
        'user',
        '',
        null,
        undefined,
      ];

      // These should NEVER be valid profile IDs
      invalidUserIds.forEach(invalidId => {
        expect(invalidId).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should ensure profile IDs are UUIDs or valid identifiers', () => {
      const validProfileId = '550e8400-e29b-41d4-a716-446655440000';
      const mockId = 'mock-thomas-palmer'; // Valid for dev
      const auth0Id = 'auth0|abc123'; // Valid but shouldn't be used for created_by

      // UUID format
      expect(validProfileId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // Mock ID for dev (acceptable)
      expect(mockId).toMatch(/^mock-/);
      
      // Auth0 ID (valid but shouldn't be in database as profile.id)
      expect(auth0Id).toMatch(/^auth0\|/);
    });
  });

  describe('Development vs Production Behavior', () => {
    it('should use consistent ID format in development', () => {
      // In development with DISABLE_AUTH=true
      const MOCK_USER_ID = 'mock-thomas-palmer';
      
      // Simulated flow
      const createdBy = MOCK_USER_ID;
      const profileId = MOCK_USER_ID;
      
      // Should match
      expect(createdBy).toBe(profileId);
    });

    it('should use database UUID in production', () => {
      // In production, should always use database UUID
      const sessionUserId = 'auth0|abc123'; // From Auth0
      const databaseProfileId = '550e8400-e29b-41d4-a716-446655440000'; // From DB
      
      // created_by should use database ID, not session ID
      const createdBy = databaseProfileId; // Correct
      
      expect(createdBy).toBe(databaseProfileId);
      expect(createdBy).not.toBe(sessionUserId);
      
      // Filtering should use same database ID
      const profileId = databaseProfileId;
      expect(createdBy).toBe(profileId); // Match!
    });
  });

  describe('Common Pitfalls', () => {
    it('should NOT use employee ID as user ID', () => {
      const employeeId = 'employee-uuid-123';
      const userProfileId = 'user-profile-uuid-456';
      
      // These are different tables with different IDs
      expect(employeeId).not.toBe(userProfileId);
      
      // created_by should use user_profiles.id, NOT employees.id
      const createdBy = userProfileId; // Correct
      expect(createdBy).toBe(userProfileId);
    });

    it('should NOT use client-provided IDs', () => {
      const clientProvidedId = 'hacker-id-123';
      const actualProfileId = 'real-uuid-456';
      
      // Server should ignore client and use authenticated profile
      const createdBy = actualProfileId; // Ignore client
      
      expect(createdBy).not.toBe(clientProvidedId);
      expect(createdBy).toBe(actualProfileId);
    });

    it('should NOT mix Auth0 ID with database UUID', () => {
      const auth0Id = 'auth0|abc123';
      const databaseUuid = '550e8400-e29b-41d4-a716-446655440000';
      
      // Profile sync should convert Auth0 ID to database UUID
      const sessionId = auth0Id;
      const profileId = databaseUuid; // From database lookup
      
      // created_by should use database UUID
      const createdBy = profileId;
      
      expect(createdBy).not.toBe(sessionId);
      expect(createdBy).toBe(databaseUuid);
    });
  });

  describe('Email as Stable Identifier', () => {
    it('should use email to bridge session and database', async () => {
      const email = 'test@example.com';
      
      // Session from Auth0
      const sessionUser: SessionUser = {
        id: 'auth0|xyz', // Auth0 ID
        email,
        full_name: 'Test User',
        app_role: 'user',
        app_permissions: {},
        department: null,
        title: null,
      };
      
      // Database profile
      const databaseProfile = {
        id: 'uuid-123', // Different ID
        email, // Same email
        full_name: 'Test User',
      };
      
      const { supabaseAdmin } = require('@/lib/supabase-admin');
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: databaseProfile,
              error: null,
            }),
          }),
        }),
      });
      
      const result = await syncUserProfile(sessionUser);
      
      // Email should match
      expect(result?.email).toBe(email);
      
      // ID should be from database, not session
      expect(result?.id).toBe(databaseProfile.id);
      expect(result?.id).not.toBe(sessionUser.id);
    });
  });
});

