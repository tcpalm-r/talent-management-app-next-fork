# GitHub Actions Build Failure Fix

## Problem Summary

The GitHub Actions CI/CD pipeline started failing at commit `06e5c4a` (feat: Enhance 360 review question management with dynamic name replacement).

## Root Cause

**Missing Database Table:** The code was refactored to use the `organization_settings` table to store 360 review question configuration, but:

1. ✅ Migration file `create_organization_settings.sql` was created
2. ❌ Migration was never moved to `migrations/` folder
3. ❌ Migration was never applied to production database
4. ❌ API route crashed when querying non-existent table during Next.js build

During GitHub Actions build, Next.js attempts to pre-render pages that call `/api/360-default-questions`, which queries the missing table, causing the build to fail.

## Changes Made

### 1. Enhanced Error Handling in API Route
**File:** `app/api/360-default-questions/route.ts`

Added graceful degradation for missing table:
- Detects PostgreSQL error code `42P01` (table doesn't exist)
- Detects PostgREST error code `PGRST301` (table not found)
- Returns default questions instead of crashing
- Logs warning with migration instructions

```typescript
// If table doesn't exist (42P01) or other database errors, return defaults
// This ensures graceful degradation during initial deployment or migrations
if (error.code === '42P01' || error.code === 'PGRST301') {
  console.warn('[360 Default Questions] organization_settings table not found, returning defaults. Run migrations to enable database storage.');
  return NextResponse.json({
    questions: DEFAULT_QUESTIONS
  });
}
```

### 2. Fixed Static Rendering Error
**File:** `app/api/surveys/load-draft/route.ts`

Added `export const dynamic = 'force-dynamic';` to prevent Next.js from trying to statically render this dynamic API route.

### 3. Added Migration to Proper Location
**File:** `migrations/create_organization_settings.sql`

Copied migration file from root to migrations folder for proper tracking and deployment.

## Deployment Instructions

### Option 1: Apply the Migration (Recommended for Production)

Run the migration to create the `organization_settings` table:

```bash
# Using Supabase CLI
supabase db push migrations/create_organization_settings.sql

# Or run directly in Supabase SQL editor
# Copy contents of migrations/create_organization_settings.sql
```

### Option 2: Use Default Questions (Works Without Migration)

The code now gracefully falls back to hardcoded defaults if the table doesn't exist, so the app will work without the migration (though question customization won't persist).

## Testing

Test the build locally:

```bash
npm run build
```

Expected result:
- ✅ Build should complete successfully
- ✅ No errors about missing `organization_settings` table
- ⚠️  Warning logged if table doesn't exist (expected until migration runs)

## GitHub Actions

Once these changes are pushed to GitHub:

1. **CI / Build** - Should pass (API returns defaults gracefully)
2. **E2E Tests** - Should pass (depends on successful build)
3. **Vercel Deployment** - Should succeed

## Vercel Environment Variables

Ensure these are configured in Vercel project settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `AI_INTRANET_URL_LOCAL`
- `AI_INTRANET_URL_PROD`
- `DISABLE_AUTH=true` (for development/testing)

## Future Prevention

To prevent similar issues:

1. Always place migrations in `migrations/` folder immediately
2. Apply migrations to staging/production before deploying code that depends on them
3. Add graceful error handling for database operations that might fail during deployment
4. Consider adding database schema validation tests to CI/CD

