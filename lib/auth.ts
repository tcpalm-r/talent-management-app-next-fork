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
 */
export const MOCK_USER: SessionUser = {
  id: 'mock-thomas-palmer',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  app_role: 'admin',
  app_permissions: {
    manage_users: true,
    manage_reviews: true,
    manage_surveys: true,
    view_analytics: true,
  },
  department: 'Engineering',
  title: 'Software Engineer',
};

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
 * Check if user has required permission
 */
export function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.app_role === 'admin') return true;
  return user.app_permissions?.[permission] === true;
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
 * IMPORTANT: Cookie priority order matters!
 * 1. x-switched-user (dev testing only)
 * 2. ai-intranet-user (real authenticated session) <- CHECK THIS FIRST
 * 3. x-auth-disabled (dev bypass mode) <- CHECK THIS LAST
 *
 * This ensures production always uses real sessions even if stale dev cookies exist.
 */
export function getClientUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';');
  // Force production mode if on production domain (not localhost)
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof window !== 'undefined' && !window.location.hostname.includes('localhost'));

  // Priority 1: Check for switched user (dev testing only - never in production)
  if (!isProduction) {
    const switchedUserCookie = cookies
      .find(c => c.trim().startsWith('x-switched-user='))
      ?.split('=')[1];

    if (switchedUserCookie) {
      try {
        console.log('[getClientUser] Found x-switched-user cookie');
        const switchedUser = JSON.parse(decodeURIComponent(switchedUserCookie));
        console.log('[getClientUser] Parsed switched user:', switchedUser.email);
        return switchedUser;
      } catch (error) {
        console.error('[getClientUser] Failed to parse x-switched-user cookie:', error);
      }
    }
  }

  // Priority 2: Check for real authenticated user session (ALWAYS CHECK THIS FIRST)
  const userCookie = cookies
    .find(c => c.trim().startsWith(`${USER_COOKIE}=`))
    ?.split('=')[1];

  if (userCookie) {
    try {
      const user = JSON.parse(decodeURIComponent(userCookie));
      console.log('[getClientUser] Found real session for:', user.email);
      return user;
    } catch (error) {
      console.error('[getClientUser] Failed to parse user cookie:', error);
    }
  }

  // Priority 3: Check for dev bypass mode (ONLY if no real session exists and not in production)
  if (!isProduction) {
    const authDisabledCookie = cookies
      .find(c => c.trim().startsWith('x-auth-disabled='))
      ?.split('=')[1];

    if (authDisabledCookie === 'true') {
      console.log('[getClientUser] Using dev bypass mode (MOCK_USER)');
      return MOCK_USER;
    }
  }

  // No valid session found
  return null;
}

/**
 * Clear stale development cookies (client-side)
 *
 * Removes old dev-mode cookies that may interfere with production authentication.
 * Safe to call in production - only removes dev-specific cookies.
 */
export function clearStaleDevCookies(): void {
  if (typeof window === 'undefined') return;

  const devCookiesToClear = [
    'x-auth-disabled',    // Old dev bypass flag
    'user-session',       // Old dev session cookie
    'x-switched-user',    // Dev user switcher cookie
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
