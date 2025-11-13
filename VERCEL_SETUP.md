# Vercel Production Environment Setup Guide

This guide walks you through configuring environment variables in Vercel to ensure proper authentication in production.

## 🚨 Critical Issue: Authentication Bypass in Production

If you're reading this, your production deployment likely has authentication bypassed, auto-logging everyone in as Thomas Palmer with admin privileges. This is a **critical security vulnerability**.

### Root Cause

The environment variables `DISABLE_AUTH=true` and/or `NEXT_PUBLIC_DISABLE_AUTH=true` are set in your Vercel production environment. These variables are intended **only for local development** and must be removed from production.

---

## Step-by-Step Fix

### 1. Access Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and log in
2. Navigate to your project: **employee-self-assessment** (or the project name)
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar

### 2. Remove Development-Only Variables

Look for and **DELETE** the following variables if they exist in **Production** or **All** environments:

- `DISABLE_AUTH`
- `NEXT_PUBLIC_DISABLE_AUTH`

**How to delete:**
1. Find the variable in the list
2. Click the **⋮** (three dots) menu on the right
3. Click **Delete**
4. Confirm deletion

### 3. Set Required Production Environment Variables

Add the following environment variables for **Production** environment:

#### Authentication (AI Intranet Integration)

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `AI_INTRANET_URL` | `https://aiintranet.sonance.com` | Production |
| `APP_ID` | `b2969245-bed2-4218-a77c-a31c2355f0b2` | Production |
| `APP_API_KEY` | `f33df1ee-a853-4237-b6c1-75016a4b3666` | Production |
| `NODE_ENV` | `production` | Production |

**Note:** The `APP_ID` and `APP_API_KEY` values above are from your current `.env.local`. If these are incorrect, update them with the correct values from your AI Intranet application registration.

#### Other Required Variables

Make sure these are also set (should already exist):

| Variable Name | Source | Environment |
|--------------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | Production |
| `ANTHROPIC_API_KEY` | Anthropic dashboard | Production |
| `RESEND_API_KEY` | Resend dashboard | Production |

### 4. How to Add Environment Variables in Vercel

1. In the **Environment Variables** section, click **Add New**
2. Enter the **Key** (e.g., `AI_INTRANET_URL`)
3. Enter the **Value** (e.g., `https://aiintranet.sonance.com`)
4. Select **Production** from the environment dropdown
5. Click **Save**
6. Repeat for each variable

### 5. Redeploy

After updating environment variables:

1. Go to the **Deployments** tab
2. Find the most recent deployment
3. Click the **⋮** (three dots) menu
4. Click **Redeploy**
5. Confirm the redeployment

**OR**

Push a new commit to your repository to trigger an automatic deployment.

---

## Verification

After redeployment, verify the fix:

### 1. Check Authentication Flow

1. Visit your production URL: `https://employee-self-assessment.vercel.app` (or your custom domain)
2. **Expected behavior:** You should be redirected to AI Intranet login page
3. **Incorrect behavior:** Auto-login as Thomas Palmer (indicates environment variables not properly updated)

### 2. Check Deployment Logs

1. Go to **Deployments** tab in Vercel
2. Click on the latest deployment
3. Click **View Function Logs** or **Runtime Logs**
4. Look for these log messages:

**✅ Correct (Production Mode):**
```
✓ Production Mode: Real authentication is ENABLED
  - AI Intranet authentication required
  - Auth0 OAuth flow active
  - User must login to access application
```

**❌ Incorrect (Still in Dev Mode):**
```
[Sonance Auth] Authentication bypassed for local development
```

**⚠️ Security Warning (Misconfigured but Protected):**
```
[SECURITY WARNING] Auth bypass detected in production environment!
[SECURITY WARNING] DISABLE_AUTH is set to true but NODE_ENV is production.
[SECURITY WARNING] Forcing authentication to be ENABLED for security.
```

If you see the security warning, the fail-safe is protecting you, but you still need to remove the environment variables as described above.

### 3. Check for UserSwitcher UI Component

1. Login to the production application (with real authentication)
2. Look at the top-right corner of the application
3. **Expected:** No "Dev: [username]" button visible
4. **Incorrect:** "Dev: [username]" button is visible (indicates `NEXT_PUBLIC_DISABLE_AUTH` is still set or `NODE_ENV` is not production)

---

## Local Development Setup

For local development, keep these settings in your `.env.local` file (NOT in Vercel):

```bash
# Local Development - Auth Bypass
DISABLE_AUTH=true
NEXT_PUBLIC_DISABLE_AUTH=true
NODE_ENV=development

# AI Intranet (for when you want to test real auth locally)
AI_INTRANET_URL_LOCAL=http://localhost:3001
AI_INTRANET_URL_PROD=https://aiintranet.sonance.com
APP_ID=b2969245-bed2-4218-a77c-a31c2355f0b2
APP_API_KEY=f33df1ee-a853-4237-b6c1-75016a4b3666
```

**Important:** `.env.local` is automatically ignored by Git (in `.gitignore`) and should **never** be committed or deployed to Vercel.

---

## Understanding Environment Variable Hierarchy

Vercel uses this priority order for environment variables:

1. **Production** environment variables (highest priority for production deployments)
2. **Preview** environment variables (for preview deployments)
3. **Development** environment variables (for local development with `vercel dev`)
4. `.env.local` file (local development only, never deployed)

**Best Practice:**
- ✅ Set production-specific variables in Vercel **Production** environment
- ✅ Keep development variables in `.env.local` on your local machine
- ❌ Never set `DISABLE_AUTH=true` in Vercel (any environment)
- ❌ Never commit `.env.local` to Git

---

## Fail-Safe Protection

As of this update, the codebase includes fail-safe protection to prevent authentication bypass in production:

### Middleware Fail-Safe (`middleware.ts`)

Even if `DISABLE_AUTH=true` is accidentally set in production, the middleware will:
1. Detect the misconfiguration
2. Log security warnings
3. **Override** the setting and enforce real authentication

This provides defense-in-depth, but **you should still remove the environment variables** for clean configuration.

### Environment Validation (`lib/env-validation.ts`)

On server startup, the application will:
1. Check for authentication misconfiguration
2. Log detailed error messages if `DISABLE_AUTH=true` in production
3. Provide guidance on fixing the issue

### UserSwitcher Protection (`components/UserSwitcher.tsx`)

The dev-only UserSwitcher component will only render if:
1. `NODE_ENV !== 'production'` AND
2. `NEXT_PUBLIC_DISABLE_AUTH === 'true'`

This ensures it never appears in production, even if misconfigured.

---

## Common Issues & Solutions

### Issue: Still seeing auto-login after redeploy

**Solution:**
1. Clear browser cookies for your production domain
2. Try in incognito/private browser window
3. Verify environment variables are set correctly in Vercel
4. Check that you redeployed after changing variables
5. Look at deployment logs to confirm production mode

### Issue: Getting "unauthorized" or 403 errors

**Solution:**
1. Verify `AI_INTRANET_URL` is correct: `https://aiintranet.sonance.com`
2. Verify `APP_ID` and `APP_API_KEY` match your AI Intranet app registration
3. Check that your user account has access to this application in AI Intranet
4. Contact AI Intranet admin to verify your app is registered correctly

### Issue: Can't login - infinite redirect loop

**Solution:**
1. Check `AUTH0_BASE_URL` matches your production URL
2. Verify Auth0 application settings have correct callback URLs
3. Check AI Intranet configuration for this application

### Issue: Environment variables not taking effect

**Solution:**
1. Make sure you selected the correct environment (Production)
2. Redeploy after changing variables (changes only apply to new deployments)
3. Variables with `NEXT_PUBLIC_` prefix are baked into the build - must redeploy to update

---

## Security Checklist

Before deploying to production, verify:

- [ ] `DISABLE_AUTH` is **not set** in Vercel Production environment
- [ ] `NEXT_PUBLIC_DISABLE_AUTH` is **not set** in Vercel Production environment
- [ ] `NODE_ENV=production` is set in Vercel Production environment
- [ ] `AI_INTRANET_URL` is set to `https://aiintranet.sonance.com`
- [ ] `APP_ID` and `APP_API_KEY` are correctly configured
- [ ] All required Supabase variables are set
- [ ] Redeployed after making environment variable changes
- [ ] Verified real authentication works (redirects to login)
- [ ] UserSwitcher component is not visible in production UI
- [ ] Deployment logs show "Production Mode: Real authentication is ENABLED"

---

## Need Help?

If you continue to experience authentication issues:

1. Check the deployment logs in Vercel
2. Review the middleware logs for authentication flow
3. Verify your AI Intranet application registration
4. Contact your platform administrator

---

**Last Updated:** 2025-01-13
**Related Documentation:**
- `AI_INTRANET_AUTHENTICATION_COMPLETE_GUIDE.md` - Full authentication architecture
- `CLAUDE.md` - Complete software stack documentation
- `middleware.ts` - Authentication middleware implementation
