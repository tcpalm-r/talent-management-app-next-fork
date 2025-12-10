-- Migration: Add citation validation status fields to feedback_360_reports
-- Purpose: Track async citation validation status for admin QA feature
-- Run: Apply via Supabase MCP or SQL editor

-- Add columns for tracking citation validation status
ALTER TABLE feedback_360_reports
  ADD COLUMN IF NOT EXISTS citation_validation_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS citation_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT NULL;

-- Add comment explaining the status values
COMMENT ON COLUMN feedback_360_reports.citation_validation_status IS
  'Citation validation status: null (not started), pending (queued), validating (in progress), validated (complete), failed (error)';

COMMENT ON COLUMN feedback_360_reports.citation_validated_at IS
  'Timestamp when citation validation was last completed';

COMMENT ON COLUMN feedback_360_reports.validation_errors IS
  'JSON array of validation errors/warnings if any';

-- Create index for querying reports by validation status (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_feedback_360_reports_citation_validation_status
  ON feedback_360_reports(citation_validation_status)
  WHERE citation_validation_status IS NOT NULL;
