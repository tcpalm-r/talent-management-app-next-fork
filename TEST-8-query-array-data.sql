-- ============================================================================
-- TEST 8: Query Array Data (Unnest)
-- ============================================================================
-- This tests PostgreSQL array operations

-- Test 1: Unnest overall_strengths array
SELECT
    r.id as report_id,
    s.survey_name,
    unnest(r.overall_strengths) as strength
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
ORDER BY report_id;

-- Expected Result: 3 rows
-- 1. "Excellent technical expertise"
-- 2. "Strong collaboration skills"
-- 3. "Proactive problem-solver"

-- Test 2: Count items in all arrays
SELECT
    r.id as report_id,
    s.survey_name,
    array_length(r.overall_strengths, 1) as strengths_count,
    array_length(r.development_areas, 1) as developments_count,
    array_length(r.recommendations, 1) as recommendations_count,
    array_length(r.key_insights, 1) as insights_count,
    array_length(r.consensus_areas, 1) as consensus_count,
    array_length(r.outlier_opinions, 1) as outliers_count
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id;

-- Expected Result:
-- All counts should be 3 except:
-- - key_insights: 3
-- - consensus_areas: 3
-- - outlier_opinions: 1 (we only added 1 in the test data)
