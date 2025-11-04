-- Fix: Update test users' app_role to match their intended roles
-- These test users were created with app_role='user' but should have admin/leader roles

UPDATE user_profiles
SET app_role = 'admin'
WHERE email = 'admin.test@example.com' AND full_name = 'Admin [TEST]';

UPDATE user_profiles
SET app_role = 'leader'
WHERE email = 'leader1.test@example.com' AND full_name = 'Leader 1 [TEST]';

UPDATE user_profiles
SET app_role = 'leader'
WHERE email = 'leader2.test@example.com' AND full_name = 'Leader 2 [TEST]';

-- Keep user roles as 'user' (users 1-4)
-- They should already have app_role='user'

-- Verify the changes
SELECT email, full_name, app_role FROM user_profiles
WHERE email LIKE '%test%' OR email LIKE '%admin%' OR email LIKE '%leader%'
ORDER BY email;
