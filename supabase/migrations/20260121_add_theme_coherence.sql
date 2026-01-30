-- Add theme_coherence column for Pass 3 coherence analysis
-- Stores contradictions, related themes, and annotations from the three-pass pipeline

ALTER TABLE feedback_360_reports
ADD COLUMN IF NOT EXISTS theme_coherence JSONB DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN feedback_360_reports.theme_coherence IS 'Theme coherence analysis from Pass 3: contradictions, related themes, annotations, and coherence summary';
