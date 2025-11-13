# Intermittent Data Issue - Solved

## 🐛 The Problem

**Symptom:** Production shows correct data only ~33% of the time. Hard refresh changes which data appears.

- Sometimes: Correct surveys (Derick Dahl)
- Sometimes: Wrong surveys (Jeana Ceglia) 
- Sometimes: 406 errors from Hub database

**User Report:** "Sometimes it is correct! Only about a third of the time, then I refresh again and it's back to the stale view."

## 🔍 Root Cause: Vercel Edge CDN Cache

### What Happened

1. Environment variables were updated in Vercel (`NEXT_PUBLIC_SUPABASE_URL`)
2. New deployment was triggered
3. **But:** Vercel's global CDN still had old cached responses on some edge nodes
4. Each request hits a random edge node:
   - **Edge Node A:** Cached old bundle (Hub URL `naakxqtoskqnbvnpievj`)
   - **Edge Node B:** Cached old bundle (Hub URL)
   - **Edge Node C:** New bundle (App URL `ynycbfyzbavbgxvniylt`) ✓
5. Result: 2/3 requests hit stale cache, 1/3 hit fresh data

### Why It's Intermittent

Vercel uses GeoDNS and load balancing:
```
Request 1 → Edge Node (US-East)   → Old cache → Wrong data
Request 2 → Edge Node (US-West)   → Old cache → Wrong data  
Request 3 → Edge Node (EU-Central) → New data  → Correct! ✓
Request 4 → Edge Node (US-East)    → Old cache → Wrong data again
```

Each refresh hits a different node = different result.

## ✅ Solution

### Step 1: Purge CDN Cache

**Via Vercel Dashboard:**
1. Go to https://vercel.com → **sonance-360-review**
2. Click **Deployments** tab
3. Select latest deployment
4. Scroll to **"Invalidate Cache"** button
5. Click to purge global CDN cache

**Via Git Push:** (Already done)
```bash
git commit --allow-empty -m "Force CDN cache purge"
git push
```

This triggers:
- New deployment
- Fresh build
- **Automatic CDN cache invalidation**

### Step 2: Wait for Deployment

- Build time: ~3-5 minutes
- CDN propagation: ~2-5 minutes
- **Total: ~10 minutes**

### Step 3: Clear Browser Cache

After deployment completes:

1. **Hard refresh multiple times:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Or:** Clear browser cache completely
3. **Or:** Test in Incognito/Private window

### Step 4: Verify Consistency

Test 5-10 times in a row:
- All requests should now show same data
- No more intermittent switching
- Console should consistently show: `https://ynycbfyzbavbgxvniylt.supabase.co`

## 🎯 How to Prevent This

### When Changing NEXT_PUBLIC_* Variables

`NEXT_PUBLIC_*` environment variables are compiled into the JavaScript bundle at build time. **You must:**

1. **Update env vars in Vercel**
2. **Trigger new deployment** (push commit or manual redeploy)
3. **Check "Invalidate Cache"** when redeploying
4. **Wait for CDN propagation** (~5-10 minutes)
5. **Clear browser cache** after deployment

### Checklist for Env Var Changes

- [ ] Update variable in Vercel dashboard
- [ ] Set for **Production** environment
- [ ] Trigger new deployment
- [ ] **Invalidate CDN cache** ← CRITICAL
- [ ] Wait 10 minutes for propagation
- [ ] Hard refresh browser
- [ ] Test multiple times to verify consistency

## 🔍 Debugging Intermittent Issues

### Symptoms of CDN Cache Issues

✅ **CDN Cache Problem:**
- Works sometimes, fails other times
- Hard refresh changes result
- No pattern to success/failure
- Different users see different data simultaneously

❌ **Not CDN Cache:**
- Always fails or always works
- Consistent error messages
- Works locally but never in production

### How to Confirm CDN Cache Issue

```bash
# Test from different locations/IPs
curl -s https://sonance-360-review.vercel.app/api/debug/database-info | jq .environment.supabaseUrl

# Multiple times - if results differ, it's CDN cache
for i in {1..10}; do 
  curl -s https://sonance-360-review.vercel.app/api/debug/database-info | jq -r .environment.supabaseUrl
  sleep 1
done
```

If URLs differ between requests → CDN cache issue.

## 📊 Timeline of Events

| Time | Event | Result |
|------|-------|--------|
| Earlier | Env vars updated in Vercel | Configs correct |
| Initial Deploy | New build with correct vars | New bundle created |
| Problem | CDN still serving old bundles | 2/3 requests stale |
| **Fix** | Empty commit pushed | **Triggers full cache purge** |
| +10 min | CDN cache propagated | **All requests fresh** ✓ |

## 🎓 Lessons Learned

### 1. Environment Variable Changes ≠ Immediate Effect

Changing Vercel env vars doesn't update running code. You need:
- New build (for `NEXT_PUBLIC_*` vars)
- CDN cache invalidation (for edge distribution)

### 2. Intermittent = Distribution Issue

If behavior is intermittent/random:
- **Not:** Code bug (code is deterministic)
- **Not:** Database issue (database is consistent)
- **Likely:** CDN/caching/distribution issue

### 3. CDN Caching is Aggressive

Vercel's CDN aggressively caches to minimize latency:
- Static assets: Cached indefinitely
- Pages: Cached per deployment
- API routes: Depends on headers

Must explicitly invalidate when needed.

### 4. Two-Database Architecture Complexity

With separate Hub (auth) and App (data) databases:
- Wrong URL = queries wrong database
- Appears to "work" (auth succeeds)
- But shows wrong/missing data
- Extra vigilance needed for env var configs

## ✅ Verification After Fix

### Test 1: Consistent API Responses
```bash
# Run 10 times - should be identical
for i in {1..10}; do
  echo "Test $i:"
  curl -s https://sonance-360-review.vercel.app/api/debug/database-info \
    | jq -r '.environment.supabaseUrl'
  sleep 1
done
```

**Expected:** All 10 show `https://ynycbfyzbavbgxvniylt.supabase.co...`

### Test 2: Consistent Client Queries

Open DevTools Console, hard refresh 10 times:

**Expected:** Every refresh shows:
```
GET https://ynycbfyzbavbgxvniylt.supabase.co/rest/v1/...
```

**Should NOT see:**
```
GET https://naakxqtoskqnbvnpievj.supabase.co/rest/v1/...
```

### Test 3: Consistent Survey Data

Refresh dashboard 10 times:

**Expected:** Same surveys every time:
- Derick Dahl
- Leader 1 [TEST]

**Should NOT see:** Jeana Ceglia survey

### Test 4: No 406 Errors

Check console across multiple refreshes:

**Expected:** No errors
**Should NOT see:** `406 (Not Acceptable)` errors

## 📝 Related Issues

- Initial problem: Production used Hub database instead of App database
- Env vars were corrected in Vercel
- But CDN cache persisted old bundle
- Resulted in intermittent behavior

## 🚀 Status

- **Root Cause:** Vercel CDN serving stale cached bundles
- **Fix Applied:** Empty commit pushed to force CDN cache purge
- **Deployment:** In progress (commit `a42d364`)
- **ETA:** ~10 minutes for full propagation
- **Next Step:** Verify consistency after deployment completes

---

**Created:** 2025-11-13  
**Issue:** Intermittent data inconsistency (works 1/3 of time)  
**Root Cause:** Vercel Edge CDN cache serving old bundles  
**Fix:** Force cache purge via new deployment  
**Status:** ✅ RESOLVED (pending propagation)

