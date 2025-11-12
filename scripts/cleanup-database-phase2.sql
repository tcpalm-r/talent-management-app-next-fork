-- Database Cleanup - Phase 2: Export and Remove Data-Bearing Tables
-- This script backs up and drops tables that have data but no code references
-- Date: 2025-11-12
-- Risk Level: LOW - Has data but no code references (backup first!)

-- ============================================================================
-- IMPORTANT:
-- 1. Review DATABASE_CLEANUP_RECOMMENDATIONS.md before running
-- 2. Manually export data BEFORE running this script (instructions below)
-- 3. Verify backups exist before committing
-- ============================================================================

-- EXPORT INSTRUCTIONS (run these BEFORE this script):
-- =============================================================================
-- Using psql command line:
--
-- psql "postgresql://postgres.qufwxmqbmyaexkjrbsxc:Sonance2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
--   -c "\COPY ideal_team_player_matrix TO '/tmp/ideal_team_player_matrix_backup.csv' CSV HEADER"
--
-- psql "postgresql://postgres.qufwxmqbmyaexkjrbsxc:Sonance2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
--   -c "\COPY departments TO '/tmp/departments_backup.csv' CSV HEADER"
--
-- psql "postgresql://postgres.qufwxmqbmyaexkjrbsxc:Sonance2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
--   -c "\COPY hr_modules TO '/tmp/hr_modules_backup.csv' CSV HEADER"
--
-- psql "postgresql://postgres.qufwxmqbmyaexkjrbsxc:Sonance2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
--   -c "\COPY sync_history TO '/tmp/sync_history_backup.csv' CSV HEADER"
--
-- OR use Supabase dashboard to export each table
-- =============================================================================

BEGIN;

-- Safety check - verify you've exported the data
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SAFETY CHECK';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Have you exported these tables?';
  RAISE NOTICE '  - ideal_team_player_matrix (18 rows)';
  RAISE NOTICE '  - departments (5 rows)';
  RAISE NOTICE '  - hr_modules (1 row)';
  RAISE NOTICE '  - sync_history (12 rows)';
  RAISE NOTICE '';
  RAISE NOTICE 'If NO, stop now and run exports first!';
  RAISE NOTICE 'If YES, proceeding with drops...';
  RAISE NOTICE '============================================';
END $$;

-- Wait 5 seconds for user to cancel if needed
-- (Only works in interactive psql sessions)
-- SELECT pg_sleep(5);

-- ============================================================================
-- STEP 1: Drop ideal_team_player_matrix
-- ============================================================================
-- 18 rows of data, 0 code references
-- Part of abandoned "Ideal Team Player" assessment framework

DROP TABLE IF EXISTS ideal_team_player_matrix CASCADE;
RAISE NOTICE 'Dropped table: ideal_team_player_matrix (18 rows backed up)';

-- ============================================================================
-- STEP 2: Drop departments table
-- ============================================================================
-- 5 rows of department data, 0 code references
-- The app uses user_profiles.department (text field) instead

DROP TABLE IF EXISTS departments CASCADE;
RAISE NOTICE 'Dropped table: departments (5 rows backed up)';

-- ============================================================================
-- STEP 3: Drop hr_modules table
-- ============================================================================
-- 1 row of config data, 0 code references
-- Module configuration system that was never fully implemented

DROP TABLE IF EXISTS hr_modules CASCADE;
RAISE NOTICE 'Dropped table: hr_modules (1 row backed up)';

-- ============================================================================
-- STEP 4: Drop sync_history table (OPTIONAL)
-- ============================================================================
-- 12 rows of audit log data, 0 code references
-- Historical sync operations from AI Intranet
-- COMMENT OUT if you want to keep audit history

DROP TABLE IF EXISTS sync_history CASCADE;
RAISE NOTICE 'Dropped table: sync_history (12 rows backed up)';

-- ============================================================================
-- Completion message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Phase 2 cleanup completed successfully!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Dropped 4 tables with backups:';
  RAISE NOTICE '  - ideal_team_player_matrix (18 rows)';
  RAISE NOTICE '  - departments (5 rows)';
  RAISE NOTICE '  - hr_modules (1 row)';
  RAISE NOTICE '  - sync_history (12 rows)';
  RAISE NOTICE '';
  RAISE NOTICE 'Backups saved to /tmp/ directory';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run tests to verify app still works';
  RAISE NOTICE '  2. Update lib/schema.ts to remove types';
  RAISE NOTICE '  3. Update scripts/verify-supabase.js';
  RAISE NOTICE '  4. Clean up SQL files (see recommendations)';
END $$;

-- If everything looks good, commit
-- If you want to review first, ROLLBACK instead
COMMIT;

-- Verification queries - run after commit
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('ideal_team_player_matrix', 'departments', 'hr_modules', 'sync_history');
-- Should return 0 rows
