-- Migration: Add report_adjustments column for sponsor-tweaking persistence
-- Date: 2024-12-12
-- Purpose: Store per-item adjustment settings (specificity, tone, length) for 360 reports

-- Add report_adjustments column to store sponsor's customizations
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS report_adjustments jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the column structure
COMMENT ON COLUMN feedback_360_surveys.report_adjustments IS
'Stores per-item adjustment settings. Structure: {
  "themes-0": {"specificity": "left"|"center"|"right", "tone": "left"|"center"|"right", "length": "left"|"center"|"right"},
  "strengths-1": {"specificity": "center", "tone": "left", "length": "center"},
  ...
}';

-- Create index for faster queries on surveys with adjustments
CREATE INDEX IF NOT EXISTS idx_feedback_360_surveys_report_adjustments
ON feedback_360_surveys USING gin (report_adjustments)
WHERE report_adjustments != '{}'::jsonb;
