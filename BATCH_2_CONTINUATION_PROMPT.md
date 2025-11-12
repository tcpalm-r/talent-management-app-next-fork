# RLS Refactoring - Batch 2 Continuation Prompt

## Context
We are in the middle of a comprehensive refactoring to remove ALL direct Supabase client calls and replace them with server-side API routes using service role keys. This is necessary because Row Level Security (RLS) has been enabled on 27 Supabase tables with service-role-only policies.

## What Has Been Completed (Batch 1)

### ✅ Successfully Refactored (3 files):
1. **app/survey/complete/[token]/page.tsx** - Public survey completion (8 calls removed)
   - Created API routes in `/app/api/survey-completion/`:
     - POST `/start` - Validate token & mark in-progress
     - GET `/survey?token=...` - Load survey details
     - GET `/questions?surveyId=...` - Load questions
     - POST `/submit` - Submit responses & mark complete

2. **components/Quick360Modal.tsx** - Quick survey creation (2 calls removed)
   - Uses existing `/app/api/surveys/create` route

3. **components/EmployeeDetailModal.tsx** - Employee 360 history (1 call removed)
   - Created GET `/app/api/employees/[id]/surveys` route

### ✅ Previously Completed (Before Batch 1):
**components/Survey360Wizard.tsx** - Main survey creation wizard
   - Created API routes in `/app/api/surveys/`:
     - POST `/create` - Create new surveys
     - POST `/save-draft` - Save draft surveys
     - POST `/update-draft` - Update existing drafts
     - POST `/update-status` - Update survey status
     - GET `/load-draft?surveyId=...` - Load draft data

### 📊 Current Status:
- **11 direct Supabase calls eliminated** from 4 files
- **5 new API route directories created**
- **Dev server is running** but has webpack cache errors (need to clear `.next`)
- **Supabase MCP is configured** and ready for validation

---

## What Remains (Batch 2) - URGENT

### 🚨 Files Still Using Direct Supabase Calls:

1. **components/Feedback360Dashboard.tsx** - 30+ calls (CRITICAL - main 360 interface)
   - This is why you can't see review cards after launching surveys
   - Largest refactoring effort remaining

2. **components/Dashboard.tsx** - 5 calls (main dashboard data loading)

---

## Immediate Tasks

### Task 1: Validate Batch 1 (Use Supabase MCP)
Now that MCP is enabled, validate:
1. Query `feedback_360_surveys` table to see surveys created in Batch 1
2. Verify reviewers were inserted correctly
3. Confirm no direct Supabase calls remain in Batch 1 files:
   ```bash
   grep -n "supabase\.from\|await supabase" \
     app/survey/complete/\[token\]/page.tsx \
     components/Quick360Modal.tsx \
     components/EmployeeDetailModal.tsx
   ```
   Should return: **NO results**

### Task 2: Fix Webpack Cache Error
The dev server has cache corruption from too many parallel file changes:
```bash
rm -rf .next
# Restart dev server if needed
```

### Task 3: Refactor Remaining Files (Batch 2)
**DO NOT use parallel sessions for Batch 2** - do sequentially to avoid cache issues.

#### File 1: components/Dashboard.tsx (5 calls - EASIER)
Current calls:
- Line 137: `.from('employees')` - materialized view
- Line 141: `.from('departments')` - materialized view
- Line 145: `.from('assessments')`
- Line 174: `.from('departments')` again
- Line 198: `.from('feedback_360_surveys').eq('status', 'finalized')`

Create API routes in `/app/api/dashboard/`:
- GET `/data` - Load employees, departments, assessments
- GET `/surveys?status=finalized` - Load finalized surveys

#### File 2: components/Feedback360Dashboard.tsx (30+ calls - LARGEST)
This is THE critical file - the main 360 review interface.

Current operations (~lines 142-1459):
- **Reads**: Load surveys with filters, load single survey, load reviewers, load responses
- **Updates**: Update survey status/fields, update reviewer status, update employee email
- **Deletes**: Delete questions, delete responses, delete reviewers, soft delete surveys

Create/extend API routes in `/app/api/surveys/`:
1. GET `/list?createdBy=X&employeeId=Y&status=Z` - Load surveys with filters
2. GET `/[id]/details` - Load single survey with all related data
3. PATCH `/[id]` - Update survey fields
4. DELETE `/[id]` - Soft delete survey
5. GET `/[id]/reviewers` - Load reviewers
6. PATCH `/[id]/reviewers/[reviewerId]` - Update reviewer
7. DELETE `/[id]/reviewers/[reviewerId]` - Remove reviewer
8. POST `/[id]/finalize` - Finalize survey
9. POST `/[id]/revert-draft` - Revert to draft
10. POST `/[id]/resend-invitation` - Resend invitation email

---

## Critical Information

### Database Access Pattern:
- **Client-side code**: BLOCKED by RLS (all direct `supabase.from()` calls fail)
- **API routes**: Use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- **API route template**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET/POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use supabase here with full access
}
```

### Why This Is Urgent:
- Users cannot see 360 review cards after launching them
- Dashboard may not load employee/survey data properly
- Main 360 interface is completely broken

### Success Criteria:
- ✅ Zero direct Supabase calls in components/
- ✅ All operations go through server-side API routes
- ✅ Can view launched surveys in dashboard
- ✅ Dev server compiles with no errors
- ✅ All 360 functionality works end-to-end

---

## Commands for Quick Reference

**Check for remaining direct calls:**
```bash
grep -rn "supabase\.from\|await supabase" components/ app/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".next"
```

**List all created API routes:**
```bash
find app/api -name "route.ts" -type f | sort
```

**Clear webpack cache:**
```bash
rm -rf .next
```

**Restart dev server:**
```bash
npm run dev
```

---

## Strategy Recommendation
1. ✅ Validate Batch 1 with MCP first (5 min)
2. ✅ Clear `.next` cache if webpack errors persist (1 min)
3. 🔄 Refactor Dashboard.tsx FIRST - smaller, easier (15 min)
4. 🔄 Refactor Feedback360Dashboard.tsx LAST - largest, most complex (30-45 min)
5. ✅ Final validation - grep for any remaining calls
6. ✅ Test full 360 workflow end-to-end

---

## Important Notes
- **DO NOT** use parallel Claude Code sessions for Batch 2 (causes webpack cache corruption)
- **DO NOT** skip validation steps
- **DO** test after each file refactoring
- **DO** use MCP for validation, NOT for writing code
- The dev server at http://localhost:3004 should stay running throughout

---

## Questions to Ask If Unclear
1. Should I validate Batch 1 first or jump straight to refactoring?
2. Should I fix the webpack cache issue first?
3. Do you want to see the full API route code for each endpoint, or should I create them all at once?
