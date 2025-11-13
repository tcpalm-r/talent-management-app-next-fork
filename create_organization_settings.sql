-- Migration: Create organization_settings table
-- Purpose: Store application-wide configuration (replaces file-based settings)
-- Date: 2025-11-13

-- Create organization_settings table for app configuration
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT setting_key_format CHECK (setting_key ~ '^[a-z0-9_]+$')
);

-- Add index on setting_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_organization_settings_key
ON organization_settings(setting_key);

-- Add RLS policies
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read settings
CREATE POLICY "Allow authenticated users to read settings"
ON organization_settings
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow admins to manage settings
CREATE POLICY "Allow admins to manage settings"
ON organization_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.auth0_id = auth.uid()::text
    AND user_profiles.app_role = 'admin'
  )
);

-- Insert default 360 questions configuration
-- These are the hardcoded defaults from the application
INSERT INTO organization_settings (setting_key, setting_value, updated_by)
VALUES (
  '360_default_questions',
  '{
    "defaultQuestionIds": [
      "impact-biggest-impact",
      "growth-stop",
      "growth-start"
    ],
    "customQuestions": {}
  }'::jsonb,
  'system'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE organization_settings IS 'Stores application-wide configuration settings in key-value format. Used for settings like 360 default questions that need to be configurable but persist across deployments.';

COMMENT ON COLUMN organization_settings.setting_key IS 'Unique identifier for the setting (snake_case format)';
COMMENT ON COLUMN organization_settings.setting_value IS 'JSON value of the setting (flexible structure)';
COMMENT ON COLUMN organization_settings.updated_by IS 'User who last updated this setting (email or system)';
