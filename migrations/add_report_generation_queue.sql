-- Migration: Add queue for AI report generation
-- Purpose: Buffer report generation requests when concurrency limit is reached

CREATE TABLE IF NOT EXISTS feedback_360_generation_queue (
  survey_id UUID PRIMARY KEY REFERENCES feedback_360_surveys(id) ON DELETE CASCADE,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID,
  requested_by_email TEXT,
  tone TEXT NOT NULL DEFAULT 'standard'
);

CREATE INDEX IF NOT EXISTS idx_feedback_360_generation_queue_queued_at
  ON feedback_360_generation_queue (queued_at);

COMMENT ON TABLE feedback_360_generation_queue IS
  'Queues AI report generation requests when concurrency slots are full.';
