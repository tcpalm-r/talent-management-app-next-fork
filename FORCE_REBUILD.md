# Force Clean Rebuild in Vercel

## Why This is Needed

When you change `NEXT_PUBLIC_*` environment variables in Vercel, the JavaScript bundle needs to be rebuilt to include the new values. Simply updating the env vars is not enough - you must trigger a new build.

## Steps to Force Clean Rebuild

### Method 1: Redeploy Without Cache (Recommended)

1. Go to https://vercel.com
2. Select project: **sonance-360-review**
3. Click **Deployments** tab
4. Find the most recent deployment
5. Click the **⋯** (three dots menu)
6. Click **Redeploy**
7. **IMPORTANT:** Uncheck "Use existing Build Cache"
8. Click **Redeploy**

### Method 2: Push New Commit

```bash
# Make a trivial change to force rebuild
git commit --allow-empty -m "Force rebuild with updated env vars"
git push origin main
```

### Method 3: Manual Build via Vercel CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Trigger new deployment
vercel --prod --force
```

## Verification After Rebuild

### 1. Check Build Logs

In Vercel deployment logs, verify:
```
✓ Loaded env variables from .env
✓ NEXT_PUBLIC_SUPABASE_URL detected
```

### 2. Test the API Endpoint

Visit: `https://sonance-360-review.vercel.app/api/debug/database-info`

Should show:
```json
{
  "environment": {
    "supabaseUrl": "https://ynycbfyzbavbgxvniylt.supabase.co..."
  }
}
```

### 3. Check Browser Console

Open DevTools → Console

**Should see:**
```
GET https://ynycbfyzbavbgxvniylt.supabase.co/rest/v1/...
```

**Should NOT see:**
```
GET https://naakxqtoskqnbvnpievj.supabase.co/rest/v1/...
```

### 4. Clear Browser Cache

After deployment, hard refresh:
- Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- Safari: `Cmd+Option+R`

Or open in Incognito/Private window to bypass cache entirely.

## Why This Happens

Next.js replaces `process.env.NEXT_PUBLIC_*` variables at **build time**, not runtime:

```javascript
// Your code:
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// After build, becomes:
const url = "https://ynycbfyzbavbgxvniylt.supabase.co";
```

The value is hardcoded into the JavaScript bundle. Changing Vercel env vars doesn't update already-deployed bundles.

## Common Mistake

❌ **Wrong:** Update env vars in Vercel → Expect immediate change  
✅ **Correct:** Update env vars in Vercel → Redeploy → Changes take effect

## If Still Not Working

### Check Vercel Env Var Scope

Ensure variables are set for **Production** environment:

1. Vercel → Settings → Environment Variables
2. Each variable should show: **Production** ✓

If set only for Preview/Development, production deployments won't use them.

### Verify Keys Match Project

Double-check that anon key and service key are from **ynycbfyzbavbgxvniylt** project:

1. Go to https://supabase.com/dashboard
2. Select **ynycbfyzbavbgxvniylt** project
3. Settings → API
4. Copy fresh keys
5. Update in Vercel if they don't match
6. Redeploy again

## Timeline

- **Env var update:** Instant
- **Rebuild trigger:** ~30 seconds
- **Build completion:** 2-5 minutes
- **Deployment:** ~1 minute
- **Total:** ~5-10 minutes for changes to be live

---

**Created:** 2025-11-13  
**Issue:** Client queries Hub database despite correct env vars  
**Cause:** Stale JavaScript bundle with old URL  
**Fix:** Force clean rebuild without cache

