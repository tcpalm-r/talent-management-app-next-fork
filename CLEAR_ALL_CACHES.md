# Clear All Caches - Production Issue Fix

## 🚨 Current Status

Intermittent data issues persist even after CDN cache purge. This indicates **multiple layers of caching**.

## 🎯 Solution: Nuclear Cache Clear

### Step 1: Wait for Latest Deployment

**Commit `36b8748`:** "Add aggressive cache-busting headers and unique build IDs"

This adds:
- `Cache-Control: no-store, must-revalidate` headers on all routes
- Unique build IDs with timestamps
- Forces fresh responses from server

**Wait 10-15 minutes** for:
- Build to complete
- CDN to propagate
- New headers to take effect

Check: https://vercel.com/elliottamadors-projects/sonance-360-review/deployments

### Step 2: Clear Browser Cache (Required!)

Even with CDN purge, your **browser** still has cached files.

#### Chrome/Edge (Mac)
1. Open DevTools (`Cmd+Option+I`)
2. **Right-click** the refresh button
3. Select **"Empty Cache and Hard Reload"**
4. Or: Settings → Privacy → Clear browsing data → Cached images and files

#### Chrome/Edge (Windows)
1. Open DevTools (`F12`)
2. **Right-click** the refresh button  
3. Select **"Empty Cache and Hard Reload"**
4. Or: Settings → Privacy → Clear browsing data → Cached images and files

#### Firefox
1. `Cmd+Shift+Delete` (Mac) or `Ctrl+Shift+Delete` (Windows)
2. Select "Cache"
3. Time range: "Everything"
4. Click "Clear Now"

#### Safari
1. `Cmd+Option+E` - Empty caches
2. Then `Cmd+R` - Refresh

### Step 3: Test in Incognito/Private Window

**Best way to verify:**
1. Open new Incognito/Private window
2. Visit: https://sonance-360-review.vercel.app
3. Login fresh
4. Check DevTools Console

**Expected:** Consistent results every time
```
GET https://ynycbfyzbavbgxvniylt.supabase.co/rest/v1/...
```

### Step 4: Verify Consistency

Test 10 times in a row:

```bash
# Check which build is serving (run 10 times)
for i in {1..10}; do
  echo "Test $i:"
  curl -s "https://sonance-360-review.vercel.app/api/debug/check-headers" \
    | jq -r '.environment.vercelGitCommitSha'
  sleep 1
done
```

**All 10 should show:** Same commit SHA (starts with `36b8748` or newer)

## 🔍 Layers of Caching

The issue involves **3 layers of cache:**

```
Browser Cache (Your Computer)
     ↓
Vercel Edge CDN (Global)
     ↓
Next.js App (Server)
```

### Why Each Needs Clearing

1. **Browser Cache**
   - Stores JS bundles locally
   - Can persist old code even after CDN update
   - **Must clear manually**

2. **Vercel CDN** 
   - Caches responses at edge nodes
   - Purged by new deployment
   - Takes 5-10 min to propagate

3. **Next.js Build**
   - Bundles environment variables
   - New build = new values
   - Happens automatically on deploy

## 🧪 Diagnostic Commands

### Test 1: Check Current Build ID
```bash
curl -s https://sonance-360-review.vercel.app/api/debug/check-headers \
  | jq
```

Look for `vercelGitCommitSha` - should be `36b8748` or newer.

### Test 2: Check Supabase URL
```bash
curl -s https://sonance-360-review.vercel.app/api/debug/database-info \
  | jq -r '.environment.supabaseUrl'
```

Should show: `https://ynycbfyzbavbgxvniylt.supabase.co...`

### Test 3: Check Multiple Times
```bash
# Run 5 times - should be identical
for i in {1..5}; do
  curl -s https://sonance-360-review.vercel.app/api/debug/check-headers \
    | jq -r '.requestId, .environment.vercelGitCommitSha'
done
```

All should show same commit SHA.

## ✅ Success Criteria

After clearing all caches, **every refresh should show:**

1. ✅ Same surveys (Derick Dahl, Leader 1 [TEST])
2. ✅ Console shows `ynycbfyzbavbgxvniylt.supabase.co` URLs
3. ✅ No 406 errors
4. ✅ No Jeana Ceglia survey
5. ✅ Consistent across 10+ refreshes

## ⚠️ If Still Inconsistent

If after clearing all caches you still see intermittent behavior:

### Check Service Worker
1. Open DevTools → Application tab
2. Service Workers section
3. Click "Unregister" if any exist
4. Hard refresh

### Check Local Storage
1. Open DevTools → Application tab
2. Local Storage → https://sonance-360-review.vercel.app
3. Right-click → Clear
4. Session Storage → Clear

### Disable Cache Completely (Testing)
1. Open DevTools (`F12`)
2. Network tab
3. Check "Disable cache"
4. Keep DevTools open while testing
5. Refresh 10 times - should be consistent

## 📊 Timeline

| Time | Action | Result |
|------|--------|--------|
| Now | Deployment building | `36b8748` commit |
| +5 min | Build complete | New code deployed |
| +10 min | CDN propagated | Cache headers active |
| **+15 min** | **Clear browser cache** | **Test for consistency** |

## 🎓 Why This Happened

1. Changed `NEXT_PUBLIC_SUPABASE_URL` env var
2. New build created with correct URL
3. **But:** Old builds still cached at:
   - Vercel edge nodes (fixed by deploy)
   - Browser cache (must clear manually)
   - Possibly service workers
4. Result: Random mix of old/new code

## 🚀 Prevention

For future env var changes:

```bash
# 1. Update env var in Vercel dashboard
# 2. Deploy to main branch
git checkout main
git commit --allow-empty -m "Update env vars"
git push origin main

# 3. Wait 15 minutes
# 4. Clear browser cache
# 5. Test in incognito window
```

---

**Created:** 2025-11-13  
**Issue:** Intermittent wrong data after CDN purge  
**Root Cause:** Browser cache + multi-layer caching  
**Fix:** Aggressive cache-busting + manual browser cache clear  
**Status:** ⏳ Waiting for deployment + user cache clear

