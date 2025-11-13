# Why Survey Creation Works Locally But Not in Production

## 🔍 The Mystery

**Local (dev):** ✅ Surveys appear immediately  
**Production:** ❌ Surveys disappear after "success" message

**Why does the EXACT same code behave differently?**

---

## 📋 The Answer: Different Authentication Flows

### **Local Development Flow (with `DISABLE_AUTH=true`)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Application Starts                                       │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Middleware (middleware.ts)                               │
│    - Sees DISABLE_AUTH=true                                 │
│    - Injects MOCK_USER into request headers                 │
│    - MOCK_USER.id = 'mock-thomas-palmer'                    │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Client Component (Survey360Wizard.tsx)                   │
│    - currentUser.id = 'mock-thomas-palmer'                  │
│    - BEFORE FIX: Sends createdBy: 'mock-thomas-palmer'      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. API Route (/api/surveys/create or save-draft)           │
│    - BEFORE FIX: Uses client's createdBy value              │
│    - created_by = 'mock-thomas-palmer'                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Database (Supabase)                                      │
│    - Survey created with:                                   │
│      created_by = 'mock-thomas-palmer'                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Survey List API (/api/surveys/list)                     │
│    - getAuthenticatedUser() returns MOCK_USER               │
│    - profile.id = 'mock-thomas-palmer'                      │
│    - Filter: survey.created_by === profile.id               │
│    - 'mock-thomas-palmer' === 'mock-thomas-palmer' ✅       │
│    - Survey is VISIBLE                                      │
└─────────────────────────────────────────────────────────────┘
```

**Result:** ✅ **WORKS** - Both the survey's `created_by` and the user's `profile.id` are the same hardcoded value: `'mock-thomas-palmer'`

---

### **Production Flow (with Real Auth0)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Logs In via AI Intranet                            │
│    - User clicks login                                      │
│    - Redirected to aiintranet.sonance.com                   │
│    - AI Intranet redirects to Auth0                         │
│    - Auth0 authenticates user                               │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Auth0 Returns to AI Intranet                            │
│    - Auth0 ID: "auth0|abc123xyz"                           │
│    - Session created with this Auth0 ID                     │
│    - Cookie set: ai-intranet-session                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. User Visits Talent Management App                       │
│    - Middleware validates session                           │
│    - Gets user from AI Intranet API                         │
│    - SessionUser.id = "auth0|abc123xyz"                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Profile Sync (lib/auth-supabase.ts)                     │
│    - Looks up user in database by EMAIL                     │
│    - SELECT * FROM user_profiles WHERE email = '...'        │
│                                                             │
│    TWO SCENARIOS:                                           │
│    ┌────────────────────────────────────────────┐          │
│    │ A) Profile EXISTS (from previous login)   │          │
│    │    - Returns existing profile              │          │
│    │    - profile.id = UUID from database       │          │
│    │    - e.g., "550e8400-e29b-41d4-a716-..."  │          │
│    └────────────────────────────────────────────┘          │
│                   OR                                        │
│    ┌────────────────────────────────────────────┐          │
│    │ B) Profile DOESN'T EXIST (first login)    │          │
│    │    - Creates new profile                   │          │
│    │    - Uses SessionUser.id from Auth0        │          │
│    │    - profile.id = "auth0|abc123xyz"        │          │
│    └────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Client Component Gets User                              │
│    - In some cases, gets Employee record, not profile      │
│    - currentUser.id might be:                              │
│      • Employee UUID (from employees view)                  │
│      • Auth0 ID (from session)                             │
│      • undefined or 'unknown'                              │
│    - INCONSISTENT VALUES!                                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Survey Creation (BEFORE FIX)                            │
│    - Client sends: createdBy: currentUser?.id || 'unknown' │
│    - API receives: createdBy = 'unknown' ❌                │
│    - OR: createdBy = employee UUID (wrong type!) ❌         │
│    - OR: createdBy = 'current-user' (literal string) ❌    │
│    - Survey created with WRONG created_by value            │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Database (Supabase)                                      │
│    - Survey created with:                                   │
│      created_by = 'unknown'                                 │
│      OR created_by = '550e8400-...' (employee UUID)         │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Survey List API (/api/surveys/list)                     │
│    - getAuthenticatedUser() called                          │
│    - Looks up profile by email                             │
│    - profile.id = "123e4567-..." (user profile UUID)       │
│    - Filter: survey.created_by === profile.id               │
│    - 'unknown' === '123e4567-...' ❌                        │
│    - Survey is HIDDEN                                       │
└─────────────────────────────────────────────────────────────┘
```

**Result:** ❌ **FAILS** - The survey's `created_by` doesn't match the user's `profile.id`

---

## 🎯 The Core Problem: ID Mismatches

### **What Values Could `created_by` Have? (Before Fix)**

| Source | Value Example | Matches profile.id? |
|--------|---------------|---------------------|
| Client sent 'unknown' | `'unknown'` | ❌ Never matches |
| Client sent literal | `'current-user'` | ❌ Never matches |
| Client sent employee UUID | `'aaa-111-bbb-222'` | ❌ Wrong ID type |
| Client sent Auth0 ID | `'auth0\|abc123'` | ❌ Might work first time, but profile uses UUID |
| Client sent undefined | `undefined` → `'unknown'` | ❌ Never matches |

### **What Value Does `profile.id` Have?**

In `/api/surveys/list`, the filter uses:
```typescript
const authData = await getAuthenticatedUser(request);
// authData.profile.id is ALWAYS the database user_profiles.id

filteredSurveys = allSurveys.filter((survey) => {
  if (survey.created_by === profile.id) return true;  // Must match EXACTLY
});
```

`profile.id` is ALWAYS:
- ✅ The UUID from the `user_profiles` table
- ✅ Looked up by email
- ✅ Consistent across requests

---

## 💡 Why Local Development Worked

### **1. Single Hardcoded ID**

```typescript
// In lib/auth.ts
export const MOCK_USER: SessionUser = {
  id: 'mock-thomas-palmer',  // ⬅️ Hardcoded, never changes
  email: 'thomas.palmer@sonance.com',
  full_name: 'Thomas Palmer',
  app_role: 'admin',
  ...
};
```

### **2. Consistent Throughout**

Every part of the system uses the same value:
- Client: `currentUser.id = 'mock-thomas-palmer'`
- Survey creation: `created_by = 'mock-thomas-palmer'`
- Profile lookup: `profile.id = 'mock-thomas-palmer'`
- Filtering: `'mock-thomas-palmer' === 'mock-thomas-palmer'` ✅

### **3. No Real Auth Complexity**

```typescript
// Middleware with DISABLE_AUTH=true
if (AUTH_DISABLED) {
  return {
    user: MOCK_USER,  // ⬅️ Always the same object
    profile: MOCK_USER,
  };
}
```

---

## 🔧 How The Fix Solves This

### **After Fix (Server-Side ID)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client Creates Survey                                    │
│    - NO LONGER sends createdBy                             │
│    - Server will derive it                                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. API Route (/api/surveys/create)                         │
│    const authData = await getAuthenticatedUser(request);    │
│    // This ALWAYS does profile lookup by email             │
│    created_by: authData.profile.id  // ⬅️ Database UUID    │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. getAuthenticatedUser() Flow                             │
│    - Gets session user (Auth0 ID)                          │
│    - Calls syncUserProfile(sessionUser)                     │
│    - syncUserProfile looks up by EMAIL:                     │
│      SELECT * FROM user_profiles WHERE email = '...'       │
│    - Returns DATABASE profile with DATABASE UUID           │
│    - authData.profile.id = '123e4567-...' (database UUID)  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Survey Created in Database                              │
│    created_by = '123e4567-...' (database UUID) ✅          │
└─────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Survey List Filtering                                   │
│    - getAuthenticatedUser() again                          │
│    - SAME lookup by email                                   │
│    - profile.id = '123e4567-...' (database UUID)           │
│    - Filter: survey.created_by === profile.id              │
│    - '123e4567-...' === '123e4567-...' ✅                   │
│    - Survey is VISIBLE                                      │
└─────────────────────────────────────────────────────────────┘
```

**Result:** ✅ **WORKS** - Both creation and filtering use the SAME database UUID

---

## 🔑 Key Insight: Email is the True Identity

The fix works because:

1. **Email is stable** across sessions and environments
2. **Database lookup by email** returns the same profile every time
3. **profile.id is always the database UUID** for that email
4. **No client involvement** - ID is derived server-side

```typescript
// The magic is in lib/auth-supabase.ts:
export async function syncUserProfile(sessionUser: SessionUser) {
  // Look up by EMAIL (stable identifier)
  const { data: existingUser } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('email', sessionUser.email)  // ⬅️ Email lookup
    .single();

  if (existingUser) {
    return existingUser;  // ⬅️ Returns DATABASE record with DATABASE UUID
  }
  
  // ... create new profile if needed
}
```

---

## 📊 Visual Comparison

### **Before Fix:**

```
LOCAL:     'mock-thomas-palmer' ──┐
                                  ├─→ MATCH ✅
Database:  'mock-thomas-palmer' ──┘

PROD:      'unknown' ──┐
                       ├─→ MISMATCH ❌
Database:  '123e4567-...' ──┘
```

### **After Fix:**

```
LOCAL:     '123e4567-...' (from DB) ──┐
                                      ├─→ MATCH ✅
Database:  '123e4567-...' (from DB) ──┘

PROD:      '123e4567-...' (from DB) ──┐
                                      ├─→ MATCH ✅
Database:  '123e4567-...' (from DB) ──┘
```

---

## 🎓 Summary

**Why it worked locally:**
- Single hardcoded ID used everywhere
- No real auth complexity
- Consistent value: `'mock-thomas-palmer'`

**Why it failed in production:**
- Client sent wrong/inconsistent IDs
- Real auth has Auth0 IDs, database UUIDs, employee IDs
- Mismatch between `created_by` and `profile.id`

**Why the fix works:**
- Server derives ID from database lookup
- Email-based lookup is stable
- Same lookup logic in creation and filtering
- No trust in client-provided IDs

---

**The lesson:** Local development can mask authentication issues because mock users have simpler, more consistent behavior than real auth flows!

