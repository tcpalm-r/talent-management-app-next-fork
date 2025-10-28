-- Migration: Update feedback_360_surveys status constraint
-- This updates the allowed statuses to: draft, in_progress, completed, finalized
-- Run this in your Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE feedback_360_surveys
DROP CONSTRAINT IF EXISTS feedback_360_surveys_status_check;

-- Add the new constraint with updated statuses
ALTER TABLE feedback_360_surveys
ADD CONSTRAINT feedback_360_surveys_status_check
CHECK (status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'completed'::text, 'finalized'::text]));

-- Optional: Update any existing surveys with old statuses to new ones
-- Uncomment if you have existing data with old statuses:
-- UPDATE feedback_360_surveys SET status = 'in_progress' WHERE status = 'active';
-- UPDATE feedback_360_surveys SET status = 'in_progress' WHERE status = 'sent';
-- UPDATE feedback_360_surveys SET status = 'finalized' WHERE status = 'cancelled';
