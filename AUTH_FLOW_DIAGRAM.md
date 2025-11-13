# Authentication Flow Diagram

## Complete Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                                    │
│                    (Browser → Next.js App)                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE (middleware.ts)                            │
│              Runs BEFORE every request (except public paths)              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ DEV MODE      │    │ URL TOKEN     │    │ COOKIE AUTH  │
│ (DISABLE_AUTH)│    │ (?auth_token) │    │ (user-session)│
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION METHODS                                │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Mock User     │    │ AI Intranet  │    │ AI Intranet   │
│ (MOCK_USER)   │    │ Token Check  │    │ Cookie Check  │
│               │    │              │    │               │
│ Sets:         │    │ Validates:   │    │ Calls:        │
│ - user-session│    │ auth_token   │    │ /api/auth/    │
│ - x-user-data │    │              │    │ central-check │
│ - x-user-id   │    │ Sets:        │    │               │
│ - x-user-role │    │ - user-session│   │ Sets:         │
│ - x-user-email│    │ - x-user-data │   │ - user-session│
│               │    │ - x-user-id   │   │ - x-user-data │
│               │    │ - x-user-role │   │ - x-user-id   │
│               │    │ - x-user-email│   │ - x-user-role  │
│               │    │              │   │ - x-user-email│
└───────────────┘    └──────────────┘   └───────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    REQUEST HEADERS SET                                   │
│              (Passed to API routes and pages)                            │
│                                                                           │
│  x-user-data: { id, email, app_role, ... }                               │
│  x-user-id: <auth0_id>                                                   │
│  x-user-role: <app_role>                                                 │
│  x-user-email: <email>                                                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE COOKIES SET                                  │
│                                                                           │
│  ⚠️ MISMATCH: Middleware sets "user-session"                             │
│     But client expects "ai-intranet-user"                                │
│                                                                           │
│  Cookie: user-session                                                     │
│  Value: JSON.stringify({ id, email, app_role, timestamp, ... })         │
│  httpOnly: true                                                          │
│  secure: production only                                                 │
│  maxAge: 86400 (24 hours)                                                │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLIENT-SIDE AUTHENTICATION                            │
│                    (React Components)                                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    UserContext (context/UserContext.tsx)                │
│                                                                           │
│  1. Calls getClientUser() from lib/auth.ts                              │
│  2. Falls back to /api/auth/me if no cookie                             │
│  3. Provides user state via React Context                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    getClientUser() (lib/auth.ts)                        │
│                                                                           │
│  Looks for cookies (in order):                                           │
│  1. x-switched-user (dev user switching)                                 │
│  2. x-auth-disabled (dev mode flag)                                     │
│  3. ai-intranet-user ⚠️ (NOT user-session!)                             │
│                                                                           │
│  ⚠️ PROBLEM: Middleware sets "user-session" but                          │
│     getClientUser() looks for "ai-intranet-user"                         │
│                                                                           │
│  Result: Falls back to /api/auth/me                                     │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    /api/auth/me (API Route)                              │
│                                                                           │
│  Uses: getAuthenticatedUser() from lib/auth-wrapper.ts                  │
│                                                                           │
│  1. Reads x-user-data header (set by middleware)                        │
│  2. Syncs with Supabase user_profiles table                             │
│  3. Returns { user, profile }                                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Components Use useAuth() Hook                        │
│                                                                           │
│  const { user, loading, error } = useAuth();                             │
│                                                                           │
│  Gets user from UserContext                                              │
│  UserContext gets it from cookies or /api/auth/me                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow Paths

### Path 1: Development Mode (DISABLE_AUTH=true)
```
Request → Middleware → Check DISABLE_AUTH → Set MOCK_USER
  → Set user-session cookie
  → Set x-user-data header
  → Continue to page
  → UserContext → getClientUser() → Can't find ai-intranet-user
  → Falls back to /api/auth/me → Reads x-user-data header → Returns MOCK_USER
```

### Path 2: Production - URL Token Auth
```
Request with ?auth_token=xxx → Middleware → Extract token
  → Call AI Intranet /api/auth/central-check?auth_token=xxx
  → AI Intranet validates token → Returns user data
  → Middleware sets user-session cookie
  → Middleware sets x-user-data header
  → Redirect to clean URL (remove auth_token)
  → UserContext → getClientUser() → Can't find ai-intranet-user
  → Falls back to /api/auth/me → Reads x-user-data header → Returns user
```

### Path 3: Production - Cookie-Based Auth
```
Request with user-session cookie → Middleware → Check cookie validity
  → If valid (< 24 hours old): Set x-user-data header, continue
  → If invalid/expired: Call AI Intranet /api/auth/central-check
  → AI Intranet validates session → Returns user data
  → Middleware sets user-session cookie (refresh)
  → Middleware sets x-user-data header
  → Continue to page
  → UserContext → getClientUser() → Can't find ai-intranet-user
  → Falls back to /api/auth/me → Reads x-user-data header → Returns user
```

### Path 4: Production - No Session
```
Request without session → Middleware → No cookie found
  → Call AI Intranet /api/auth/central-check
  → AI Intranet returns 401 (not authenticated)
  → Middleware redirects to AI Intranet login
  → User logs in → Redirected back with auth_token
  → Back to Path 2
```

## Key Components

### 1. Middleware (middleware.ts)
- **Purpose**: First line of authentication defense
- **Runs**: Before every request (except public paths)
- **Sets Cookies**: `user-session` (⚠️ mismatch!)
- **Sets Headers**: `x-user-data`, `x-user-id`, `x-user-role`, `x-user-email`
- **Auth Methods**:
  - Dev mode bypass (DISABLE_AUTH)
  - URL token auth (?auth_token=)
  - Cookie-based auth (user-session)
  - AI Intranet integration (/api/auth/central-check)

### 2. Client Auth Library (lib/auth.ts)
- **Purpose**: Client-side cookie reading
- **Expects Cookies**: `ai-intranet-user`, `ai-intranet-session` (⚠️ mismatch!)
- **Provides**: `getClientUser()`, `MOCK_USER`, cookie helpers
- **Problem**: Looks for cookies middleware doesn't set

### 3. Auth Wrapper (lib/auth-wrapper.ts)
- **Purpose**: Server-side auth for API routes
- **Reads**: `x-user-data` header (set by middleware)
- **Syncs**: With Supabase user_profiles table
- **Provides**: `getAuthenticatedUser()`, `requireAuth()`, `requireAdmin()`

### 4. User Context (context/UserContext.tsx)
- **Purpose**: React Context for auth state
- **Reads**: Cookies via `getClientUser()` OR `/api/auth/me`
- **Provides**: `useAuth()` hook for components
- **State**: `user`, `loading`, `error`

### 5. API Routes (app/api/auth/*)
- **`/api/auth/me`**: Returns current user (reads from headers)
- **`/api/auth/callback`**: Auth0 OAuth callback (legacy?)
- **`/api/auth/login`**: Redirects to AI Intranet login
- **`/api/auth/logout`**: Clears cookies, redirects to hub
- **`/api/auth/switch-user`**: Dev mode user switching
- **`/api/auth/sync`**: Syncs user to Supabase

## The Cookie Mismatch Problem

```
Middleware sets:        Client expects:
─────────────────       ─────────────────
user-session            ai-intranet-user
                        ai-intranet-session
```

**Impact**:
- `getClientUser()` can't find the cookie
- Falls back to `/api/auth/me` on every request
- Extra API calls, slower performance
- AppWrapper falls back to MOCK_USER if API fails

## How It Actually Works (Despite Mismatch)

1. **Middleware authenticates** → Sets `user-session` cookie + `x-user-data` header
2. **UserContext tries cookies** → `getClientUser()` doesn't find `ai-intranet-user`
3. **Falls back to API** → Calls `/api/auth/me`
4. **API reads headers** → `getAuthenticatedUser()` reads `x-user-data` header
5. **Returns user** → UserContext gets user from API response
6. **Components work** → `useAuth()` provides user to components

**It works, but inefficiently** - every page load requires an API call because cookies don't match.

## Recommended Fix

Align cookie names:
- Option 1: Change middleware to set `ai-intranet-user` and `ai-intranet-session`
- Option 2: Change client to read `user-session` cookie

This would allow `getClientUser()` to work directly from cookies, eliminating the API fallback.

