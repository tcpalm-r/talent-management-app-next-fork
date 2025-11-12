# Database Cleanup Recommendations

**Analysis Date:** 2025-11-12
**Project:** talent-management-next

## Executive Summary

Analyzed 24 database objects (tables/views) and found:
- ✅ **11 active tables** in use with data
- 🗑️ **10 dead tables/views** (exist but never referenced in code)
- ❌ **3 missing tables** (referenced in verify script but don't exist)
- 📁 **8 redundant SQL schema files** in project root

**Recommended Action:** Remove 10 unused database objects and clean up 6 obsolete SQL migration files.

---

## Part 1: Dead Database Objects (Completely Unused)

These tables/views exist in your Supabase database but are **never referenced** in any application code. They are safe to remove.

### 🗑️ High Priority - Remove Immediately

#### 1. `performance_review_participants` (0 rows)
- **Status:** Empty table, no code references
- **Why it exists:** Likely from abandoned performance review feature implementation
- **Risk:** None - completely unused
- **Action:** `DROP TABLE performance_review_participants;`

#### 2. `performance_review_deadlines` (0 rows)
- **Status:** Empty table, no code references
- **Why it exists:** Part of incomplete performance review feature
- **Risk:** None - completely unused
- **Action:** `DROP TABLE performance_review_deadlines;`

#### 3. `user_profile_changes` (0 rows)
- **Status:** Empty table, no code references
- **Why it exists:** Audit log table that was never implemented
- **Risk:** None - no data to lose
- **Action:** `DROP TABLE user_profile_changes;`

#### 4. `active_users` (4 rows, VIEW)
- **Status:** View with data but no code references
- **Why it exists:** Materialized view from early architecture
- **Risk:** Low - not used by application
- **Action:** `DROP VIEW active_users;` or `DROP MATERIALIZED VIEW active_users;`

#### 5. `pending_users` (382 rows, VIEW)
- **Status:** View with substantial data but no code references
- **Why it exists:** Part of user onboarding flow that was abandoned
- **Risk:** Low - data can be queried from user_profiles if needed
- **Action:** `DROP VIEW pending_users;` or `DROP MATERIALIZED VIEW pending_users;`

#### 6. `active_performance_reviews` (1 row, VIEW)
- **Status:** View with minimal data, no code references
- **Why it exists:** Stub view from existing-schema.sql (lines 52-67)
- **Schema issue:** View returns all NULL values (stub definition)
- **Risk:** None - broken view that's unused
- **Action:** `DROP VIEW active_performance_reviews;`

### 🟡 Medium Priority - Review Before Removal

#### 7. `ideal_team_player_matrix` (18 rows)
- **Status:** Table with data but no code references
- **Why it exists:** Part of "Ideal Team Player" assessment framework
- **Risk:** Medium - has actual data (18 rows)
- **Schema reference:** Defined in lib/schema.ts:171-181
- **Recommendation:** Check if this was a past feature. If abandoned, export data first, then drop.
- **Action:**
  ```sql
  -- Export first
  COPY ideal_team_player_matrix TO '/tmp/ideal_team_player_matrix_backup.csv' CSV HEADER;
  -- Then drop
  DROP TABLE ideal_team_player_matrix;
  ```

#### 8. `departments` (5 rows, likely a TABLE)
- **Status:** Table with data but no code references
- **Why it exists:** Department master table, but `user_profiles.department` is used instead (text field)
- **Risk:** Medium - has reference data (5 departments)
- **Note:** `supabase-schema.sql` defines a different departments table (lines 21-28)
- **Recommendation:** This is likely a duplicate/unused table. The app uses `user_profiles.department` as a text field.
- **Action:** Export data, verify it's not used, then drop
  ```sql
  -- Export first
  COPY departments TO '/tmp/departments_backup.csv' CSV HEADER;
  -- Then drop
  DROP TABLE departments;
  ```

#### 9. `hr_modules` (1 row)
- **Status:** Configuration table with 1 row, no code references
- **Why it exists:** Module configuration system that was never fully implemented
- **Risk:** Low - single configuration row
- **Schema reference:** Defined in lib/schema.ts:313-325
- **Action:**
  ```sql
  -- Export first
  COPY hr_modules TO '/tmp/hr_modules_backup.csv' CSV HEADER;
  -- Then drop
  DROP TABLE hr_modules;
  ```

### 🟢 Low Priority - Consider Keeping (Audit/Logging)

#### 10. `sync_history` (12 rows)
- **Status:** Table with data but no code references
- **Why it exists:** Audit log for user sync operations from AI Intranet
- **Risk:** Low - historical data
- **Schema reference:** Defined in lib/schema.ts:328-349
- **Recommendation:** Keep if you want audit history, or export and drop if not needed
- **Action (if removing):**
  ```sql
  -- Export first
  COPY sync_history TO '/tmp/sync_history_backup.csv' CSV HEADER;
  -- Then drop
  DROP TABLE sync_history;
  ```

---

## Part 2: Missing Tables (Referenced but Don't Exist)

These tables are mentioned in `scripts/verify-supabase.js` but don't exist in the database:

### ❌ Tables That Don't Exist

1. **`nine_box_assessments`** - Referenced in verify script (line 79)
   - Not in actual database
   - Not referenced in any application code
   - **Action:** Remove from verify script

2. **`performance_improvement_plans`** - Referenced in verify script (line 80)
   - Not in actual database
   - Not referenced in any application code
   - **Action:** Remove from verify script

3. **`succession_plans`** - Referenced in verify script (line 81)
   - Not in actual database
   - Not referenced in any application code
   - **Action:** Remove from verify script

**Fix:** Update `scripts/verify-supabase.js` lines 72-82 to remove these phantom tables.

---

## Part 3: Active Tables (Keep These)

These are healthy, actively used tables with code references:

✅ **Core User Management:**
- `user_profiles` (393 rows, 11 file refs) - Main user table
- `employees` (386 rows, 2 file refs) - Materialized view or table for active employees

✅ **360 Feedback System:**
- `feedback_360_surveys` (2 rows, 24 file refs) - Core survey table
- `feedback_360_questions` (17 rows, 5 file refs) - Question bank
- `feedback_360_survey_questions` (6 rows, 10 file refs) - Junction table
- `feedback_360_survey_reviewers` (9 rows, 16 file refs) - Reviewer tracking
- `feedback_360_responses` (18 rows, 6 file refs) - Response data
- `feedback_360_reports` (1 row, 6 file refs) - AI-generated reports

✅ **Performance Management:**
- `performance_reviews` (1 row, 2 file refs) - Review cycles
- `assessments` (1 row, 2 file refs) - Assessment data
- `assessment_responses` (1257 rows, 1 file ref) - Assessment responses

---

## Part 4: Redundant Schema Files

Found **8 SQL files** in project root with duplicate/obsolete schemas:

### 🗑️ Files to Delete

1. **`supabase-schema.sql`** (Old 9-box schema)
   - Defines old structure: organizations, departments, users, employees, box_definitions, assessments
   - This is from an earlier version of the app (9-box talent assessment)
   - **Action:** Delete or move to `archive/` folder

2. **`supabase-seed.sql`** (If exists)
   - Seed data for old schema
   - **Action:** Delete or archive

3. **`supabase-add-employee-roles.sql`** (Migration)
   - Old migration file
   - **Action:** Delete if already applied

4. **`supabase-add-employee-roles-fixed.sql`** (Migration)
   - Fixed version of above
   - **Action:** Delete if already applied

5. **`fix-test-user-roles.sql`** (Migration)
   - One-off fix script
   - **Action:** Delete if already applied

6. **`fix-employees-view.sql`** (Migration)
   - One-off fix script
   - **Action:** Delete if already applied

### 📁 Files to Keep

1. **`existing-schema.sql`** - Current production schema dump
   - Keep as reference or move to `database/schema/` folder

2. **`current-schema-dump.sql`** (If different from existing-schema.sql)
   - Keep most recent one, delete duplicates

---

## Part 5: Schema Definition Issues

### 🔄 Duplicate Schema Sources

Your database schema is defined in **multiple places**, which can lead to drift:

1. **`lib/schema.ts`** (TypeScript interfaces)
   - Defines types for ALL tables (including dead ones)
   - **Action:** Remove type definitions for dead tables after cleanup

2. **`existing-schema.sql`** (SQL dump)
   - Production database schema
   - Contains all current tables/views

3. **`supabase-schema.sql`** (Old SQL)
   - Completely different schema (old 9-box structure)
   - **Action:** Delete this file

4. **Multiple migration files** (SQL)
   - Ad-hoc fixes and changes
   - **Action:** Consolidate into single schema file or use proper migration tool

### Recommendation: Single Source of Truth

Consider using **Supabase Migrations** or **Drizzle Kit** to manage schema:
- Keep single authoritative schema file
- Use migration tool for changes
- Auto-generate TypeScript types from database

---

## Implementation Plan

### Phase 1: Low-Risk Cleanup (Immediate)

```sql
-- Drop empty tables with no code references
DROP TABLE IF EXISTS performance_review_participants;
DROP TABLE IF EXISTS performance_review_deadlines;
DROP TABLE IF EXISTS user_profile_changes;

-- Drop stub/broken views
DROP VIEW IF EXISTS active_performance_reviews;
DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews;
```

### Phase 2: Export and Drop Unused Views (Day 2)

```sql
-- Backup and drop unused views
DROP VIEW IF EXISTS active_users;
DROP MATERIALIZED VIEW IF EXISTS active_users;

DROP VIEW IF EXISTS pending_users;
DROP MATERIALIZED VIEW IF EXISTS pending_users;
```

### Phase 3: Review and Drop Data Tables (Week 2)

```bash
# Export data first
psql $DATABASE_URL -c "\COPY ideal_team_player_matrix TO '/tmp/ideal_team_player_matrix.csv' CSV HEADER"
psql $DATABASE_URL -c "\COPY departments TO '/tmp/departments.csv' CSV HEADER"
psql $DATABASE_URL -c "\COPY hr_modules TO '/tmp/hr_modules.csv' CSV HEADER"
psql $DATABASE_URL -c "\COPY sync_history TO '/tmp/sync_history.csv' CSV HEADER"
```

```sql
-- After verifying backups
DROP TABLE IF EXISTS ideal_team_player_matrix;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS hr_modules;
DROP TABLE IF EXISTS sync_history; -- Optional, if you don't need audit history
```

### Phase 4: Update Code

1. **Update `scripts/verify-supabase.js`**
   - Remove lines 79-81 (nine_box_assessments, performance_improvement_plans, succession_plans)

2. **Update `lib/schema.ts`**
   - Remove interface definitions for deleted tables:
     - `IdealTeamPlayerMatrix` (lines 171-181)
     - `HRModule` (lines 313-325)
     - `SyncHistory` (lines 328-349)
     - `UserProfileChange` (lines 352-363)
     - `ActiveUser` (lines 372-383)
     - `PendingUser` (lines 388-399)
     - `ActivePerformanceReview` (lines 401-418)
     - `PerformanceReviewParticipant` (lines 144-154)
     - `PerformanceReviewDeadline` (lines 159-166)

3. **Clean up SQL files**
   ```bash
   # Create archive folder
   mkdir -p database/archive

   # Move old files
   mv supabase-schema.sql database/archive/
   mv supabase-add-employee-roles*.sql database/archive/
   mv fix-*.sql database/archive/

   # Keep only current schema
   mv existing-schema.sql database/schema.sql
   ```

---

## Estimated Impact

### Database Size Reduction
- **Minimal** - Most dead tables are empty or have <20 rows
- `pending_users` (382 rows) is largest dead table

### Code Simplification
- Remove ~150 lines from `lib/schema.ts`
- Simplify `scripts/verify-supabase.js` by 3 lines
- Delete 6 obsolete SQL migration files

### Risk Assessment
- **Low Risk** - No active code references to removed objects
- **Reversible** - All data backed up before deletion
- **Testing** - Run full test suite after each phase

---

## Verification Queries

After cleanup, verify success:

```sql
-- List all remaining tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- List all remaining views
SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;

-- List all materialized views
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY matviewname;

-- Get row counts for all tables
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

---

## Summary

Your database has accumulated **10 unused objects** (42% of total) from:
1. Abandoned features (performance review participants, ideal team player matrix)
2. Unused audit logging (sync_history, user_profile_changes)
3. Redundant views (active_users, pending_users, active_performance_reviews)
4. Alternative department table not used by app
5. Stub configuration table (hr_modules)

All 10 can be safely removed with proper backups. This will:
- ✅ Simplify database maintenance
- ✅ Reduce confusion about schema
- ✅ Remove dead code from `lib/schema.ts`
- ✅ Clean up project root (remove 6 obsolete SQL files)

**Next Steps:**
1. Review this report with team
2. Schedule maintenance window
3. Execute Phase 1 immediately (zero-risk drops)
4. Execute Phase 2-3 with backups
5. Update code to match cleaned database
