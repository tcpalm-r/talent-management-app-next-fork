## Testing Strategy: Preventing Authentication & API Issues

### 🎯 Purpose

These tests prevent issues like the **RLS refactoring bug** where surveys disappeared in production because:
1. Client sent wrong user IDs to API routes
2. API routes accepted client-provided IDs instead of using authenticated user
3. Surveys were created with `created_by` values that didn't match the user's profile ID
4. Role-based filtering hid surveys from their creators

---

## 🧪 Test Suite Overview

### **1. Integration Tests** (`__tests__/integration/`)

#### **survey-creation.test.ts**
Tests the complete survey creation flow:
- ✅ Verifies API uses authenticated user ID, not client-provided ID
- ✅ Tests that unauthenticated requests are rejected
- ✅ Ensures client tampering (sending fake IDs) is ignored
- ✅ Validates surveys are visible immediately after creation
- ✅ Tests role-based filtering (admin/leader/user)

#### **auth-flow.test.ts**
Tests authentication and ID consistency:
- ✅ Verifies `profile.id` is from database, not session
- ✅ Tests email-based lookup (stable identifier)
- ✅ Validates UUID vs Auth0 ID handling
- ✅ Checks common pitfalls (employee ID vs user ID)
- ✅ Tests development vs production behavior

---

## 🚀 Running Tests

### **Run All Tests**
```bash
npm test
```

### **Run Only Integration Tests**
```bash
npm test __tests__/integration
```

### **Run with Coverage**
```bash
npm test -- --coverage
```

### **Run Pre-Commit Checks**
```bash
./scripts/pre-commit-checks.sh
```

---

## 🔄 GitHub Actions CI

The CI pipeline runs automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

### **CI Workflow** (`.github/workflows/ci.yml`)

**Jobs:**

1. **test** - Runs unit and integration tests
   - Linting
   - Unit tests with coverage
   - Integration tests
   - Security vulnerability checks
   - Build verification

2. **e2e-tests** - Runs end-to-end tests
   - Playwright tests
   - Full user workflows

3. **security-audit** - Security checks
   - npm audit for dependencies
   - Pattern detection (eval, dangerouslySetInnerHTML)
   - Environment variable usage

### **Security Checks**

The CI automatically fails if:
- ❌ API routes accept `createdBy` from client
- ❌ Survey creation routes missing authentication
- ❌ Survey creation not using `authData.profile.id`
- ❌ Client components sending `createdBy` field

---

## 🛡️ Security Checks Explained

### **Check 1: No Client-Provided User IDs**

**What it checks:**
```bash
grep -r "createdBy.*await request.json()" app/api/
```

**Why it matters:**
- Client-provided user IDs can be tampered with
- API must derive identity from server-side authentication
- Prevents the exact bug that caused surveys to disappear

**Example of WHAT NOT TO DO:**
```typescript
// ❌ VULNERABLE:
const { createdBy } = await request.json();
const survey = await supabase.insert({ created_by: createdBy });
```

**Example of CORRECT APPROACH:**
```typescript
// ✅ SECURE:
const authData = await getAuthenticatedUser(request);
const survey = await supabase.insert({ created_by: authData.profile.id });
```

### **Check 2: Authentication Required**

**What it checks:**
- `/api/surveys/create` has `getAuthenticatedUser()`
- `/api/surveys/save-draft` has `getAuthenticatedUser()`

**Why it matters:**
- Prevents unauthorized survey creation
- Ensures we have authenticated user context
- Required for getting correct `profile.id`

### **Check 3: Uses Authenticated User ID**

**What it checks:**
- Routes use `authData.profile.id` for ownership fields
- Not using client-provided values

**Why it matters:**
- `profile.id` is always from the database
- Looked up by email (stable identifier)
- Consistent across requests
- Matches filtering logic in `/api/surveys/list`

### **Check 4: Client Components Clean**

**What it checks:**
- Components don't send `createdBy` in API calls
- No hardcoded user IDs like `'current-user'` or `'unknown'`

**Why it matters:**
- Server derives all ownership information
- Client can't tamper with identity
- Simpler and more secure

---

## 📝 Writing New Tests

### **Testing API Route with User ID**

```typescript
import { POST as myApiRoute } from '@/app/api/my-route/route';
import { getAuthenticatedUser } from '@/lib/auth-wrapper';

jest.mock('@/lib/auth-wrapper');

test('should use authenticated user ID', async () => {
  // Mock authentication
  (getAuthenticatedUser as jest.Mock).mockResolvedValue({
    user: mockUser,
    profile: { id: 'test-uuid-123', email: 'test@example.com' },
  });

  // Create request
  const request = new NextRequest('http://localhost/api/my-route', {
    method: 'POST',
    body: JSON.stringify({ data: 'test' }),
  });

  // Call route
  await myApiRoute(request);

  // Verify authentication was checked
  expect(getAuthenticatedUser).toHaveBeenCalledWith(request);

  // Verify correct ID was used
  // (check your database mock was called with profile.id)
});
```

### **Testing Role-Based Filtering**

```typescript
test('admin sees all, user sees only own', async () => {
  // Test with admin
  (getAuthenticatedUser as jest.Mock).mockResolvedValue({
    user: { ...mockUser, app_role: 'admin' },
    profile: { ...mockProfile, app_role: 'admin' },
  });

  let response = await listSurveys(request);
  let data = await response.json();
  
  expect(data.surveys).toHaveLength(3); // Sees all

  // Test with regular user
  (getAuthenticatedUser as jest.Mock).mockResolvedValue({
    user: { ...mockUser, app_role: 'user' },
    profile: { ...mockProfile, app_role: 'user' },
  });

  response = await listSurveys(request);
  data = await response.json();
  
  expect(data.surveys).toHaveLength(1); // Sees only own
});
```

---

## 🔍 Pre-Commit Hook Setup

### **Install Git Hook (Optional)**

To run security checks automatically before each commit:

```bash
# Create git hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
./scripts/pre-commit-checks.sh
EOF

# Make it executable
chmod +x .git/hooks/pre-commit
```

Now security checks run automatically before every commit!

---

## 🐛 What These Tests Would Have Caught

### **The RLS Refactoring Bug**

**What happened:**
```typescript
// In Survey360Wizard.tsx:
createdBy: currentUser?.id || 'unknown'

// In /api/surveys/create:
const { createdBy } = await request.json();
created_by: createdBy || 'unknown'
```

**Result:** Surveys created with `created_by: 'unknown'`

**What tests would catch:**

1. **Integration test:** "should use authenticated user ID, not client-provided ID"
   - Would fail because mock verifies `authData.profile.id` is used
   
2. **Security check:** Client-provided user IDs
   - Would fail: Found `createdBy` in `await request.json()`
   
3. **Security check:** Missing authentication
   - Would fail: No `getAuthenticatedUser()` call
   
4. **Visibility test:** "should make surveys visible to their creator immediately"
   - Would fail: Survey with `'unknown'` doesn't match filter

---

## 📊 Test Coverage Goals

| Area | Target | Current |
|------|--------|---------|
| API Routes | 80% | ~50% |
| Auth Logic | 90% | ~60% |
| Integration | 70% | New! |
| E2E | 50% | ~30% |

---

## 🎓 Best Practices

### **Always Test:**
1. ✅ Authentication is required
2. ✅ Server derives user identity
3. ✅ Created records are immediately visible
4. ✅ Role-based filtering works
5. ✅ Client can't tamper with ownership

### **Never Trust:**
1. ❌ Client-provided user IDs
2. ❌ Session IDs directly in database
3. ❌ Employee IDs as user IDs
4. ❌ Literal strings as IDs ('unknown', 'current-user')

### **Always Use:**
1. ✅ `getAuthenticatedUser(request)` in API routes
2. ✅ `authData.profile.id` for ownership fields
3. ✅ Email as stable identifier for lookups
4. ✅ Database UUID as source of truth

---

## 🚨 When Tests Fail

### **"should use authenticated user ID, not client-provided ID" fails:**
**Cause:** API route accepting user ID from client  
**Fix:** Use `getAuthenticatedUser()` and `authData.profile.id`

### **"should reject unauthenticated requests" fails:**
**Cause:** Missing authentication check  
**Fix:** Add `getAuthenticatedUser()` at start of route handler

### **"should make surveys visible to their creator immediately" fails:**
**Cause:** ID mismatch between creation and filtering  
**Fix:** Both must use same `authData.profile.id`

### **CI security check fails:**
**Cause:** Detected vulnerable pattern  
**Fix:** Review the grep output and remove client-provided user IDs

---

## 📚 Related Documentation

- [Security Fix Documentation](./SECURITY_FIX_USER_ID_VULNERABILITY.md)
- [Why It Works Locally But Not Production](./WHY_IT_WORKS_LOCALLY_BUT_NOT_PRODUCTION.md)
- [Component Testing Guide](./TESTING.md)

---

## 🔄 Continuous Improvement

As new features are added:

1. **Add integration tests** for any new API routes
2. **Test authentication** for routes that create records
3. **Verify filtering** if implementing role-based access
4. **Run pre-commit checks** before pushing

---

**Remember:** These tests exist because a real bug cost hours of debugging. Keep them updated and they'll save you time!

