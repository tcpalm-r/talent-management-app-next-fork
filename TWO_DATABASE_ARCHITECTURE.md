# Two-Database Architecture

## 🏗️ Architecture Overview

Your application uses **TWO separate Supabase projects:**

### 1. AI Intranet Hub (Authentication Database)
**URL:** `https://naakxqtoskqnbvnpievj.supabase.co`

**Purpose:**
- Central authentication for all Sonance applications
- User management across the organization
- SSO integration with Auth0
- Application access control

**Used By:**
- `middleware.ts` - Validates auth tokens with Hub API
- `lib/auth.ts` - Authentication logic
- `lib/auth-supabase.ts` - User profile sync from Hub to App DB

**NOT used for:** Application data (surveys, reviews, assessments)

---

### 2. Talent Management App (Application Database)
**URL:** `https://ynycbfyzbavbgxvniylt.supabase.co`

**Purpose:**
- 360° feedback surveys
- Performance reviews
- User profiles (synced from Hub)
- Assessment data
- All application-specific data

**Used By:**
- `lib/supabase.ts` - Main Supabase client
- `lib/supabase-admin.ts` - Admin operations
- All API routes (`app/api/*`)
- Client components (Dashboard, Survey Wizard, etc.)

---

## ⚙️ Environment Configuration

### Required Environment Variables

#### For Authentication (Hub Integration)
```bash
# AI Intranet Hub API
AI_INTRANET_URL=https://aiintranet.sonance.com
APP_ID=b2969245-bed2-4218-a77c-a31c2355f0b2
APP_API_KEY=f33df1ee-a853-4237-b6c1-75016a4b3666
```

#### For Application Database (Talent Management App)
```bash
# Talent Management App's Supabase (ynycbfyzbavbgxvniylt)
NEXT_PUBLIC_SUPABASE_URL=https://ynycbfyzbavbgxvniylt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-ynycbfyzbavbgxvniylt>
SUPABASE_SERVICE_ROLE_KEY=<service-key-from-ynycbfyzbavbgxvniylt>
```

**CRITICAL:** `NEXT_PUBLIC_SUPABASE_URL` must ALWAYS point to the **Talent Management App's database** (ynycbfyzbavbgxvniylt), NOT the Hub's database (naakxqtoskqnbvnpievj).

---

## 🔍 Diagnosing Configuration Issues

### Symptoms of Misconfiguration

1. **Client queries Hub database:**
   - Console errors: `GET https://naakxqtoskqnbvnpievj.supabase.co/rest/v1/...`
   - Surveys don't load or show different data
   - 406 Not Acceptable errors

2. **Server queries Hub database:**
   - Surveys not found
   - Empty dashboard
   - Database connection errors

### How to Check Configuration

#### 1. Check Local Configuration
```bash
# In .env.local
grep NEXT_PUBLIC_SUPABASE_URL .env.local

# Should show: https://ynycbfyzbavbgxvniylt.supabase.co
```

#### 2. Check Production Configuration (Vercel)

Visit: `https://sonance-360-review.vercel.app/api/debug/database-info`

Expected output:
```json
{
  "environment": {
    "supabaseUrl": "https://ynycbfyzbavbgxvniylt.supabase.co...",
    "hasServiceKey": true,
    "nodeEnv": "production"
  },
  "database": {
    "connected": true,
    "surveyCount": 2,
    "surveys": [...]
  }
}
```

If you see `naakxqtoskqnbvnpievj` in the URL, **production is misconfigured**.

#### 3. Check Browser Console

In production, open DevTools Console. Look for Supabase API calls:

✅ **Correct:** `GET https://ynycbfyzbavbgxvniylt.supabase.co/rest/v1/...`  
❌ **Wrong:** `GET https://naakxqtoskqnbvnpievj.supabase.co/rest/v1/...`

---

## 🔧 Fixing Vercel Production Configuration

If production is pointing to the wrong database:

### Step 1: Access Vercel Environment Variables

1. Go to https://vercel.com
2. Select project: **sonance-360-review**
3. Settings → Environment Variables

### Step 2: Verify/Update Variables

Check these variables are set to **ynycbfyzbavbgxvniylt** values:

| Variable | Should Be |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ynycbfyzbavbgxvniylt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key from ynycbfyzbavbgxvniylt project |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from ynycbfyzbavbgxvniylt project |

### Step 3: Get Keys from Correct Project

1. Go to https://supabase.com/dashboard
2. Select project: **ynycbfyzbavbgxvniylt**
3. Settings → API
4. Copy:
   - Project URL: `https://ynycbfyzbavbgxvniylt.supabase.co`
   - anon/public key
   - service_role key

### Step 4: Update and Redeploy

1. Update environment variables in Vercel
2. Redeploy: Deployments → (latest) → ⋯ → Redeploy
   - **OR** push to `main` branch to trigger new deployment:
   ```bash
   git checkout main
   git commit --allow-empty -m "Trigger redeploy"
   git push origin main
   ```
3. Wait for deployment to complete
4. Test: Visit `/api/debug/database-info`

**Note:** Production deployments only trigger from the `main` branch.

---

## 🎯 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User visits Talent Management App                           │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Middleware checks authentication                            │
│ - Validates token with AI Intranet Hub API                 │
│ - Hub (naakxqtoskqnbvnpievj) returns user data            │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ lib/auth-supabase.ts syncs user to App DB                  │
│ - Looks up user in App DB (ynycbfyzbavbgxvniylt)          │
│ - Creates/updates user_profiles record                     │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Application queries App DB (ynycbfyzbavbgxvniylt)          │
│ - All surveys, reviews, assessments                        │
│ - User profile for app-specific data                       │
└─────────────────────────────────────────────────────────────┘
```

**Key Point:** Hub is ONLY for authentication. All app data queries go to the App DB.

---

## 📊 Data Flow

### On Login
1. User logs in via AI Intranet Hub
2. Hub validates via Auth0
3. Hub returns user data + session token
4. Middleware validates token with Hub
5. `auth-supabase.ts` syncs user → App DB
6. App queries App DB for all features

### On Data Operations
```
Client/Server → App DB (ynycbfyzbavbgxvniylt)
              → NEVER queries Hub DB
```

### User Profile Source of Truth
- **Authentication:** Hub (naakxqtoskqnbvnpievj)
- **App Data:** App DB (ynycbfyzbavbgxvniylt)
- **Sync:** `lib/auth-supabase.ts` keeps them in sync

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Setting NEXT_PUBLIC_SUPABASE_URL to Hub
```bash
# WRONG!
NEXT_PUBLIC_SUPABASE_URL=https://naakxqtoskqnbvnpievj.supabase.co
```

**Result:** App queries Hub database, finds no surveys, breaks.

### ❌ Mistake 2: Mixing Keys from Different Projects
```bash
# WRONG!
NEXT_PUBLIC_SUPABASE_URL=https://ynycbfyzbavbgxvniylt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key-from-naakxqtoskqnbvnpievj> # Wrong!
```

**Result:** Authentication errors, API calls fail.

### ❌ Mistake 3: Client-Side Hub Queries
```typescript
// WRONG! Never do this in components:
const hubClient = createClient(
  'https://naakxqtoskqnbvnpievj.supabase.co',
  hubAnonKey
);
```

**Result:** Unnecessary queries to Hub, data confusion.

---

## ✅ Verification Checklist

- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL=https://ynycbfyzbavbgxvniylt.supabase.co`
- [ ] Vercel production has same URL
- [ ] Both have matching anon/service keys from ynycbfyzbavbgxvniylt
- [ ] `/api/debug/database-info` shows ynycbfyzbavbgxvniylt URL
- [ ] Browser console shows queries to ynycbfyzbavbgxvniylt
- [ ] Surveys load correctly in both local and production
- [ ] No 406 errors in console

---

## 📚 Related Files

### Authentication
- `middleware.ts` - Validates with Hub API
- `lib/auth.ts` - Auth logic
- `lib/auth-supabase.ts` - User sync

### Database Clients
- `lib/supabase.ts` - App DB client (RLS-enabled)
- `lib/supabase-admin.ts` - App DB admin client (bypasses RLS)

### Configuration
- `.env.local` - Local environment
- Vercel dashboard - Production environment

---

**Last Updated:** 2025-11-13  
**Issue:** Data inconsistency between local and production  
**Root Cause:** Potential misconfiguration of NEXT_PUBLIC_SUPABASE_URL in Vercel

