-- Debug logs table for temporary API debugging
-- This table captures detailed timing and progress info from serverless functions
-- Can be safely dropped after debugging is complete

CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT NOT NULL,  -- Groups logs from same request
  survey_id TEXT,            -- Optional survey reference
  level TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warn', 'error'
  stage TEXT NOT NULL,       -- e.g., 'pass1_start', 'pass1_complete', 'pass2_start'
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Flexible data like timing, token counts, etc.
  elapsed_ms INTEGER         -- Milliseconds since session started
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_debug_logs_session ON debug_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_survey ON debug_logs(survey_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created ON debug_logs(created_at DESC);

-- Auto-cleanup: delete logs older than 7 days (optional, can be run manually)
-- DELETE FROM debug_logs WHERE created_at < NOW() - INTERVAL '7 days';
