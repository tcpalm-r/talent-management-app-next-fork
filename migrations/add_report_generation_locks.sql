-- Migration: Add locks for AI report generation concurrency control
-- Purpose: Prevent duplicate report generation and limit concurrent runs

CREATE TABLE IF NOT EXISTS feedback_360_generation_locks (
  survey_id UUID PRIMARY KEY REFERENCES feedback_360_surveys(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  locked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_360_generation_locks_expires_at
  ON feedback_360_generation_locks (expires_at);

COMMENT ON TABLE feedback_360_generation_locks IS
  'Tracks active AI report generation locks to prevent duplicate runs and limit concurrency.';
