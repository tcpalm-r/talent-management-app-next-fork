-- ============================================================================
-- TEST 1: Verify Table Structure
-- ============================================================================
-- Run this first to confirm all columns exist with correct types

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'feedback_360_reports'
ORDER BY ordinal_position;

-- Expected Results:
-- Should show 15 columns:
-- 1. id (uuid, NO, gen_random_uuid())
-- 2. survey_id (uuid, NO, NULL)
-- 3. themes (jsonb, NO, '[]'::jsonb)
-- 4. sentiment_by_relationship (jsonb, NO, '{}'::jsonb)
-- 5. overall_strengths (ARRAY, NO, '{}'::text[])
-- 6. development_areas (ARRAY, NO, '{}'::text[])
-- 7. recommendations (ARRAY, NO, '{}'::text[])
-- 8. key_insights (ARRAY, NO, '{}'::text[])
-- 9. consensus_areas (ARRAY, NO, '{}'::text[])
-- 10. outlier_opinions (ARRAY, NO, '{}'::text[])
-- 11. generated_at (timestamp with time zone, NO, NULL)
-- 12. generated_by (text, NO, NULL)
-- 13. manager_notes (text, YES, NULL)
-- 14. created_at (timestamp with time zone, YES, now())
-- 15. updated_at (timestamp with time zone, YES, now())
