-- ============================================================================
-- TEST 3: Find an Existing Survey for Testing
-- ============================================================================
-- This query finds surveys that we can use to create test reports

SELECT
    s.id,
    s.survey_name,
    s.status,
    s.created_by,
    s.created_at,
    e.name as employee_name,
    e.email as employee_email,
    (SELECT COUNT(*) FROM feedback_360_survey_reviewers WHERE survey_id = s.id) as reviewer_count,
    (SELECT COUNT(*) FROM feedback_360_responses WHERE survey_id = s.id) as response_count
FROM feedback_360_surveys s
LEFT JOIN employees e ON e.id = s.employee_id
ORDER BY s.created_at DESC
LIMIT 10;

-- Instructions:
-- 1. Look at the results
-- 2. Pick a survey with some responses (response_count > 0 is ideal)
-- 3. Copy the 'id' value (UUID) from one of the rows
-- 4. You'll use this ID in the next test (TEST-4)
--
-- If no surveys exist, you'll need to create one first through the UI
