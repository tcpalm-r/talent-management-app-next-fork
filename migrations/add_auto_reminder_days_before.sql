-- Migration: Add 'auto_reminder_days_before' field to feedback_360_surveys table
-- This enables configurable automatic reminder emails for survey reviewers
-- Survey creators can choose: 1 day before, 2 days before, or no automatic reminders (NULL)

-- Step 1: Add the auto_reminder_days_before column
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS auto_reminder_days_before INTEGER;

-- Step 2: Add check constraint to ensure valid values (1 or 2 days, or NULL for disabled)
ALTER TABLE feedback_360_surveys
DROP CONSTRAINT IF EXISTS feedback_360_surveys_auto_reminder_days_check;

ALTER TABLE feedback_360_surveys
ADD CONSTRAINT feedback_360_surveys_auto_reminder_days_check
CHECK (auto_reminder_days_before IN (1, 2) OR auto_reminder_days_before IS NULL);

-- Step 3: Set default to 1 day for future surveys (optional - can be NULL by default)
-- COMMENT: We're leaving this as NULL by default so survey creators explicitly opt-in
-- ALTER TABLE feedback_360_surveys ALTER COLUMN auto_reminder_days_before SET DEFAULT 1;

-- Step 4: Add comment to document the field
COMMENT ON COLUMN feedback_360_surveys.auto_reminder_days_before IS
'Number of days before due_date to send automatic reminder emails. Valid values: 1, 2, or NULL (disabled). Configured during survey creation.';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'feedback_360_surveys'
AND column_name = 'auto_reminder_days_before';
