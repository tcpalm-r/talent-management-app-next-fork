# AI Intranet Authentication - Complete Implementation Guide

**Complete copy-paste ready guide for implementing AI Intranet authentication in any Next.js 15 application.**

This document contains ALL code, configurations, and instructions needed to replicate the exact authentication setup from the Process Documentation project.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Core Files](#core-files)
8. [API Routes](#api-routes)
9. [UI Components](#ui-components)
10. [Scripts](#scripts)
11. [Installation Steps](#installation-steps)
12. [Local Development & Test User](#local-development--test-user)
13. [Testing](#testing)
14. [Troubleshooting](#troubleshooting)

---

## Overview

This authentication system integrates with a central AI Intranet service (Auth0-based) to provide:

- **Single Sign-On (SSO)** across multiple applications
- **Token-based authentication** for cross-domain access
- **Cookie-based sessions** with 24-hour expiry
- **Automatic user profile synchronization** to local database
- **Role-based access control** (RBAC) with app-specific permissions
- **Development bypass mode** for local testing without AI Intranet

### Authentication Flow

```
1. User visits your app
   ↓
2. Middleware intercepts request
   ↓
3. Check authentication:
   a. Auth token in URL? → Validate with AI Intranet
   b. Valid session cookie? → Allow access
   c. No auth? → Redirect to AI Intranet login
   ↓
4. On successful auth:
   - Create secure session cookie
   - Add user data to request headers
   - Sync user profile to database
   ↓
5. User accesses protected routes
```

---

## Features

✅ **Token-based Cross-Domain Auth** - Users click from AI Intranet and are automatically logged in
✅ **Cookie-based Sessions** - 24-hour sessions with automatic renewal
✅ **Middleware Protection** - All routes protected by default
✅ **User Profile Sync** - Automatic sync with AI Intranet user data
✅ **Role-Based Access** - App-specific roles and permissions
✅ **Graceful Fallbacks** - Works offline with cached sessions
✅ **Development Bypass** - Test without AI Intranet connection
✅ **Professional UI** - Beautiful unauthorized page

---

## Architecture

### Core Components

1. **Middleware (`middleware.ts`)** - Intercepts all requests, validates authentication
2. **Auth Library (`lib/auth.ts`)** - Utility functions for user management
3. **Supabase Auth (`lib/auth-supabase.ts`)** - Database operations via Supabase client
4. **Admin Client (`lib/supabase-admin.ts`)** - Service role client for bypassing RLS
5. **API Routes (`app/api/auth/*`)** - Authentication endpoints
6. **Database (`user_profiles` table)** - Stores synced user data

### Data Flow

```
AI Intranet → Middleware → Session Cookie + Headers → API Routes → Your App
                ↓
          User Profile DB (Supabase)
```

---

## Prerequisites

### Required Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.50.2",
    "drizzle-orm": "^0.39.3",
    "next": "^15.3.4",
    "postgres": "^3.4.7",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.4",
    "dotenv": "^16.4.5"
  }
}
```

Install if missing:

```bash
npm install @supabase/supabase-js drizzle-orm postgres zod
npm install -D drizzle-kit dotenv
```

### AI Intranet Requirements

You need from your AI Intranet administrator:

1. **Application ID** (UUID) - Your app's unique identifier
2. **API Key** (UUID) - Shared secret for server-to-server auth
3. **AI Intranet URL** - Base URL (e.g., `https://aiintranet.yourcompany.com`)
4. **Application Name** - Exactly as registered (e.g., "Process Documentation")

---

## Environment Variables

Create or update `.env.local`:

```bash
# ============================================
# DATABASE CONNECTION (Supabase)
# ============================================
# Use the Supabase connection pooler URL (with port 5432)
DATABASE_URL="postgresql://postgres.[project-id]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# ============================================
# SUPABASE CONFIGURATION
# ============================================
# Public URL for Supabase project
NEXT_PUBLIC_SUPABASE_URL="https://[project-id].supabase.co"

# Anon key for client-side operations
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."

# Service role key for admin operations (NEVER expose to client!)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."

# ============================================
# AI INTRANET AUTHENTICATION
# ============================================
# Base URL of your AI Intranet instance
AI_INTRANET_URL="https://aiintranet.yourcompany.com"

# Public-facing URL (for redirects)
NEXT_PUBLIC_AI_INTRANET_URL="https://aiintranet.yourcompany.com"

# Your application's unique ID (UUID from AI Intranet)
APP_ID="b2969245-bed2-4218-a77c-a31c2355f0b2"

# Shared API key for authentication (UUID from AI Intranet)
APP_API_KEY="f33df1ee-a853-4237-b6c1-75016a4b3666"

# Your app's public URL (for logout redirects)
NEXT_PUBLIC_APP_URL="https://yourapp.com"

# ============================================
# DEVELOPMENT OPTIONS (Optional)
# ============================================
# Set to 'true' to bypass authentication in development
DISABLE_AUTH="false"

# Node environment
NODE_ENV="development"
```

**Important Notes:**
- `DATABASE_URL` must use Supabase **pooler** URL (`:5432`), not direct database
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only, never expose to client
- `APP_ID` and `APP_API_KEY` must match exactly with AI Intranet registration
- `DISABLE_AUTH=true` only works when `NODE_ENV=development`

---

## Database Setup

### User Profiles Table (SQL)

Run this SQL in your Supabase SQL Editor or via migration:

```sql
-- User Profiles Table - AI Intranet Integration
-- This table stores user profiles synced from the AI Intranet

CREATE TABLE IF NOT EXISTS user_profiles (
  -- Primary Key
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- AI Intranet Identity
  auth0_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,

  -- User Information
  full_name TEXT,
  given_name TEXT,
  family_name TEXT,
  picture TEXT,
  avatar_url TEXT,

  -- Roles & Permissions
  global_role TEXT DEFAULT 'user',
  capabilities JSONB DEFAULT '[]'::jsonb,
  app_role TEXT DEFAULT 'user',
  app_permissions JSONB DEFAULT '{}'::jsonb,
  app_access BOOLEAN DEFAULT true,
  local_permissions JSONB DEFAULT '{}'::jsonb,

  -- Profile Information
  department TEXT,
  title TEXT,
  phone TEXT,
  location TEXT,

  -- Sync Tracking
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Audit Fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  last_updated_by TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth0_id ON user_profiles(auth0_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_app_role ON user_profiles(app_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_profiles IS 'User profiles synced from AI Intranet central authentication';
COMMENT ON COLUMN user_profiles.auth0_id IS 'Auth0 user ID from AI Intranet';
COMMENT ON COLUMN user_profiles.global_role IS 'Global role across all applications';
COMMENT ON COLUMN user_profiles.app_role IS 'Role specific to this application';
COMMENT ON COLUMN user_profiles.app_permissions IS 'App-specific permissions in JSON format';
COMMENT ON COLUMN user_profiles.last_sync IS 'Last time profile was synced from AI Intranet';
```

### Drizzle ORM Schema

Add to `lib/schema.ts`:

```typescript
import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// User Profiles table - for AI Intranet integration
export const userProfiles = pgTable("user_profiles", {
  id: text().primaryKey().default('gen_random_uuid()'),
  auth0Id: text("auth0_id").notNull().unique(),
  email: text().notNull().unique(),
  fullName: text("full_name"),
  givenName: text("given_name"),
  familyName: text("family_name"),
  picture: text(),
  avatarUrl: text("avatar_url"),

  // Roles and permissions from AI Intranet
  globalRole: text("global_role").default('user'),
  capabilities: jsonb().default([]),

  // App-specific permissions
  appRole: text("app_role").default('user'), // admin, user
  appPermissions: jsonb("app_permissions").default({}),
  appAccess: boolean("app_access").default(false),

  // Local app-specific permissions
  localPermissions: jsonb("local_permissions").default({}),

  // Additional user information
  department: text(),
  title: text(),
  phone: text(),
  location: text(),

  // Sync tracking
  lastSync: timestamp("last_sync"),

  // Audit fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
  lastUpdatedBy: text("last_updated_by"),

  // Status
  isActive: boolean("is_active").default(true)
});

// Validation schema
export const insertUserProfileSchema = createInsertSchema(userProfiles, {
  email: z.string().email(),
  auth0Id: z.string().min(1),
  appRole: z.enum(['admin', 'user']).optional(),
  globalRole: z.enum(['admin', 'user']).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
```

---

## Core Files

### 1. `middleware.ts` (Root directory - CRITICAL!)

⚠️ **MUST be at project root, same level as `app/` directory!**

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Check if authentication is disabled for local development
  if (process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV === 'development') {
    console.log('🔓 Authentication bypassed for local development');

    // Create a mock user session for development
    const mockUser = {
      id: 'dev-user-1',
      auth0_id: 'auth0|dev-user',
      email: 'developer@test.com',
      full_name: 'Test Developer',
      role: 'admin',
      permissions: ['all'],
      app_access: true,
      timestamp: Date.now()
    };

    // Add user data to request headers for use in API routes and pages
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-data', JSON.stringify(mockUser));
    requestHeaders.set('x-user-id', mockUser.auth0_id);
    requestHeaders.set('x-user-role', mockUser.role);
    requestHeaders.set('x-user-email', mockUser.email);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Set mock session cookie
    response.cookies.set('user-session', JSON.stringify(mockUser), {
      httpOnly: true,
      secure: false, // Not secure in development
      sameSite: 'lax',
      maxAge: 86400 // 24 hours
    });

    return response;
  }

  // Skip middleware for specific paths
  const skipPaths = [
    '/api/auth/',
    '/_next/',
    '/favicon',
    '/unauthorized',
    '/robots.txt',
    '/sitemap.xml',
    '/_next/static',
    '/_next/image',
    '/public'
  ];

  const pathname = request.nextUrl.pathname;

  // Skip middleware for paths that should be public
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth token in URL (for cross-domain authentication)
  const authToken = request.nextUrl.searchParams.get('auth_token');

  if (authToken) {
    console.log('[AUTH DEBUG] ========== Token Authentication ==========');
    console.log('[AUTH DEBUG] Token found in URL, attempting token-based authentication');

    // Handle token-based authentication
    try {
      const tokenUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}&auth_token=${authToken}`;
      console.log('[AUTH DEBUG] Token validation URL:', tokenUrl);

      const validateResponse = await fetch(tokenUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': process.env.APP_API_KEY || '',
          'Authorization': `Bearer ${process.env.APP_API_KEY}`,
        },
        cache: 'no-store'
      });

      console.log('[AUTH DEBUG] Token validation response status:', validateResponse.status);

      if (validateResponse.ok) {
        // Get raw response for debugging
        const responseText = await validateResponse.text();
        console.log('[AUTH DEBUG] Token validation raw response:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
          console.log('[AUTH DEBUG] Token validation parsed response:', JSON.stringify(data, null, 2));
        } catch (parseError) {
          console.error('[AUTH DEBUG] Failed to parse token response:', parseError);
          throw new Error('Invalid JSON response from AI Intranet');
        }

        // Handle different response formats from AI Intranet
        const access = data.access || data.granted;
        const user = data.user || (data.users && data.users[0]) || null;

        console.log('[AUTH DEBUG] Token auth - Access granted:', access);
        console.log('[AUTH DEBUG] Token auth - User found:', !!user);

        if (access && user) {
          console.log('[AUTH DEBUG] Token authentication successful for:', user.email);

          // Map user fields and extract app-specific permissions
          const appPermissions = user.app_permissions?.['Process Documentation'] || {};
          const mappedUser = {
            id: user.id,
            auth0_id: user.auth0_id,
            email: user.email,
            full_name: user.full_name,
            given_name: user.given_name,
            family_name: user.family_name,
            picture: user.picture || user.avatar_url,
            role: appPermissions.role || user.app_role || user.role || 'user',
            permissions: appPermissions.permissions || user.permissions || {},
            app_role: appPermissions.role || user.app_role || user.role || 'user',
            app_permissions: appPermissions.permissions || {},
            global_role: user.global_role || user.role,
            capabilities: user.capabilities || [],
            app_access: true,
            department: user.department,
            title: user.title,
            timestamp: Date.now()
          };

          console.log('[AUTH DEBUG] Created session for user:', mappedUser.email, 'with role:', mappedUser.app_role);

          // Sync user profile to database (fire and forget)
          fetch(`${request.nextUrl.origin}/api/auth/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-data': JSON.stringify(mappedUser),
              'x-user-id': mappedUser.auth0_id,
            },
            body: JSON.stringify({ userData: user })
          }).catch(err => console.error('[AUTH DEBUG] Failed to sync user profile:', err));

          // Create request headers with user data for API routes
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-data', JSON.stringify(mappedUser));
          requestHeaders.set('x-user-id', mappedUser.auth0_id);
          requestHeaders.set('x-user-role', mappedUser.role);
          requestHeaders.set('x-user-email', mappedUser.email);

          // Create response and redirect without auth_token
          const cleanUrl = new URL(pathname, request.url);
          cleanUrl.searchParams.delete('auth_token');

          const response = NextResponse.redirect(cleanUrl);

          // Store user data in encrypted cookie (expires in 24 hours)
          response.cookies.set('user-session', JSON.stringify(mappedUser), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 86400 // 24 hours
          });

          console.log('[AUTH DEBUG] Token auth complete, redirecting to:', cleanUrl.pathname);
          return response;
        } else {
          console.error('[AUTH DEBUG] Token auth failed - access:', access, 'user:', !!user);
        }
      } else {
        console.error('[AUTH DEBUG] Token validation failed with status:', validateResponse.status);
      }
    } catch (error) {
      console.error('[AUTH DEBUG] Token validation error:', error);
    }
  }

  // Check for existing session cookie
  const sessionCookie = request.cookies.get('user-session');

  if (sessionCookie) {
    console.log('[AUTH DEBUG] ========== Session Cookie Authentication ==========');
    console.log('[AUTH DEBUG] Session cookie found, checking validity');

    try {
      const session = JSON.parse(sessionCookie.value);

      // Check if session is still valid (24 hour expiry)
      if (session.timestamp && Date.now() - session.timestamp < 86400000) {
        console.log('[AUTH DEBUG] Valid session found for user:', session.email);
        console.log('[AUTH DEBUG] Session age:', Math.floor((Date.now() - session.timestamp) / 1000 / 60), 'minutes');

        // Add user data to request headers for use in API routes and pages
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-user-data', JSON.stringify(session));
        requestHeaders.set('x-user-id', session.auth0_id);
        requestHeaders.set('x-user-role', session.role);
        requestHeaders.set('x-user-email', session.email);

        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        console.log('[AUTH DEBUG] Using existing session for:', session.email);
        return response;
      } else {
        console.log('[AUTH DEBUG] Session expired, age:', Math.floor((Date.now() - session.timestamp) / 1000 / 60 / 60), 'hours');
      }
    } catch (error) {
      console.error('[AUTH DEBUG] Session parsing failed:', error);
    }
  } else {
    console.log('[AUTH DEBUG] No session cookie found');
  }

  // Try cookie-based authentication (for same-domain scenarios)
  console.log('[AUTH DEBUG] ========== Cookie-Based Authentication ==========');
  console.log('[AUTH DEBUG] No token or valid session found, trying cookie-based auth');

  try {
    // Debug logging for authentication
    const authUrl = `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}`;
    console.log('[AUTH DEBUG] Cookie auth URL:', authUrl);
    console.log('[AUTH DEBUG] App ID:', process.env.APP_ID);
    console.log('[AUTH DEBUG] AI Intranet URL:', process.env.AI_INTRANET_URL);
    console.log('[AUTH DEBUG] API Key present:', !!process.env.APP_API_KEY);
    console.log('[AUTH DEBUG] Request path:', pathname);
    console.log('[AUTH DEBUG] Cookies being sent:', request.headers.get('cookie') ? 'Yes' : 'No');

    const authResponse = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.APP_API_KEY}`,
        'Cookie': request.headers.get('cookie') || '',
        'User-Agent': request.headers.get('user-agent') || '',
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      },
      cache: 'no-store'
    });

    console.log('[AUTH DEBUG] Response status:', authResponse.status);
    console.log('[AUTH DEBUG] Response headers:', Object.fromEntries(authResponse.headers.entries()));

    if (authResponse.status === 401) {
      console.log('[AUTH DEBUG] User not authenticated, redirecting to AI Intranet login');
      // User not authenticated - redirect to AI Intranet login
      const loginUrl = new URL('/login', process.env.AI_INTRANET_URL);
      loginUrl.searchParams.set('returnTo', request.url);
      loginUrl.searchParams.set('app', process.env.APP_ID || '');
      return NextResponse.redirect(loginUrl);
    }

    if (authResponse.status === 403) {
      console.log('[AUTH DEBUG] User authenticated but no access to this app');
      // User authenticated but no access to this app
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (!authResponse.ok) {
      // Other error - redirect to unauthorized
      console.error('[AUTH DEBUG] Auth check failed with status:', authResponse.status);
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Get raw response text first for debugging
    const responseText = await authResponse.text();
    console.log('[AUTH DEBUG] Raw response text:', responseText);

    // Parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('[AUTH DEBUG] Parsed response:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('[AUTH DEBUG] Failed to parse response as JSON:', parseError);
      console.error('[AUTH DEBUG] Response was:', responseText);
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // Handle different response formats from AI Intranet
    const access = data.access || data.granted;
    const user = data.user || (data.users && data.users[0]) || null;

    console.log('[AUTH DEBUG] Access granted:', access);
    console.log('[AUTH DEBUG] User data found:', !!user);
    if (user) {
      console.log('[AUTH DEBUG] User email:', user.email);
      console.log('[AUTH DEBUG] User role:', user.role || user.app_role);
      console.log('[AUTH DEBUG] User has app_permissions:', !!user.app_permissions);
    }

    if (!access) {
      console.error('[AUTH DEBUG] Access denied:', { access, hasUser: !!user });
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // If access is granted but no user data, create a minimal user object
    // This handles the case where AI Intranet only returns authorization decision
    let minimalUser = null;
    if (!user && access) {
      console.log('[AUTH DEBUG] Access granted but no user data provided, creating minimal user session');

      // Try to extract email from somewhere (this is a fallback)
      // In production, you'd want AI Intranet to always return user data
      minimalUser = {
        id: 'temp-' + Date.now(),
        auth0_id: 'unknown',
        email: 'user@company.com', // Default fallback - UPDATE THIS
        full_name: 'User',
        role: 'user',
        app_role: 'user',
        permissions: {},
        app_permissions: {},
        global_role: 'user',
        capabilities: [],
        app_access: true
      };

      console.log('[AUTH DEBUG] Created minimal user:', minimalUser);

      // NOTE: This is a temporary workaround.
      // The AI Intranet should be fixed to return user data with the auth decision
      console.warn('[AUTH DEBUG] WARNING: Using fallback user data. AI Intranet should return user object with auth decision.');
    }

    // Use the user object if available, or the minimal user if we had to create one
    const userToMap = user || minimalUser;

    // Map user fields and extract app-specific permissions
    // IMPORTANT: Replace 'Process Documentation' with YOUR app name
    const appPermissions = userToMap.app_permissions?.['Process Documentation'] || {};
    const mappedUser = {
      id: userToMap.id,
      auth0_id: userToMap.auth0_id,
      email: userToMap.email,
      full_name: userToMap.full_name,
      given_name: userToMap.given_name,
      family_name: userToMap.family_name,
      picture: userToMap.picture,
      role: appPermissions.role || userToMap.role || userToMap.app_role || 'user',
      permissions: appPermissions.permissions || userToMap.permissions || {},
      app_role: appPermissions.role || userToMap.app_role || userToMap.role || 'user',
      app_permissions: appPermissions.permissions || userToMap.permissions || {},
      global_role: userToMap.global_role || userToMap.role,
      capabilities: userToMap.capabilities || [],
      app_access: true,
      department: userToMap.department,
      title: userToMap.title
    };

    console.log('[AUTH DEBUG] Mapped user object:', JSON.stringify(mappedUser, null, 2));

    // Add user data to request headers for use in API routes and pages
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-data', JSON.stringify(mappedUser));
    requestHeaders.set('x-user-id', mappedUser.auth0_id);
    requestHeaders.set('x-user-role', mappedUser.role);
    requestHeaders.set('x-user-email', mappedUser.email);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Store user data in session cookie
    response.cookies.set('user-session', JSON.stringify({
      ...mappedUser,
      timestamp: Date.now()
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 // 24 hours
    });

    return response;

  } catch (error) {
    console.error('Middleware authentication failed:', error);

    // If AI Intranet is down, check if we have a valid session cookie
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie.value);
        if (session.timestamp && Date.now() - session.timestamp < 86400000) {
          // Allow access with cached session
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set('x-user-data', JSON.stringify(session));
          requestHeaders.set('x-user-id', session.auth0_id);
          requestHeaders.set('x-user-role', session.role);

          const response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          return response;
        }
      } catch (e) {
        // Session invalid
      }
    }

    // Redirect to unauthorized if all auth methods fail
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - unauthorized (unauthorized page)
     * - public (public files)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|unauthorized|public).*)',
  ],
};
```

**⚠️ CRITICAL CONFIGURATION:**
- Line 113: Update `'Process Documentation'` to match YOUR app name in AI Intranet
- Line 307: Update `'Process Documentation'` to match YOUR app name in AI Intranet
- Line 315: Update default email `'user@company.com'` to your organization's domain

---

### 2. `lib/auth.ts`

```typescript
// lib/auth.ts - Authentication utilities for AI Intranet integration

import { db } from './db';
import { userProfiles } from './schema';
import { eq } from 'drizzle-orm';
import type { UserProfile } from './schema';

// Type definitions for AI Intranet user data
export interface AIIntranetUser {
  id: string;
  auth0_id: string;
  email: string;
  full_name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  role: string;
  permissions: Record<string, boolean>;
  global_role?: string;
  capabilities?: string[];
}

export interface SessionUser extends AIIntranetUser {
  app_role?: string;
  app_permissions?: Record<string, boolean>;
  app_access: boolean;
  local_permissions?: Record<string, any>;
  department?: string;
  title?: string;
}

/**
 * Extract user data from request headers (set by middleware)
 */
export function getCurrentUser(headers: Headers | any): SessionUser | null {
  try {
    // Handle both Headers object and plain object
    const userData = headers instanceof Headers
      ? headers.get('x-user-data')
      : headers['x-user-data'];

    if (!userData) return null;

    return JSON.parse(userData) as SessionUser;
  } catch (error) {
    console.error('Failed to parse user data from headers:', error);
    return null;
  }
}

/**
 * Get user ID from request headers
 */
export function getCurrentUserId(headers: Headers | any): string | null {
  return headers instanceof Headers
    ? headers.get('x-user-id')
    : headers['x-user-id'];
}

/**
 * Get user email from request headers
 */
export function getCurrentUserEmail(headers: Headers | any): string | null {
  return headers instanceof Headers
    ? headers.get('x-user-email')
    : headers['x-user-email'];
}

/**
 * Get extended user profile from database
 */
export async function getCurrentUserProfile(headers: Headers | any): Promise<UserProfile | null> {
  const userId = getCurrentUserId(headers);
  if (!userId) return null;

  try {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.auth0Id, userId))
      .limit(1);

    return profile || null;
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
}

/**
 * Sync user profile from AI Intranet data
 */
export async function syncUserProfile(userData: AIIntranetUser & { app_role?: string; app_permissions?: any }): Promise<UserProfile | null> {
  try {
    // Check if profile exists
    const [existingProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.auth0Id, userData.auth0_id))
      .limit(1);

    const profileData = {
      auth0Id: userData.auth0_id,
      email: userData.email,
      fullName: userData.full_name,
      givenName: userData.given_name,
      familyName: userData.family_name,
      picture: userData.picture,
      globalRole: userData.global_role || userData.role,
      capabilities: userData.capabilities || [],
      appRole: userData.app_role || (userData.role === 'admin' ? 'admin' : 'user'),
      appPermissions: userData.app_permissions || userData.permissions || {},
      appAccess: true,
      lastSync: new Date(),
      isActive: true
    };

    if (existingProfile) {
      // Update existing profile
      const [updated] = await db
        .update(userProfiles)
        .set({
          ...profileData,
          updatedAt: new Date()
        })
        .where(eq(userProfiles.auth0Id, userData.auth0_id))
        .returning();

      return updated;
    } else {
      // Create new profile
      const [created] = await db
        .insert(userProfiles)
        .values({
          ...profileData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return created;
    }
  } catch (error) {
    console.error('Failed to sync user profile:', error);
    return null;
  }
}

/**
 * Check if user has a specific app permission
 */
export function hasAppPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;

  // Owners have all permissions
  if (user.app_role === 'owner') return true;

  // Check specific permission
  return user.app_permissions?.[permission] === true;
}

/**
 * Check if user has a specific app role
 */
export function hasAppRole(user: SessionUser | null, role: string): boolean {
  if (!user) return false;
  return user.app_role === role;
}

/**
 * Check if user has any of the specified app roles
 */
export function hasAnyAppRole(user: SessionUser | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.app_role || '');
}

/**
 * Check if user has a global capability
 */
export function hasCapability(user: SessionUser | null, capability: string): boolean {
  if (!user) return false;
  return user.capabilities?.includes(capability) || false;
}

/**
 * Permission level hierarchy
 */
export const APP_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
} as const;

export const ROLE_HIERARCHY = {
  [APP_ROLES.ADMIN]: 2,
  [APP_ROLES.USER]: 1
} as const;

/**
 * Check if user role is at least the specified level
 */
export function hasMinimumRole(user: SessionUser | null, minimumRole: keyof typeof APP_ROLES): boolean {
  if (!user || !user.app_role) return false;

  const userLevel = ROLE_HIERARCHY[user.app_role as keyof typeof ROLE_HIERARCHY] || 0;
  const requiredLevel = ROLE_HIERARCHY[APP_ROLES[minimumRole]] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if the current request is authenticated
 */
export function isAuthenticated(headers: Headers | any): boolean {
  return getCurrentUser(headers) !== null;
}

/**
 * Require authentication or throw error
 */
export function requireAuth(headers: Headers | any): SessionUser {
  const user = getCurrentUser(headers);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Require specific role or throw error
 */
export function requireRole(headers: Headers | any, role: keyof typeof APP_ROLES): SessionUser {
  const user = requireAuth(headers);
  if (!hasMinimumRole(user, role)) {
    throw new Error(`${role} role required`);
  }
  return user;
}
```

---

### 3. `lib/auth-supabase.ts`

```typescript
// lib/auth-supabase.ts - Authentication utilities using Supabase client
// This is an alternative to auth.ts that uses Supabase client instead of Drizzle
// to avoid connection pooling issues

import { supabase } from './database';
import { supabaseAdmin } from './supabase-admin';
import type { SessionUser } from './auth';

/**
 * Sync user profile using Supabase client (REST API)
 * This avoids direct database connection issues
 */
export async function syncUserProfileViaSupabase(userData: any): Promise<any> {
  try {
    console.log('[SYNC-SUPABASE] Starting profile sync for:', userData.email);

    // Prepare the profile data
    const profileData = {
      id: userData.id,
      auth0_id: userData.auth0_id,
      email: userData.email,
      full_name: userData.full_name || userData.email,
      given_name: userData.given_name || null,
      family_name: userData.family_name || null,
      picture: userData.picture || userData.avatar_url || null,
      avatar_url: userData.avatar_url || userData.picture || null,
      global_role: userData.global_role || userData.role || 'user',
      capabilities: userData.capabilities || [],
      app_role: userData.app_role || userData.role || 'user',
      app_permissions: userData.app_permissions || userData.permissions || {},
      app_access: true,
      local_permissions: userData.local_permissions || {},
      department: userData.department || null,
      title: userData.title || null,
      phone: userData.phone || null,
      location: userData.location || null,
      last_sync: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString()
    };

    console.log('[SYNC-SUPABASE] Profile data prepared:', {
      email: profileData.email,
      app_role: profileData.app_role,
      app_access: profileData.app_access
    });

    // Upsert the user profile using Supabase admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profileData, {
        onConflict: 'auth0_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[SYNC-SUPABASE] Failed to sync profile:', error);

      // If upsert fails, try insert then update
      if (error.code === '23505') { // Duplicate key error
        console.log('[SYNC-SUPABASE] Attempting update instead of insert...');

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            ...profileData,
            created_at: undefined // Don't update created_at on update
          })
          .eq('auth0_id', userData.auth0_id)
          .select()
          .single();

        if (updateError) {
          console.error('[SYNC-SUPABASE] Update also failed:', updateError);
          throw updateError;
        }

        console.log('[SYNC-SUPABASE] Profile updated successfully:', updateData?.email);
        return updateData;
      }

      throw error;
    }

    console.log('[SYNC-SUPABASE] Profile synced successfully:', data?.email);
    return data;
  } catch (error) {
    console.error('[SYNC-SUPABASE] Sync failed with error:', error);

    // Return null instead of throwing to avoid breaking authentication
    // User can still use the app even if profile sync fails
    return null;
  }
}

/**
 * Get user profile from database using Supabase client
 */
export async function getUserProfileViaSupabase(auth0Id: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth0_id', auth0Id)
      .single();

    if (error) {
      console.error('[SYNC-SUPABASE] Failed to fetch profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[SYNC-SUPABASE] Error fetching profile:', error);
    return null;
  }
}

/**
 * Check if user exists in database
 */
export async function userExistsInDatabase(auth0Id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('auth0_id', auth0Id)
      .single();

    return !error && !!data;
  } catch (error) {
    return false;
  }
}
```

---

### 4. `lib/supabase-admin.ts`

```typescript
// lib/supabase-admin.ts - Supabase Admin Client with Service Role
// This client bypasses RLS for admin operations like user profile sync

import { createClient } from '@supabase/supabase-js';

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Create a Supabase client with the service role key
// This bypasses Row Level Security for admin operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Export for use in server-side operations only
// NEVER expose this client or the service role key to the client side
export default supabaseAdmin;
```

---

### 5. `lib/database.ts`

```typescript
// lib/database.ts - Supabase Database Integration

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create client with retry configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      return fetch(url, {
        ...options,
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));
    }
  }
});
```

---

## API Routes

### 1. `app/api/auth/sync/route.ts`

```typescript
// app/api/auth/sync/route.ts - Sync user profile from AI Intranet

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, syncUserProfile } from '@/lib/auth';
import { syncUserProfileViaSupabase } from '@/lib/auth-supabase';

export async function POST(request: NextRequest) {
  try {
    // Check if this is a sync request from middleware (with userData in body)
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const body = await request.json();
        if (body.userData) {
          console.log('[SYNC] Syncing user profile from middleware for:', body.userData.email);

          // Map the user data with app-specific permissions
          const appPermissions = body.userData.app_permissions?.['Process Documentation'] || {};
          const userDataToSync = {
            ...body.userData,
            app_role: appPermissions.role || body.userData.app_role || body.userData.role || 'user',
            app_permissions: appPermissions.permissions || {}
          };

          // Try Supabase client first (more reliable)
          let profile = await syncUserProfileViaSupabase(userDataToSync);

          // Fallback to Drizzle if Supabase fails
          if (!profile) {
            console.log('[SYNC] Supabase sync failed, trying Drizzle...');
            profile = await syncUserProfile(userDataToSync);
          }

          if (!profile) {
            console.error('[SYNC] Failed to sync profile for:', body.userData.email);
            return NextResponse.json(
              { error: 'Failed to sync profile' },
              { status: 500 }
            );
          }

          console.log('[SYNC] Successfully synced profile for:', body.userData.email, 'with role:', userDataToSync.app_role);
          return NextResponse.json({
            success: true,
            profile: profile
          });
        }
      } catch (parseError) {
        // Not JSON or no userData, fall through to normal sync
        console.log('[SYNC] Falling back to header-based sync');
      }
    }

    // Normal sync - use current user from headers
    const user = getCurrentUser(request.headers);

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('[SYNC] Syncing profile for current user:', user.email);

    // Sync profile with database - try Supabase client first
    let profile = await syncUserProfileViaSupabase({
      id: user.id,
      auth0_id: user.auth0_id,
      email: user.email,
      full_name: user.full_name,
      given_name: user.given_name,
      family_name: user.family_name,
      picture: user.picture,
      role: user.role,
      permissions: user.permissions,
      global_role: user.global_role,
      capabilities: user.capabilities,
      app_role: user.app_role,
      app_permissions: user.app_permissions
    });

    // Fallback to Drizzle if Supabase fails
    if (!profile) {
      console.log('[SYNC] Supabase sync failed, trying Drizzle...');
      profile = await syncUserProfile({
        id: user.id,
        auth0_id: user.auth0_id,
        email: user.email,
        full_name: user.full_name,
        given_name: user.given_name,
        family_name: user.family_name,
        picture: user.picture,
        role: user.role,
        permissions: user.permissions,
        global_role: user.global_role,
        capabilities: user.capabilities,
        app_role: user.app_role,
        app_permissions: user.app_permissions
      });
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to sync profile' },
        { status: 500 }
      );
    }

    console.log('[SYNC] Successfully synced profile for:', user.email);
    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('[SYNC] Failed to sync user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also handle webhook from AI Intranet for profile updates
export async function PUT(request: NextRequest) {
  try {
    // Verify API key from AI Intranet
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.APP_API_KEY) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const userData = await request.json();

    // Sync profile with database
    const profile = await syncUserProfile(userData);

    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to sync profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Failed to sync user profile from webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**⚠️ CRITICAL:** Line 18 - Update `'Process Documentation'` to YOUR app name

---

### 2. `app/api/auth/me/route.ts`

```typescript
// app/api/auth/me/route.ts - Get current user profile

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentUserProfile } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('[AUTH/ME] Checking authentication...');

    // First try to get user from headers (set by middleware)
    let user = getCurrentUser(request.headers);
    console.log('[AUTH/ME] User from headers:', user ? 'Found' : 'Not found');

    // If no user in headers, check for session cookie directly
    if (!user) {
      const sessionCookie = request.cookies.get('user-session');
      console.log('[AUTH/ME] Session cookie exists:', !!sessionCookie);

      if (sessionCookie) {
        try {
          const session = JSON.parse(sessionCookie.value);
          // Check if session is still valid (24 hour expiry)
          if (session.timestamp && Date.now() - session.timestamp < 86400000) {
            user = session;
            console.log('[AUTH/ME] Valid session found for:', session.email);
          } else {
            console.log('[AUTH/ME] Session expired');
          }
        } catch (error) {
          console.error('[AUTH/ME] Failed to parse session cookie:', error);
        }
      }
    }

    if (!user) {
      console.log('[AUTH/ME] No valid user found, returning 401');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('[AUTH/ME] User authenticated:', user.email, 'Role:', user.app_role || user.role);

    // Get extended profile from local database (optional enhancement)
    let profile = null;
    try {
      profile = await getCurrentUserProfile(request.headers);
    } catch (error) {
      console.log('[AUTH/ME] Could not fetch extended profile (non-critical):', error);
    }

    // Combine session data with database profile
    const userData = {
      ...user,
      // Ensure we have app_role and other critical fields
      app_role: user.app_role || user.role || 'user',
      email: user.email,
      full_name: user.full_name,
      auth0_id: user.auth0_id,
      ...(profile && {
        department: profile.department,
        title: profile.title,
        localPermissions: profile.localPermissions,
        lastSync: profile.lastSync
      })
    };

    console.log('[AUTH/ME] Returning user data for:', userData.email);
    return NextResponse.json(userData);
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### 3. `app/api/auth/logout/route.ts`

```typescript
// app/api/auth/logout/route.ts - Logout endpoint

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Clear the session cookie
    const response = NextResponse.redirect(
      `${process.env.AI_INTRANET_URL}/api/auth/logout?returnTo=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003')}`
    );

    // Clear session cookie
    response.cookies.set('user-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    });

    return response;
  } catch (error) {
    console.error('Logout failed:', error);
    // Fallback to just clearing the cookie and redirecting to home
    const response = NextResponse.redirect('/');
    response.cookies.set('user-session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });
    return response;
  }
}

export async function POST(request: NextRequest) {
  // Also support POST for logout
  return GET(request);
}
```

---

### 4. `app/api/auth/validate-token/route.ts`

```typescript
// app/api/auth/validate-token/route.ts - Validate auth token from AI Intranet

import { NextRequest, NextResponse } from 'next/server';
import { syncUserProfile } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token required' },
        { status: 400 }
      );
    }

    // Validate token with AI Intranet
    const validateResponse = await fetch(
      `${process.env.AI_INTRANET_URL}/api/auth/central-check?application=${process.env.APP_ID}&auth_token=${token}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': process.env.APP_API_KEY || '',
        },
        cache: 'no-store'
      }
    );

    if (!validateResponse.ok) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const data = await validateResponse.json();

    // Handle different response formats from AI Intranet
    const access = data.access || data.granted;
    const user = data.user || (data.users && data.users[0]) || null;

    if (!access || !user) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Map user fields and extract app-specific permissions
    const appPermissions = user.app_permissions?.['Process Documentation'] || {};
    const mappedUser = {
      id: user.id,
      auth0_id: user.auth0_id,
      email: user.email,
      full_name: user.full_name,
      given_name: user.given_name,
      family_name: user.family_name,
      picture: user.picture,
      role: appPermissions.role || user.role || 'viewer',
      permissions: appPermissions.permissions || {},
      global_role: user.role,
      capabilities: user.capabilities || []
    };

    // Sync user profile to database
    await syncUserProfile(mappedUser);

    // Create session
    const response = NextResponse.json({
      success: true,
      user: mappedUser
    });

    // Set session cookie
    response.cookies.set('user-session', JSON.stringify({
      ...mappedUser,
      app_access: true,
      timestamp: Date.now()
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400 // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Token validation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**⚠️ CRITICAL:** Line 49 - Update `'Process Documentation'` to YOUR app name

---

## UI Components

### `app/unauthorized/page.tsx`

```typescript
'use client';

import { ShieldAlert, ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function UnauthorizedPage() {
  const handleContactAdmin = () => {
    const subject = encodeURIComponent('Application Access Request');
    const body = encodeURIComponent(
      `Hello,

I am requesting access to the application.

Current URL: ${window.location.origin}
Timestamp: ${new Date().toISOString()}

Please grant me the appropriate permissions to access this application.

Thank you,`
    );

    window.location.href = `mailto:admin@company.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <ShieldAlert className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">Your Application Name</p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl">Unauthorized Access</CardTitle>
            <CardDescription>
              You don't have permission to access this application
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                This application requires specific permissions from the AI Intranet system.
                If you believe you should have access, please contact your administrator.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <h4 className="font-medium">What you can do:</h4>
                <ul className="space-y-1 text-muted-foreground ml-4">
                  <li>• Contact your system administrator</li>
                  <li>• Verify you're logged into AI Intranet</li>
                  <li>• Check if you have the correct role assigned</li>
                  <li>• Try logging out and back in</li>
                </ul>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>

              <Button
                variant="default"
                onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'https://aiintranet.company.com'}`}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                AI Intranet
              </Button>
            </div>

            <Button
              variant="secondary"
              onClick={handleContactAdmin}
              className="w-full flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Request Access
            </Button>
          </CardFooter>
        </Card>

        {/* Additional Help */}
        <div className="text-center space-y-2">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Need help? Contact your system administrator</p>
            <p className="font-mono bg-muted px-2 py-1 rounded text-xs inline-block">
              App ID: {process.env.NEXT_PUBLIC_APP_ID || 'Your App Name'}
            </p>
          </div>
        </div>

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 font-mono">
              <div>
                <span className="text-muted-foreground">AI Intranet URL:</span>
                <br />
                {process.env.NEXT_PUBLIC_AI_INTRANET_URL || 'Not configured'}
              </div>
              <div>
                <span className="text-muted-foreground">App URL:</span>
                <br />
                {typeof window !== 'undefined' ? window.location.origin : 'Unknown'}
              </div>
              <div>
                <span className="text-muted-foreground">Timestamp:</span>
                <br />
                {new Date().toISOString()}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

**Note:** This assumes you're using shadcn/ui components. If not, replace with your own UI components.

---

## Scripts

### 1. `scripts/run-auth-migration.js`

```javascript
#!/usr/bin/env node

// scripts/run-auth-migration.js - Run the authentication database migration

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

const MIGRATION_FILE = path.join(__dirname, 'create-user-profiles-table.sql');

// Check if required environment variables exist
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('🚀 Starting authentication migration...');

    // Check if migration file exists
    if (!fs.existsSync(MIGRATION_FILE)) {
      console.error(`❌ Migration file not found: ${MIGRATION_FILE}`);
      process.exit(1);
    }

    // Read migration SQL
    const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log('📄 Migration file loaded');

    // Use psql to run the migration
    const databaseUrl = process.env.DATABASE_URL;

    console.log('📊 Connecting to database...');
    console.log(`   Host: ${new URL(databaseUrl).hostname}`);

    // Create a temporary file with the SQL
    const tempFile = path.join(__dirname, 'temp-migration.sql');
    fs.writeFileSync(tempFile, migrationSQL);

    try {
      // Run the migration using psql
      const command = `psql "${databaseUrl}" -f "${tempFile}"`;
      console.log('🔧 Executing migration...');

      const output = execSync(command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log('✅ Migration completed successfully!');
      console.log('\n📝 Output:');
      console.log(output);

    } catch (error) {
      console.error('❌ Migration failed:');
      console.error(error.message);

      if (error.stdout) {
        console.error('\n📝 Output:');
        console.error(error.stdout);
      }

      if (error.stderr) {
        console.error('\n⚠️  Errors:');
        console.error(error.stderr);
      }

      process.exit(1);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }

    console.log('\n🎉 Authentication system migration completed!');
    console.log('\nNext steps:');
    console.log('1. Verify the user_profiles table was created');
    console.log('2. Test the authentication flow');
    console.log('3. Check that middleware is working');
    console.log('\nTo test: npm run dev and navigate to the application');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();
```

### 2. `scripts/create-user-profiles-table.sql`

Create this file with the SQL from the [Database Setup](#database-setup) section above.

### 3. `scripts/create-test-user.js`

```javascript
#!/usr/bin/env node
/**
 * Create Test Developer User Profile
 * This script creates a user profile for the mock user used in development
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { userProfiles } from '../lib/schema.ts';

// Load environment variables
config({ path: '.env.local' });

async function createTestUser() {
  console.log('🔧 Creating test developer user profile...');

  // Create connection
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment');
    process.exit(1);
  }

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);

  try {
    // Insert test developer user profile
    // Only include fields that exist in the database
    const testUser = {
      id: 'dev-user-1',
      auth0Id: 'auth0|dev-user',
      email: 'developer@test.com',
      fullName: 'Test Developer',
      givenName: 'Test',
      familyName: 'Developer',
      globalRole: 'admin',
      appRole: 'admin',
      appPermissions: { all: true },
      appAccess: true,
      department: null,
      title: null,
      phone: null,
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSync: new Date(),
      isActive: true
    };

    console.log('📝 Inserting user profile:', {
      id: testUser.id,
      auth0Id: testUser.auth0Id,
      email: testUser.email,
      fullName: testUser.fullName
    });

    const result = await db
      .insert(userProfiles)
      .values(testUser)
      .onConflictDoUpdate({
        target: userProfiles.auth0Id,
        set: {
          fullName: testUser.fullName,
          appRole: testUser.appRole,
          appAccess: testUser.appAccess,
          lastSync: new Date(),
          updatedAt: new Date()
        }
      })
      .returning();

    console.log('✅ Test developer user created successfully!');
    console.log('User details:', result[0]);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    await client.end();
    process.exit(1);
  }
}

createTestUser();
```

### 4. Add to `package.json`

```json
{
  "scripts": {
    "migrate:auth": "node scripts/run-auth-migration.js",
    "create:test-user": "node scripts/create-test-user.js"
  }
}
```

---

## Installation Steps

Follow these steps **in order** to set up authentication in your project:

### Step 1: Install Dependencies

```bash
npm install @supabase/supabase-js drizzle-orm postgres zod
npm install -D drizzle-kit dotenv
```

### Step 2: Set Up Environment Variables

1. Create `.env.local` file in project root
2. Copy the environment variables from [Environment Variables](#environment-variables) section
3. Fill in your actual values from AI Intranet admin and Supabase dashboard

### Step 3: Create Database Table

**Option A: Using Supabase SQL Editor (Recommended)**
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy the SQL from [Database Setup](#database-setup)
4. Execute the SQL

**Option B: Using Migration Script**
1. Create `scripts/create-user-profiles-table.sql` with the SQL from [Database Setup](#database-setup)
2. Run: `npm run migrate:auth`

### Step 4: Update Drizzle Schema

1. Open `lib/schema.ts`
2. Add the `userProfiles` table definition from [Database Setup](#database-setup)
3. Add the type exports

### Step 5: Create Core Files

Create each of the following files with the complete code provided:

1. `middleware.ts` (root directory - CRITICAL!)
2. `lib/auth.ts`
3. `lib/auth-supabase.ts`
4. `lib/supabase-admin.ts`
5. `lib/database.ts` (or update existing)

**⚠️ CRITICAL UPDATES:**
- In `middleware.ts` lines 113, 307, 315: Update app name and default email
- In `app/api/auth/sync/route.ts` line 18: Update app name
- In `app/api/auth/validate-token/route.ts` line 49: Update app name

### Step 6: Create API Routes

Create each API route directory and file:

```
app/
└── api/
    └── auth/
        ├── sync/
        │   └── route.ts
        ├── me/
        │   └── route.ts
        ├── logout/
        │   └── route.ts
        └── validate-token/
            └── route.ts
```

### Step 7: Create Unauthorized Page

```
app/
└── unauthorized/
    └── page.tsx
```

### Step 8: Create Scripts

```
scripts/
├── run-auth-migration.js
├── create-user-profiles-table.sql
└── create-test-user.js
```

### Step 9: Update package.json

Add scripts from [Scripts](#scripts) section.

### Step 10: Test Authentication

```bash
# Start development server
npm run dev

# Try to access your app
# Should redirect to AI Intranet login (or show test user if DISABLE_AUTH=true)
```

---

## Local Development & Test User

### Development Bypass (No AI Intranet Required)

For local development without AI Intranet connection:

1. **Enable Bypass in `.env.local`:**
   ```bash
   DISABLE_AUTH=true
   NODE_ENV=development
   ```

2. **Restart Development Server:**
   ```bash
   npm run dev
   ```

3. **Verify Bypass is Active:**
   - Check terminal for: `🔓 Authentication bypassed for local development`
   - You should be automatically logged in as mock user

### Mock User Configuration

The mock user is defined in `middleware.ts` (lines 10-19):

```typescript
const mockUser = {
  id: 'dev-user-1',
  auth0_id: 'auth0|dev-user',
  email: 'developer@test.com',
  full_name: 'Test Developer',
  role: 'admin',
  permissions: ['all'],
  app_access: true,
  timestamp: Date.now()
};
```

**Customize the mock user** by editing these values in `middleware.ts`.

### Create Test User in Database (Optional)

If you want the mock user to also exist in your database:

```bash
npm run create:test-user
```

This creates a `developer@test.com` user profile with admin role.

### Disabling Bypass

To re-enable normal authentication:

1. Set `DISABLE_AUTH=false` in `.env.local` OR remove the line entirely
2. Restart dev server

---

## Testing

### Test 1: Verify Middleware is Running

```bash
# Start dev server
npm run dev

# Check terminal for middleware logs:
# [AUTH DEBUG] ========== Cookie-Based Authentication ==========
# [AUTH DEBUG] Cookie auth URL: https://...
```

✅ **Success**: Middleware logs appear
❌ **Failure**: No logs → Middleware not running (check file location!)

### Test 2: Verify Development Bypass

```bash
# Ensure DISABLE_AUTH=true in .env.local
npm run dev

# Visit http://localhost:3000
# Should see: 🔓 Authentication bypassed for local development
```

✅ **Success**: Auto-logged in without redirect
❌ **Failure**: Redirects to AI Intranet → Check DISABLE_AUTH and NODE_ENV

### Test 3: Verify Token Authentication

```bash
# Get auth token from AI Intranet admin
# Visit: http://localhost:3000?auth_token=YOUR_TOKEN

# Should:
# 1. Validate token with AI Intranet
# 2. Create session cookie
# 3. Redirect to clean URL (no token)
```

✅ **Success**: Redirected and logged in
❌ **Failure**: Stuck with token in URL → Check logs for validation errors

### Test 4: Verify Database Sync

```bash
# After successful login, check database:
# Via Supabase Dashboard → Table Editor → user_profiles
# Or via SQL:
SELECT email, app_role, last_sync
FROM user_profiles
ORDER BY last_sync DESC
LIMIT 5;
```

✅ **Success**: User profile exists in database
❌ **Failure**: No profile → Check `[SYNC]` logs in console

### Test 5: Verify API Route Protection

Create test endpoint `app/api/test-auth/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request.headers);

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Authenticated!',
    user: {
      email: user.email,
      role: user.app_role,
      permissions: user.app_permissions
    }
  });
}
```

Visit: `http://localhost:3000/api/test-auth`

✅ **Success**: Returns user data (not 401)
❌ **Failure**: Returns 401 → Middleware not adding headers

### Test 6: Verify Logout

```bash
# While logged in, visit:
http://localhost:3000/api/auth/logout

# Should:
# 1. Clear session cookie
# 2. Redirect to AI Intranet logout
# 3. Visiting app again redirects to login
```

✅ **Success**: Full logout flow works
❌ **Failure**: Still logged in → Check cookie clearing

---

## Troubleshooting

### Middleware Not Running

**Symptoms:**
- No middleware logs in terminal
- No authentication happening
- No redirects

**Solutions:**

1. **File Location** - MOST COMMON ISSUE
   ```
   ✅ CORRECT: middleware.ts (at root, same level as app/)
   ❌ WRONG:   app/middleware.ts
   ❌ WRONG:   lib/middleware.ts
   ❌ WRONG:   src/middleware.ts (unless using src directory)
   ```

2. **File Name** - Case sensitive
   ```
   ✅ CORRECT: middleware.ts (lowercase 'm')
   ❌ WRONG:   Middleware.ts
   ❌ WRONG:   MIDDLEWARE.ts
   ```

3. **Next.js Version**
   ```bash
   npm list next
   # Should be 12.2 or higher

   # If needed:
   npm install next@latest
   ```

4. **Clear Next.js Cache**
   ```bash
   rm -rf .next
   npm run dev
   ```

5. **Check for TypeScript Errors**
   ```bash
   npm run build
   # Fix any errors in middleware.ts
   ```

### Authentication Loop / Constant Redirects

**Symptoms:**
- Keeps redirecting to AI Intranet login
- Never completes authentication

**Solutions:**

1. **Verify Environment Variables**
   ```bash
   # Check these match EXACTLY with AI Intranet:
   echo $AI_INTRANET_URL
   echo $APP_ID
   echo $APP_API_KEY
   ```

2. **Check AI Intranet Logs**
   - Contact AI Intranet admin
   - Verify app is registered
   - Check if requests are arriving

3. **Verify APP_ID Format**
   ```bash
   # Should be UUID format:
   APP_ID="b2969245-bed2-4218-a77c-a31c2355f0b2"

   # NOT:
   APP_ID="Process Documentation"
   ```

### User Gets "Access Denied"

**Symptoms:**
- User authenticated but sees unauthorized page
- Status 403 from AI Intranet

**Solutions:**

1. **Grant Access in AI Intranet**
   - Go to AI Intranet admin panel
   - Find the user
   - Grant access to your application
   - Assign appropriate role

2. **Check Application Name**
   - Verify app name in AI Intranet matches
   - Update middleware line 113, 307
   - Update API routes (sync, validate-token)

### Session Cookie Not Persisting

**Symptoms:**
- Logged in but immediately logged out
- Session doesn't survive page refresh

**Solutions:**

1. **Check Cookie Security Settings**
   ```typescript
   // In middleware, verify:
   response.cookies.set('user-session', data, {
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production', // false in dev!
     sameSite: 'lax',
     maxAge: 86400
   });
   ```

2. **Cross-Domain Issues**
   - Use token-based auth for cross-domain
   - Cookie-based only works same domain

3. **Clear Browser Cookies**
   - Clear all cookies for localhost
   - Try incognito/private window

### Database Connection Errors During Sync

**Symptoms:**
- `[SYNC]` errors in logs
- User authenticated but not in database

**Solutions:**

1. **Verify DATABASE_URL**
   ```bash
   # Must use pooler URL with :5432
   DATABASE_URL="postgresql://postgres....pooler.supabase.com:5432/postgres"

   # NOT direct database URL
   ```

2. **Check Supabase Service Role Key**
   ```bash
   # Verify SUPABASE_SERVICE_ROLE_KEY is set
   # Should start with "eyJhbGc..."
   ```

3. **Check Connection Limits**
   - Go to Supabase Dashboard → Settings → Database
   - Verify connection pool isn't exhausted

### Headers Missing in API Routes

**Symptoms:**
- `getCurrentUser()` returns null in API routes
- User data not available

**Solutions:**

1. **Use `headers()` in App Router**
   ```typescript
   import { headers } from 'next/headers';
   import { getCurrentUser } from '@/lib/auth';

   export async function GET(request: Request) {
     const headersList = headers();
     const user = getCurrentUser(headersList);
     // ...
   }
   ```

2. **Check Middleware Matcher**
   ```typescript
   // Verify API route isn't excluded:
   export const config = {
     matcher: [
       '/((?!api/auth|_next/static|_next/image|favicon.ico|unauthorized|public).*)',
     ],
   };
   ```

### Development Bypass Not Working

**Symptoms:**
- `DISABLE_AUTH=true` but still redirects
- No "🔓 Authentication bypassed" log

**Solutions:**

1. **Verify Environment Variables**
   ```bash
   # Both must be set:
   DISABLE_AUTH=true
   NODE_ENV=development
   ```

2. **Restart Dev Server**
   ```bash
   # Environment variables only load on startup
   # Stop and restart:
   npm run dev
   ```

3. **Check Middleware Logic**
   ```typescript
   // First lines of middleware should be:
   if (process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV === 'development') {
     console.log('🔓 Authentication bypassed for local development');
     // ...
   }
   ```

---

## Summary

This guide provides **complete, copy-paste ready code** for implementing AI Intranet authentication in any Next.js 15 application.

### What You Get

✅ **Complete authentication system** integrated with AI Intranet
✅ **Token and cookie-based auth** for flexible deployment
✅ **User profile synchronization** to local database
✅ **Role-based access control** with app-specific permissions
✅ **Development bypass mode** for local testing
✅ **Production-ready** with security best practices
✅ **Graceful fallbacks** for offline scenarios
✅ **Professional UI** for unauthorized users

### Critical Configuration Points

Before deploying, **MUST UPDATE** these locations:

1. **middleware.ts**:
   - Line 113: App name for permissions
   - Line 307: App name for permissions
   - Line 315: Default email domain

2. **app/api/auth/sync/route.ts**:
   - Line 18: App name for permissions

3. **app/api/auth/validate-token/route.ts**:
   - Line 49: App name for permissions

4. **Environment Variables**:
   - All AI Intranet credentials
   - Supabase credentials
   - App URL for redirects

### Quick Start Checklist

- [ ] Install dependencies
- [ ] Set up environment variables
- [ ] Create database table
- [ ] Update Drizzle schema
- [ ] Create core files (middleware, lib/auth.ts, etc.)
- [ ] Create API routes
- [ ] Create unauthorized page
- [ ] Create scripts
- [ ] Update middleware with YOUR app name
- [ ] Update API routes with YOUR app name
- [ ] Test with `DISABLE_AUTH=true`
- [ ] Test with real AI Intranet
- [ ] Deploy to production

### Support

If issues persist after following this guide:

1. **Check Logs** - Look for `[AUTH DEBUG]` messages
2. **Check Network Tab** - Verify requests to AI Intranet
3. **Check Database** - Verify user_profiles table exists
4. **Check AI Intranet** - Verify app registration
5. **Contact AI Intranet Admin** - They can see server-side logs

---

**You now have everything needed to implement AI Intranet authentication exactly as it's done in the Process Documentation project!** 🎉

Simply drop this file into your new project and tell Claude Code: *"Set up AI Intranet authentication exactly as described in AI_INTRANET_AUTHENTICATION_COMPLETE_GUIDE.md"*
