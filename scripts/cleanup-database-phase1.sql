-- Database Cleanup - Phase 1: Zero-Risk Removals
-- This script drops empty tables and broken views that have no code references
-- Date: 2025-11-12
-- Risk Level: ZERO - All targets are empty or broken with no code usage

-- ============================================================================
-- IMPORTANT: Review DATABASE_CLEANUP_RECOMMENDATIONS.md before running
-- ============================================================================

BEGIN;

-- Log what we're about to do
DO $$
BEGIN
  RAISE NOTICE 'Starting Phase 1 Database Cleanup...';
  RAISE NOTICE 'This will drop 6 unused database objects';
END $$;

-- ============================================================================
-- STEP 1: Drop empty tables with no code references
-- ============================================================================

-- Drop performance_review_participants (0 rows, 0 code references)
DROP TABLE IF EXISTS performance_review_participants CASCADE;
RAISE NOTICE 'Dropped table: performance_review_participants';

-- Drop performance_review_deadlines (0 rows, 0 code references)
DROP TABLE IF EXISTS performance_review_deadlines CASCADE;
RAISE NOTICE 'Dropped table: performance_review_deadlines';

-- Drop user_profile_changes (0 rows, 0 code references)
DROP TABLE IF EXISTS user_profile_changes CASCADE;
RAISE NOTICE 'Dropped table: user_profile_changes';

-- ============================================================================
-- STEP 2: Drop stub/broken views with no code references
-- ============================================================================

-- Drop active_performance_reviews (stub view returning all NULL, 0 code references)
DROP VIEW IF EXISTS active_performance_reviews CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews CASCADE;
RAISE NOTICE 'Dropped view: active_performance_reviews';

-- ============================================================================
-- STEP 3: Drop unused views (these have data but no code references)
-- ============================================================================

-- Drop active_users view (4 rows, 0 code references)
DROP VIEW IF EXISTS active_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_users CASCADE;
RAISE NOTICE 'Dropped view: active_users';

-- Drop pending_users view (382 rows, 0 code references)
DROP VIEW IF EXISTS pending_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS pending_users CASCADE;
RAISE NOTICE 'Dropped view: pending_users';

-- ============================================================================
-- Completion message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Phase 1 cleanup completed successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Dropped:';
  RAISE NOTICE '  - 3 empty tables';
  RAISE NOTICE '  - 3 unused views';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run tests to verify app still works';
  RAISE NOTICE '  2. Review Phase 2 for data-bearing tables';
  RAISE NOTICE '  3. Update lib/schema.ts to remove dropped types';
END $$;

-- If everything looks good, commit
-- If you want to review first, ROLLBACK instead
COMMIT;

-- Verification query - run after commit to verify drops
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN
--   ('performance_review_participants', 'performance_review_deadlines', 'user_profile_changes');
-- Should return 0 rows

-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname IN
--   ('active_performance_reviews', 'active_users', 'pending_users');
-- Should return 0 rows
