-- Migration: Cleanup unused tables from overly complex migration
-- Date: 2025-01-07
--
-- We originally created user_app_settings table and user_profiles_with_settings VIEW
-- thinking we needed to separate app-specific columns. But we can simply do selective
-- column upserts when syncing from Project A, leaving app-specific columns untouched.

-- Drop the VIEW first (it depends on both tables)
DROP VIEW IF EXISTS user_profiles_with_settings;

-- Drop the table (no longer needed)
DROP TABLE IF EXISTS user_app_settings;
