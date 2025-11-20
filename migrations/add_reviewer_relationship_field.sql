-- Migration: Add 'relationship' field to feedback_360_survey_reviewers table
-- This fixes a schema discrepancy where the code expects this field but it doesn't exist in production
-- The relationship field stores the type of relationship the reviewer has with the subject
-- Valid values: 'manager', 'slt', 'direct_report', 'cross_functional'

-- Step 1: Add the relationship column
ALTER TABLE feedback_360_survey_reviewers
ADD COLUMN IF NOT EXISTS relationship TEXT;

-- Step 2: Add check constraint for valid relationships
ALTER TABLE feedback_360_survey_reviewers
DROP CONSTRAINT IF EXISTS feedback_360_survey_reviewers_relationship_check;

ALTER TABLE feedback_360_survey_reviewers
ADD CONSTRAINT feedback_360_survey_reviewers_relationship_check
CHECK (relationship IN ('manager', 'slt', 'direct_report', 'cross_functional') OR relationship IS NULL);

-- Step 3: Create index for relationship queries (improves performance)
CREATE INDEX IF NOT EXISTS idx_reviewer_relationship
ON feedback_360_survey_reviewers(relationship);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feedback_360_survey_reviewers'
AND column_name = 'relationship';
