-- Add narrative fields to feedback_360_surveys table
-- This supports the new "Generate Narrative" feature that creates a one-page summary before finalization

ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS final_narrative TEXT,
ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS narrative_version INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN feedback_360_surveys.final_narrative IS 'AI-generated one-page narrative summarizing the entire 360 report';
COMMENT ON COLUMN feedback_360_surveys.narrative_generated_at IS 'Timestamp when the narrative was last generated';
COMMENT ON COLUMN feedback_360_surveys.narrative_version IS 'Increments each time narrative is regenerated, used to track if report changes are ahead of narrative';
