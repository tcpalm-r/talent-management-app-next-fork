-- Add organization_settings table for storing system-wide settings
-- This allows admins to configure default 360 questions and other settings

CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_settings_key ON organization_settings(key);

-- Disable Row Level Security for simplified access
ALTER TABLE organization_settings DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE organization_settings TO anon;
GRANT ALL ON TABLE organization_settings TO authenticated;
GRANT ALL ON TABLE organization_settings TO service_role;

-- Create update trigger
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Insert default 360 questions setting
INSERT INTO organization_settings (key, settings)
VALUES (
  'default_360_questions',
  '{"question_ids": ["impact-biggest-impact", "growth-stop", "growth-start"]}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Verify
SELECT * FROM organization_settings WHERE key = 'default_360_questions';
