-- Migration: Add group-level analysis fields to feedback_360_reports
-- Date: 2025-01-15
-- Purpose: Support new "Consensus & Outliers" tab with group-level analysis
--
-- New fields:
-- - varied_by_relationship: Topics where different groups (manager, direct reports, etc.) perceive the subject differently
-- - outliers: Unique perspectives from single reviewers
--
-- Note: consensus_areas already exists but will now include groups_agreeing array

-- Add varied_by_relationship column (JSON array of topics with perspectives by group)
ALTER TABLE feedback_360_reports
ADD COLUMN IF NOT EXISTS varied_by_relationship JSONB DEFAULT '[]'::jsonb;

-- Add outliers column (JSON array of unique single-reviewer perspectives)
ALTER TABLE feedback_360_reports
ADD COLUMN IF NOT EXISTS outliers JSONB DEFAULT '[]'::jsonb;

-- Update consensus_areas to be JSONB if it isn't already (to support the new structure with groups_agreeing)
-- Note: If the column is already text[] or jsonb, this may need adjustment
-- The new structure includes: { text, groups_agreeing, citations }

-- Add comment for documentation
COMMENT ON COLUMN feedback_360_reports.varied_by_relationship IS 'Topics where different reviewer groups (manager, direct reports, cross-functional, SLT) perceive the subject differently. Each item has a topic and array of perspectives by group.';
COMMENT ON COLUMN feedback_360_reports.outliers IS 'Unique perspectives mentioned by only one reviewer. Significant observations not shared by multiple reviewers.';
