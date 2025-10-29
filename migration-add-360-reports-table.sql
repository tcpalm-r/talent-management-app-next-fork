-- Add feedback_360_reports table for storing AI-generated 360 feedback analysis
-- This table stores the comprehensive AI analysis results from Claude for each completed survey
-- Purpose: Enable 2-3 page AI-generated reports with themes, insights, and recommendations

-- ============================================================================
-- Main Table: feedback_360_reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_360_reports (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to survey (one report per survey)
    survey_id UUID NOT NULL REFERENCES feedback_360_surveys(id) ON DELETE CASCADE,

    -- AI Analysis Results (complex nested data stored as JSONB)
    themes JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Structure: Array of ThemeAnalysis objects
    -- [{
    --   theme: string,
    --   sentiment: 'positive'|'neutral'|'negative'|'mixed',
    --   frequency: number,
    --   supporting_quotes: string[],
    --   relationships_mentioned: string[]
    -- }]

    sentiment_by_relationship JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: Record<ParticipantRelationship, number>
    -- { "manager": 0.85, "peer": 0.78, "direct_report": 0.92, "self": 0.70, "other": 0.80 }

    -- AI Analysis Results (arrays of strings)
    overall_strengths TEXT[] NOT NULL DEFAULT '{}',
    -- Array of key strengths identified across all responses

    development_areas TEXT[] NOT NULL DEFAULT '{}',
    -- Array of areas for improvement identified across all responses

    recommendations TEXT[] NOT NULL DEFAULT '{}',
    -- Array of actionable recommendations based on feedback

    key_insights TEXT[] NOT NULL DEFAULT '{}',
    -- Array of important patterns and observations from the data

    consensus_areas TEXT[] NOT NULL DEFAULT '{}',
    -- Array of areas where most participants (70%+) strongly agree

    outlier_opinions TEXT[] NOT NULL DEFAULT '{}',
    -- Array of unique or contrasting perspectives worth noting

    -- Metadata
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- When the AI analysis was generated

    generated_by TEXT NOT NULL,
    -- AI model identifier (e.g., 'claude-sonnet-4-20250514')

    manager_notes TEXT,
    -- Optional notes added by the manager after reviewing the report

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(survey_id)  -- One report per survey, can be regenerated (upsert)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index on survey_id for fast lookups when retrieving reports for a survey
CREATE INDEX IF NOT EXISTS idx_360_reports_survey_id
ON feedback_360_reports(survey_id);

-- Index on generated_at for time-based queries (e.g., recent reports)
CREATE INDEX IF NOT EXISTS idx_360_reports_generated_at
ON feedback_360_reports(generated_at DESC);

-- GIN index on themes JSONB for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_360_reports_themes_gin
ON feedback_360_reports USING gin(themes);

-- GIN index on sentiment_by_relationship JSONB for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_360_reports_sentiment_gin
ON feedback_360_reports USING gin(sentiment_by_relationship);

-- ============================================================================
-- Permissions
-- ============================================================================

-- Disable Row Level Security for simplified access (consistent with other 360 tables)
ALTER TABLE feedback_360_reports DISABLE ROW LEVEL SECURITY;

-- Grant permissions to all roles
GRANT ALL ON TABLE feedback_360_reports TO anon;
GRANT ALL ON TABLE feedback_360_reports TO authenticated;
GRANT ALL ON TABLE feedback_360_reports TO service_role;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp on record updates
CREATE TRIGGER update_360_reports_updated_at
    BEFORE UPDATE ON feedback_360_reports
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Verify table creation
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'feedback_360_reports'
ORDER BY ordinal_position;

-- Verify indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'feedback_360_reports';

-- Test query: Check that foreign key relationship works
SELECT
    r.id as report_id,
    r.survey_id,
    s.survey_name,
    s.status,
    r.generated_by,
    r.generated_at,
    r.created_at
FROM feedback_360_reports r
LEFT JOIN feedback_360_surveys s ON s.id = r.survey_id
LIMIT 5;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ feedback_360_reports table created successfully';
    RAISE NOTICE '📊 Ready to store AI-generated 360 feedback analysis reports';
END $$;
