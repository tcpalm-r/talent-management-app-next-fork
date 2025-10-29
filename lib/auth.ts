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
 */
export const AUTH_DISABLED = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

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
    '/api/auth/validate-token',
    '/survey/complete', // Public survey completion
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
 */
export function getClientUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  // Dev bypass mode
  if (AUTH_DISABLED) {
    return MOCK_USER;
  }

  const cookies = document.cookie.split(';');
  const userCookie = cookies
    .find(c => c.trim().startsWith(`${USER_COOKIE}=`))
    ?.split('=')[1];

  if (!userCookie) return null;

  try {
    return JSON.parse(decodeURIComponent(userCookie));
  } catch {
    return null;
  }
}

/**
 * Logout user (client-side)
 */
export async function logout(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/unauthorized';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/unauthorized';
  }
}
