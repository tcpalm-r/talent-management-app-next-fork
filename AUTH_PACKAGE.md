# Authentication Package for ITP Standalone App

This document contains all authentication code from the Talent Management app. Copy each file to the corresponding path in your ITP standalone app.

## Dependencies

Install these packages:

```bash
npm install @supabase/supabase-js
```

## Environment Variables

Add these to your `.env.local`:

```bash
# Supabase (same database as main app)
NEXT_PUBLIC_SUPABASE_URL=https://ynycbfyzbavbgxvniylt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Sonance Hub Integration
APP_ID=<your-app-id>
APP_API_KEY=<your-app-api-key>
AI_INTRANET_URL=https://aiintranet.sonance.com
NEXT_PUBLIC_AI_INTRANET_URL=https://aiintranet.sonance.com
NEXT_PUBLIC_APP_ID=<your-app-id>
AUTH_SYNC_SECRET=<generate-a-secret>

# Auth0 (Legacy/Fallback) - optional
AUTH0_ISSUER_BASE_URL=<auth0-domain>
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
AUTH0_BASE_URL=<your-app-url>

# Microsoft Teams / Azure AD
NEXT_PUBLIC_AZURE_AD_TENANT_ID=ae4bbd35-942c-4c35-b794-274bc9cdd718
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=<your-azure-client-id>

# Development
DISABLE_AUTH=true
NEXT_PUBLIC_DISABLE_AUTH=true
NODE_ENV=development
```

---

## File 1: `lib/schema.ts`

Types for authentication. You may need to adjust this to remove types not needed for ITP.

```typescript
/**
 * Database Schema Type Definitions
 */

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

/**
 * User Profile - Core user data
 * Maps to existing user_profiles table
 */
export interface UserProfile {
  id: string;
  auth0_id: string | null;
  email: string;
  full_name: string;
  given_name: string | null;
  family_name: string | null;
  picture: string | null;
  avatar_url: string | null;

  // Roles and permissions
  global_role: string | null;
  app_role: string | null;
  app_permissions: Record<string, any> | null;
  app_access: boolean | null;
  capabilities: any | null;
  local_permissions: Record<string, any> | null;

  // Organizational info
  department: string | null;
  title: string | null;
  job_title: string | null;
  phone: string | null;
  location: string | null;
  manager_id: string | null;
  manager_email: string | null;
  employee_number: string | null;
  cost_center: string | null;
  external_id: string | null;

  // Login tracking
  has_logged_in: boolean | null;
  first_login_at: string | null;
  last_login_at: string | null;
  sync_method: string | null;

  // Metadata
  last_sync: string | null;
  is_active: boolean | null;
  is_hidden: boolean | null;
  scim_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  last_updated_by: string | null;
  idx: number;
}

/**
 * Session User - Simplified user info for session management
 */
export interface SessionUser {
  id: string;
  auth0_id?: string | null;
  email: string;
  full_name: string;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  app_role: string;
  app_permissions: Record<string, any>;
  global_role?: string | null;
  capabilities?: any;
  app_access?: boolean;
  department: string | null;
  title: string | null;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type AppRole = 'admin' | 'slt' | 'leader' | 'user';
export type GlobalRole = 'admin' | 'slt' | 'leader' | 'user';

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isAdmin(user: UserProfile | SessionUser): boolean {
  return user.app_role === 'admin';
}

export function isLeader(user: UserProfile | SessionUser): boolean {
  return user.app_role === 'leader' || user.app_role === 'admin';
}
```

---

## File 2: `lib/auth.ts`

Core authentication logic with simplified test users.

```typescript
/**
 * Authentication Core Library
 *
 * Handles AI Intranet authentication with dev bypass mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SessionUser } from './schema';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
  process.env.DISABLE_AUTH?.trim() === 'true';

/**
 * Mock user for local development
 * IMPORTANT: Uses REAL database ID for authorization checks to work
 */
export const MOCK_USER: SessionUser = {
  id: '5b1e1ee7-5850-4b7f-8881-9304c17ab63f', // Real DB ID
  auth0_id: 'thomas.palmer@sonance.com',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  given_name: 'Thomas',
  family_name: 'Palmer',
  picture: undefined,
  app_role: 'admin',
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
 * Simplified test users for development - one of each role
 */
export const TEST_USERS: SessionUser[] = [
  MOCK_USER, // admin
  {
    id: 'e57dcddb-5249-4b76-894f-f44636e43d17',
    auth0_id: 'mikes@sonance.com',
    email: 'mikes@sonance.com',
    full_name: 'Mike Sonntag',
    given_name: 'Mike',
    family_name: 'Sonntag',
    picture: null,
    app_role: 'slt',
    app_permissions: { read: true, admin: true, write: true },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: 'Sales',
    title: 'Chief Revenue Officer',
  },
  {
    id: '076bbd75-fce2-471a-a621-dc55070b37ba',
    auth0_id: 'alina.grijalva@sonance.com',
    email: 'alina.grijalva@sonance.com',
    full_name: 'Alina Grijalva',
    given_name: 'Alina',
    family_name: 'Grijalva',
    picture: null,
    app_role: 'user',
    app_permissions: { read: true, admin: false, write: false },
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: 'Executive',
    title: 'Executive Assistant',
  },
];

export const SESSION_COOKIE = 'ai-intranet-session';
export const USER_COOKIE = 'ai-intranet-user';
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// SESSION VALIDATION
// ============================================================================

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

    if (!response.ok) return null;

    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value || null;
}

export function getUserFromRequest(request: NextRequest): SessionUser | null {
  const userCookie = request.cookies.get(USER_COOKIE)?.value;
  if (!userCookie) return null;

  try {
    return JSON.parse(userCookie);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(userCookie));
    } catch {
      console.error('[Auth] Failed to parse user cookie');
      return null;
    }
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE HELPERS
// ============================================================================

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<SessionUser | null> {
  if (AUTH_DISABLED) return MOCK_USER;

  const cachedUser = getUserFromRequest(request);
  if (cachedUser) return cachedUser;

  const sessionToken = getSessionFromRequest(request);
  if (!sessionToken) return null;

  return await validateSession(sessionToken);
}

export function createAuthenticatedResponse(
  response: NextResponse,
  user: SessionUser,
  sessionToken?: string
): NextResponse {
  response.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  if (sessionToken) {
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/',
    });
  }

  return response;
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(USER_COOKIE);
  return response;
}

// ============================================================================
// ROUTE PROTECTION
// ============================================================================

export function isProtectedRoute(pathname: string): boolean {
  const publicRoutes = [
    '/unauthorized',
    '/login',
    '/api/auth',
    '/api/auth/validate-token',
    '/api/debug',
  ];
  return !publicRoutes.some(route => pathname.startsWith(route));
}

export function hasRole(user: SessionUser | null, ...roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.app_role);
}

// ============================================================================
// AI INTRANET INTEGRATION
// ============================================================================

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

    if (!response.ok) return null;

    const data = await response.json();
    return { user: data.user, sessionToken: data.sessionToken };
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
}

// ============================================================================
// CLIENT-SIDE AUTH HELPERS
// ============================================================================

export function getClientUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';');
  let userCookie = cookies
    .find(c => c.trim().startsWith(`${USER_COOKIE}=`))
    ?.split('=').slice(1).join('=');

  if (userCookie) {
    try {
      return JSON.parse(userCookie);
    } catch {
      try {
        const decoded = decodeURIComponent(userCookie);
        const user = JSON.parse(decoded);
        document.cookie = `${USER_COOKIE}=${JSON.stringify(user)}; path=/; max-age=86400; SameSite=Lax`;
        return user;
      } catch {
        console.error('[getClientUser] Failed to parse cookie');
      }
    }
  }

  userCookie = cookies
    .find(c => c.trim().startsWith('user-session='))
    ?.split('=').slice(1).join('=');

  if (userCookie) {
    try {
      return JSON.parse(decodeURIComponent(userCookie));
    } catch {
      console.error('[getClientUser] Failed to parse user-session cookie');
    }
  }

  if (AUTH_DISABLED) return MOCK_USER;
  return null;
}

export function clearStaleDevCookies(): void {
  if (typeof window === 'undefined') return;

  const devCookiesToClear = ['x-auth-disabled', 'user-session', 'x-switched-user'];
  devCookiesToClear.forEach(cookieName => {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });
}

export async function logout(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      redirect: 'follow'
    });

    if (!response.redirected) {
      const hubUrl = process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.sonance.com';
      const loginUrl = new URL('/login', hubUrl);
      loginUrl.searchParams.set('returnTo', window.location.origin);
      loginUrl.searchParams.set('logout', 'true');
      window.location.href = loginUrl.toString();
    }
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    const hubUrl = process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.sonance.com';
    const loginUrl = new URL('/login', hubUrl);
    loginUrl.searchParams.set('returnTo', window.location.origin);
    loginUrl.searchParams.set('logout', 'true');
    window.location.href = loginUrl.toString();
  }
}
```

---

## File 3: `lib/supabase.ts`

Client-side Supabase client.

```typescript
/**
 * Supabase Client & Database Utilities
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Re-export types
export type { UserProfile, SessionUser, AppRole, GlobalRole } from './schema';
export { isAdmin, isLeader } from './schema';
```

---

## File 4: `lib/supabase-admin.ts`

Server-side admin client (bypasses RLS).

```typescript
/**
 * Supabase Admin Client
 *
 * IMPORTANT: ONLY use this in server-side code (API routes, server components)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export function isServerContext(): boolean {
  return typeof window === 'undefined';
}

export function requireServerContext(functionName: string): void {
  if (!isServerContext()) {
    throw new Error(
      `${functionName} can only be called in server-side code.`
    );
  }
}
```

---

## File 5: `lib/auth-supabase.ts`

Supabase integration for auth.

```typescript
/**
 * Authentication - Supabase Integration
 */

import { supabaseAdmin } from './supabase-admin';
import type { SessionUser, UserProfile } from './schema';

export async function syncUserProfile(sessionUser: SessionUser): Promise<UserProfile | null> {
  try {
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', sessionUser.email)
      .single();

    const now = new Date().toISOString();

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          full_name: sessionUser.full_name,
          app_role: sessionUser.app_role,
          app_permissions: sessionUser.app_permissions || {},
          department: sessionUser.department || null,
          title: sessionUser.title || null,
          has_logged_in: true,
          last_login_at: now,
          updated_at: now,
        })
        .eq('email', sessionUser.email)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        return null;
      }
      return updatedUser as UserProfile;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: sessionUser.id,
          email: sessionUser.email,
          full_name: sessionUser.full_name,
          app_role: sessionUser.app_role || 'user',
          app_permissions: sessionUser.app_permissions || {},
          app_access: true,
          department: sessionUser.department || null,
          title: sessionUser.title || null,
          has_logged_in: true,
          first_login_at: now,
          last_login_at: now,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return null;
      }
      return newUser as UserProfile;
    }
  } catch (error) {
    console.error('Error syncing user profile:', error);
    return null;
  }
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function getUserProfileById(id: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching user profile:', error);
      return null;
    }
    return data as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export function toSessionUser(profile: UserProfile): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    app_role: profile.app_role || 'user',
    app_permissions: (profile.app_permissions as Record<string, any>) || {},
    department: profile.department,
    title: profile.title,
  };
}

export async function hasAppAccess(email: string): Promise<boolean> {
  try {
    const profile = await getUserProfileByEmail(email);
    return profile?.app_access === true && profile?.is_active === true;
  } catch {
    return false;
  }
}

export async function updateLastLogin(email: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('user_profiles')
      .update({ last_login_at: now, has_logged_in: true })
      .eq('email', email);
  } catch (error) {
    console.error('Error updating last login:', error);
  }
}

export async function checkPermission(email: string, permission: string): Promise<boolean> {
  try {
    const profile = await getUserProfileByEmail(email);
    if (!profile) return false;
    if (profile.app_role === 'admin') return true;
    const permissions = profile.app_permissions as Record<string, any>;
    return permissions?.[permission] === true;
  } catch {
    return false;
  }
}

export async function checkRole(email: string, ...roles: string[]): Promise<boolean> {
  try {
    const profile = await getUserProfileByEmail(email);
    if (!profile) return false;
    return roles.includes(profile.app_role || 'user');
  } catch {
    return false;
  }
}

export async function syncUserProfileViaSupabase(userData: any): Promise<any> {
  try {
    console.log('[SYNC-SUPABASE] Starting profile sync for:', userData.email);

    if (!userData?.auth0_id || !userData?.email) {
      console.error('[SYNC-SUPABASE] Missing auth0_id or email');
      return null;
    }

    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, app_role, app_permissions, global_role, capabilities, app_access, local_permissions')
      .eq('auth0_id', userData.auth0_id)
      .maybeSingle();

    const profileData = {
      id: existingProfile?.id || userData.id,
      auth0_id: userData.auth0_id,
      email: userData.email,
      full_name: userData.full_name || userData.email,
      given_name: userData.given_name || null,
      family_name: userData.family_name || null,
      picture: userData.picture || userData.avatar_url || null,
      avatar_url: userData.avatar_url || userData.picture || null,
      global_role: existingProfile?.global_role || 'user',
      capabilities: existingProfile?.capabilities || [],
      app_role: existingProfile?.app_role || 'user',
      app_permissions: existingProfile?.app_permissions || {},
      app_access: existingProfile?.app_access ?? true,
      local_permissions: existingProfile?.local_permissions || {},
      department: userData.department || null,
      title: userData.title || null,
      phone: userData.phone || null,
      location: userData.location || null,
      last_sync: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profileData, { onConflict: 'auth0_id' })
      .select()
      .single();

    if (error) {
      console.error('[SYNC-SUPABASE] Failed to sync profile:', error);
      if (error.code === '23505') {
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ ...profileData, created_at: undefined })
          .eq('auth0_id', userData.auth0_id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updateData;
      }
      throw error;
    }

    console.log('[SYNC-SUPABASE] Profile synced successfully:', data?.email);
    return data;
  } catch (error) {
    console.error('[SYNC-SUPABASE] Sync failed with error:', error);
    return null;
  }
}
```

---

## File 6: `lib/auth-wrapper.ts`

High-level authentication wrapper.

```typescript
/**
 * Authentication Wrapper
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

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<{ user: SessionUser; profile: UserProfile } | null> {
  const userDataHeader = request.headers.get('x-user-data');
  if (userDataHeader) {
    try {
      const sessionUser = JSON.parse(userDataHeader) as SessionUser;
      const profile = await getUserProfileByEmail(sessionUser.email);
      if (profile) {
        return { user: toSessionUser(profile), profile };
      }
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
          is_hidden: null,
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

  if (AUTH_DISABLED) {
    const mockProfile = await getUserProfileByEmail(MOCK_USER.email);
    if (mockProfile) {
      return { user: toSessionUser(mockProfile), profile: mockProfile };
    }
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
        is_hidden: null,
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

  const user = await getAuthUser(request);
  if (!user) return null;

  const profile = await syncUserProfile(user);
  if (!profile) return null;

  return { user: toSessionUser(profile), profile };
}

export async function validateAndSyncSession(
  sessionToken: string
): Promise<{ user: SessionUser; profile: UserProfile } | null> {
  if (AUTH_DISABLED) {
    return getAuthenticatedUser({} as NextRequest);
  }

  const user = await validateSession(sessionToken);
  if (!user) return null;

  const profile = await syncUserProfile(user);
  if (!profile) return null;

  await updateLastLogin(user.email);
  return { user: toSessionUser(profile), profile };
}

export async function getUserProfile(
  email: string
): Promise<{ user: SessionUser; profile: UserProfile } | null> {
  const profile = await getUserProfileByEmail(email);
  if (!profile) return null;
  return { user: toSessionUser(profile), profile };
}

export async function refreshUserProfile(email: string): Promise<UserProfile | null> {
  return getUserProfileByEmail(email);
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
  const authData = await getAuthenticatedUser(request);
  return authData?.user.app_role === 'admin';
}

export async function isLeaderOrAdmin(request: NextRequest): Promise<boolean> {
  const authData = await getAuthenticatedUser(request);
  const role = authData?.user.app_role;
  return role === 'admin' || role === 'leader';
}

export async function requireAuth(
  request: NextRequest
): Promise<{ user: SessionUser; profile: UserProfile }> {
  const authData = await getAuthenticatedUser(request);
  if (!authData) throw new Error('Unauthorized');
  return authData;
}

export async function requireAdmin(
  request: NextRequest
): Promise<{ user: SessionUser; profile: UserProfile }> {
  const authData = await requireAuth(request);
  if (authData.user.app_role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return authData;
}

export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<{ user: SessionUser; profile: UserProfile }> {
  const authData = await requireAuth(request);
  if (authData.user.app_role === 'admin') return authData;

  let hasPermission = false;
  if (permission === 'admin') {
    hasPermission = authData.user.app_role === 'admin';
  } else if (permission === 'write') {
    hasPermission = ['admin', 'slt', 'leader'].includes(authData.user.app_role);
  } else if (permission === 'read') {
    hasPermission = true;
  }

  if (!hasPermission) {
    throw new Error(`Forbidden: ${permission} permission required`);
  }
  return authData;
}

export type AuthData = { user: SessionUser; profile: UserProfile };
export type SessionData = AuthData & { sessionToken: string };
```

---

## File 7: `middleware.ts`

**IMPORTANT:** Adjust the `skipPaths` and `matcher` to match your ITP app's routes.

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MOCK_USER = {
  id: '5b1e1ee7-5850-4b7f-8881-9304c17ab63f',
  auth0_id: 'thomas.palmer@sonance.com',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  given_name: 'Thomas',
  family_name: 'Palmer',
  picture: null,
  app_role: 'admin',
  app_permissions: { manage_users: true, manage_reviews: true, manage_surveys: true, view_analytics: true },
  global_role: 'admin',
  capabilities: [],
  app_access: true,
  department: 'Engineering',
  title: 'Developer',
  timestamp: Date.now()
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

const base64UrlEncode = (input: Uint8Array | string): string => {
  const buffer = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);
  return buffer.toString('base64url');
};

const signAuthSyncToken = async (payload: Record<string, any>, secret: string): Promise<string> => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    Buffer.from(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, Buffer.from(data));
  const encodedSignature = Buffer.from(signature).toString('base64url');
  return `${data}.${encodedSignature}`;
};

async function getLocalUserRole(email: string) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('app_role, app_permissions')
      .ilike('email', email)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return { app_role: data.app_role || 'user', app_permissions: data.app_permissions || {} };
  } catch (error) {
    console.error('[Auth] Error fetching local user role:', error);
    return null;
  }
}

function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // ADJUST THESE PATHS FOR YOUR ITP APP
    const skipPaths = [
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/callback',
      '/api/auth/validate-token',
      '/api/auth/teams',
      '/_next/',
      '/favicon',
      '/unauthorized',
      '/robots.txt',
      '/sitemap.xml',
      '/_next/static',
      '/_next/image',
      '/public',
      '/auth-start',
      '/auth-end',
      '/blank-auth-end',
      '/config'
    ];

    if (skipPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Teams context
    const isInTeams = request.nextUrl.searchParams.get('inTeams') === 'true';
    if (isInTeams) {
      const teamsSessionCookie = request.cookies.get('ai-intranet-user');
      if (teamsSessionCookie) {
        try {
          const session = JSON.parse(teamsSessionCookie.value);
          if (session.timestamp && Date.now() - session.timestamp < 86400000) {
            const localRole = await getLocalUserRole(session.email);
            if (localRole) {
              session.app_role = localRole.app_role;
              session.app_permissions = localRole.app_permissions;
            }
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-data', JSON.stringify(session));
            requestHeaders.set('x-user-id', session.auth0_id || session.id);
            requestHeaders.set('x-user-role', session.app_role);
            requestHeaders.set('x-user-email', session.email);
            return NextResponse.next({ request: { headers: requestHeaders } });
          }
        } catch {}
      }
      return NextResponse.next();
    }

    // Auth disabled check
    let authDisabled =
      process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
      process.env.DISABLE_AUTH?.trim() === 'true';

    // Production fail-safe
    if (process.env.NODE_ENV === 'production' && authDisabled) {
      console.error('[SECURITY] Auth bypass blocked in production');
      authDisabled = false;
    }

    if (authDisabled) {
      const existingUserCookie = request.cookies.get('ai-intranet-user');
      let currentUser = MOCK_USER;

      if (existingUserCookie) {
        try {
          currentUser = JSON.parse(existingUserCookie.value);
        } catch {}
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(currentUser));
      requestHeaders.set('x-user-id', currentUser.auth0_id || currentUser.id);
      requestHeaders.set('x-user-role', currentUser.app_role);
      requestHeaders.set('x-user-email', currentUser.email);

      const response = NextResponse.next({ request: { headers: requestHeaders } });

      if (!existingUserCookie) {
        response.cookies.set('ai-intranet-user', JSON.stringify(MOCK_USER), {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: 86400
        });
      }
      return response;
    }

    // URL token auth
    const authToken = request.nextUrl.searchParams.get('auth_token');
    if (authToken) {
      try {
        const tokenUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}&auth_token=${authToken}`;
        const validateResponse = await fetch(tokenUrl, {
          method: 'GET',
          headers: {
            'X-API-Key': process.env.APP_API_KEY || '',
            'Authorization': `Bearer ${process.env.APP_API_KEY}`,
          },
          cache: 'no-store'
        });

        if (validateResponse.ok) {
          const data = await validateResponse.json();
          const access = data.access || data.granted;
          const user = data.user || (data.users && data.users[0]) || null;

          if (access && user) {
            const localRole = await getLocalUserRole(user.email);
            const appPermissions = user.app_permissions?.['ITP'] || {};
            const mappedUser = {
              id: user.id,
              auth0_id: user.auth0_id,
              email: user.email,
              full_name: user.full_name,
              given_name: user.given_name,
              family_name: user.family_name,
              picture: user.picture || user.avatar_url,
              app_role: localRole?.app_role || appPermissions.role || user.app_role || 'user',
              app_permissions: localRole?.app_permissions || appPermissions.permissions || {},
              global_role: user.global_role || user.role,
              capabilities: user.capabilities || [],
              app_access: true,
              department: user.department,
              title: user.title,
              timestamp: Date.now()
            };

            // Sync profile (fire and forget)
            const authSyncSecret = process.env.AUTH_SYNC_SECRET;
            if (authSyncSecret) {
              const syncPayload = { user: mappedUser, iat: Date.now() };
              const syncToken = await signAuthSyncToken(syncPayload, authSyncSecret);
              fetch(`${request.nextUrl.origin}/api/auth/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-sync-token': syncToken },
              }).catch(() => {});
            }

            const cleanUrl = new URL(request.url);
            cleanUrl.searchParams.delete('auth_token');
            const response = NextResponse.redirect(cleanUrl);
            response.cookies.set('ai-intranet-user', JSON.stringify(mappedUser), {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 86400
            });
            return response;
          }
        }
      } catch {}
    }

    // Session cookie auth
    const sessionCookie = request.cookies.get('ai-intranet-user');
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie.value);
        if (session.timestamp && Date.now() - session.timestamp < 86400000) {
          const localRole = await getLocalUserRole(session.email);
          if (localRole) {
            session.app_role = localRole.app_role;
            session.app_permissions = localRole.app_permissions;
          }

          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-data', JSON.stringify(session));
          requestHeaders.set('x-user-id', session.auth0_id);
          requestHeaders.set('x-user-role', session.app_role);
          requestHeaders.set('x-user-email', session.email);

          const response = NextResponse.next({ request: { headers: requestHeaders } });
          if (localRole) {
            response.cookies.set('ai-intranet-user', JSON.stringify(session), {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 86400
            });
          }
          return response;
        }
      } catch {}
    }

    // Cookie-based auth with hub
    try {
      const authUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}`;
      const authResponse = await fetch(authUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.APP_API_KEY}`,
          'Cookie': request.headers.get('cookie') || '',
          'User-Agent': request.headers.get('user-agent') || '',
          'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        },
        cache: 'no-store'
      });

      if (authResponse.status === 401) {
        const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
        const returnTo = new URL(request.url);
        returnTo.searchParams.delete('auth_token');
        loginUrl.searchParams.set('returnTo', returnTo.toString());
        loginUrl.searchParams.set('app', process.env.APP_ID || '');
        return NextResponse.redirect(loginUrl);
      }

      if (authResponse.status === 403) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      if (!authResponse.ok) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      const data = await authResponse.json();
      const access = data.access || data.granted;
      const user = data.user || (data.users && data.users[0]) || null;

      if (!access || !user) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      const localRole = await getLocalUserRole(user.email);
      const appPermissions = user.app_permissions?.['ITP'] || {};
      const mappedUser = {
        id: user.id,
        auth0_id: user.auth0_id,
        email: user.email,
        full_name: user.full_name,
        given_name: user.given_name,
        family_name: user.family_name,
        picture: user.picture,
        app_role: localRole?.app_role || appPermissions.role || user.app_role || 'user',
        app_permissions: localRole?.app_permissions || appPermissions.permissions || {},
        global_role: user.global_role || user.role,
        capabilities: user.capabilities || [],
        app_access: true,
        department: user.department,
        title: user.title,
        timestamp: Date.now()
      };

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-data', JSON.stringify(mappedUser));
      requestHeaders.set('x-user-id', mappedUser.auth0_id);
      requestHeaders.set('x-user-role', mappedUser.app_role);
      requestHeaders.set('x-user-email', mappedUser.email);

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.set('ai-intranet-user', JSON.stringify(mappedUser), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400
      });
      return response;

    } catch (error) {
      // Fallback to hub login
      const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
      const returnTo = new URL(request.url);
      returnTo.searchParams.delete('auth_token');
      loginUrl.searchParams.set('returnTo', returnTo.toString());
      loginUrl.searchParams.set('app', process.env.APP_ID || '');
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
    loginUrl.searchParams.set('returnTo', request.url);
    loginUrl.searchParams.set('app', process.env.APP_ID || '');
    return NextResponse.redirect(loginUrl);
  }
}

// ADJUST THIS MATCHER FOR YOUR ITP APP ROUTES
export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|unauthorized|public).*)',
  ],
};
```

---

## File 8: `context/UserContext.tsx`

```typescript
/**
 * User Context
 */

'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getClientUser, logout as logoutUser, clearStaleDevCookies } from '@/lib/auth';
import type { SessionUser } from '@/lib/schema';

export interface UserContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cookieUser = getClientUser();
      if (cookieUser) {
        setUser(cookieUser);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[UserContext] Error:', err);
      setError('Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      (typeof window !== 'undefined' && !window.location.hostname.includes('localhost'));

    if (isProduction) clearStaleDevCookies();
    fetchUser();
  }, [fetchUser]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await logoutUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error, refreshUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}
```

---

## File 9: `hooks/useAuth.ts`

```typescript
/**
 * useAuth Hook
 */

'use client';

import { useContext } from 'react';
import { UserContext } from '@/context/UserContext';
import type { SessionUser } from '@/lib/schema';

export function useAuth() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useAuth must be used within a UserProvider');
  }
  return context;
}

export type { SessionUser };
```

---

## File 10: `app/api/auth/login/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authDisabled =
      process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
      process.env.DISABLE_AUTH?.trim() === 'true';

    if (authDisabled) {
      return NextResponse.redirect(new URL('/', request.nextUrl.origin));
    }

    const auth0IssuerUrl = process.env.AUTH0_ISSUER_BASE_URL;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const baseUrl = process.env.AUTH0_BASE_URL;
    const auth0Domain = auth0IssuerUrl?.replace('https://', '');
    const redirectUri = `${baseUrl}/api/auth/callback`;

    if (!auth0Domain || !clientId) {
      return NextResponse.json({ error: 'Auth0 configuration missing' }, { status: 500 });
    }

    const authorizeUrl = new URL(`https://${auth0Domain}/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'openid profile email');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
```

---

## File 11: `app/api/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuthenticatedResponse } from '@/lib/auth';
import type { SessionUser } from '@/lib/schema';

export const dynamic = 'force-dynamic';

function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const authDisabled =
      process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
      process.env.DISABLE_AUTH?.trim() === 'true';

    if (authDisabled) {
      return NextResponse.redirect(new URL('/', request.nextUrl.origin));
    }

    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    const auth0IssuerUrl = process.env.AUTH0_ISSUER_BASE_URL;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    const baseUrl = process.env.AUTH0_BASE_URL;

    if (!auth0IssuerUrl || !clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    const tokenResponse = await fetch(`${auth0IssuerUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `${auth0IssuerUrl}/api/v2/`,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${baseUrl}/api/auth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    const tokenData = await tokenResponse.json();
    const idToken = tokenData.id_token;
    const accessToken = tokenData.access_token;
    const idTokenPayload = decodeJWT(idToken);

    if (!idTokenPayload) {
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    const auth0Id = idTokenPayload.sub;
    const email = idTokenPayload.email;
    const fullName = idTokenPayload.name || email;
    const givenName = idTokenPayload.given_name;
    const familyName = idTokenPayload.family_name;
    const picture = idTokenPayload.picture;

    const { data: existingUser, error: lookupError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .ilike('email', email)
      .single();

    let user = existingUser;

    if (lookupError && lookupError.code !== 'PGRST116') {
      return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
    }

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          auth0_id: auth0Id,
          email: email,
          full_name: fullName,
          given_name: givenName,
          family_name: familyName,
          picture: picture,
          app_role: 'user',
          app_permissions: {},
          has_logged_in: true,
          first_login_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
          sync_method: 'auth0',
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
      }
      user = newUser;
    } else {
      await supabaseAdmin
        .from('user_profiles')
        .update({ auth0_id: auth0Id, last_login_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role || 'user',
      app_permissions: user.app_permissions || {},
      department: user.department,
      title: user.title,
    };

    const response = NextResponse.redirect(new URL('/', request.nextUrl.origin));
    return createAuthenticatedResponse(response, sessionUser, accessToken);
  } catch (error) {
    return NextResponse.redirect(new URL('/unauthorized', request.nextUrl.origin));
  }
}
```

---

## File 12: `app/api/auth/me/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authData = await getAuthenticatedUser(request);
    if (!authData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ user: authData.user, profile: authData.profile });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## File 13: `app/api/auth/logout/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const hubUrl = process.env.AI_INTRANET_URL || 'https://aiintranet.sonance.com';
    const loginUrl = new URL('/login', hubUrl);
    loginUrl.searchParams.set('returnTo', request.nextUrl.origin);
    loginUrl.searchParams.set('logout', 'true');

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('user-session');
    response.cookies.delete('appSession');
    response.cookies.delete('ai-intranet-session');
    response.cookies.delete('ai-intranet-user');

    return response;
  } catch (error) {
    const hubUrl = process.env.AI_INTRANET_URL || 'https://aiintranet.sonance.com';
    const response = NextResponse.redirect(new URL('/login', hubUrl));
    response.cookies.delete('user-session');
    return response;
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
```

---

## File 14: `app/api/auth/sync/route.ts`

```typescript
import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

const verifyAuthSyncToken = (token: string, secret: string): { user: Record<string, any>; iat: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', secret).update(data).digest('base64url');

    const signatureBuffer = Buffer.from(encodedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payloadRaw = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadRaw);
    if (!payload?.user) return null;

    const iat = payload.iat;
    if (typeof iat !== 'number' || Math.abs(Date.now() - iat) > MAX_TOKEN_AGE_MS) return null;

    return payload;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const authSyncSecret = process.env.AUTH_SYNC_SECRET;
    if (!authSyncSecret && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Auth sync misconfigured' }, { status: 500 });
    }

    const authSyncToken = request.headers.get('x-auth-sync-token');
    if (!authSyncToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verifiedPayload = authSyncSecret ? verifyAuthSyncToken(authSyncToken, authSyncSecret) : null;
    if (!verifiedPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mappedUser = verifiedPayload.user;

    try {
      const supabaseModule = await import('@/lib/auth-supabase');
      const syncResult = await supabaseModule.syncUserProfileViaSupabase(mappedUser);
      return NextResponse.json({ success: true, profile: syncResult });
    } catch {
      return NextResponse.json({ success: true, message: 'User authenticated (sync failed)' });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## File 15: `app/api/auth/switch-user/route.ts` (Dev Only)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_DISABLED, USER_COOKIE, SESSION_DURATION, TEST_USERS } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TEST_USER_IDS = TEST_USERS.map(u => u.id);

export async function POST(request: NextRequest) {
  if (!AUTH_DISABLED) {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const baseUser = TEST_USERS.find(u => u.email === email);
    if (!baseUser) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
    }

    const { data: dbUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, app_role, department, title')
      .eq('id', baseUser.id)
      .single();

    const user = {
      ...baseUser,
      app_role: dbUser?.app_role || baseUser.app_role,
      department: baseUser.department || dbUser?.department,
      title: baseUser.title || dbUser?.title,
    };

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, full_name: user.full_name, app_role: user.app_role }
    });

    response.cookies.set(USER_COOKIE, JSON.stringify(user), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to switch user' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!AUTH_DISABLED) {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 });
  }

  try {
    const { data: dbUsers } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, app_role, department, title')
      .in('id', TEST_USER_IDS);

    const dbUserMap = new Map((dbUsers || []).map(u => [u.id, u]));

    const users = TEST_USERS.map(baseUser => {
      const dbUser = dbUserMap.get(baseUser.id);
      return {
        id: baseUser.id,
        email: baseUser.email,
        full_name: baseUser.full_name,
        app_role: dbUser?.app_role || baseUser.app_role,
        department: baseUser.department || dbUser?.department,
        title: baseUser.title || dbUser?.title,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch test users' }, { status: 500 });
  }
}
```

---

## File 16: `app/api/auth/teams/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const AZURE_TENANT_ID = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;
const AZURE_CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID;

function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const payload = decodeJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const validAudiences = [
      AZURE_CLIENT_ID,
      `api://${AZURE_CLIENT_ID}`,
    ].filter(Boolean);

    const tokenAudience = (payload.aud as string || '').toLowerCase();
    const isValidAudience = validAudiences.some(
      expected => expected && tokenAudience === expected.toLowerCase()
    );

    if (!isValidAudience) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 401 });
    }

    if (payload.tid !== AZURE_TENANT_ID) {
      return NextResponse.json({ error: 'Invalid tenant' }, { status: 401 });
    }

    const email = (payload.upn || payload.preferred_username || payload.email) as string;
    const name = payload.name as string;
    const oid = payload.oid as string;

    if (!email) {
      return NextResponse.json({ error: 'No email in token' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: userProfile, error: dbError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (dbError || !userProfile) {
      return NextResponse.json({
        error: 'User not found',
        email,
        message: 'Contact admin for access.',
      }, { status: 403 });
    }

    const sessionUser = {
      id: userProfile.id,
      auth0_id: email,
      email: userProfile.email,
      full_name: userProfile.full_name || name || email.split('@')[0],
      given_name: userProfile.given_name || (name ? name.split(' ')[0] : null),
      family_name: userProfile.family_name || (name ? name.split(' ').slice(1).join(' ') : null),
      picture: userProfile.avatar_url || userProfile.picture || null,
      app_role: userProfile.app_role || 'user',
      app_permissions: userProfile.app_permissions || {},
      global_role: userProfile.app_role,
      capabilities: [],
      app_access: true,
      department: userProfile.department,
      title: userProfile.title,
      timestamp: Date.now(),
      azure_oid: oid,
      auth_source: 'teams',
    };

    const response = NextResponse.json({ success: true, user: sessionUser });

    response.cookies.set('ai-intranet-user', JSON.stringify(sessionUser), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 86400,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    configured: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID),
  });
}
```

---

## File 17: `app/unauthorized/page.tsx`

Create a simple unauthorized page:

```typescript
export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
      <p className="text-gray-600 mb-4">You don't have permission to access this application.</p>
      <a href="/" className="text-blue-600 hover:underline">Go to Home</a>
    </div>
  );
}
```

---

## Usage in Your App

1. Wrap your app with `UserProvider` in your root layout:

```typescript
// app/layout.tsx
import { UserProvider } from '@/context/UserContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
```

2. Use the `useAuth` hook in components:

```typescript
'use client';
import { useAuth } from '@/hooks/useAuth';

export function MyComponent() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return (
    <div>
      <p>Hello, {user.full_name}!</p>
      <p>Role: {user.app_role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

3. Use auth helpers in API routes:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-wrapper';

export async function GET(request: NextRequest) {
  try {
    const { user, profile } = await requireAuth(request);
    // user is authenticated
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

---

## Checklist

- [ ] Copy all files to corresponding paths
- [ ] Install `@supabase/supabase-js`
- [ ] Add environment variables to `.env.local`
- [ ] Register your ITP app in the Sonance Hub (get APP_ID and APP_API_KEY)
- [ ] Adjust middleware `skipPaths` for ITP-specific routes
- [ ] Adjust middleware `matcher` pattern if needed
- [ ] Create `/unauthorized` page
- [ ] Wrap app with `UserProvider`
- [ ] Test dev mode with `DISABLE_AUTH=true`
- [ ] Test production auth flow
