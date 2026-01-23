-- Migration: Add table for tracking cancelled report generations
-- Purpose: Replace in-memory cancellation tracking for serverless compatibility

CREATE TABLE IF NOT EXISTS feedback_360_cancelled_generations (
  survey_id UUID PRIMARY KEY REFERENCES feedback_360_surveys(id) ON DELETE CASCADE,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_by TEXT
);

COMMENT ON TABLE feedback_360_cancelled_generations IS
  'Tracks cancelled report generations so serverless functions can detect cancellation requests.';
