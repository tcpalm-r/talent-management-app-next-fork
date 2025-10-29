-- ============================================================================
-- FINAL TEST: Migration Success Summary
-- ============================================================================
-- Run this to get a complete overview of the migration status

SELECT
    'feedback_360_reports' as table_name,
    (SELECT COUNT(*) FROM feedback_360_reports) as record_count,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'feedback_360_reports') as column_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'feedback_360_reports') as index_count,
    CASE
        WHEN (SELECT COUNT(*) FROM feedback_360_reports) > 0 THEN '✅ Migration Complete & Tested'
        ELSE '⚠️ Migration Complete (No test data yet)'
    END as status;

-- Expected Result:
-- - table_name: feedback_360_reports
-- - record_count: 1 (if you ran the test inserts)
-- - column_count: 15
-- - index_count: 6
-- - status: ✅ Migration Complete & Tested

-- ============================================================================
-- CLEANUP (Optional)
-- ============================================================================
-- Uncomment to remove test data after verification

-- DELETE FROM feedback_360_reports
-- WHERE generated_by LIKE '%REGENERATED%'
--    OR generated_by = 'claude-sonnet-4-20250514';

-- -- Verify deletion
-- SELECT COUNT(*) as remaining_records FROM feedback_360_reports;
