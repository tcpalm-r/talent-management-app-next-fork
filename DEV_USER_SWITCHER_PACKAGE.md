# Dev User Switcher Package

A complete development-only user switching system for Next.js apps. Allows developers to quickly switch between test users without logging out/in.

## Overview

This system provides:
- A dropdown UI to switch between predefined test users
- Cookie-based persistence that mirrors production auth flow
- Middleware integration that sets user headers for API routes
- Production safety (automatically disabled in production)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  ENV: DISABLE_AUTH=true + NEXT_PUBLIC_DISABLE_AUTH  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  middleware.ts: reads cookie, sets x-user-* headers │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  POST /api/auth/switch-user: validates, sets cookie │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  getClientUser(): reads cookie on client side       │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

Add to `.env.local`:
```bash
DISABLE_AUTH=true
NEXT_PUBLIC_DISABLE_AUTH=true
```

---

## File 1: `lib/schema.ts` (partial - add this type)

```typescript
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
```

---

## File 2: `lib/auth.ts`

```typescript
/**
 * Authentication Core Library
 *
 * Handles authentication with dev bypass mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SessionUser } from './schema';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Check if authentication is disabled (dev mode)
 */
export const AUTH_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
  process.env.DISABLE_AUTH?.trim() === 'true';

/**
 * Mock user for local development (Thomas Palmer)
 * IMPORTANT: Uses REAL database ID for authorization checks to work
 */
export const MOCK_USER: SessionUser = {
  id: '5b1e1ee7-5850-4b7f-8881-9304c17ab63f',
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
    auth0_id: 'alina.grijalva@sonance.com',
    email: 'alina.grijalva@sonance.com',
    full_name: 'Alina Grijalva',
    given_name: 'Alina',
    family_name: 'Grijalva',
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
    department: 'Executive',
    title: 'Executive Assistant',
  },
  {
    id: '3bccaf29-bc33-4b1e-9ce1-db7967886b0a',
    auth0_id: 'jasons@sonance.com',
    email: 'jasons@sonance.com',
    full_name: 'Jason S',
    given_name: 'Jason',
    family_name: 'S',
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
    department: 'Executive',
    title: 'Chief Revenue Officer - Residential',
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
  {
    id: 'df135c41-0905-4ecb-8d65-e1b3ab447828',
    auth0_id: 'jorgen@sonance.com',
    email: 'jorgen@sonance.com',
    full_name: 'Jorge Notni',
    given_name: 'Jorge',
    family_name: 'Notni',
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
    department: 'Operations',
    title: 'Vice President of Operations',
  },
  {
    id: '7423ab47-d55e-4cd9-8b5f-46d044d67a56',
    auth0_id: 'rigol@jamesloudspeaker.com',
    email: 'rigol@jamesloudspeaker.com',
    full_name: 'Rigo Lopez',
    given_name: 'Rigo',
    family_name: 'Lopez',
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
    department: 'Finance',
    title: 'Plant Controller',
  },
  {
    id: 'f492d0f8-4ff5-4ceb-bf76-67ce5e3f4b72',
    auth0_id: 'ari@sonance.com',
    email: 'ari@sonance.com',
    full_name: 'Ari Supran',
    given_name: 'Ari',
    family_name: 'Supran',
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
    department: 'Administration',
    title: 'Chief Executive Officer',
  },
  {
    id: '6958b8a1-a459-4df7-b0ce-062d4c56d23b',
    auth0_id: 'gigid@sonance.com',
    email: 'gigid@sonance.com',
    full_name: 'Gigi Dryer',
    given_name: 'Gigi',
    family_name: 'Dryer',
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
    department: 'Human Resources',
    title: 'Vice President of Human Resources',
  },
  {
    id: '8221904c-bc14-440b-a62a-219b45ba74cf',
    auth0_id: 'patm@sonance.com',
    email: 'patm@sonance.com',
    full_name: 'Pat McGaughan',
    given_name: 'Patrick',
    family_name: 'McGaughan',
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
    department: 'Finance',
    title: 'COO/CFO',
  },
  {
    id: 'a609cb7a-e598-49d1-a5d0-da8bbf492810',
    auth0_id: 'robr@sonance.com',
    email: 'robr@sonance.com',
    full_name: 'Rob Roland',
    given_name: 'Rob',
    family_name: 'Roland',
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
    department: 'Product Management',
    title: null,
  },
  {
    id: '0f7544b4-e320-48c2-805c-ee4271007ffa',
    auth0_id: 'BrianT@sonance.com',
    email: 'BrianT@sonance.com',
    full_name: 'Brian Taksier',
    given_name: 'Brian',
    family_name: 'Taksier',
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
    department: 'Services',
    title: 'Technical Support Supervisor',
  },
];

/**
 * Cookie names
 */
export const SESSION_COOKIE = 'ai-intranet-session';
export const USER_COOKIE = 'ai-intranet-user';

/**
 * Session duration (7 days in ms)
 */
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// CLIENT-SIDE AUTH HELPERS
// ============================================================================

/**
 * Get user from cookie (client-side)
 */
export function getClientUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  const cookies = document.cookie.split(';');

  // Check for authenticated user session
  let userCookie = cookies
    .find(c => c.trim().startsWith(`${USER_COOKIE}=`))
    ?.split('=').slice(1).join('=');

  if (userCookie) {
    try {
      // Try parsing directly first (new format - not manually encoded)
      const user = JSON.parse(userCookie);
      return user;
    } catch (error) {
      // If that fails, try decoding first (old double-encoded format)
      try {
        const decoded = decodeURIComponent(userCookie);
        const user = JSON.parse(decoded);

        // Re-save the cookie in the new format to fix it
        document.cookie = `${USER_COOKIE}=${JSON.stringify(user)}; path=/; max-age=86400; SameSite=Lax`;

        return user;
      } catch (decodeError) {
        console.error('[getClientUser] Failed to parse cookie:', error);
      }
    }
  }

  // If no session cookie found and in dev mode, return MOCK_USER
  if (AUTH_DISABLED) {
    return MOCK_USER;
  }

  return null;
}

/**
 * Logout user (client-side)
 */
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

## File 3: `context/UserContext.tsx`

```typescript
/**
 * User Context
 *
 * Provides global authentication state to the application.
 */

'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { getClientUser, logout as logoutUser } from '@/lib/auth';
import type { SessionUser } from '@/lib/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface UserContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

export const UserContext = createContext<UserContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user from cookie/API
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to get user from cookie first
      const cookieUser = getClientUser();

      if (cookieUser) {
        setUser(cookieUser);
        setLoading(false);
        return;
      }

      // Fetch from API
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[UserContext] Error during fetchUser:', err);
      setError('Failed to load user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  // Logout
  const logout = useCallback(async () => {
    await logoutUser();
  }, []);

  const value: UserContextValue = {
    user,
    loading,
    error,
    refreshUser,
    logout,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
```

---

## File 4: `hooks/useAuth.ts`

```typescript
/**
 * useAuth Hook
 *
 * Provides authentication state and methods to components.
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

## File 5: `app/api/auth/switch-user/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_DISABLED, USER_COOKIE, SESSION_DURATION, TEST_USERS } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin'; // Optional: for DB role refresh

// List of test user IDs that are allowed in the user switcher
const TEST_USER_IDS = TEST_USERS.map(u => u.id);

/**
 * Switch User API - Local Development Only
 *
 * Allows switching between test users for local development testing.
 * Only works when DISABLE_AUTH=true. Returns 403 in production.
 */
export async function POST(request: NextRequest) {
  // SECURITY: Only allow user switching in development mode
  if (!AUTH_DISABLED) {
    console.error('[User Switcher] Attempted to use in production - BLOCKED');
    return NextResponse.json(
      { error: 'User switching is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user in hardcoded TEST_USERS array
    const baseUser = TEST_USERS.find(u => u.email === email);

    if (!baseUser) {
      console.error('[User Switcher] User not found in test users:', email);
      return NextResponse.json(
        { error: `User not found: ${email}` },
        { status: 404 }
      );
    }

    // Optional: Fetch current user data from database to get latest app_role
    // Remove this block if you don't need DB role refresh
    let dbUser = null;
    try {
      const { data, error: dbError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, app_role, department, title')
        .eq('id', baseUser.id)
        .single();

      if (!dbError) {
        dbUser = data;
      }
    } catch (e) {
      // DB query is optional - continue with hardcoded user
    }

    // Merge: prefer database values for app_role, fall back to hardcoded
    const user = {
      ...baseUser,
      app_role: dbUser?.app_role || baseUser.app_role,
      full_name: baseUser.full_name,
      email: baseUser.email,
      department: baseUser.department || dbUser?.department,
      title: baseUser.title || dbUser?.title,
    };

    console.log(`[User Switcher] Switching to user:`, {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      app_role: user.app_role,
    });

    // Create response with user cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        app_role: user.app_role,
      }
    });

    // Set user cookie
    response.cookies.set(USER_COOKIE, JSON.stringify(user), {
      httpOnly: false, // Accessible to JavaScript for client-side use
      secure: false, // Not secure in development
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[User Switcher] Error switching user:', error);
    return NextResponse.json(
      { error: 'Failed to switch user' },
      { status: 500 }
    );
  }
}

/**
 * Get test users - Local Development Only
 */
export async function GET(request: NextRequest) {
  // SECURITY: Only allow in development mode
  if (!AUTH_DISABLED) {
    return NextResponse.json(
      { error: 'User switching is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    // Optional: Fetch current data for test users from database
    let dbUserMap = new Map();
    try {
      const { data: dbUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('id, email, full_name, app_role, department, title')
        .in('id', TEST_USER_IDS);

      if (dbUsers) {
        dbUserMap = new Map(dbUsers.map(u => [u.id, u]));
      }
    } catch (e) {
      // DB query is optional
    }

    // Merge with hardcoded users
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
    console.error('[User Switcher] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test users' },
      { status: 500 }
    );
  }
}
```

---

## File 6: `middleware.ts` (dev mode section to add)

Add this block to your middleware after checking skip paths, before your production auth logic:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Mock user for local development
 */
const MOCK_USER = {
  id: '5b1e1ee7-5850-4b7f-8881-9304c17ab63f',
  auth0_id: 'thomas.palmer@sonance.com',
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  given_name: 'Thomas',
  family_name: 'Palmer',
  picture: null,
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
  title: 'Developer',
  timestamp: Date.now()
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip paths that should be public
  const skipPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/callback',
    '/_next/',
    '/favicon',
    '/unauthorized',
  ];

  if (skipPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if authentication is disabled (dev mode)
  let authDisabled =
    process.env.NEXT_PUBLIC_DISABLE_AUTH?.trim() === 'true' ||
    process.env.DISABLE_AUTH?.trim() === 'true';

  // PRODUCTION FAIL-SAFE: Never allow auth bypass in production
  if (process.env.NODE_ENV === 'production' && authDisabled) {
    console.error('[SECURITY WARNING] Auth bypass detected in production!');
    console.error('[SECURITY WARNING] Forcing authentication to be ENABLED.');
    authDisabled = false;
  }

  if (authDisabled) {
    // Check if there's an existing user cookie from user switcher
    const existingUserCookie = request.cookies.get('ai-intranet-user');
    let currentUser = MOCK_USER;

    if (existingUserCookie) {
      try {
        const parsedUser = JSON.parse(existingUserCookie.value);
        currentUser = parsedUser;
      } catch (error) {
        console.error('[Auth] Failed to parse user cookie, using MOCK_USER');
      }
    }

    // Create request headers with current user data
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-data', JSON.stringify(currentUser));
    requestHeaders.set('x-user-id', currentUser.auth0_id || currentUser.id);
    requestHeaders.set('x-user-role', currentUser.app_role);
    requestHeaders.set('x-user-email', currentUser.email);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Set cookie if there wasn't one already
    if (!existingUserCookie) {
      response.cookies.set('ai-intranet-user', JSON.stringify(MOCK_USER), {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: 86400 // 24 hours
      });
    }

    return response;
  }

  // ... rest of your production auth logic here ...
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|unauthorized|public).*)',
  ],
};
```

---

## File 7: `components/DevUserSwitcher.tsx` (UI Component)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { AUTH_DISABLED } from '@/lib/auth';

interface TestUser {
  id: string;
  email: string;
  full_name: string;
  app_role: string;
  department: string | null;
  title: string | null;
}

interface DevUserSwitcherProps {
  currentUserEmail?: string;
  onSwitch?: () => void;
}

export default function DevUserSwitcher({ currentUserEmail, onSwitch }: DevUserSwitcherProps) {
  const [switching, setSwitching] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Only render in dev mode
  if (!AUTH_DISABLED) return null;

  // Fetch test users when opened
  useEffect(() => {
    if (isOpen && testUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true);
      fetch('/api/auth/switch-user')
        .then(res => res.json())
        .then(data => {
          if (data.users) {
            setTestUsers(data.users);
          }
        })
        .catch(() => {
          // Silent fail
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [isOpen]);

  const handleSwitchUser = async (email: string) => {
    setSwitching(true);
    try {
      const response = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        onSwitch?.();
        window.location.reload();
      } else {
        const data = await response.json();
        console.error('Failed to switch user:', data.error);
        alert('Failed to switch user: ' + data.error);
        setSwitching(false);
      }
    } catch (error) {
      console.error('Error switching user:', error);
      alert('Error switching user');
      setSwitching(false);
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    slt: 'bg-orange-100 text-orange-700',
    leader: 'bg-blue-100 text-blue-700',
    user: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
      >
        🔧 Dev: Switch User
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-2">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Switch User (Dev Only)
            </p>
          </div>

          {loadingUsers ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              Loading users...
            </div>
          ) : testUsers.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No test users found
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {testUsers.map((user) => {
                const isCurrentUser = user.email === currentUserEmail;
                const roleColor = roleColors[user.app_role] || roleColors.user;

                return (
                  <button
                    key={user.email}
                    onClick={() => handleSwitchUser(user.email)}
                    disabled={isCurrentUser || switching}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isCurrentUser
                        ? 'bg-blue-50 border-l-2 border-blue-500'
                        : switching
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-900">
                        {user.full_name}
                        {isCurrentUser && <span className="ml-1 text-blue-600">(current)</span>}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor}`}>
                        {user.app_role}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {user.email}
                    </div>
                    {user.title && (
                      <div className="text-xs text-gray-400 truncate">
                        {user.title}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="px-3 py-2 border-t border-gray-100 mt-1">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## File 8: `app/layout.tsx` (wrap with UserProvider)

```typescript
import { UserProvider } from '@/context/UserContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
```

---

## Usage in Components

```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import DevUserSwitcher from '@/components/DevUserSwitcher';

export default function Header() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <header className="flex items-center justify-between p-4">
      <h1>My App</h1>
      <div className="flex items-center gap-4">
        <span>{user?.full_name}</span>
        <DevUserSwitcher currentUserEmail={user?.email} />
      </div>
    </header>
  );
}
```

---

## Accessing User in API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // User data is set by middleware
  const userData = request.headers.get('x-user-data');
  const userRole = request.headers.get('x-user-role');
  const userEmail = request.headers.get('x-user-email');

  if (!userData) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = JSON.parse(userData);

  // Use user data...
  return NextResponse.json({ user });
}
```

---

## Security Notes

1. **Production Safety**: The middleware forcibly disables auth bypass when `NODE_ENV=production`
2. **Hardcoded Users Only**: Only users in the `TEST_USERS` array can be switched to
3. **Cookie-Based**: Uses the same cookie mechanism as production auth
4. **No Real Auth Bypass**: This doesn't bypass real authentication - it only works when `AUTH_DISABLED=true`

## Database Integration (Optional)

If you want the switcher to reflect real-time role changes from your database, keep the Supabase queries in the API route. Otherwise, remove them and use only the hardcoded values.
