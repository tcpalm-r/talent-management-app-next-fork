-- ============================================================================
-- TEST 2: Verify Foreign Key Constraint
-- ============================================================================
-- This confirms the FK relationship to feedback_360_surveys exists

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

-- Expected Result:
-- constraint_name: feedback_360_reports_survey_id_fkey
-- table_name: feedback_360_reports
-- column_name: survey_id
-- foreign_table_name: feedback_360_surveys
-- foreign_column_name: id
-- delete_rule: CASCADE
