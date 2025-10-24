-- ============================================
-- ROLLBACK SCRIPT V2: Remove 9-Box Talent Grid Migration
-- ============================================
-- Purpose: Safely removes all changes from migration-hybrid-9box-v2.sql
--          Restores database to pre-migration state
--
-- CHANGE FROM V1: Properly restores the renamed 'itp_assessments' back to 'assessments'
--
-- IMPORTANT: This will DELETE all 9-box assessment data!
-- Only run this if you need to undo the migration
-- ============================================

-- ============================================
-- STEP 1: DROP VIEWS (must be dropped before tables they depend on)
-- ============================================
DROP VIEW IF EXISTS assessments CASCADE;
DROP VIEW IF EXISTS employees CASCADE;

-- ============================================
-- STEP 2: DROP TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_talent_grid_assessments_updated_at ON talent_grid_assessments;
DROP TRIGGER IF EXISTS update_box_definitions_updated_at ON box_definitions;
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;

-- ============================================
-- STEP 3: DROP INDEXES
-- ============================================
DROP INDEX IF EXISTS idx_box_definitions_org_id;
DROP INDEX IF EXISTS idx_talent_grid_assessments_org_id;
DROP INDEX IF EXISTS idx_talent_grid_assessments_employee_id;
DROP INDEX IF EXISTS idx_departments_org_id;

-- ============================================
-- STEP 4: DROP TABLES (in reverse order of dependencies)
-- ============================================
-- Drop talent_grid_assessments first (has foreign keys to other tables)
DROP TABLE IF EXISTS talent_grid_assessments CASCADE;

-- Drop box_definitions
DROP TABLE IF EXISTS box_definitions CASCADE;

-- Drop departments
DROP TABLE IF EXISTS departments CASCADE;

-- Drop organizations last (other tables reference it)
DROP TABLE IF EXISTS organizations CASCADE;

-- ============================================
-- STEP 5: RESTORE ORIGINAL ASSESSMENTS TABLE NAME
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'itp_assessments'
    ) THEN
        -- Rename itp_assessments back to assessments
        ALTER TABLE itp_assessments RENAME TO assessments;
        RAISE NOTICE 'Restored itp_assessments table name to assessments';

        -- Restore the primary key constraint name
        ALTER TABLE assessments RENAME CONSTRAINT itp_assessments_pkey TO assessments_pkey;

        -- Restore foreign key constraints
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'assessment_responses_assessment_id_fkey'
            AND table_name = 'assessment_responses'
        ) THEN
            ALTER TABLE assessment_responses
            DROP CONSTRAINT IF EXISTS assessment_responses_assessment_id_fkey;

            ALTER TABLE assessment_responses
            ADD CONSTRAINT assessment_responses_assessment_id_fkey
            FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_assessment_responses_assessment_id'
            AND table_name = 'assessment_responses'
        ) THEN
            ALTER TABLE assessment_responses
            DROP CONSTRAINT IF EXISTS fk_assessment_responses_assessment_id;

            ALTER TABLE assessment_responses
            ADD CONSTRAINT fk_assessment_responses_assessment_id
            FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
        END IF;

        -- Restore index names
        ALTER INDEX IF EXISTS idx_itp_assessments_type RENAME TO idx_assessments_type;
        ALTER INDEX IF EXISTS idx_itp_assessments_user_id RENAME TO idx_assessments_user_id;
        ALTER INDEX IF EXISTS idx_itp_assessments_framework_type RENAME TO idx_assessments_framework_type;
        ALTER INDEX IF EXISTS idx_itp_assessments_performance_review_id RENAME TO idx_assessments_performance_review_id;

        RAISE NOTICE 'Restored foreign keys and indexes';
    ELSE
        RAISE WARNING 'itp_assessments table not found - may have already been restored or never renamed';
    END IF;
END $$;

-- ============================================
-- STEP 6: VERIFY ROLLBACK
-- ============================================
DO $$
DECLARE
    assessments_exists BOOLEAN;
    user_profiles_count INTEGER;
BEGIN
    -- Check if assessments table exists
    SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'assessments'
    ) INTO assessments_exists;

    -- Get user profiles count
    SELECT COUNT(*) INTO user_profiles_count FROM user_profiles;

    RAISE NOTICE '==============================================';
    RAISE NOTICE 'ROLLBACK COMPLETED SUCCESSFULLY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Verification:';
    RAISE NOTICE '- Original assessments table exists: %', assessments_exists;
    RAISE NOTICE '- User profiles count: %', user_profiles_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Your database should now be in its pre-migration state';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================
-- VERIFICATION QUERIES (run these after rollback)
-- ============================================
/*
-- 1. Verify new tables are gone
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'departments', 'box_definitions', 'talent_grid_assessments');
-- Expected: 0 rows

-- 2. Verify new views are gone
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('assessments', 'employees');
-- Expected: 0 rows

-- 3. Verify original assessments TABLE exists (not view)
SELECT table_type FROM information_schema.tables
WHERE table_name = 'assessments' AND table_schema = 'public';
-- Expected: 'BASE TABLE' (not 'VIEW')

-- 4. Verify original data is intact
SELECT COUNT(*) FROM assessments; -- Your Ideal Team Player data
SELECT COUNT(*) FROM user_profiles;
SELECT COUNT(*) FROM feedback_360_surveys;
SELECT COUNT(*) FROM performance_reviews;
-- Expected: Original counts unchanged

-- 5. Test a query on the restored assessments table
SELECT id, user_id, assessment_type, status, framework_type
FROM assessments
LIMIT 5;
-- Should show your Ideal Team Player assessment data
*/
