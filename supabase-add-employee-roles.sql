-- Add role column to employees table for 360 dashboard permissions
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'leader', 'user'));

-- Create test users for 360 dashboard testing
-- Note: Replace 'your-org-id-here' with your actual organization ID

DO $$
DECLARE
  org_id UUID;
  admin_id UUID;
  leader_id UUID;
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- Get or create organization (replace with your actual org ID if you have one)
  SELECT id INTO org_id FROM organizations LIMIT 1;

  IF org_id IS NULL THEN
    INSERT INTO organizations (name) VALUES ('Test Organization')
    RETURNING id INTO org_id;
  END IF;

  -- Create admin test user
  INSERT INTO employees (
    organization_id,
    name,
    email,
    title,
    role,
    employee_id
  ) VALUES (
    org_id,
    'Admin User [TEST]',
    'admin.test@example.com',
    'Chief People Officer',
    'admin',
    'EMP-ADMIN-TEST'
  ) RETURNING id INTO admin_id;

  -- Create leader test user
  INSERT INTO employees (
    organization_id,
    name,
    email,
    title,
    role,
    employee_id,
    manager_name
  ) VALUES (
    org_id,
    'Leader User [TEST]',
    'leader.test@example.com',
    'Engineering Manager',
    'leader',
    'EMP-LEADER-TEST',
    'Admin User [TEST]'
  ) RETURNING id INTO leader_id;

  -- Set leader's reports_to_id
  UPDATE employees SET reports_to_id = admin_id WHERE id = leader_id;

  -- Create first regular user (reports to leader)
  INSERT INTO employees (
    organization_id,
    name,
    email,
    title,
    role,
    employee_id,
    manager_name,
    reports_to_id
  ) VALUES (
    org_id,
    'User One [TEST]',
    'user1.test@example.com',
    'Senior Software Engineer',
    'user',
    'EMP-USER1-TEST',
    'Leader User [TEST]',
    leader_id
  ) RETURNING id INTO user1_id;

  -- Create second regular user (reports to leader)
  INSERT INTO employees (
    organization_id,
    name,
    email,
    title,
    role,
    employee_id,
    manager_name,
    reports_to_id
  ) VALUES (
    org_id,
    'User Two [TEST]',
    'user2.test@example.com',
    'Software Engineer',
    'user',
    'EMP-USER2-TEST',
    'Leader User [TEST]',
    leader_id
  ) RETURNING id INTO user2_id;

  RAISE NOTICE 'Test users created successfully';
  RAISE NOTICE 'Admin ID: %', admin_id;
  RAISE NOTICE 'Leader ID: %', leader_id;
  RAISE NOTICE 'User 1 ID: %', user1_id;
  RAISE NOTICE 'User 2 ID: %', user2_id;
END $$;
