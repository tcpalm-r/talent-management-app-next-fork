-- Migration: Add flagged_for_admin column to feedback_360_surveys table
-- This allows surveys to be flagged for admin review via the "Send to HR for Review" button
-- Date: 2025-10-29

-- Add flagged_for_admin column
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS flagged_for_admin BOOLEAN DEFAULT FALSE;

-- Create an index for faster queries filtering by flagged status
CREATE INDEX IF NOT EXISTS idx_360_surveys_flagged_for_admin
ON feedback_360_surveys(flagged_for_admin)
WHERE flagged_for_admin = TRUE;

-- Add a comment to document the column
COMMENT ON COLUMN feedback_360_surveys.flagged_for_admin IS
'Indicates whether this survey has been flagged for admin review via the "Send to HR for Review" button';
