-- ============================================================================
-- TEST 9: Test Update Trigger
-- ============================================================================
-- This verifies that the updated_at trigger works automatically

-- STEP 1: Record current timestamps
SELECT
    id,
    survey_id,
    created_at,
    updated_at,
    updated_at = created_at as timestamps_match
FROM feedback_360_reports
ORDER BY created_at DESC
LIMIT 1;

-- Note the created_at and updated_at values (should be the same initially)

-- STEP 2: Update the record (add manager notes)
UPDATE feedback_360_reports
SET manager_notes = 'Test note: This employee shows strong potential for leadership role. Follow up in Q1 2026.'
WHERE id IN (
    SELECT id FROM feedback_360_reports ORDER BY created_at DESC LIMIT 1
)
RETURNING id, manager_notes, created_at, updated_at;

-- STEP 3: Verify that updated_at changed
SELECT
    id,
    survey_id,
    manager_notes,
    created_at,
    updated_at,
    updated_at > created_at as trigger_working,
    extract(epoch from (updated_at - created_at)) as seconds_difference
FROM feedback_360_reports
ORDER BY updated_at DESC
LIMIT 1;

-- Expected Result:
-- - trigger_working: true
-- - seconds_difference: should be > 0 (a few seconds)
-- - manager_notes should show the text we added
-- - created_at should be unchanged
-- - updated_at should be more recent than created_at
