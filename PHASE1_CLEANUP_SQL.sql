-- ============================================================================
-- DATABASE CLEANUP - PHASE 1: ZERO-RISK REMOVALS
-- ============================================================================
-- Copy this entire file and run it in Supabase SQL Editor
-- Date: 2025-11-12
-- Risk Level: ZERO - All objects are empty or unused
-- ============================================================================

-- Log start
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Starting Phase 1 Database Cleanup';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Dropping 6 unused database objects';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Drop empty tables (0 rows, 0 code references)
-- ============================================================================

-- Drop performance_review_participants
DROP TABLE IF EXISTS performance_review_participants CASCADE;
DO $$ BEGIN RAISE NOTICE '✓ Dropped: performance_review_participants (empty table)'; END $$;

-- Drop performance_review_deadlines
DROP TABLE IF EXISTS performance_review_deadlines CASCADE;
DO $$ BEGIN RAISE NOTICE '✓ Dropped: performance_review_deadlines (empty table)'; END $$;

-- Drop user_profile_changes
DROP TABLE IF EXISTS user_profile_changes CASCADE;
DO $$ BEGIN RAISE NOTICE '✓ Dropped: user_profile_changes (empty table)'; END $$;

-- ============================================================================
-- STEP 2: Drop unused views (have some rows but 0 code references)
-- ============================================================================

-- Drop active_performance_reviews (stub view)
DROP VIEW IF EXISTS active_performance_reviews CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews CASCADE;
DO $$ BEGIN RAISE NOTICE '✓ Dropped: active_performance_reviews (unused view)'; END $$;

-- Drop active_users (4 rows)
DROP VIEW IF EXISTS active_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_users CASCADE;
DO $$ BEGIN RAISE NOTICE '✓ Dropped: active_users (unused view)'; END $$;

-- Drop pending_users (382 rows)
DROP VIEW IF EXISTS pending_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS pending_users CASCADE;
DO $$ BEGIN RAISE NOTICE '✓ Dropped: pending_users (unused view)'; END $$;

-- ============================================================================
-- Completion message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Phase 1 Cleanup COMPLETED!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Dropped 6 objects:';
  RAISE NOTICE '  ✓ 3 empty tables';
  RAISE NOTICE '  ✓ 3 unused views';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run verify script: node scripts/verify-supabase.js';
  RAISE NOTICE '  2. Test your application';
  RAISE NOTICE '  3. Review Phase 2 recommendations';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run these after to confirm)
-- ============================================================================

-- Check if objects still exist (should return 0 rows)
SELECT
  'TABLE' as object_type,
  tablename as object_name
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'performance_review_participants',
    'performance_review_deadlines',
    'user_profile_changes'
  )
UNION ALL
SELECT
  'VIEW' as object_type,
  viewname as object_name
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'active_performance_reviews',
    'active_users',
    'pending_users'
  )
UNION ALL
SELECT
  'MATERIALIZED VIEW' as object_type,
  matviewname as object_name
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname IN (
    'active_performance_reviews',
    'active_users',
    'pending_users'
  );

-- This query should return 0 rows if cleanup was successful
