# TypeScript Errors Explained

## Overview
There are two categories of errors in your codebase:

1. **Runtime Error**: `filteredEmployees` before initialization (Survey360Wizard.tsx)
2. **TypeScript Compilation Errors**: Type mismatches and missing properties

---

## 1. Runtime Error: filteredEmployees (RESOLVED)

### Error Message:
```
ReferenceError: Cannot access 'filteredEmployees' before initialization
components/Survey360Wizard.tsx (471:20)
```

### Cause:
A `useEffect` hook was trying to use `filteredEmployees.length` in its dependency array **before** `filteredEmployees` was declared.

In JavaScript/React:
- Variables declared with `const` have **temporal dead zone** - they cannot be accessed before their declaration
- `useEffect` dependencies are evaluated immediately during render
- If you reference a variable in dependencies before it's declared, you get this error

### ✅ **Current Status**:
**This error appears to be ALREADY FIXED** in your current code. I checked the file and:
- `filteredEmployees` is declared at line 443
- It's only used at lines 1215-1216 (both after declaration)
- No `useEffect` currently references it in dependencies

**Action**: Try refreshing your browser / restarting dev server. The error may be from cached code.

---

## 2. TypeScript Errors (NEED FIXING)

### Error Category A: Missing `app_role` on Employee Type

**Error Count**: ~19 errors in `Feedback360Dashboard.tsx`

#### Example Errors:
```typescript
components/Feedback360Dashboard.tsx(88,53): error TS2339:
  Property 'app_role' does not exist on type 'Employee'.

components/Feedback360Dashboard.tsx(167,38): error TS2339:
  Property 'app_role' does not exist on type 'Employee'.
```

#### Cause:
The code is trying to access `currentUser.app_role`, but the `Employee` type doesn't have an `app_role` property.

Looking at the type definitions:
- `Employee` type is used for `currentUser` prop
- But `app_role` is only defined on `UserProfile` type

#### Solution:
**Option 1**: Add `app_role` to the `Employee` type in `types/index.ts`:

```typescript
export interface Employee {
  id: string;
  name: string;
  email?: string | null;
  title?: string | null;
  department?: string | null;
  reports_to_id?: string | null;
  app_role?: 'user' | 'leader' | 'admin' | null;  // ADD THIS
  // ... other fields
}
```

**Option 2**: Change `currentUser` prop type from `Employee` to `UserProfile`:

```typescript
interface Feedback360DashboardProps {
  employees: Employee[];
  departments: Department[];
  organizationId: string;
  currentUserName: string;
  currentUser?: UserProfile; // Change from Employee to UserProfile
}
```

**Recommended**: Option 1 - because Employee and UserProfile should probably have the same structure anyway.

---

### Error Category B: Type Mismatch in API Route

**File**: `app/api/360-generate-report/route.ts`

#### Error 1: UserProfile Type Mismatch (Lines 115, 446)
```typescript
error TS2345: Argument of type 'UserProfile' is not assignable to parameter of type
'{ id: string; email?: string | undefined; app_role?: string | undefined; }'.
```

**Cause**: The `determineViewerRole` function expects a simplified user object, but we're passing full `UserProfile` which has additional fields.

**Solution**: Update the function signature to accept `UserProfile`:

```typescript
function determineViewerRole(
  user: UserProfile, // Change from inline type
  survey: { created_by: string; employee_id: string; status: string | null }
): 'sponsor' | 'subject' | 'admin' | 'unauthorized' {
  // ... implementation
}
```

---

#### Error 2: Database Upsert Type Mismatch (Line 316)
```typescript
error TS2769: No overload matches this call.
```

**Cause**: The `upsert` operation expects specific column types that match the database schema exactly.

**Likely Issue**: The `themes` array structure doesn't match the expected database JSONB type.

**Solution**: Add explicit type casting:

```typescript
const { error: upsertError } = await supabase
  .from('feedback_360_reports')
  .upsert({
    survey_id: survey_id,
    themes: analysisResult.themes as any, // Cast to any for JSONB
    overall_strengths: analysisResult.overall_strengths || [],
    // ... rest of fields
  } as any, {
    onConflict: 'survey_id',
  });
```

---

#### Error 3: Missing Properties (Line 464)
```typescript
error TS2739: Type 'Feedback360Report' is missing the following properties from type
'{ ... }': manager_notes, survey
```

**Cause**: When fetching from database, Supabase returns extra properties (`survey` from JOIN) that aren't in our TypeScript interface.

**Solution**: Cast the result to the correct type:

```typescript
if (viewerRole === 'subject') {
  filteredReport = filterReportForSubject(filteredReport as Feedback360Report);
}

return NextResponse.json({
  success: true,
  report: filteredReport as any, // Temporary cast
  viewerRole
});
```

---

### Error Category C: Other Errors

#### Survey Complete Page (survey/complete/[token]/page.tsx:33)
```typescript
error TS18047: 'params' is possibly 'null'.
```

**Solution**: Add null check:

```typescript
export default async function SurveyCompletePage({ params }: Props) {
  if (!params) {
    return <div>Invalid request</div>;
  }

  const { token } = params;
  // ... rest of code
}
```

#### Survey360Wizard (Line 1116)
```typescript
error TS2339: Property 'replace' does not exist on type 'never'.
```

**Need to see code context** - likely an array type inference issue.

---

## Quick Fix Summary

### Priority 1: Fix Employee Type (Fixes 19 errors)

```typescript
// types/index.ts
export interface Employee {
  id: string;
  name: string;
  email?: string | null;
  title?: string | null;
  department?: string | null;
  reports_to_id?: string | null;
  app_role?: 'user' | 'leader' | 'admin' | null;  // ← ADD THIS
  // ... other fields
}
```

### Priority 2: Fix API Route Types

```typescript
// app/api/360-generate-report/route.ts

// Import UserProfile
import type { UserProfile } from '@/lib/schema';

// Update function signature (line 39)
function determineViewerRole(
  user: UserProfile,  // ← CHANGE THIS
  survey: { created_by: string; employee_id: string; status: string | null }
): 'sponsor' | 'subject' | 'admin' | 'unauthorized' {
  // ... existing code
}

// Add type casts where needed (lines 316, 464)
```

### Priority 3: Add Null Checks

Fix the survey complete page and other null safety issues.

---

## Testing After Fixes

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Should show 0 errors after fixes
```

---

## Why These Errors Occurred

1. **Missing `app_role`**: The `Employee` type wasn't updated when `app_role` field was added to the database
2. **API Type Mismatches**: We added new functionality (role-based filtering) with strict types, but didn't update all type definitions
3. **Database Schema Mismatch**: The database has `manager_notes` field that's not in our TypeScript interface

These are all **fixable** and don't represent logic errors - just type definition mismatches!
