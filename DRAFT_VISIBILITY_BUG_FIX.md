# Draft Visibility Bug Fix

**Date:** 2025-01-13  
**Commit:** ae30d35  
**Status:** ✅ Deployed to Production

---

## 🐛 The Problem

**Symptom:**
- Colleague (Trevin Clark) creates survey draft in production
- ✅ Says "Draft saved successfully"
- ❌ Draft doesn't appear in their survey list
- ✅ Works perfectly in local dev (DISABLE_AUTH=true)
- ✅ Admin can see the draft after hard refresh

**Key Observation:** The draft WAS saving to the database successfully, but was being hidden by client-side filtering.

---

## 🔍 Root Cause Analysis

### The Dual Filtering Problem

The app was filtering surveys **TWICE**:

1. **Server-side filtering** (✅ CORRECT):
   - `/api/surveys/list` (lines 79-140)
   - Uses `authData.profile.id` from `getAuthenticatedUser()`
   - Correctly filters by role using database profile ID
   - Draft saved with `created_by = authData.profile.id`

2. **Client-side filtering** (❌ BUGGY):
   - `Feedback360Dashboard.tsx` (lines 166-241)
   - Re-filtered surveys using `currentUser.id`
   - Caused ID mismatch issues

### The ID Mismatch Bug

**Lines 185-188 (Leaders) and 215-218 (Users):**
```typescript
const isSponsor = survey.created_by && (
  survey.created_by === currentUser.id ||  // ❌ Might not match profile.id!
  (currentUser.email && survey.created_by === currentUser.email)  // ❌ NEVER works (UUID !== email)
);
if (isSponsor) return true;

// Draft surveys should only be visible to their sponsor
if (survey.status === 'draft') return false;  // ❌ Hides all non-sponsor drafts
```

### What Went Wrong

**Trevin Clark's Profile ID:** `13db57cf-eef8-4db0-96a8-771bb7df2237`

**Flow:**
1. **Save Draft:**
   - `POST /api/surveys/save-draft`
   - Uses `authData.profile.id` = `13db57cf-eef8-4db0-96a8-771bb7df2237`
   - Draft saves with `created_by = '13db57cf-eef8-4db0-96a8-771bb7df2237'` ✅

2. **Load Surveys:**
   - `GET /api/surveys/list`
   - API correctly filters and includes Trevin's draft ✅
   - Returns draft to client

3. **Client-side filtering:**
   - Checks: `survey.created_by === currentUser.id`
   - If `currentUser.id` doesn't match `profile.id` → FAILS ❌
   - Checks: `survey.created_by === currentUser.email`
   - `'13db57cf-eef8-4db0-96a8-771bb7df2237' === 'trevin@sonance.com'` → FAILS ❌
   - Result: `isSponsor = false`
   - Line 192: `if (survey.status === 'draft') return false;` → **DRAFT HIDDEN** ❌

### Why It Worked Locally

**Local Dev (DISABLE_AUTH=true):**
- Uses consistent `MOCK_USER` with fixed ID
- `currentUser.id` always matches `profile.id`
- Both API and client use same ID
- ✅ Draft visible

**Production (Real Auth):**
- Multiple sources of user data (Auth0, AI Intranet, Supabase)
- `currentUser.id` from employees materialized view
- `authData.profile.id` from user_profiles table
- IDs might be different → ❌ Draft hidden

---

## ✅ The Fix

**Removed ALL client-side role filtering** (lines 166-241 in `Feedback360Dashboard.tsx`)

### Before (BUGGY):
```typescript
// Enhance surveys with employee data
let enhancedSurveys = data.surveys?.map(...) || [];

// ❌ DUPLICATE FILTERING - causes bugs!
if (currentUser) {
  if (userRole === 'leader') {
    enhancedSurveys = enhancedSurveys.filter(survey => {
      const isSponsor = survey.created_by === currentUser.id ||
                        survey.created_by === currentUser.email;  // Never works!
      if (isSponsor) return true;
      if (survey.status === 'draft') return false;  // Hides non-sponsor drafts!
      // ... more filtering
    });
  } else {
    // ... similar buggy filtering for regular users
  }
}

setSurveys(enhancedSurveys);
```

### After (FIXED):
```typescript
// Enhance surveys with employee data
let enhancedSurveys = data.surveys?.map(...) || [];

// NOTE: Role-based filtering is handled entirely by the API
// The API uses authenticated user's profile.id and applies
// correct server-side filtering. Trust the API response.

setSurveys(enhancedSurveys);
```

---

## 🎯 Why This Fix Works

1. **Single Source of Truth:** API filtering uses consistent `profile.id` from database
2. **No ID Mismatch:** Client doesn't try to re-filter with potentially different ID
3. **Simpler Code:** Removed 77 lines of buggy duplicate logic
4. **Consistent Behavior:** Same filtering logic for local dev and production

### Role-Based Filtering (API Only)

**`/api/surveys/list/route.ts` (Lines 81-140):**

**Admin:**
- Sees all surveys ✅

**Leader:**
- Surveys they created (using `profile.id`) ✅
- Surveys for their direct reports ✅
- Surveys where they're the subject ✅
- Surveys where they're a reviewer (except drafts) ✅

**User:**
- Surveys they created (using `profile.id`) ✅
- Surveys where they're the subject (finalized only) ✅
- Surveys where they're a reviewer (except drafts) ✅

---

## 📊 Code Impact

- **File Changed:** `components/Feedback360Dashboard.tsx`
- **Lines Removed:** 77 (duplicate filtering logic)
- **Lines Added:** 10 (explanatory comment)
- **Net Reduction:** -67 lines

---

## 🚀 Deployment

**Commit:** ae30d35  
**Pushed to:** `main` branch  
**Vercel:** Auto-deployed to production  
**Production URL:** https://sonance-360-review.vercel.app

---

## ✅ Expected Results

After this fix, all users should be able to:

1. **Create drafts** in production ✅
2. **See their drafts** immediately (no hard refresh needed) ✅
3. **Edit drafts** without issues ✅
4. **Delete drafts** without issues ✅

**For Trevin Clark specifically:**
- His profile ID: `13db57cf-eef8-4db0-96a8-771bb7df2237`
- All drafts saved with this ID will now be visible ✅
- Future drafts will save and display correctly ✅

---

## 🧪 Testing

**Test Case 1: Create Draft**
1. Colleague creates 360 survey draft
2. Saves draft
3. ✅ Draft appears immediately in survey list (no refresh needed)

**Test Case 2: Edit Draft**
1. Colleague opens existing draft
2. Makes changes
3. Saves
4. ✅ Changes persist and draft remains visible

**Test Case 3: Delete Draft**
1. Colleague deletes draft
2. ✅ Draft disappears from list immediately

**Test Case 4: Role-Based Visibility**
1. Leader creates draft for direct report
2. ✅ Leader sees draft
3. ❌ Other leaders don't see draft
4. ✅ Admin sees all drafts

---

## 📝 Related Fixes

This is the **second major fix** deployed today:

1. **Supabase Singleton Fix** (commits 402f190 & 37de839)
   - Fixed connection pool issues
   - Replaced dynamic client creation with singletons
   - 9 API routes updated

2. **Draft Visibility Fix** (commit ae30d35) ← **THIS FIX**
   - Removed duplicate client-side filtering
   - Fixed ID mismatch bug
   - Simplified codebase by 67 lines

Both fixes work together to ensure:
- ✅ Reliable database connections
- ✅ Consistent user identification
- ✅ Proper role-based access control
- ✅ Drafts save and display correctly

---

## 🔍 Verification Commands

**Check if colleague's profile exists:**
```sql
SELECT id, email, full_name, app_role 
FROM user_profiles 
WHERE email = 'trevin@sonance.com';
```

**Check if drafts are saved correctly:**
```sql
SELECT id, survey_name, created_by, status, created_at 
FROM feedback_360_surveys 
WHERE created_by = '13db57cf-eef8-4db0-96a8-771bb7df2237' 
AND status = 'draft';
```

**Browser console check:**
```javascript
// Check what profile ID the API sees
fetch('/api/auth/me')
  .then(r => r.json())
  .then(data => console.log('Profile ID:', data.profile.id));

// Check surveys returned by API
fetch('/api/surveys/list')
  .then(r => r.json())
  .then(data => console.log('Surveys from API:', data.surveys.length));
```

---

**Status:** Fix deployed and live in production ✅  
**Expected Result:** Colleagues can now save and see drafts correctly 🎉

