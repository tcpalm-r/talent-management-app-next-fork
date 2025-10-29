-- ============================================================================
-- TESTING SCRIPT for feedback_360_reports table
-- ============================================================================
-- Run these queries AFTER executing migration-add-360-reports-table.sql
-- to verify the table was created correctly and works as expected.

-- ============================================================================
-- STEP 1: Verify Table Creation
-- ============================================================================

-- Check that table exists and has all expected columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'feedback_360_reports'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO, gen_random_uuid())
-- survey_id (uuid, NO, NULL)
-- themes (jsonb, NO, '[]'::jsonb)
-- sentiment_by_relationship (jsonb, NO, '{}'::jsonb)
-- overall_strengths (ARRAY, NO, '{}'::text[])
-- development_areas (ARRAY, NO, '{}'::text[])
-- recommendations (ARRAY, NO, '{}'::text[])
-- key_insights (ARRAY, NO, '{}'::text[])
-- consensus_areas (ARRAY, NO, '{}'::text[])
-- outlier_opinions (ARRAY, NO, '{}'::text[])
-- generated_at (timestamp with time zone, NO, NULL)
-- generated_by (text, NO, NULL)
-- manager_notes (text, YES, NULL)
-- created_at (timestamp with time zone, YES, now())
-- updated_at (timestamp with time zone, YES, now())

-- ============================================================================
-- STEP 2: Verify Indexes
-- ============================================================================

-- Check that all indexes were created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'feedback_360_reports'
ORDER BY indexname;

-- Expected indexes:
-- feedback_360_reports_pkey (PRIMARY KEY on id)
-- feedback_360_reports_survey_id_key (UNIQUE on survey_id)
-- idx_360_reports_survey_id
-- idx_360_reports_generated_at
-- idx_360_reports_themes_gin
-- idx_360_reports_sentiment_gin

-- ============================================================================
-- STEP 3: Verify Foreign Key Constraint
-- ============================================================================

-- Check foreign key relationship
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'feedback_360_reports';

-- Expected: survey_id references feedback_360_surveys(id) with CASCADE delete

-- ============================================================================
-- STEP 4: Test Insert with Sample Data
-- ============================================================================

-- First, find an existing survey to use for testing
SELECT
    id,
    survey_name,
    status,
    employee_id,
    created_at
FROM feedback_360_surveys
ORDER BY created_at DESC
LIMIT 5;

-- Copy one of the survey IDs from above and use it below
-- Replace 'PASTE_SURVEY_ID_HERE' with an actual UUID from the query above

-- Test insert with sample data
INSERT INTO feedback_360_reports (
    survey_id,
    themes,
    sentiment_by_relationship,
    overall_strengths,
    development_areas,
    recommendations,
    key_insights,
    consensus_areas,
    outlier_opinions,
    generated_at,
    generated_by
) VALUES (
    'PASTE_SURVEY_ID_HERE'::uuid,  -- Replace with actual survey ID
    '[
        {
            "theme": "Strong Communication Skills",
            "sentiment": "positive",
            "frequency": 7,
            "supporting_quotes": [
                "Always clear and concise in team meetings",
                "Great at explaining complex technical concepts"
            ],
            "relationships_mentioned": ["peer", "manager", "direct_report"]
        },
        {
            "theme": "Time Management Challenges",
            "sentiment": "mixed",
            "frequency": 4,
            "supporting_quotes": [
                "Sometimes misses deadlines during busy periods",
                "Could improve prioritization of tasks"
            ],
            "relationships_mentioned": ["peer", "manager"]
        }
    ]'::jsonb,
    '{
        "manager": 0.85,
        "peer": 0.78,
        "direct_report": 0.92,
        "self": 0.70,
        "other": 0.80
    }'::jsonb,
    ARRAY['Excellent technical expertise', 'Strong collaboration skills', 'Proactive problem-solver'],
    ARRAY['Time management during peak periods', 'Delegation skills', 'Strategic thinking'],
    ARRAY['Consider time management training', 'Practice delegating routine tasks', 'Shadow senior leadership for strategic exposure'],
    ARRAY['Strong consensus on technical abilities', 'Mixed feedback on workload management', 'Universally praised for team collaboration'],
    ARRAY['Self-assessment is lower than peer feedback'],
    ARRAY['Manager feels time management needs work'],
    NOW(),
    'claude-sonnet-4-20250514'
)
ON CONFLICT (survey_id) DO UPDATE SET
    themes = EXCLUDED.themes,
    sentiment_by_relationship = EXCLUDED.sentiment_by_relationship,
    overall_strengths = EXCLUDED.overall_strengths,
    development_areas = EXCLUDED.development_areas,
    recommendations = EXCLUDED.recommendations,
    key_insights = EXCLUDED.key_insights,
    consensus_areas = EXCLUDED.consensus_areas,
    outlier_opinions = EXCLUDED.outlier_opinions,
    generated_at = EXCLUDED.generated_at,
    generated_by = EXCLUDED.generated_by,
    updated_at = NOW()
RETURNING id, survey_id, generated_by, created_at, updated_at;

-- If successful, you should see the inserted record details

-- ============================================================================
-- STEP 5: Test Query - Retrieve Report
-- ============================================================================

-- Query the test report you just inserted
SELECT
    id,
    survey_id,
    array_length(overall_strengths, 1) as strengths_count,
    array_length(development_areas, 1) as development_count,
    array_length(recommendations, 1) as recommendations_count,
    jsonb_array_length(themes) as themes_count,
    generated_by,
    generated_at,
    created_at,
    updated_at
FROM feedback_360_reports
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- STEP 6: Test JOIN Query - Report with Survey Details
-- ============================================================================

-- Join report with survey to see full details
SELECT
    r.id as report_id,
    r.survey_id,
    s.survey_name,
    s.status as survey_status,
    s.employee_id,
    e.name as employee_name,
    e.email as employee_email,
    e.title as employee_title,
    array_length(r.overall_strengths, 1) as strengths_count,
    array_length(r.development_areas, 1) as development_areas_count,
    jsonb_array_length(r.themes) as themes_count,
    r.generated_by,
    r.generated_at,
    r.created_at as report_created_at
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
LEFT JOIN employees e ON e.id = s.employee_id
ORDER BY r.created_at DESC
LIMIT 5;

-- If this query returns data, the foreign key relationship is working!

-- ============================================================================
-- STEP 7: Test JSONB Queries
-- ============================================================================

-- Query themes with specific sentiment
SELECT
    r.id,
    r.survey_id,
    s.survey_name,
    theme->>'theme' as theme_name,
    theme->>'sentiment' as sentiment,
    (theme->>'frequency')::integer as frequency
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
CROSS JOIN jsonb_array_elements(r.themes) as theme
WHERE theme->>'sentiment' = 'positive'
ORDER BY (theme->>'frequency')::integer DESC;

-- Query sentiment scores by relationship
SELECT
    r.id,
    r.survey_id,
    s.survey_name,
    (r.sentiment_by_relationship->>'manager')::numeric as manager_sentiment,
    (r.sentiment_by_relationship->>'peer')::numeric as peer_sentiment,
    (r.sentiment_by_relationship->>'direct_report')::numeric as direct_report_sentiment,
    (r.sentiment_by_relationship->>'self')::numeric as self_sentiment
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
ORDER BY r.created_at DESC;

-- ============================================================================
-- STEP 8: Test Array Queries
-- ============================================================================

-- Unnest array to see all strengths
SELECT
    r.id,
    r.survey_id,
    s.survey_name,
    unnest(r.overall_strengths) as strength
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
ORDER BY r.created_at DESC;

-- Count items in arrays
SELECT
    r.id,
    r.survey_id,
    s.survey_name,
    array_length(r.overall_strengths, 1) as strengths,
    array_length(r.development_areas, 1) as developments,
    array_length(r.recommendations, 1) as recommendations,
    array_length(r.key_insights, 1) as insights,
    array_length(r.consensus_areas, 1) as consensus,
    array_length(r.outlier_opinions, 1) as outliers
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
ORDER BY r.created_at DESC;

-- ============================================================================
-- STEP 9: Test Update Trigger
-- ============================================================================

-- Update a record to verify the updated_at trigger works
UPDATE feedback_360_reports
SET manager_notes = 'Test note: This employee shows strong potential for leadership role'
WHERE id IN (
    SELECT id FROM feedback_360_reports ORDER BY created_at DESC LIMIT 1
)
RETURNING id, manager_notes, created_at, updated_at;

-- Verify updated_at changed (should be more recent than created_at)
SELECT
    id,
    created_at,
    updated_at,
    updated_at > created_at as trigger_working
FROM feedback_360_reports
ORDER BY updated_at DESC
LIMIT 5;

-- ============================================================================
-- STEP 10: Test UPSERT (ON CONFLICT)
-- ============================================================================

-- Try inserting the same survey_id again - should update existing record
-- Use the same survey_id from STEP 4

INSERT INTO feedback_360_reports (
    survey_id,
    themes,
    sentiment_by_relationship,
    overall_strengths,
    development_areas,
    recommendations,
    key_insights,
    consensus_areas,
    outlier_opinions,
    generated_at,
    generated_by
) VALUES (
    'PASTE_SURVEY_ID_HERE'::uuid,  -- Use same ID as STEP 4
    '[{"theme": "Updated Theme", "sentiment": "positive", "frequency": 1, "supporting_quotes": [], "relationships_mentioned": []}]'::jsonb,
    '{}'::jsonb,
    ARRAY['Updated strength'],
    ARRAY['Updated development area'],
    ARRAY['Updated recommendation'],
    ARRAY['Updated insight'],
    ARRAY['Updated consensus'],
    ARRAY['Updated outlier'],
    NOW(),
    'claude-sonnet-4-20250514-updated'
)
ON CONFLICT (survey_id) DO UPDATE SET
    themes = EXCLUDED.themes,
    overall_strengths = EXCLUDED.overall_strengths,
    generated_by = EXCLUDED.generated_by,
    updated_at = NOW()
RETURNING id, survey_id, generated_by, created_at, updated_at;

-- Check that record was updated, not duplicated
SELECT COUNT(*) as record_count, survey_id
FROM feedback_360_reports
GROUP BY survey_id
HAVING COUNT(*) > 1;
-- Should return 0 rows (no duplicates)

-- ============================================================================
-- STEP 11: Cleanup Test Data (Optional)
-- ============================================================================

-- Uncomment to remove test data after verification
-- DELETE FROM feedback_360_reports WHERE generated_by LIKE '%updated%';

-- ============================================================================
-- SUCCESS INDICATORS
-- ============================================================================

-- ✅ All columns exist with correct types
-- ✅ All indexes created successfully
-- ✅ Foreign key constraint working
-- ✅ Can insert records with complex JSONB and arrays
-- ✅ Can query with JOINs to related tables
-- ✅ JSONB queries work (themes, sentiment)
-- ✅ Array queries work (unnest, array_length)
-- ✅ Update trigger automatically updates updated_at
-- ✅ UNIQUE constraint prevents duplicates (upsert works)
-- ✅ CASCADE delete works (test separately if needed)

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

SELECT
    'feedback_360_reports' as table_name,
    (SELECT COUNT(*) FROM feedback_360_reports) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'feedback_360_reports') as column_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'feedback_360_reports') as index_count,
    'Migration successful! ✅' as status;
