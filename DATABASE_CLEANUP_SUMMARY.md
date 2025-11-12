# Database Cleanup Summary

**Quick Reference Guide**

## 🎯 What We Found

Out of **24 database objects** analyzed:
- ✅ **11 are healthy** (actively used with data)
- 🗑️ **10 are dead** (exist but never used in code)
- ❌ **3 are phantom** (in verify script but don't exist)

## 📊 Dead Objects Breakdown

| Object Name | Type | Rows | Risk | Action |
|-------------|------|------|------|--------|
| `performance_review_participants` | Table | 0 | None | Drop immediately |
| `performance_review_deadlines` | Table | 0 | None | Drop immediately |
| `user_profile_changes` | Table | 0 | None | Drop immediately |
| `active_performance_reviews` | View | 1 | None | Drop immediately (broken stub) |
| `active_users` | View | 4 | Low | Drop after phase 1 |
| `pending_users` | View | 382 | Low | Drop after phase 1 |
| `ideal_team_player_matrix` | Table | 18 | Medium | **Backup first**, then drop |
| `departments` | Table | 5 | Medium | **Backup first**, then drop |
| `hr_modules` | Table | 1 | Low | **Backup first**, then drop |
| `sync_history` | Table | 12 | Low | **Backup first**, optional drop |

## 🚀 Quick Start Guide

### Option 1: Automated Cleanup (Recommended)

```bash
# Run analysis script (already done)
node scripts/analyze-database-usage.js

# Phase 1: Zero-risk drops (no backups needed)
psql $DATABASE_URL -f scripts/cleanup-database-phase1.sql

# Phase 2: Export and drop data tables
# First, export data manually (see phase 2 script comments)
# Then run:
psql $DATABASE_URL -f scripts/cleanup-database-phase2.sql
```

### Option 2: Manual Cleanup via Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `scripts/cleanup-database-phase1.sql`
3. Review and execute
4. For Phase 2: Export tables first via Table Editor → Export
5. Then copy contents of `scripts/cleanup-database-phase2.sql`
6. Review and execute

## 📁 Files Created

### Analysis Files
- ✅ `DATABASE_USAGE_REPORT.json` - Raw analysis data
- ✅ `DATABASE_CLEANUP_RECOMMENDATIONS.md` - Detailed 2,800+ word report
- ✅ `DATABASE_CLEANUP_SUMMARY.md` - This quick reference

### Cleanup Scripts
- ✅ `scripts/analyze-database-usage.js` - Analysis tool (run anytime)
- ✅ `scripts/cleanup-database-phase1.sql` - Drop empty/broken objects
- ✅ `scripts/cleanup-database-phase2.sql` - Drop data-bearing tables (backup first)

## ⚡ Zero-Risk Quick Cleanup

If you want to clean up **immediately** with **zero risk**:

```sql
-- Copy this to Supabase SQL Editor and run
BEGIN;

-- Drop 3 empty tables
DROP TABLE IF EXISTS performance_review_participants CASCADE;
DROP TABLE IF EXISTS performance_review_deadlines CASCADE;
DROP TABLE IF EXISTS user_profile_changes CASCADE;

-- Drop 3 unused views
DROP VIEW IF EXISTS active_performance_reviews CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews CASCADE;
DROP VIEW IF EXISTS active_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_users CASCADE;
DROP VIEW IF EXISTS pending_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS pending_users CASCADE;

COMMIT;
```

This removes 6 objects that are completely empty or unused.

## 🔧 Code Updates Needed After Cleanup

### 1. Update `scripts/verify-supabase.js`

Remove lines 79-81:
```javascript
// DELETE THESE LINES:
'nine_box_assessments',
'performance_improvement_plans',
'succession_plans'
```

### 2. Update `lib/schema.ts`

Remove these interface definitions (after running cleanup):
- `PerformanceReviewParticipant` (lines 144-154)
- `PerformanceReviewDeadline` (lines 159-166)
- `IdealTeamPlayerMatrix` (lines 171-181)
- `HRModule` (lines 313-325)
- `SyncHistory` (lines 328-349)
- `UserProfileChange` (lines 352-363)
- `ActiveUser` (lines 372-383)
- `PendingUser` (lines 388-399)
- `ActivePerformanceReview` (lines 401-418)

### 3. Clean Up SQL Files

```bash
# Create archive folder
mkdir -p database/archive

# Move obsolete files
mv supabase-schema.sql database/archive/
mv supabase-add-employee-roles*.sql database/archive/
mv fix-*.sql database/archive/

# Keep current schema
mv existing-schema.sql database/schema.sql
```

## 🎯 What to Keep (Healthy Tables)

These 11 tables are actively used and should **NOT** be touched:

**Core:**
- `user_profiles` (393 rows, 11 refs)
- `employees` (386 rows, 2 refs)

**360 Feedback:**
- `feedback_360_surveys` (2 rows, 24 refs)
- `feedback_360_questions` (17 rows, 5 refs)
- `feedback_360_survey_questions` (6 rows, 10 refs)
- `feedback_360_survey_reviewers` (9 rows, 16 refs)
- `feedback_360_responses` (18 rows, 6 refs)
- `feedback_360_reports` (1 row, 6 refs)

**Performance:**
- `performance_reviews` (1 row, 2 refs)
- `assessments` (1 row, 2 refs)
- `assessment_responses` (1257 rows, 1 ref)

## 🔍 Verification After Cleanup

Run this to verify cleanup:

```sql
-- List all remaining tables
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected result: 11 tables (listed above)
```

## 📈 Impact Summary

**Database:**
- Remove 10 unused objects (42% reduction)
- Minimal size impact (most are empty)
- Cleaner schema for future development

**Codebase:**
- Delete ~150 lines from `lib/schema.ts`
- Remove 3 lines from `verify-supabase.js`
- Archive 6 obsolete SQL files

**Risk:**
- ✅ Phase 1: **Zero risk** (all empty/broken)
- ✅ Phase 2: **Low risk** (backed up data)
- ✅ **Reversible** (all data exported)

## 💡 Next Steps

1. **Read** `DATABASE_CLEANUP_RECOMMENDATIONS.md` for full details
2. **Run** Phase 1 cleanup (zero risk)
3. **Test** app thoroughly
4. **Export** data for Phase 2 tables
5. **Run** Phase 2 cleanup
6. **Update** code (schema.ts, verify script)
7. **Clean** up SQL files
8. **Commit** changes

## ⚠️ Important Notes

- **Always backup before dropping** data-bearing tables
- **Test thoroughly** after each phase
- **Review carefully** - this analysis is automated
- **Keep backups** of exported data for at least 30 days
- Consider using **Supabase Migrations** going forward

## 📞 Questions?

Review the detailed report: `DATABASE_CLEANUP_RECOMMENDATIONS.md`

It contains:
- Full rationale for each decision
- Step-by-step implementation plan
- SQL queries for verification
- Risk assessment for each object
- Migration strategy recommendations
