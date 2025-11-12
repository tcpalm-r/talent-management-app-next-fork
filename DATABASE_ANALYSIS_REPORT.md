# Supabase Database Analysis Report
**Generated:** 2025-01-27  
**Project:** Performance Reviews (ynycbfyzbavbgxvniylt)

---

## Executive Summary

This comprehensive analysis covers:
- ✅ **17 base tables** + 3 views + 1 materialized view (21 total database objects)
- ✅ **22 foreign key relationships** (verified via information_schema and pg_constraint)
- ✅ **90 indexes** (verified via pg_indexes and pg_class)
- ⚠️ **Missing indexes** on 3 foreign keys
- ⚠️ **Duplicate indexes** on 2 tables
- ⚠️ **High sequential scan ratios** on several tables
- ⚠️ **RLS enabled** but only service_role policies exist (no user-level policies)
- ✅ **No orphaned foreign keys** detected
- ⚠️ **Data type inconsistencies** in status fields

---

## 1. Complete Table Structure with Relationships

### Core Tables (17 base tables)

#### **user_profiles** (393 rows)
**Primary Key:** `idx` (integer)  
**Unique Constraints:** `id` (uuid), `email`, `auth0_id`  
**Foreign Keys:**
- `manager_id` → `user_profiles.id`
- `created_by` → `user_profiles.id`
- `last_updated_by` → `user_profiles.id`
- `organization_id` → `organizations.id`

**Key Columns:** 37 columns including auth, role, department, manager relationships

#### **organizations** (1 row)
**Primary Key:** `id` (uuid)  
**Foreign Keys:** None (root table)  
**Referenced By:** 7 tables (user_profiles, departments, box_definitions, performance_reviews, talent_grid_assessments, feedback_360_surveys, feedback_360_questions)

#### **departments** (5 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `organization_id` → `organizations.id`

#### **feedback_360_surveys** (1 row)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `employee_id` → `user_profiles.id`
- `organization_id` → `organizations.id`

**Referenced By:** 4 tables (feedback_360_responses, feedback_360_survey_questions, feedback_360_survey_reviewers, feedback_360_reports)

#### **feedback_360_questions** (17 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `organization_id` → `organizations.id`

**Referenced By:** 2 tables (feedback_360_responses, feedback_360_survey_questions)

#### **feedback_360_responses** (18 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `survey_id` → `feedback_360_surveys.id`
- `question_id` → `feedback_360_questions.id`

#### **feedback_360_survey_questions** (3 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `survey_id` → `feedback_360_surveys.id`
- `question_id` → `feedback_360_questions.id`

#### **feedback_360_survey_reviewers** (6 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `survey_id` → `feedback_360_surveys.id`

#### **feedback_360_reports** (1 row)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `survey_id` → `feedback_360_surveys.id` (unique)

#### **itp_assessments** (104 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `assessor_id` → `user_profiles.id`
- `performance_review_id` → `performance_reviews.id`

**Referenced By:** assessment_responses

#### **assessment_responses** (1,257 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `assessment_id` → `itp_assessments.id`

#### **performance_reviews** (1 row)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `organization_id` → `organizations.id`

**Referenced By:** 2 tables (itp_assessments, ideal_team_player_matrix)

#### **ideal_team_player_matrix** (18 rows)
**Primary Key:** `id` (integer)  
**Foreign Keys:**
- `performance_review_id` → `performance_reviews.id`

#### **talent_grid_assessments** (1 row)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `organization_id` → `organizations.id`
- `employee_id` → `user_profiles.id` (unique constraint)

#### **box_definitions** (9 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:**
- `organization_id` → `organizations.id`

#### **sync_history** (12 rows)
**Primary Key:** `id` (uuid)  
**Foreign Keys:** None

#### **hr_modules** (1 row)
**Primary Key:** `id` (text)  
**Foreign Keys:** None

### Views (3)
- `assessments` (VIEW)
- `feedback_360_question_usage_stats` (VIEW)
- `recent_syncs` (VIEW)

### Materialized Views (1)
- **`employees`** - Materialized view based on `user_profiles`
  - **Definition:** Selects active users (`is_active = true`) with denormalized department and manager information
  - **Indexes:** Yes (hasindexes = true)
  - **Status:** Populated (ispopulated = true)
  - **Purpose:** Performance optimization for employee lookups
  - **Columns:** id, organization_id, employee_id, name, email, department_id, manager_name, title, location, app_role, reports_to_id, created_at, updated_at

---

## 2. Tables Without Proper Indexes

### Missing Indexes on Foreign Keys

**CRITICAL:** The following foreign keys lack indexes, which can cause performance issues:

1. **`itp_assessments.assessor_id`** → `user_profiles.id`
   - **Impact:** High - Used to find assessments by assessor
   - **Recommendation:** `CREATE INDEX idx_itp_assessments_assessor_id ON itp_assessments(assessor_id);`

2. **`user_profiles.created_by`** → `user_profiles.id`
   - **Impact:** Medium - Used for audit trails
   - **Recommendation:** `CREATE INDEX idx_user_profiles_created_by ON user_profiles(created_by);`

3. **`user_profiles.last_updated_by`** → `user_profiles.id`
   - **Impact:** Medium - Used for audit trails
   - **Recommendation:** `CREATE INDEX idx_user_profiles_last_updated_by ON user_profiles(last_updated_by);`

### Tables with High Sequential Scan Ratios

Tables with >80% sequential scans (indicating missing or underutilized indexes):

1. **`performance_reviews`** - 100% sequential scans (135 seq, 0 idx)
   - Only 1 row, but should still have indexes for future growth
   - **Recommendation:** Add composite index on `(organization_id, status)`

2. **`feedback_360_survey_reviewers`** - 99.86% sequential scans (17,796 seq, 25 idx)
   - **CRITICAL:** Very high scan count despite having indexes
   - **Issue:** Indexes exist but queries aren't using them effectively
   - **Recommendation:** Review query patterns, consider composite indexes

3. **`sync_history`** - 99.28% sequential scans (137 seq, 1 idx)
   - **Recommendation:** Add index on `(status, created_at DESC)` for common queries

4. **`feedback_360_questions`** - 97.31% sequential scans (2,536 seq, 70 idx)
   - **Recommendation:** Review query patterns, ensure indexes match WHERE clauses

5. **`feedback_360_surveys`** - 96.56% sequential scans (9,867 seq, 351 idx)
   - **Recommendation:** Add composite index on `(status, employee_id, organization_id)`

---

## 3. Unused or Orphaned Tables

### Table Usage Analysis (from pg_stat_user_tables)

**Low Activity Tables** (potential candidates for archival):
- `hr_modules` - 1 row, minimal activity (99 seq scans, 20 idx scans)
- `performance_reviews` - 1 row, 100% sequential scans
- `organizations` - 1 row, moderate activity
- `box_definitions` - 9 rows, low activity

**High Activity Tables:**
- `user_profiles` - 393 rows, 7,654 index scans (well-indexed)
- `feedback_360_survey_reviewers` - 6 rows, but 17,796 sequential scans (needs optimization)
- `departments` - 5 rows, 3,430 index scans (well-indexed)

### Duplicate Indexes Found

**CRITICAL:** The following tables have duplicate/redundant indexes:

1. **`assessment_responses`**
   - `idx_assessment_responses_assessment` and `idx_assessment_responses_assessment_id` both index `assessment_id`
   - **Action:** Drop one of these indexes

2. **`feedback_360_survey_reviewers`**
   - `idx_reviewer_email` and `idx_survey_reviewers_email` both index `reviewer_email`
   - `idx_reviewer_status` and `idx_survey_reviewers_status` both index `status`
   - `idx_reviewer_access_token` and `feedback_360_survey_reviewers_access_token_key` both index `access_token` (unique constraint covers this)
   - **Action:** Drop duplicate indexes, keep the more descriptive names. Note: The unique constraint on `access_token` already provides indexing, so `idx_reviewer_access_token` is redundant.

### Orphaned Data Check

✅ **No orphaned foreign keys detected:**
- `user_profiles.manager_id` - 0 orphaned references
- `user_profiles.created_by` - 0 orphaned references
- `user_profiles.last_updated_by` - 0 orphaned references

---

## 4. Missing RLS Policies and Security Gaps

### Current RLS Status

**ALL TABLES HAVE RLS ENABLED** ✅

However, **CRITICAL SECURITY GAP:**

### Missing User-Level Policies

All tables currently have **ONLY** `service_role_full_access` policies:
- Policy allows `service_role` full access (ALL operations)
- **NO policies exist for authenticated users (`authenticated` role)**
- **NO policies exist for anonymous users (`anon` role)**

**This means:**
- ✅ Service role (backend) can access all data
- ❌ Authenticated users cannot access any data via Supabase client
- ❌ Anonymous users cannot access any data

**Current Policy Pattern:**
```sql
-- Example from any table
CREATE POLICY "service_role_full_access" ON table_name
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Required Actions

**HIGH PRIORITY:** Add RLS policies for authenticated users:

1. **`user_profiles`**
   ```sql
   -- Users can read their own profile
   CREATE POLICY "users_read_own_profile" ON user_profiles
   FOR SELECT TO authenticated
   USING (auth.uid()::text = id::text);
   
   -- Users can read profiles in their organization
   CREATE POLICY "users_read_org_profiles" ON user_profiles
   FOR SELECT TO authenticated
   USING (organization_id IN (
     SELECT organization_id FROM user_profiles WHERE id = auth.uid()::uuid
   ));
   ```

2. **`feedback_360_surveys`**
   ```sql
   -- Users can read surveys where they are the subject
   CREATE POLICY "users_read_own_surveys" ON feedback_360_surveys
   FOR SELECT TO authenticated
   USING (employee_id IN (
     SELECT id FROM user_profiles WHERE auth0_id = auth.jwt()->>'sub'
   ));
   ```

3. **`feedback_360_responses`**
   ```sql
   -- Reviewers can read/write their own responses
   CREATE POLICY "reviewers_manage_responses" ON feedback_360_responses
   FOR ALL TO authenticated
   USING (reviewer_email = (SELECT email FROM user_profiles WHERE auth0_id = auth.jwt()->>'sub'));
   ```

**Note:** The application appears to use a custom auth system (AI Intranet + Auth0) rather than Supabase Auth, which complicates RLS policy creation. Consider:
- Using Supabase Auth for user identification
- Creating custom RLS functions that check your auth system
- Or maintaining current service_role-only access (less secure)

---

## 5. Schema Inconsistencies and Normalization Issues

### Data Type Inconsistencies

**Status Field Types:**
- `itp_assessments.status` → `character varying(50)`
- `sync_history.status` → `character varying(20)`
- `recent_syncs.status` → `character varying(20)` (view)
- `feedback_360_survey_reviewers.status` → `text`
- `feedback_360_surveys.status` → `text`
- `hr_modules.status` → `text`
- `performance_reviews.status` → `text`

**Recommendation:** Standardize all status fields to `text` with CHECK constraints for consistency.

### Primary Key Inconsistencies

**`user_profiles`** uses `idx` (integer) as primary key instead of `id` (uuid):
- **Issue:** Non-standard pattern - all other tables use `id` (uuid) as PK
- **Impact:** Low - works but inconsistent
- **Recommendation:** Consider migrating to use `id` as primary key, or document why `idx` is used

### Normalization Issues

1. **`user_profiles.manager_email`** - Denormalized field
   - **Issue:** Stores email separately from manager_id
   - **Impact:** Medium - Can become stale if manager email changes
   - **Recommendation:** Remove `manager_email`, derive from `manager_id` join when needed

2. **`itp_assessments.user_id`** - Uses `varchar` instead of `uuid`
   - **Issue:** Inconsistent with other user references (should reference `user_profiles.id`)
   - **Impact:** High - Cannot enforce foreign key constraint
   - **Recommendation:** Migrate to `uuid` and add foreign key to `user_profiles.id`

3. **`feedback_360_survey_reviewers.reviewer_email`** - Text field without FK
   - **Issue:** Should reference `user_profiles.email` or `user_profiles.id`
   - **Impact:** Medium - No referential integrity
   - **Recommendation:** Add foreign key constraint or create lookup table

4. **`feedback_360_surveys.created_by`** - Text field instead of UUID
   - **Issue:** Should reference `user_profiles.id` for consistency
   - **Impact:** Medium - Cannot enforce referential integrity
   - **Recommendation:** Migrate to `uuid` and add foreign key

### Timestamp Inconsistencies

**Mixed timestamp types:**
- Most tables use `timestamp with time zone` ✅
- `feedback_360_surveys.due_date` → `timestamp without time zone` ⚠️
- `feedback_360_survey_reviewers.email_sent_at` → `timestamp without time zone` ⚠️
- `feedback_360_survey_reviewers.last_reminder_at` → `timestamp without time zone` ⚠️

**Recommendation:** Standardize all timestamps to `timestamp with time zone` for consistency and timezone handling.

### Redundant Columns

1. **`user_profiles`** has both:
   - `picture` and `avatar_url` (likely redundant)
   - `title` and `job_title` (likely redundant)
   - `global_role` and `app_role` (different purposes, but could be confusing)

2. **`assessment_responses`** has duplicate foreign key constraints:
   - `fk_assessment_responses_assessment_id` and `assessment_responses_assessment_id_fkey`
   - **Action:** Drop one of these duplicate constraints

---

## Recommendations Summary

### High Priority

1. **Add missing indexes on foreign keys:**
   - `itp_assessments.assessor_id`
   - `user_profiles.created_by`
   - `user_profiles.last_updated_by`

2. **Remove duplicate indexes:**
   - `assessment_responses`: Drop `idx_assessment_responses_assessment` or `idx_assessment_responses_assessment_id`
   - `feedback_360_survey_reviewers`: Drop `idx_reviewer_email`, `idx_reviewer_status`, and `idx_reviewer_access_token` (keep `idx_survey_reviewers_*` versions and unique constraint)

3. **Add RLS policies for authenticated users** (if using Supabase Auth)
   - Or document that service_role-only access is intentional

4. **Fix `itp_assessments.user_id` data type:**
   - Migrate from `varchar` to `uuid`
   - Add foreign key to `user_profiles.id`

### Medium Priority

1. **Optimize high sequential-scan tables:**
   - Add composite indexes on `feedback_360_survey_reviewers`
   - Add composite indexes on `feedback_360_surveys`
   - Review query patterns for `feedback_360_questions`

2. **Standardize status field types** to `text` with CHECK constraints

3. **Standardize timestamp fields** to `timestamp with time zone`

4. **Remove denormalized `manager_email`** field from `user_profiles`

### Low Priority

1. **Consider migrating `user_profiles` primary key** from `idx` to `id` for consistency

2. **Document why `user_profiles` has both `picture` and `avatar_url`**

3. **Review and potentially consolidate `title` and `job_title` fields**

---

## SQL Scripts for Fixes

### Add Missing Indexes

```sql
-- Missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_itp_assessments_assessor_id 
ON itp_assessments(assessor_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by 
ON user_profiles(created_by);

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_updated_by 
ON user_profiles(last_updated_by);
```

### Remove Duplicate Indexes

```sql
-- Remove duplicate indexes
DROP INDEX IF EXISTS idx_assessment_responses_assessment;
DROP INDEX IF EXISTS idx_reviewer_email;
DROP INDEX IF EXISTS idx_reviewer_status;
DROP INDEX IF EXISTS idx_reviewer_access_token; -- Unique constraint already provides index
```

### Add Composite Indexes for Performance

```sql
-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_360_surveys_status_employee_org 
ON feedback_360_surveys(status, employee_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_survey_reviewers_survey_status 
ON feedback_360_survey_reviewers(survey_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_history_status_created 
ON sync_history(status, created_at DESC);
```

---

## Conclusion

The database structure is generally well-designed with proper foreign key relationships and RLS enabled. However, there are several optimization opportunities:

1. **Performance:** Missing indexes on foreign keys and high sequential scan ratios
2. **Security:** RLS enabled but no user-level policies (may be intentional given custom auth)
3. **Consistency:** Data type inconsistencies and normalization issues
4. **Maintenance:** Duplicate indexes and constraints

Addressing the high-priority items will significantly improve query performance and data integrity.

