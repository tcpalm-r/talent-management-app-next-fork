/**
 * Tests for auth.ts - Authentication Core Library
 */

import {
  AUTH_DISABLED,
  MOCK_USER,
  SESSION_COOKIE,
  USER_COOKIE,
  SESSION_DURATION,
  validateSession,
  getSessionFromRequest,
  getUserFromRequest,
  getAuthenticatedUser,
  createAuthenticatedResponse,
  clearAuthCookies,
  isProtectedRoute,
  hasPermission,
  hasRole,
  exchangeAIIntranetToken,
  getClientUser,
} from '../auth';
import { NextRequest, NextResponse } from 'next/server';
import { mockSessionUsers } from '../../test-utils/mockData';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('auth.ts - Constants', () => {
  it('should define AUTH_DISABLED constant', () => {
    expect(typeof AUTH_DISABLED).toBe('boolean');
  });

  it('should define MOCK_USER for development', () => {
    expect(MOCK_USER).toHaveProperty('id');
    expect(MOCK_USER).toHaveProperty('email');
    expect(MOCK_USER).toHaveProperty('full_name');
    expect(MOCK_USER).toHaveProperty('app_role');
    expect(MOCK_USER.app_role).toBe('admin');
  });

  it('should define cookie names', () => {
    expect(SESSION_COOKIE).toBe('ai-intranet-session');
    expect(USER_COOKIE).toBe('ai-intranet-user');
  });

  it('should define session duration', () => {
    expect(SESSION_DURATION).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('auth.ts - Session Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('validateSession', () => {
    it('should validate session token successfully', async () => {
      const mockUser = mockSessionUsers.admin;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      const result = await validateSession('valid-token');

      expect(result).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return null when token is invalid', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await validateSession('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when AI Intranet config is missing', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, AI_INTRANET_URL: '', APP_ID: '' };

      const result = await validateSession('token');

      expect(result).toBeNull();

      process.env = originalEnv;
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await validateSession('token');

      expect(result).toBeNull();
    });
  });

  describe.skip('getSessionFromRequest', () => {
    // Skip: Requires full Next.js edge runtime setup
    it('should extract session token from request cookies', () => {});
    it('should return null when no session cookie exists', () => {});
  });

  describe.skip('getUserFromRequest', () => {
    // Skip: Requires full Next.js edge runtime setup
    it('should extract and parse user from request cookies', () => {});
    it('should return null when no user cookie exists', () => {});
    it('should return null when user cookie is malformed', () => {});
  });

  describe.skip('getAuthenticatedUser', () => {
    // Skip: Requires full Next.js edge runtime setup
    it('should return MOCK_USER when AUTH_DISABLED is true', async () => {});
    it('should return cached user from cookie if available', async () => {});
    it('should validate session token when no cached user', async () => {});
    it('should return null when no session token and not dev mode', async () => {});
  });
});

describe.skip('auth.ts - Response Helpers', () => {
  // Skip: Requires full Next.js edge runtime setup
  describe('createAuthenticatedResponse', () => {
    it('should set user and session cookies', () => {});
    it('should set user cookie without session token', () => {});
  });

  describe('clearAuthCookies', () => {
    it('should delete auth cookies', () => {});
  });
});

describe('auth.ts - Route Protection', () => {
  describe('isProtectedRoute', () => {
    it('should return true for protected routes', () => {
      expect(isProtectedRoute('/')).toBe(true);
      expect(isProtectedRoute('/dashboard')).toBe(true);
      expect(isProtectedRoute('/employees')).toBe(true);
      expect(isProtectedRoute('/admin/settings')).toBe(true);
    });

    it('should return false for public routes', () => {
      expect(isProtectedRoute('/login')).toBe(false);
      expect(isProtectedRoute('/unauthorized')).toBe(false);
      expect(isProtectedRoute('/api/auth/login')).toBe(false);
      expect(isProtectedRoute('/api/auth/callback')).toBe(false);
      expect(isProtectedRoute('/api/auth/validate-token')).toBe(false);
      expect(isProtectedRoute('/api/debug')).toBe(false);
      expect(isProtectedRoute('/survey/complete/abc123')).toBe(false);
    });

    it('should handle routes with query parameters', () => {
      expect(isProtectedRoute('/survey/complete?token=abc')).toBe(false);
      expect(isProtectedRoute('/login?returnTo=/dashboard')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin users (admins have all permissions)', () => {
      const admin = mockSessionUsers.admin;

      expect(hasPermission(admin, 'manage_users')).toBe(true);
      expect(hasPermission(admin, 'any_permission')).toBe(true);
    });

    it('should return true when user has specific permission', () => {
      const leader = mockSessionUsers.leader;

      expect(hasPermission(leader, 'manage_surveys')).toBe(true);
      expect(hasPermission(leader, 'view_analytics')).toBe(true);
    });

    it('should return false when user lacks permission', () => {
      const user = mockSessionUsers.user;

      expect(hasPermission(user, 'manage_users')).toBe(false);
      expect(hasPermission(user, 'manage_surveys')).toBe(false);
    });

    it('should return false for null user', () => {
      expect(hasPermission(null, 'any_permission')).toBe(false);
    });

    it('should handle users without app_permissions object', () => {
      const userWithoutPerms = { ...mockSessionUsers.user, app_permissions: null };

      expect(hasPermission(userWithoutPerms, 'any_permission')).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has one of the specified roles', () => {
      const admin = mockSessionUsers.admin;
      const leader = mockSessionUsers.leader;
      const user = mockSessionUsers.user;

      expect(hasRole(admin, 'admin')).toBe(true);
      expect(hasRole(admin, 'admin', 'leader')).toBe(true);
      expect(hasRole(leader, 'leader', 'admin')).toBe(true);
      expect(hasRole(user, 'user')).toBe(true);
    });

    it('should return false when user does not have any specified role', () => {
      const user = mockSessionUsers.user;

      expect(hasRole(user, 'admin')).toBe(false);
      expect(hasRole(user, 'leader', 'admin')).toBe(false);
    });

    it('should return false for null user', () => {
      expect(hasRole(null, 'admin')).toBe(false);
    });
  });
});

describe('auth.ts - AI Intranet Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('exchangeAIIntranetToken', () => {
    it('should exchange token for session successfully', async () => {
      const mockUser = mockSessionUsers.admin;
      const mockSessionToken = 'new-session-token';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: mockUser,
          sessionToken: mockSessionToken,
        }),
      });

      const result = await exchangeAIIntranetToken('ai-intranet-token');

      expect(result).toEqual({
        user: mockUser,
        sessionToken: mockSessionToken,
      });
    });

    it('should return null when exchange fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await exchangeAIIntranetToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when config is missing', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, AI_INTRANET_URL: '', APP_ID: '' };

      const result = await exchangeAIIntranetToken('token');

      expect(result).toBeNull();

      process.env = originalEnv;
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await exchangeAIIntranetToken('token');

      expect(result).toBeNull();
    });
  });
});

describe('auth.ts - Client-Side Helpers', () => {
  describe('getClientUser', () => {
    beforeEach(() => {
      // Clear document.cookie
      if (typeof document !== 'undefined') {
        document.cookie = '';
      }
    });

    it('should return null in server-side environment', () => {
      const result = getClientUser();

      // This test runs in Node (server-side), so it should return null
      expect(result).toBeNull();
    });

    // Note: Full client-side cookie tests would require jsdom or browser environment
    // These tests are limited to what we can test in Node environment
  });
});
