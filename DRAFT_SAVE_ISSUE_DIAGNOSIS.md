# Draft Save Issue Diagnosis

## ✅ RESOLVED - See DRAFT_VISIBILITY_BUG_FIX.md

**Solution:** Removed duplicate client-side filtering that was hiding drafts  
**Commit:** ae30d35  
**Status:** Fixed and deployed to production

---

## 🐛 Original Problem (NOW FIXED)

**Colleague creates draft in production:**
- ✅ Says "Draft saved successfully"
- ❌ Draft doesn't appear in their survey list
- ✅ BUT: Works perfectly in local dev server

## 🔍 Root Cause (Likely)

**User Profile Sync Issue** - The colleague's user profile may not exist or be properly synced in the App database.

### How Draft Saving Works

**1. Save Draft (`/api/surveys/save-draft`):**
```typescript
// Line 45 of save-draft/route.ts
created_by: authData.profile.id  // Uses authenticated user's profile ID
```

**2. List Surveys (`/api/surveys/list`):**
```typescript
// Lines 84-106 - Role-based filtering
if (user.app_role === 'leader') {
  filteredSurveys = allSurveys.filter(survey => {
    // 1. Created by this leader (survey.created_by === profile.id)
    // 2. For direct reports
    // 3. Where they're the subject
    // 4. Where they're a reviewer
  });
}
```

### The Problem

**In Local Dev (DISABLE_AUTH=true):**
- ✅ Uses consistent `MOCK_USER` with fixed ID
- ✅ Profile always exists in database
- ✅ Draft saves with known `created_by` ID
- ✅ List query finds drafts by that ID

**In Production (Real Auth):**
- ⚠️ Colleague authenticates via AI Intranet/Auth0
- ❌ **Colleague's profile may not exist in App DB (`user_profiles` table)**
- ❌ Draft saves with `profile.id` that doesn't match any user
- ❌ List query filters based on `profile.id` that doesn't exist
- ❌ Draft appears "invisible" to the user

## 🔧 What to Check

### 1. Does Colleague's Profile Exist?

Check if your colleague's email exists in the `user_profiles` table in the **App database** (`ynycbfyzbavbgxvniylt`):

```sql
SELECT id, email, full_name, app_role, is_active 
FROM user_profiles 
WHERE email = 'colleague@sonance.com';
```

### 2. Check Draft's `created_by` Field

See what `created_by` ID the draft was saved with:

```sql
SELECT id, survey_name, created_by, status, created_at 
FROM feedback_360_surveys 
WHERE status = 'draft' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 3. Compare IDs

If the colleague's profile exists, check if the `created_by` ID matches their `profile.id`:

```sql
-- Get colleague's profile ID
SELECT id FROM user_profiles WHERE email = 'colleague@sonance.com';

-- Check if any drafts match this ID
SELECT * FROM feedback_360_surveys 
WHERE created_by = '<colleague_profile_id>' 
AND status = 'draft';
```

## 🚨 Most Likely Scenarios

### Scenario A: Profile Doesn't Exist
- Colleague authenticates successfully
- `getAuthenticatedUser()` returns user data from Auth0/AI Intranet
- But `user_profiles` table doesn't have their record
- Draft saves with incorrect or temporary ID
- List query can't find drafts because profile doesn't match

### Scenario B: Profile ID Mismatch
- Profile exists but with different ID than Auth0 returns
- Draft saves with one ID
- List query filters with different ID
- Drafts are "orphaned"

### Scenario C: RLS Policy Blocking
- Draft saves successfully
- Row Level Security (RLS) policy blocks read access
- List query can't see the draft due to RLS rules

## ✅ Solutions

### Solution 1: Ensure User Profile Sync

Make sure colleague's profile is synced when they first log in:

**Check:** `lib/auth-supabase.ts` - `syncUserProfile()` function
- This should be called when user authenticates
- Creates/updates user_profile in App DB
- Returns consistent profile ID

**Verify:** Does middleware or auth flow call `syncUserProfile()`?

### Solution 2: Check RLS Policies

**In Supabase Dashboard:**
1. Go to Database → Tables → `feedback_360_surveys`
2. Check "Row Level Security" policies
3. Ensure there's a policy allowing users to read their own drafts:

```sql
-- Example RLS policy that should exist
CREATE POLICY "Users can read their own drafts"
ON feedback_360_surveys
FOR SELECT
USING (created_by = auth.uid() OR created_by = (SELECT id FROM user_profiles WHERE email = current_user_email));
```

### Solution 3: Add User Sync on First Request

**In middleware or auth wrapper:**
- When user authenticates in production
- Immediately sync their profile to App DB
- Ensure profile ID is consistent

## 🧪 Quick Test

**Ask your colleague to:**

1. **Open browser dev console** in production
2. **Go to:** https://sonance-360-review.vercel.app/api/auth/me
3. **Check response:**
   ```json
   {
     "user": { ... },
     "profile": {
       "id": "xxxxx-xxxxx-xxxxx",
       "email": "colleague@sonance.com",
       ...
     }
   }
   ```
4. **Note the `profile.id`** value

Then check if that ID exists in `user_profiles` table and matches any drafts' `created_by` field.

## 📝 Next Steps

1. **Verify colleague's profile exists** in App DB
2. **Check draft's `created_by`** matches their profile ID
3. **Review RLS policies** on `feedback_360_surveys` table
4. **Test user sync flow** - does it run when colleague logs in?
5. **Add logging** to see what IDs are being used

---

**Status:** Diagnosis in progress  
**Likely Cause:** User profile not synced or ID mismatch  
**Priority:** HIGH - Blocking production usage

