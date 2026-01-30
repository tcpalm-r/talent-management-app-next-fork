-- Add hr_admin to the app_role check constraint
-- hr_admin has most admin permissions but NOT audit mode or send backward

-- Drop the existing constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_app_role_check;

-- Add the updated constraint with hr_admin included
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_app_role_check
  CHECK (app_role IN ('admin', 'hr_admin', 'slt', 'leader', 'user'));
