-- Fix: Recreate employees materialized view using app_role (not role)
-- This fixes the backend connection after deleting the role column

-- Step 1: Drop the broken materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS employees CASCADE;

-- Step 2: Create the employees materialized view using app_role
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
    up.app_role,  -- Use app_role field (admin/leader/user)
    up.manager_id AS reports_to_id,
    up.created_at,
    up.updated_at
FROM user_profiles up
WHERE up.is_active = true;

-- Step 3: Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_id ON employees(id);
CREATE INDEX IF NOT EXISTS idx_employees_org_id ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept_id ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_reports_to ON employees(reports_to_id);

-- Step 4: Grant permissions
GRANT SELECT ON employees TO anon;
GRANT SELECT ON employees TO authenticated;
GRANT SELECT ON employees TO service_role;

-- Step 5: Refresh the materialized view
REFRESH MATERIALIZED VIEW employees;

-- Verify the employees view is working
SELECT COUNT(*) as active_employees FROM employees;
