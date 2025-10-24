-- ============================================
-- FIX: Add missing 'relationship' column to feedback_360_survey_reviewers
-- ============================================
-- Purpose: The front-end Survey360Wizard tries to insert a 'relationship'
-- column that doesn't exist in the database schema, causing 400 errors.
--
-- Run this migration to add the missing column.
-- ============================================

-- Add relationship column to feedback_360_survey_reviewers
DO $$
BEGIN
    -- Check if column doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feedback_360_survey_reviewers'
        AND column_name = 'relationship'
    ) THEN
        -- Add the relationship column
        ALTER TABLE feedback_360_survey_reviewers
        ADD COLUMN relationship TEXT NOT NULL DEFAULT 'peer'
        CHECK (relationship IN ('manager', 'peer', 'direct_report', 'cross_functional'));

        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_feedback_360_survey_reviewers_relationship
        ON feedback_360_survey_reviewers(relationship);

        RAISE NOTICE 'Added relationship column to feedback_360_survey_reviewers';
    ELSE
        RAISE NOTICE 'relationship column already exists in feedback_360_survey_reviewers';
    END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Added relationship column to feedback_360_survey_reviewers';
    RAISE NOTICE 'Valid values: manager, peer, direct_report, cross_functional';
    RAISE NOTICE 'Default value: peer';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- Test that the column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feedback_360_survey_reviewers'
        AND column_name = 'relationship'
    ) THEN
        RAISE NOTICE '✅ Verification passed: relationship column exists';
    ELSE
        RAISE EXCEPTION '❌ Verification failed: relationship column not found';
    END IF;
END $$;
