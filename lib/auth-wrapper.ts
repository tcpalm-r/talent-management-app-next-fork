/**
 * Authentication Wrapper
 *
 * High-level authentication functions that combine auth logic with Supabase.
 * Provides a unified interface for authentication operations.
 */

import { NextRequest } from 'next/server';
import {
  AUTH_DISABLED,
  MOCK_USER,
  getAuthenticatedUser as getAuthUser,
  validateSession,
} from './auth';
import {
  syncUserProfile,
  getUserProfileByEmail,
  updateLastLogin,
  toSessionUser,
} from './auth-supabase';
import type { SessionUser, UserProfile } from './schema';

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

/**
 * Get authenticated user with Supabase sync
 * This is the main function to use in API routes and server components
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<{ user: SessionUser; profile: UserProfile } | null> {
  // Check for user data from middleware headers
  // In dev mode with user switcher, this contains the switched user
  // In production, this contains the authenticated session user
  const userDataHeader = request.headers.get('x-user-data');
  if (userDataHeader) {
    try {
      const sessionUser = JSON.parse(userDataHeader) as SessionUser;
      console.log('[auth-wrapper] Using session user from middleware:', sessionUser.email);

      // Get the profile from Supabase
      const profile = await getUserProfileByEmail(sessionUser.email);
      if (profile) {
        return {
          user: toSessionUser(profile),
          profile,
        };
      }

      // If not in database, construct profile from session user data
      // This can happen in dev mode when testing with users not in the database
      return {
        user: sessionUser,
        profile: {
          ...sessionUser,
          auth0_id: sessionUser.auth0_id || null,
          given_name: sessionUser.given_name || sessionUser.full_name?.split(' ')[0] || '',
          family_name: sessionUser.family_name || sessionUser.full_name?.split(' ').slice(1).join(' ') || '',
          picture: sessionUser.picture || null,
          avatar_url: null,
          global_role: sessionUser.global_role || sessionUser.app_role,
          capabilities: sessionUser.capabilities || null,
          local_permissions: null,
          job_title: sessionUser.title || '',
          phone: null,
          location: null,
          manager_id: null,
          manager_email: null,
          employee_number: null,
          cost_center: null,
          external_id: null,
          has_logged_in: true,
          first_login_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
          sync_method: 'session',
          last_sync: null,
          is_active: true,
          scim_active: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: null,
          last_updated_by: null,
          idx: 0,
          app_access: sessionUser.app_access !== undefined ? sessionUser.app_access : true,
        } as UserProfile,
      };
    } catch (error) {
      console.error('[auth-wrapper] Failed to parse session user:', error);
    }
  }

  // Dev bypass mode
  if (AUTH_DISABLED) {
    // Try to get mock user from Supabase, or use hardcoded mock
    const mockProfile = await getUserProfileByEmail(MOCK_USER.email);

    if (mockProfile) {
      return {
        user: toSessionUser(mockProfile),
        profile: mockProfile,
      };
    }

    // Return hardcoded mock if not in database
    return {
      user: MOCK_USER,
      profile: {
        ...MOCK_USER,
        auth0_id: null,
        given_name: 'Thomas',
        family_name: 'Palmer',
        picture: null,
        avatar_url: null,
        global_role: 'admin',
        capabilities: null,
        local_permissions: null,
        job_title: 'Software Engineer',
        phone: null,
        location: null,
        manager_id: null,
        manager_email: null,
        employee_number: null,
        cost_center: null,
        external_id: null,
        has_logged_in: true,
        first_login_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        sync_method: 'mock',
        last_sync: null,
        is_active: true,
        scim_active: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
        last_updated_by: null,
        idx: 0,
        app_access: true,
      } as UserProfile,
    };
  }

  // Get authenticated user from session
  const user = await getAuthUser(request);
  if (!user) {
    return null;
  }

  // Sync with Supabase
  const profile = await syncUserProfile(user);
  if (!profile) {
    return null;
  }

  return {
    user: toSessionUser(profile),
    profile,
  };
}

/**
 * Validate and sync user session
 * Use this when you receive a session token from AI Intranet
 */
export async function validateAndSyncSession(
  sessionToken: string
): Promise<{ user: SessionUser; profile: UserProfile } | null> {
  // Dev bypass mode
  if (AUTH_DISABLED) {
    return getAuthenticatedUser({} as NextRequest);
  }

  // Validate session with AI Intranet
  const user = await validateSession(sessionToken);
  if (!user) {
    return null;
  }

  // Sync with Supabase
  const profile = await syncUserProfile(user);
  if (!profile) {
    return null;
  }

  // Update last login
  await updateLastLogin(user.email);

  return {
    user: toSessionUser(profile),
    profile,
  };
}

// ============================================================================
// USER PROFILE OPERATIONS
// ============================================================================

/**
 * Get user profile by email with full data
 */
export async function getUserProfile(
  email: string
): Promise<{ user: SessionUser; profile: UserProfile } | null> {
  const profile = await getUserProfileByEmail(email);
  if (!profile) {
    return null;
  }

  return {
    user: toSessionUser(profile),
    profile,
  };
}

/**
 * Refresh user profile from Supabase
 * Use this to get latest data after updates
 */
export async function refreshUserProfile(
  email: string
): Promise<UserProfile | null> {
  return getUserProfileByEmail(email);
}

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

/**
 * Check if request is from authenticated admin
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const authData = await getAuthenticatedUser(request);
  return authData?.user.app_role === 'admin';
}

/**
 * Check if request is from authenticated leader or admin
 */
export async function isLeaderOrAdmin(request: NextRequest): Promise<boolean> {
  const authData = await getAuthenticatedUser(request);
  const role = authData?.user.app_role;
  return role === 'admin' || role === 'leader';
}

/**
 * Require authentication - throws if not authenticated
 * Use this in API routes that require authentication
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: SessionUser; profile: UserProfile }> {
  const authData = await getAuthenticatedUser(request);

  if (!authData) {
    throw new Error('Unauthorized');
  }

  return authData;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: SessionUser; profile: UserProfile }> {
  const authData = await requireAuth(request);

  if (authData.user.app_role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  return authData;
}

/**
 * Require specific permission - throws if not permitted
 */
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<{ user: SessionUser; profile: UserProfile }> {
  const authData = await requireAuth(request);

  // Admins have all permissions
  if (authData.user.app_role === 'admin') {
    return authData;
  }

  // Check specific permission
  if (authData.user.app_permissions?.[permission] !== true) {
    throw new Error(`Forbidden: ${permission} permission required`);
  }

  return authData;
}

// ============================================================================
// SESSION HELPERS
// ============================================================================

/**
 * Create session for user
 * Returns session token and user data
 */
export async function createSession(
  email: string
): Promise<{ user: SessionUser; profile: UserProfile; sessionToken: string } | null> {
  // Dev bypass mode
  if (AUTH_DISABLED) {
    const authData = await getAuthenticatedUser({} as NextRequest);
    if (!authData) return null;

    return {
      ...authData,
      sessionToken: 'mock-session-token',
    };
  }

  // Get profile from Supabase
  const profile = await getUserProfileByEmail(email);
  if (!profile) {
    return null;
  }

  // Update last login
  await updateLastLogin(email);

  // In production, you'd generate a real session token here
  // For now, we rely on AI Intranet's session management
  const sessionToken = `session-${Date.now()}-${Math.random().toString(36)}`;

  return {
    user: toSessionUser(profile),
    profile,
    sessionToken,
  };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AuthData = {
  user: SessionUser;
  profile: UserProfile;
};

export type SessionData = AuthData & {
  sessionToken: string;
};
