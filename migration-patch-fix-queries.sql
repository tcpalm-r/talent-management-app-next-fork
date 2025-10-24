-- ============================================
-- PATCH: Fix Query Issues for Front-End
-- ============================================
-- Purpose: Fixes 400 errors when front-end tries to query:
-- 1. employees VIEW with organization_id filter and joins
-- 2. feedback_360_surveys without organization_id column
--
-- Run this AFTER migration-hybrid-9box-v2.sql
-- ============================================

-- ============================================
-- FIX 1: Add organization_id to feedback_360_surveys
-- ============================================
DO $$
BEGIN
    -- Check if column doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feedback_360_surveys'
        AND column_name = 'organization_id'
    ) THEN
        -- Add the column
        ALTER TABLE feedback_360_surveys
        ADD COLUMN organization_id UUID DEFAULT 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid;

        -- Add foreign key
        ALTER TABLE feedback_360_surveys
        ADD CONSTRAINT feedback_360_surveys_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_feedback_360_surveys_org_id
        ON feedback_360_surveys(organization_id);

        RAISE NOTICE 'Added organization_id to feedback_360_surveys';
    ELSE
        RAISE NOTICE 'organization_id already exists in feedback_360_surveys';
    END IF;
END $$;

-- ============================================
-- FIX 2: Recreate employees VIEW as a MATERIALIZED VIEW
-- ============================================
-- Drop the existing VIEW
DROP VIEW IF EXISTS employees CASCADE;

-- Create as MATERIALIZED VIEW for better Supabase compatibility
CREATE MATERIALIZED VIEW employees AS
SELECT
    up.id,
    'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid AS organization_id,
    up.employee_number AS employee_id,
    up.full_name AS name,
    up.email,

    -- Map department name to department_id via lookup
    (SELECT d.id FROM departments d WHERE d.name = up.department LIMIT 1) AS department_id,

    -- Get manager's full name via lookup
    (SELECT m.full_name FROM user_profiles m WHERE m.id = up.manager_id) AS manager_name,

    up.title,
    up.location,
    up.created_at,
    up.updated_at
FROM user_profiles up
WHERE up.is_active = true;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_id ON employees(id);
CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Grant permissions
GRANT SELECT ON employees TO anon;
GRANT SELECT ON employees TO authenticated;
GRANT SELECT ON employees TO service_role;

-- ============================================
-- FIX 3: Create function to refresh employees view
-- ============================================
CREATE OR REPLACE FUNCTION refresh_employees_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY employees;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_employees_view() TO anon;
GRANT EXECUTE ON FUNCTION refresh_employees_view() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_employees_view() TO service_role;

-- Initial refresh
REFRESH MATERIALIZED VIEW employees;

-- ============================================
-- FIX 4: Add organization_id to other 360 feedback tables if missing
-- ============================================

-- feedback_360_questions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feedback_360_questions'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE feedback_360_questions
        ADD COLUMN organization_id UUID DEFAULT 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid;

        ALTER TABLE feedback_360_questions
        ADD CONSTRAINT feedback_360_questions_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_feedback_360_questions_org_id
        ON feedback_360_questions(organization_id);

        RAISE NOTICE 'Added organization_id to feedback_360_questions';
    END IF;
END $$;

-- ============================================
-- FIX 5: Add organization_id to performance_reviews if missing
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performance_reviews'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE performance_reviews
        ADD COLUMN organization_id UUID DEFAULT 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid;

        ALTER TABLE performance_reviews
        ADD CONSTRAINT performance_reviews_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_performance_reviews_org_id
        ON performance_reviews(organization_id);

        RAISE NOTICE 'Added organization_id to performance_reviews';
    END IF;
END $$;

-- ============================================
-- FIX 6: Add organization_id to user_profiles if missing
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE user_profiles
        ADD COLUMN organization_id UUID DEFAULT 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid;

        ALTER TABLE user_profiles
        ADD CONSTRAINT user_profiles_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id
        ON user_profiles(organization_id);

        RAISE NOTICE 'Added organization_id to user_profiles';
    END IF;
END $$;

-- Refresh the materialized view after user_profiles changes
REFRESH MATERIALIZED VIEW employees;

-- ============================================
-- SUMMARY
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'PATCH APPLIED SUCCESSFULLY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Added organization_id to feedback_360_surveys';
    RAISE NOTICE '2. Converted employees to MATERIALIZED VIEW';
    RAISE NOTICE '3. Added organization_id to feedback_360_questions';
    RAISE NOTICE '4. Added organization_id to performance_reviews';
    RAISE NOTICE '5. Added organization_id to user_profiles';
    RAISE NOTICE '6. Created refresh_employees_view() function';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: When user_profiles change, refresh with:';
    RAISE NOTICE 'SELECT refresh_employees_view();';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
/*
-- Verify employees can be queried with organization_id
SELECT * FROM employees
WHERE organization_id = 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'
LIMIT 5;

-- Verify feedback_360_surveys has organization_id
SELECT id, organization_id, employee_id, survey_name
FROM feedback_360_surveys
WHERE organization_id = 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'
LIMIT 5;

-- Verify departments join works
SELECT e.id, e.name, e.email, d.name as department_name
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.organization_id = 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'
LIMIT 5;

-- Verify assessments join works
SELECT e.id, e.name, a.performance, a.potential, a.box_key
FROM employees e
LEFT JOIN assessments a ON e.id = a.employee_id
WHERE e.organization_id = 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'
LIMIT 5;
*/
