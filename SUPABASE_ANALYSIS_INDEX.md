# Supabase Database Operations Analysis Index

## Overview

This analysis documents all Supabase database operations in the `Feedback360Dashboard.tsx` component. The project has 3 comprehensive documentation files to help you understand and refactor database operations.

**Analysis Date:** November 12, 2025
**Component Analyzed:** `/components/Feedback360Dashboard.tsx`
**Component Size:** 2,584 lines
**Total Operations Found:** 25
**Tables Involved:** 6

---

## Documentation Files

### 1. SUPABASE_OPERATIONS_SUMMARY.md (11 KB, 489 lines)
**Best For:** Quick overview and reference

Contains:
- High-level summary of all 25 operations
- Organized by database table
- Operation type breakdown
- Quick table of contents
- Recommended API routes to create

**When to Use:**
- Getting a bird's-eye view of database access
- Planning API route creation
- Understanding operation distribution
- Identifying security concerns

**Key Sections:**
- Operations by table with line numbers
- Filter/condition details
- Data flow summary
- Security and performance notes

---

### 2. SUPABASE_OPERATIONS_DETAILED.md (19 KB, 859 lines)
**Best For:** In-depth reference and implementation

Contains:
- 24 individual operation detail sheets
- Complete query patterns with code samples
- Filter conditions and return values
- Side effects and purpose
- Authorization and performance notes
- Security improvements section

**When to Use:**
- Creating API routes to replace component queries
- Understanding query intent and side effects
- Checking authorization requirements
- Performance optimization planning
- Implementing RLS policies

**Each Operation Includes:**
- Function name and location (line numbers)
- Complete TypeScript query pattern
- Filter/condition details
- Data fetched/modified
- Return values
- Side effects
- Authorization checks

---

### 3. SUPABASE_OPERATIONS_QUICK_REFERENCE.md (10 KB, 354 lines)
**Best For:** Quick lookup and data flow understanding

Contains:
- Operations organized by table
- Function-to-operations mapping
- Operation summary matrix
- Data flow diagram (ASCII)
- Key functions with query counts
- Performance complexity analysis
- Security quick checklist
- API route creation priority

**When to Use:**
- Quick lookup during development
- Understanding function call sequences
- Planning refactoring priorities
- Data flow debugging
- Determining API route priorities

---

## Quick Statistics

### By Operation Type
- **SELECT:** 11 operations
- **INSERT:** 1 operation
- **UPDATE:** 6 operations
- **DELETE:** 7 operations

### By Table
1. `feedback_360_surveys` - 13 operations (most accessed)
2. `feedback_360_survey_reviewers` - 7 operations
3. `feedback_360_responses` - 1 operation
4. `feedback_360_survey_questions` - 2 operations
5. `feedback_360_questions` - 1 operation
6. `user_profiles` - 1 operation

### By Function
- `loadSurveys()` - 1 SELECT
- `loadRawSurveyData()` - 5 SELECTs
- `sendBackward()` - 1 DELETE, 1 UPDATE, 2 SELECTs
- `addReviewer()` - 1 INSERT, 1 SELECT, 1 UPDATE
- `removeReviewer()` - 1 DELETE, 1 SELECT, 1 UPDATE
- `deleteInProgressSurvey()` - 4 DELETEs
- `finalizeSurvey()` - 1 UPDATE
- And 8 more functions...

---

## How to Use These Documents

### Scenario 1: Creating API Routes
1. Start with `SUPABASE_OPERATIONS_SUMMARY.md` - Get overview
2. Check `SUPABASE_OPERATIONS_QUICK_REFERENCE.md` - See recommendations
3. Use `SUPABASE_OPERATIONS_DETAILED.md` - Get exact query patterns
4. For each operation, copy the query pattern and move to API route

### Scenario 2: Implementing RLS Policies
1. Review `SUPABASE_OPERATIONS_SUMMARY.md` - Understand role filtering
2. Read security section in `SUPABASE_OPERATIONS_DETAILED.md`
3. For each operation, identify access control requirements
4. Check `SUPABASE_OPERATIONS_QUICK_REFERENCE.md` - Security matrix

### Scenario 3: Performance Optimization
1. Check `SUPABASE_OPERATIONS_QUICK_REFERENCE.md` - Performance table
2. Review `SUPABASE_OPERATIONS_DETAILED.md` - Operation complexity
3. Identify O(n) operations and add pagination/caching
4. Use `SUPABASE_OPERATIONS_SUMMARY.md` - Verify dependencies

### Scenario 4: Understanding Data Flow
1. Read `SUPABASE_OPERATIONS_QUICK_REFERENCE.md` - Data flow diagram
2. Trace through each function in `SUPABASE_OPERATIONS_SUMMARY.md`
3. For specific operation, check `SUPABASE_OPERATIONS_DETAILED.md`
4. Follow side effects and state updates

---

## Key Findings

### Security Gaps
1. **No server-side authorization** - All checks are client-side
2. **No RLS policies** - Database doesn't enforce permissions
3. **Organization filtering** - Only checked at query time, not enforced
4. **Deletion authorization** - Minimal checks on delete operations
5. **No audit logging** - Sensitive operations aren't tracked

### Performance Issues
1. **No pagination** - `loadSurveys()` loads all surveys at once O(n)
2. **Multiple queries** - Cascade deletes require 4 separate queries
3. **Client-side filtering** - Role filtering done after full query
4. **N+1 queries** - Some operations fetch related data in sequence

### Architectural Concerns
1. **Direct DB access from component** - Should use API routes
2. **Role filtering** - Moved server-side for consistency
3. **Error handling** - Inconsistent error reporting
4. **State management** - Complex with multiple async operations
5. **Component coupling** - Tightly coupled to Supabase SDK

---

## Recommended Actions (Priority)

### High Priority
1. Create `/api/360-surveys` GET endpoint (replace loadSurveys)
2. Implement Supabase RLS policies
3. Move authorization checks to server
4. Add organization_id validation server-side

### Medium Priority
1. Create CRUD API endpoints for surveys
2. Implement cascade delete as DB function
3. Add pagination to survey list
4. Add audit logging for sensitive operations

### Low Priority
1. Optimize query patterns
2. Add query result caching
3. Batch operations where possible
4. Performance monitoring

---

## API Routes to Create

Based on component analysis, recommend these API routes:

```
GET    /api/360-surveys                           - Replace loadSurveys()
GET    /api/360-surveys/[id]                      - Replace survey SELECT queries
GET    /api/360-surveys/[id]/raw-data             - Replace loadRawSurveyData()
GET    /api/360-surveys/[id]/reviewers            - Replace loadReviewers()
POST   /api/360-surveys/[id]/reviewers            - Replace addReviewer()
PUT    /api/360-surveys/[id]                      - Replace UPDATE queries
PUT    /api/360-surveys/[id]/status               - Update survey status
DELETE /api/360-surveys/[id]                      - Replace delete operations
DELETE /api/360-surveys/[id]/reviewers/[rid]     - Replace removeReviewer()
POST   /api/360-surveys/[id]/send-reminders       - Replace sendReminders()
POST   /api/360-surveys/[id]/finalize             - Replace finalizeSurvey()
POST   /api/360-surveys/[id]/send-hr              - Replace sendToHR()
```

---

## Document Cross-References

### SUPABASE_OPERATIONS_SUMMARY.md

**Section** → Related Sections in Other Files

- Overview → Quick Reference: At a Glance
- Sections 1-6 (by table) → Detailed: Operation Detail Sheets
- Summary Statistics → Quick Reference: Operations by Table
- Role-Based Filtering → Quick Reference: Security Considerations
- Recommended API Routes → Quick Reference: Creating API Routes

### SUPABASE_OPERATIONS_DETAILED.md

**Section** → Related Sections in Other Files

- Quick Index → Quick Reference: At a Glance
- Operation Detail Sheets → Summary: Operations Section
- Security Notes → Quick Reference: Security Considerations
- Performance Considerations → Quick Reference: Query Performance Notes

### SUPABASE_OPERATIONS_QUICK_REFERENCE.md

**Section** → Related Sections in Other Files

- At a Glance → Summary: Overview
- Operations by Table → Detailed: Quick Index
- Key Functions → Detailed: Operation Detail Sheets
- Data Flow Diagram → Summary: Role-Based Filtering
- Performance Notes → Detailed: Performance Considerations
- Security Considerations → Detailed: Security Notes

---

## File Locations (Complete Reference)

### Documentation Files
- `/SUPABASE_ANALYSIS_INDEX.md` - This index file
- `/SUPABASE_OPERATIONS_SUMMARY.md` - High-level overview
- `/SUPABASE_OPERATIONS_DETAILED.md` - Complete reference
- `/SUPABASE_OPERATIONS_QUICK_REFERENCE.md` - Quick lookup

### Source Files Referenced
- `/components/Feedback360Dashboard.tsx` - Analyzed component
- `/components/Survey360Wizard.tsx` - Related component (survey creation)
- `/components/Quick360Modal.tsx` - Related component
- `/components/EmployeeDetailModal.tsx` - Related component
- `/app/api/360-generate-report/route.ts` - Related API route
- `/app/api/send-survey-invitation/route.ts` - Related API route
- `/lib/supabase.ts` - Supabase client SDK

---

## Database Schema (Quick Reference)

### Tables Accessed

**feedback_360_surveys**
- Stores survey instances
- 13 operations in component
- Fields: id, organization_id, employee_id, status, created_by, survey_name, due_date, flagged_for_admin, flagged_for_reanalysis, created_at, updated_at

**feedback_360_survey_reviewers**
- Stores reviewer participation
- 7 operations in component
- Fields: id, survey_id, reviewer_name, reviewer_email, relationship, status, access_token

**feedback_360_responses**
- Stores feedback responses
- 1 operation in component (delete)
- Fields: id, survey_id, reviewer_email, question_id, response_text, rating

**feedback_360_survey_questions**
- Joins surveys to questions
- 2 operations in component
- Fields: id, survey_id, question_id, question_order

**feedback_360_questions**
- Question bank
- 1 operation in component (via JOIN)
- Fields: id, question_text, category

**user_profiles**
- Employee data
- 1 operation in component (get employee)
- Fields: id, full_name, email, title

---

## Next Steps

1. **Start with Summary** - Read SUPABASE_OPERATIONS_SUMMARY.md (15 min)
2. **Review Quick Reference** - Check Quick Reference for data flow (10 min)
3. **Choose Your Path:**
   - Creating APIs? → Go to Detailed, copy query patterns
   - Implementing security? → Check security sections
   - Optimizing performance? → Review performance analysis
4. **Use as Template** - Copy exact query patterns for API routes
5. **Implement Incrementally** - Create 1-2 API routes at a time

---

## Questions & Answers

**Q: How do I migrate from direct component queries to API routes?**
A: Use SUPABASE_OPERATIONS_DETAILED.md - Copy the exact query pattern from each operation detail sheet into your new API route.

**Q: Which operations are most critical for security?**
A: DELETE operations and UPDATE operations on flagged_for_admin/flagged_for_reanalysis should be moved to API routes first.

**Q: Can I create these changes incrementally?**
A: Yes, recommended approach:
1. Create GET /api/360-surveys (read-only, safe)
2. Create PUT /api/360-surveys/[id] (update status)
3. Create DELETE routes (needs authorization)

**Q: How do RLS policies fit in?**
A: RLS policies enforce row-level access at the database level, preventing accidental data leaks. Implement alongside API routes.

**Q: What's the performance impact of these changes?**
A: Should improve performance:
- Server-side filtering reduces data transfer
- Transactions for cascade deletes reduce query count
- Can add caching at API layer

---

## Contact & Updates

**Last Updated:** November 12, 2025
**Analysis Tool:** Claude Code (File Search Specialist)
**Component Analyzed:** Feedback360Dashboard.tsx v2.1
**Database:** Supabase (PostgreSQL)

For questions or updates, refer to:
- CLAUDE.md - Project architecture documentation
- Component comments - Inline documentation
- API route files - Implementation examples

---

## License & Attribution

These analysis documents are part of the talent-management-next project.
Created for internal reference and API route migration planning.

