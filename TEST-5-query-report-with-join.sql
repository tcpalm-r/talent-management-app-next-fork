-- ============================================================================
-- TEST 5: Query Report with JOIN to Survey
-- ============================================================================
-- This tests that the foreign key relationship works for queries

SELECT
    r.id as report_id,
    r.survey_id,
    s.survey_name,
    s.status as survey_status,
    s.employee_id,
    e.name as employee_name,
    e.email as employee_email,
    e.title as employee_title,

    -- Array lengths
    array_length(r.overall_strengths, 1) as strengths_count,
    array_length(r.development_areas, 1) as development_count,
    array_length(r.recommendations, 1) as recommendations_count,

    -- JSONB array length
    jsonb_array_length(r.themes) as themes_count,

    -- Metadata
    r.generated_by,
    r.generated_at,
    r.created_at as report_created_at,
    r.updated_at as report_updated_at
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
LEFT JOIN employees e ON e.id = s.employee_id
ORDER BY r.created_at DESC
LIMIT 5;

-- Expected Result:
-- Should show your test report joined with survey and employee data
-- Verify:
-- ✓ Survey name appears correctly
-- ✓ Employee name appears
-- ✓ Array counts show: 3 strengths, 3 developments, 3 recommendations, 3 themes
-- ✓ generated_by shows 'claude-sonnet-4-20250514'
-- ✓ Timestamps are populated
