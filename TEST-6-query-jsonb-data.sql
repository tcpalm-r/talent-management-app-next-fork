-- ============================================================================
-- TEST 6: Query JSONB Data (Themes)
-- ============================================================================
-- This tests that JSONB querying works for extracting theme details

SELECT
    r.id as report_id,
    r.survey_id,
    s.survey_name,

    -- Extract individual theme details from JSONB array
    theme->>'theme' as theme_name,
    theme->>'sentiment' as sentiment,
    (theme->>'frequency')::integer as frequency,
    theme->'supporting_quotes' as quotes,
    theme->'relationships_mentioned' as relationships
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
CROSS JOIN jsonb_array_elements(r.themes) as theme
ORDER BY (theme->>'frequency')::integer DESC;

-- Expected Result:
-- Should show 3 rows (one for each theme in the test data):
-- 1. "Excellent Technical Expertise" (frequency: 8, sentiment: positive)
-- 2. "Strong Communication Skills" (frequency: 7, sentiment: positive)
-- 3. "Time Management Challenges" (frequency: 4, sentiment: mixed)
--
-- Verify that supporting_quotes and relationships_mentioned are JSON arrays
