-- Migration: Extract App-Specific Columns from user_profiles
-- Purpose: Separate app-specific data (roles, permissions, login tracking)
--          from user_profiles so it can sync cleanly with Project A (central user directory)
-- Date: 2025-01-07
--
-- This migration:
-- 1. Creates user_app_settings table for app-specific data
-- 2. Migrates existing data from user_profiles
-- 3. Adds missing Project A columns to user_profiles
-- 4. Creates a compatibility VIEW that JOINs both tables
-- 5. Drops app-specific columns from user_profiles
--
-- IMPORTANT: Run each section sequentially and verify before proceeding

-- ============================================================================
-- SECTION 1: Create user_app_settings table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- App-specific roles/permissions (NOT in Project A)
  app_role TEXT DEFAULT 'user',
  app_access BOOLEAN DEFAULT false,
  app_permissions JSONB DEFAULT '{}',
  local_permissions JSONB DEFAULT '{}',

  -- Activity tracking (app-specific)
  has_logged_in BOOLEAN DEFAULT false,
  first_login_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Audit fields (app-specific)
  created_by UUID,
  last_updated_by UUID,

  -- App-specific metadata
  sync_method TEXT,
  last_sync TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

COMMENT ON TABLE user_app_settings IS 'App-specific user settings and permissions, separate from synced user profile data';
COMMENT ON COLUMN user_app_settings.user_id IS 'Foreign key to user_profiles.id';
COMMENT ON COLUMN user_app_settings.app_role IS 'Application role: admin, leader, slt, or user';
COMMENT ON COLUMN user_app_settings.app_access IS 'Whether user has access to this application';
COMMENT ON COLUMN user_app_settings.app_permissions IS 'JSON object of specific permissions for this app';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_app_settings_user_id ON user_app_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_settings_app_role ON user_app_settings(app_role);
CREATE INDEX IF NOT EXISTS idx_user_app_settings_app_access ON user_app_settings(app_access) WHERE app_access = true;

-- ============================================================================
-- SECTION 2: Migrate existing data from user_profiles to user_app_settings
-- ============================================================================
INSERT INTO user_app_settings (
  user_id,
  app_role,
  app_access,
  app_permissions,
  local_permissions,
  has_logged_in,
  first_login_at,
  last_login_at,
  created_by,
  last_updated_by,
  sync_method,
  last_sync,
  created_at,
  updated_at
)
SELECT
  id,
  COALESCE(app_role, 'user'),
  COALESCE(app_access, false),
  COALESCE(app_permissions, '{}'),
  COALESCE(local_permissions, '{}'),
  COALESCE(has_logged_in, false),
  first_login_at,
  last_login_at,
  created_by,
  last_updated_by,
  sync_method,
  last_sync,
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW())
FROM user_profiles
WHERE id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Verify migration
SELECT
  'Migrated ' || COUNT(*) || ' rows to user_app_settings' as migration_status
FROM user_app_settings;

-- ============================================================================
-- SECTION 3: Add missing Project A columns to user_profiles
-- ============================================================================
-- These columns exist in Project A but may not exist in current schema
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT,
  ADD COLUMN IF NOT EXISTS auth0_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth0_user_id TEXT,
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_provider TEXT,
  ADD COLUMN IF NOT EXISTS sso_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scim_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Migrate phone data to phone_number if it exists
UPDATE user_profiles
SET phone_number = phone
WHERE phone IS NOT NULL
  AND (phone_number IS NULL OR phone_number = '');

-- ============================================================================
-- SECTION 4: Create compatibility VIEW
-- This VIEW merges user_profiles + user_app_settings for seamless reads
-- ============================================================================
CREATE OR REPLACE VIEW user_profiles_with_settings AS
SELECT
  -- Core user_profiles columns (synced from Project A)
  up.id,
  up.auth0_id,
  up.email,
  up.full_name,
  up.given_name,
  up.family_name,
  up.picture,
  up.avatar_url,
  up.capabilities,
  up.department,
  up.title,
  up.job_title,
  up.phone,
  up.phone_number,
  up.location,
  up.manager_id,
  up.manager_email,
  up.employee_number,
  up.cost_center,
  up.external_id,
  up.scim_active,
  up.is_active,
  up.created_at,
  up.updated_at,

  -- New Project A columns
  up.role,
  up.last_sign_in_at,
  up.auth_provider,
  up.auth0_verified,
  up.auth0_user_id,
  up.login_count,
  up.last_login_provider,
  up.sso_metadata,
  up.email_verified,
  up.scim_metadata,

  -- App-specific columns (from user_app_settings with defaults)
  COALESCE(uas.app_role, 'user') as app_role,
  COALESCE(uas.app_access, false) as app_access,
  COALESCE(uas.app_permissions, '{}')::jsonb as app_permissions,
  COALESCE(uas.local_permissions, '{}')::jsonb as local_permissions,
  COALESCE(uas.has_logged_in, false) as has_logged_in,
  uas.first_login_at,
  uas.last_login_at,
  uas.created_by,
  uas.last_updated_by,
  uas.sync_method,
  uas.last_sync,

  -- Keep idx if it exists
  up.idx

FROM user_profiles up
LEFT JOIN user_app_settings uas ON up.id = uas.user_id;

COMMENT ON VIEW user_profiles_with_settings IS 'Combined view of user_profiles (synced from Project A) and user_app_settings (app-specific). Use this for reads.';

-- ============================================================================
-- SECTION 5: Drop app-specific columns from user_profiles
-- IMPORTANT: Only run this AFTER verifying the VIEW works correctly
-- ============================================================================
-- Uncomment and run this section after verifying everything works:
/*
ALTER TABLE user_profiles
  DROP COLUMN IF EXISTS global_role,
  DROP COLUMN IF EXISTS app_role,
  DROP COLUMN IF EXISTS app_access,
  DROP COLUMN IF EXISTS app_permissions,
  DROP COLUMN IF EXISTS local_permissions,
  DROP COLUMN IF EXISTS has_logged_in,
  DROP COLUMN IF EXISTS first_login_at,
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS last_updated_by,
  DROP COLUMN IF EXISTS sync_method,
  DROP COLUMN IF EXISTS last_sync,
  DROP COLUMN IF EXISTS phone;  -- Replaced by phone_number
*/

-- ============================================================================
-- SECTION 6: Verification queries
-- ============================================================================
-- Run these to verify the migration:

-- Check user_app_settings count matches user_profiles
SELECT
  (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
  (SELECT COUNT(*) FROM user_app_settings) as user_app_settings_count;

-- Verify VIEW returns expected columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles_with_settings'
ORDER BY ordinal_position;

-- Sample data from VIEW
SELECT id, email, full_name, app_role, app_access, is_active
FROM user_profiles_with_settings
LIMIT 5;

-- ============================================================================
-- SECTION 7: RLS Policies for user_app_settings (if needed)
-- ============================================================================
-- Enable RLS
ALTER TABLE user_app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for admin operations)
CREATE POLICY "Service role full access" ON user_app_settings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Authenticated users can read their own settings
CREATE POLICY "Users can read own settings" ON user_app_settings
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: Allow admins to read all settings (based on app_role in user_app_settings)
CREATE POLICY "Admins can read all settings" ON user_app_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_app_settings admin_settings
      WHERE admin_settings.user_id = auth.uid()
      AND admin_settings.app_role = 'admin'
    )
  );
