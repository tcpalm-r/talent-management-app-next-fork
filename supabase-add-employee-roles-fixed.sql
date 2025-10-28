-- Add role column to user_profiles table (source for employees view)
-- This enables 360 dashboard role-based permissions

-- Step 1: Add role column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'leader', 'user'));

-- Step 2: Recreate the employees materialized view to include role
DROP MATERIALIZED VIEW IF EXISTS employees CASCADE;

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
    up.role,  -- NEW: Include role field
    up.manager_id AS reports_to_id,  -- NEW: Include for hierarchy
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

-- Step 5: Create test users in user_profiles
DO $$
DECLARE
  org_id UUID := 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid;
  admin_id UUID;
  leader1_id UUID;
  leader2_id UUID;
  user1_id UUID;
  user2_id UUID;
  user3_id UUID;
  user4_id UUID;
BEGIN
  -- Create admin test user
  INSERT INTO user_profiles (
    full_name,
    email,
    title,
    role,
    employee_number,
    is_active
  ) VALUES (
    'Admin [TEST]',
    'admin.test@example.com',
    'Chief People Officer',
    'admin',
    'EMP-ADMIN-TEST',
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'admin',
      full_name = 'Admin [TEST]',
      title = 'Chief People Officer',
      employee_number = 'EMP-ADMIN-TEST'
  RETURNING id INTO admin_id;

  -- Migrate old leader email to new format if needed
  UPDATE user_profiles
  SET email = 'leader1.test@example.com',
      full_name = 'Leader 1 [TEST]',
      role = 'leader',
      title = 'Engineering Manager',
      employee_number = 'EMP-LEADER1-TEST',
      manager_id = admin_id
  WHERE email = 'leader.test@example.com'
  RETURNING id INTO leader1_id;

  -- Create leader 1 test user (only if migration didn't happen)
  IF leader1_id IS NULL THEN
    INSERT INTO user_profiles (
      full_name,
      email,
      title,
      role,
      employee_number,
      manager_id,
      is_active
    ) VALUES (
      'Leader 1 [TEST]',
      'leader1.test@example.com',
      'Engineering Manager',
      'leader',
      'EMP-LEADER1-TEST',
      admin_id,
      true
    )
    ON CONFLICT (email) DO UPDATE
    SET role = 'leader',
        full_name = 'Leader 1 [TEST]',
        title = 'Engineering Manager',
        employee_number = 'EMP-LEADER1-TEST',
        manager_id = admin_id
    RETURNING id INTO leader1_id;
  END IF;

  -- Create leader 2 test user
  INSERT INTO user_profiles (
    full_name,
    email,
    title,
    role,
    employee_number,
    manager_id,
    is_active
  ) VALUES (
    'Leader 2 [TEST]',
    'leader2.test@example.com',
    'Product Manager',
    'leader',
    'EMP-LEADER2-TEST',
    admin_id,
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'leader',
      full_name = 'Leader 2 [TEST]',
      title = 'Product Manager',
      employee_number = 'EMP-LEADER2-TEST',
      manager_id = admin_id
  RETURNING id INTO leader2_id;

  -- Create user 1 (reports to leader 1)
  INSERT INTO user_profiles (
    full_name,
    email,
    title,
    role,
    employee_number,
    manager_id,
    is_active
  ) VALUES (
    'User 1 [TEST]',
    'user1.test@example.com',
    'Senior Software Engineer',
    'user',
    'EMP-USER1-TEST',
    leader1_id,
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'user',
      full_name = 'User 1 [TEST]',
      title = 'Senior Software Engineer',
      employee_number = 'EMP-USER1-TEST',
      manager_id = leader1_id
  RETURNING id INTO user1_id;

  -- Create user 2 (reports to leader 1)
  INSERT INTO user_profiles (
    full_name,
    email,
    title,
    role,
    employee_number,
    manager_id,
    is_active
  ) VALUES (
    'User 2 [TEST]',
    'user2.test@example.com',
    'Software Engineer',
    'user',
    'EMP-USER2-TEST',
    leader1_id,
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'user',
      full_name = 'User 2 [TEST]',
      title = 'Software Engineer',
      employee_number = 'EMP-USER2-TEST',
      manager_id = leader1_id
  RETURNING id INTO user2_id;

  -- Create user 3 (reports to leader 2)
  INSERT INTO user_profiles (
    full_name,
    email,
    title,
    role,
    employee_number,
    manager_id,
    is_active
  ) VALUES (
    'User 3 [TEST]',
    'user3.test@example.com',
    'Product Designer',
    'user',
    'EMP-USER3-TEST',
    leader2_id,
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'user',
      full_name = 'User 3 [TEST]',
      title = 'Product Designer',
      employee_number = 'EMP-USER3-TEST',
      manager_id = leader2_id
  RETURNING id INTO user3_id;

  -- Create user 4 (reports to leader 2)
  INSERT INTO user_profiles (
    full_name,
    email,
    title,
    role,
    employee_number,
    manager_id,
    is_active
  ) VALUES (
    'User 4 [TEST]',
    'user4.test@example.com',
    'Junior Product Designer',
    'user',
    'EMP-USER4-TEST',
    leader2_id,
    true
  )
  ON CONFLICT (email) DO UPDATE
  SET role = 'user',
      full_name = 'User 4 [TEST]',
      title = 'Junior Product Designer',
      employee_number = 'EMP-USER4-TEST',
      manager_id = leader2_id
  RETURNING id INTO user4_id;

  RAISE NOTICE 'Test users created/updated successfully';
  RAISE NOTICE 'Admin ID: %', admin_id;
  RAISE NOTICE 'Leader 1 ID: %', leader1_id;
  RAISE NOTICE 'Leader 2 ID: %', leader2_id;
  RAISE NOTICE 'User 1 ID: %', user1_id;
  RAISE NOTICE 'User 2 ID: %', user2_id;
  RAISE NOTICE 'User 3 ID: %', user3_id;
  RAISE NOTICE 'User 4 ID: %', user4_id;
END $$;

-- Step 6: Refresh the materialized view to include new data
REFRESH MATERIALIZED VIEW employees;

-- Verify the results
SELECT
  name,
  email,
  role,
  title,
  (SELECT name FROM employees e2 WHERE e2.id = e1.reports_to_id) as reports_to
FROM employees e1
WHERE email LIKE '%test@example.com'
ORDER BY
  CASE role
    WHEN 'admin' THEN 1
    WHEN 'leader' THEN 2
    WHEN 'user' THEN 3
  END;
