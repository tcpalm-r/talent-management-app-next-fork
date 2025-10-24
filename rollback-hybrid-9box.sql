-- ============================================
-- ROLLBACK SCRIPT: Remove 9-Box Talent Grid Migration
-- ============================================
-- Purpose: Safely removes all changes from migration-hybrid-9box.sql
--          Restores database to pre-migration state
--
-- IMPORTANT: This will DELETE all 9-box assessment data!
-- Only run this if you need to undo the migration
-- ============================================

-- 1. DROP VIEWS (must be dropped before tables they depend on)
-- ============================================
DROP VIEW IF EXISTS assessments CASCADE;
DROP VIEW IF EXISTS employees CASCADE;

-- 2. DROP TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_talent_grid_assessments_updated_at ON talent_grid_assessments;
DROP TRIGGER IF EXISTS update_box_definitions_updated_at ON box_definitions;
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;

-- 3. DROP INDEXES
-- ============================================
DROP INDEX IF EXISTS idx_box_definitions_org_id;
DROP INDEX IF EXISTS idx_talent_grid_assessments_org_id;
DROP INDEX IF EXISTS idx_talent_grid_assessments_employee_id;
DROP INDEX IF EXISTS idx_departments_org_id;

-- 4. DROP TABLES (in reverse order of dependencies)
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
-- RESTORE ORIGINAL ASSESSMENTS TABLE VISIBILITY
-- ============================================
-- Your original 'assessments' table (for Ideal Team Player)
-- is now fully visible again without the VIEW overlay

-- Verify your original assessments table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'assessments'
    ) THEN
        RAISE NOTICE 'Original assessments table successfully restored';
    ELSE
        RAISE WARNING 'Original assessments table not found - this may indicate a problem';
    END IF;
END $$;

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================
-- Your database should now be in its pre-migration state
-- Verify by checking:
-- 1. Original 'assessments' table exists and works
-- 2. No 'organizations', 'departments', or 'box_definitions' tables
-- 3. No 'employees' or 'assessments' views
-- 4. All existing data (performance reviews, 360 feedback) is intact
-- ============================================

-- Verification queries (run these after rollback):
-- SELECT COUNT(*) FROM assessments; -- Should show your original Ideal Team Player data
-- SELECT COUNT(*) FROM user_profiles; -- Should show your users unchanged
-- SELECT COUNT(*) FROM feedback_360_surveys; -- Should show your 360 data unchanged
-- SELECT COUNT(*) FROM performance_reviews; -- Should show your performance reviews unchanged
