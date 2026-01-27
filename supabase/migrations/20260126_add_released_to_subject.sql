-- Add released_to_subject_at column to feedback_360_surveys
-- This controls when subjects can view their finalized 360 feedback reports
-- NULL = not released (subject cannot see)
-- Timestamp = released (subject can see their report)

ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS released_to_subject_at TIMESTAMPTZ DEFAULT NULL;

-- Pre-release Jason's finalized surveys
-- Jason's user ID: 3bccaf29-bc33-4b1e-9ce1-db7967886b0a
-- Jason's email: jasons@sonance.com
UPDATE feedback_360_surveys
SET released_to_subject_at = NOW()
WHERE status = 'finalized'
  AND (created_by = '3bccaf29-bc33-4b1e-9ce1-db7967886b0a'
       OR LOWER(created_by_email) = 'jasons@sonance.com');
