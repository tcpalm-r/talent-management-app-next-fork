-- Fix: Refresh the employees materialized view to get the correct IDs from user_profiles
REFRESH MATERIALIZED VIEW employees;

-- Verify Thomas Palmer now has the correct ID
SELECT
  'employees view' as source,
  id,
  email,
  name
FROM employees
WHERE email = 'thomas.palmer@sonance.com'

UNION ALL

SELECT
  'user_profiles table' as source,
  id,
  email,
  full_name as name
FROM user_profiles
WHERE email = 'thomas.palmer@sonance.com';
