-- Migration: Add 'slt' role to app_role check constraint
-- This allows the app_role column to accept 'slt' as a valid value
-- Existing roles: 'admin', 'leader', 'user'
-- New role: 'slt' (Senior Leadership Team)

-- Step 1: Drop the existing constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_app_role_check;

-- Step 2: Add the new constraint with 'slt' included
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_app_role_check
  CHECK (app_role IN ('admin', 'leader', 'slt', 'user'));

-- Verify the constraint was added
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'user_profiles_app_role_check';
