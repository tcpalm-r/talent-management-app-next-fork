/**
 * Authentication Core Library
 *
 * Handles AI Intranet authentication with dev bypass mode.
 * Integrates with existing DISABLE_AUTH environment variable.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SessionUser } from './schema';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Check if authentication is disabled (dev mode)
 * Checks NEXT_PUBLIC_DISABLE_AUTH environment variable at build time
 * This enables mock authentication mode for development and testing
 */
export const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
  process.env.DISABLE_AUTH?.trim() === 'true';

/**
 * Mock user for local development (Thomas Palmer)
 * Structure matches production session format exactly
 * IMPORTANT: Uses REAL database ID for authorization checks to work
 */
export const MOCK_USER: SessionUser = {
  id: '5b1e1ee7-5850-4b7f-8881-9304c17ab63f', // Real DB ID from employees table
  auth0_id: 'thomas.palmer@sonance.com',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  given_name: 'Thomas',
  family_name: 'Palmer',
  picture: undefined,
  app_role: 'admin', // Updated to match database value
  app_permissions: {
    manage_users: true,
    manage_reviews: true,
    manage_surveys: true,
    view_analytics: true,
  },
  global_role: 'admin',
  capabilities: [],
  app_access: true,
  department: 'Engineering',
  title: 'Software Engineer',
};

/**
 * Test users for local development user switching
 * Hardcoded with exact database IDs and roles for testing
 */
export const TEST_USERS: SessionUser[] = [
  MOCK_USER, // Thomas Palmer - Admin
  {
    id: 'e57dcddb-5249-4b76-894f-f44636e43d17',
    auth0_id: 'mikes@sonance.com',
    email: 'mikes@sonance.com',
    full_name: 'Mike Sonntag',
    given_name: 'Mike',
    family_name: 'Sonntag',
    picture: null,
    app_role: 'slt',
    app_permissions: {
      read: true,
      admin: true,
      write: true,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: 'Sales',
    title: 'Chief Revenue Officer - Commercial',
  },
  {
    id: '62ec7ec5-784e-48a2-849d-0ddb4bdd9f94',
    auth0_id: 'user3.test@example.com',
    email: 'user3.test@example.com',
    full_name: 'User 3 [TEST]',
    given_name: null,
    family_name: null,
    picture: null,
    app_role: 'user',
    app_permissions: {
      read: true,
      admin: false,
      write: false,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: null,
    title: 'Product Designer',
  },
  {
    id: '076bbd75-fce2-471a-a621-dc55070b37ba',
    auth0_id: 'user4.test@example.com',
    email: 'user4.test@example.com',
    full_name: 'User 4 [TEST]',
    given_name: null,
    family_name: null,
    picture: null,
    app_role: 'user',
    app_permissions: {
      read: true,
      admin: false,
      write: false,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: null,
    title: 'Junior Product Designer',
  },
  {
    id: '13fac9a4-c05f-4490-86df-af0fac7edbf6',
    auth0_id: 'derickd@sonance.com',
    email: 'derickd@sonance.com',
    full_name: 'Derick Dahl',
    given_name: 'Derick',
    family_name: 'Dahl',
    picture: 'https://s.gravatar.com/avatar/e0de550688b11955b082e1a706ff451a?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fdd.png',
    app_role: 'leader',
    app_permissions: {
      read: true,
      admin: false,
      write: true,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: 'Product Management',
    title: 'Head of Technology and Innovation',
  },
  {
    id: 'ed37dc13-9b28-4a18-8f88-c46b9d195fdf',
    auth0_id: 'admin.test@example.com',
    email: 'admin.test@example.com',
    full_name: 'Admin [TEST]',
    given_name: null,
    family_name: null,
    picture: null,
    app_role: 'admin',
    app_permissions: {
      read: true,
      admin: true,
      write: true,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: null,
    title: 'Chief People Officer',
  },
  {
    id: 'a9d7553c-e416-47fc-ba1a-f4cb53425b12',
    auth0_id: 'leader1.test@example.com',
    email: 'leader1.test@example.com',
    full_name: 'Leader 1 [TEST]',
    given_name: null,
    family_name: null,
    picture: null,
    app_role: 'leader',
    app_permissions: {
      read: true,
      admin: false,
      write: true,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: null,
    title: 'Engineering Manager',
  },
  {
    id: '9425a392-8833-4fb0-9065-9ceb54c827d7',
    auth0_id: 'slt1.test@example.com',
    email: 'slt1.test@example.com',
    full_name: 'SLT 1 [TEST]',
    given_name: null,
    family_name: null,
    picture: null,
    app_role: 'slt',
    app_permissions: {
      read: true,
      admin: false,
      write: true,
    },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: null,
    title: 'Product Manager',
  },
];

/**
 * Cookie names
 */
export const SESSION_COOKIE = 'ai-intranet-session';
export const USER_COOKIE = 'ai-intranet-user';

/**
 * Session duration (7 days)
 */
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Validate session token with AI Intranet
 * Returns user data if valid, null otherwise
 */
export async function validateSession(token: string): Promise<SessionUser | null> {
  try {
    const aiIntranetUrl = process.env.AI_INTRANET_URL || process.env.NEXT_PUBLIC_AI_INTRANET_URL;
    const appId = process.env.APP_ID || process.env.NEXT_PUBLIC_APP_ID;
    const appApiKey = process.env.APP_API_KEY;

    if (!aiIntranetUrl || !appId) {
      console.error('AI Intranet configuration missing');
      return null;
    }

    const response = await fetch(`${aiIntranetUrl}/api/auth/validate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-ID': appId,
        ...(appApiKey && { 'X-App-API-Key': appApiKey }),
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * Get session from request cookies
 */
export function getSessionFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value || null;
}

/**
 * Get user from request cookies
 */
export function getUserFromRequest(request: NextRequest): SessionUser | null {
  const userCookie = request.cookies.get(USER_COOKIE)?.value;
  if (!userCookie) return null;

  try {
    return JSON.parse(decodeURIComponent(userCookie));
  } catch {
    return null;
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE HELPERS
// ============================================================================

/**
 * Check if request is authenticated
 * Returns user if authenticated, null otherwise
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<SessionUser | null> {
  // Dev bypass mode - return mock user
  if (AUTH_DISABLED) {
    return MOCK_USER;
  }

  // Try to get user from cookie first (cached)
  const cachedUser = getUserFromRequest(request);
  if (cachedUser) {
    return cachedUser;
  }

  // Validate session token
  const sessionToken = getSessionFromRequest(request);
  if (!sessionToken) {
    return null;
  }

  const user = await validateSession(sessionToken);
  return user;
}

/**
 * Create authenticated response with user cookies
 */
export function createAuthenticatedResponse(
  response: NextResponse,
  user: SessionUser,
  sessionToken?: string
): NextResponse {
  // Set user cookie
  response.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)), {
    httpOnly: false, // Accessible to JavaScript for client-side use
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  // Set session cookie if provided
  if (sessionToken) {
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true, // Not accessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/',
    });
  }

  return response;
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(USER_COOKIE);
  return response;
}

// ============================================================================
// ROUTE PROTECTION
// ============================================================================

/**
 * Check if route requires authentication
 */
export function isProtectedRoute(pathname: string): boolean {
  const publicRoutes = [
    '/unauthorized',
    '/login',                    // Login page
    '/api/auth',                 // All Auth0 routes (login, callback, logout, me)
    '/api/auth/validate-token',
    '/api/debug',                // Debug endpoints
    '/survey/complete',          // Public survey completion
  ];

  // Check if route starts with any public route
  return !publicRoutes.some(route => pathname.startsWith(route));
}


/**
 * Check if user has required role
 */
export function hasRole(user: SessionUser | null, ...roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.app_role);
}

// ============================================================================
// AI INTRANET INTEGRATION
// ============================================================================

/**
 * Exchange AI Intranet token for session
 */
export async function exchangeAIIntranetToken(
  token: string
): Promise<{ user: SessionUser; sessionToken: string } | null> {
  try {
    const aiIntranetUrl = process.env.AI_INTRANET_URL || process.env.NEXT_PUBLIC_AI_INTRANET_URL;
    const appId = process.env.APP_ID || process.env.NEXT_PUBLIC_APP_ID;
    const appApiKey = process.env.APP_API_KEY;

    if (!aiIntranetUrl || !appId) {
      console.error('AI Intranet configuration missing');
      return null;
    }

    const response = await fetch(`${aiIntranetUrl}/api/auth/exchange-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-ID': appId,
        ...(appApiKey && { 'X-App-API-Key': appApiKey }),
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      user: data.user,
      sessionToken: data.sessionToken,
    };
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
}

// ============================================================================
// CLIENT-SIDE AUTH HELPERS
// ============================================================================

/**
 * Get user from cookie (client-side)
 *
 * UNIFIED COOKIE APPROACH:
 * - Production: Uses ai-intranet-user cookie from real authentication
 * - Dev mode: Uses ai-intranet-user cookie from user switcher or DISABLE_AUTH
 * - This ensures dev mode perfectly replicates production behavior
 *
 * Cookie priority:
 * 1. ai-intranet-user (production sessions AND dev user switcher)
 * 2. user-session (legacy, backward compatibility)
 * 3. MOCK_USER fallback if no session found in dev mode
 */
export function getClientUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';');

  // Check for authenticated user session (ai-intranet-user)
  // This cookie is used by BOTH production and dev mode (via user switcher)
  let userCookie = cookies
    .find(c => c.trim().startsWith(`${USER_COOKIE}=`))
    ?.split('=').slice(1).join('='); // Handle = characters in cookie value

  if (userCookie) {
    try {
      // Try parsing directly first (new format - not manually encoded)
      const user = JSON.parse(userCookie);
      console.log('[getClientUser] Found session for:', user.email);
      return user;
    } catch (error) {
      // If that fails, try decoding first (old double-encoded format)
      try {
        console.log('[getClientUser] Trying to decode legacy cookie format...');
        const decoded = decodeURIComponent(userCookie);
        const user = JSON.parse(decoded);
        console.log('[getClientUser] Found session (legacy format) for:', user.email);

        // Re-save the cookie in the new format to fix it
        document.cookie = `${USER_COOKIE}=${JSON.stringify(user)}; path=/; max-age=86400; SameSite=Lax`;
        console.log('[getClientUser] Fixed legacy cookie format');

        return user;
      } catch (decodeError) {
        console.error('[getClientUser] Failed to parse cookie (tried both formats):', error);
      }
    }
  }

  // Fallback: Check for user-session cookie (legacy, backward compatibility)
  userCookie = cookies
    .find(c => c.trim().startsWith('user-session='))
    ?.split('=').slice(1).join('='); // Handle = characters in cookie value

  if (userCookie) {
    try {
      const user = JSON.parse(decodeURIComponent(userCookie));
      console.log('[getClientUser] Found legacy user-session for:', user.email);
      console.warn('[getClientUser] Legacy cookie found - should migrate to ai-intranet-user');
      return user;
    } catch (error) {
      console.error('[getClientUser] Failed to parse user-session cookie:', error);
    }
  }

  // If no session cookie found and in dev mode, return MOCK_USER
  // This handles the case when DISABLE_AUTH=true but no cookie is set yet
  if (AUTH_DISABLED) {
    console.log('[getClientUser] No session found, using MOCK_USER (dev mode)');
    return MOCK_USER;
  }

  console.log('[getClientUser] No authenticated session found');
  return null;
}

/**
 * Clear stale development cookies (client-side)
 *
 * Removes old dev-mode cookies that may interfere with authentication.
 * Safe to call in production - only removes dev-specific cookies.
 *
 * NOTE: Does NOT clear ai-intranet-user as it's used by both production and dev mode.
 */
export function clearStaleDevCookies(): void {
  if (typeof window === 'undefined') return;

  const devCookiesToClear = [
    'x-auth-disabled',    // Old dev bypass flag
    'user-session',       // Old dev session cookie (legacy)
    'x-switched-user',    // Old dev user switcher cookie (deprecated - now uses ai-intranet-user)
  ];

  // Clear each stale cookie by setting expiry to the past
  devCookiesToClear.forEach(cookieName => {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });

  console.log('[Auth] Cleared stale dev cookies:', devCookiesToClear.join(', '));
}

/**
 * Logout user (client-side)
 * Redirects to Sonance hub login page
 */
export async function logout(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    console.log('[Auth] Initiating logout');

    // Call logout endpoint to clear server-side cookies
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      redirect: 'follow'
    });

    // The logout endpoint will redirect to hub login, so we let it complete
    // If fetch doesn't redirect automatically, redirect manually
    if (!response.redirected) {
      // Get the hub URL from the environment or use default
      const hubUrl = process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.sonance.com';
      const loginUrl = new URL('/login', hubUrl);
      loginUrl.searchParams.set('returnTo', window.location.origin);
      loginUrl.searchParams.set('logout', 'true');
      window.location.href = loginUrl.toString();
    }
  } catch (error) {
    console.error('[Auth] Logout error:', error);

    // Fallback: Redirect to hub login even if logout endpoint fails
    const hubUrl = process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.sonance.com';
    const loginUrl = new URL('/login', hubUrl);
    loginUrl.searchParams.set('returnTo', window.location.origin);
    loginUrl.searchParams.set('logout', 'true');
    window.location.href = loginUrl.toString();
  }
}
