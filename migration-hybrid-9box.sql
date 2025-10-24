-- ============================================
-- HYBRID MIGRATION: Add 9-Box Talent Grid to Existing Schema
-- ============================================
-- Purpose: Adds organizations, departments, box_definitions, and employees VIEW
--          while preserving existing performance review and 360 feedback system
--
-- IMPORTANT: Test in a cloned environment first!
-- Run this AFTER backing up your database
-- ============================================

-- 1. CREATE ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE DEPARTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE BOX_DEFINITIONS TABLE (9-Box Grid)
-- ============================================
CREATE TABLE IF NOT EXISTS box_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    action_hint TEXT,
    color TEXT DEFAULT '#6B7280',
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- 4. CREATE TALENT_GRID_ASSESSMENTS TABLE (9-Box Placements)
-- ============================================
-- Note: This is separate from your existing 'assessments' table
-- which is used for Ideal Team Player framework
CREATE TABLE IF NOT EXISTS talent_grid_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL, -- References user_profiles.id
    performance TEXT CHECK (performance IN ('low', 'medium', 'high')),
    potential TEXT CHECK (potential IN ('low', 'medium', 'high')),
    box_key TEXT,
    note TEXT,
    assessed_by UUID, -- References user_profiles.id
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id)
);

-- 5. CREATE EMPLOYEES VIEW
-- ============================================
-- This VIEW maps user_profiles to the employees structure expected by the front-end
-- It allows the 9-box grid to work with your existing user_profiles data
CREATE OR REPLACE VIEW employees AS
SELECT
    up.id,
    'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f'::uuid AS organization_id, -- Fixed org ID
    up.employee_number AS employee_id,
    up.full_name AS name,
    up.email,

    -- Map department name to department_id via lookup
    (SELECT d.id FROM departments d WHERE d.name = up.department LIMIT 1) AS department_id,

    -- Get manager's full name via lookup
    (SELECT m.full_name FROM user_profiles m WHERE m.id = up.manager_id) AS manager_name,

    up.title,
    up.location,
    up.created_at,
    up.updated_at
FROM user_profiles up
WHERE up.is_active = true;

-- 6. CREATE ASSESSMENTS VIEW FOR 9-BOX
-- ============================================
-- This VIEW maps talent_grid_assessments to match the 'assessments' structure
-- expected by the front-end for the 9-box grid
-- Your original 'assessments' table remains unchanged for Ideal Team Player data
CREATE OR REPLACE VIEW assessments AS
SELECT
    tga.id,
    tga.organization_id,
    tga.employee_id,
    tga.performance,
    tga.potential,
    tga.box_key,
    tga.note,
    tga.assessed_by,
    tga.assessed_at,
    tga.created_at,
    tga.updated_at
FROM talent_grid_assessments tga;

-- 7. DISABLE ROW LEVEL SECURITY (matching your existing setup)
-- ============================================
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE talent_grid_assessments DISABLE ROW LEVEL SECURITY;

-- 8. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_talent_grid_assessments_employee_id ON talent_grid_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_talent_grid_assessments_org_id ON talent_grid_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_box_definitions_org_id ON box_definitions(organization_id);

-- 9. CREATE UPDATE TRIGGERS
-- ============================================
-- Trigger for organizations
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Trigger for departments
CREATE TRIGGER update_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Trigger for box_definitions
CREATE TRIGGER update_box_definitions_updated_at
    BEFORE UPDATE ON box_definitions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Trigger for talent_grid_assessments
CREATE TRIGGER update_talent_grid_assessments_updated_at
    BEFORE UPDATE ON talent_grid_assessments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert organization
INSERT INTO organizations (id, name)
VALUES ('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Test Organization')
ON CONFLICT (id) DO NOTHING;

-- Insert departments
INSERT INTO departments (id, organization_id, name, color) VALUES
('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Engineering', '#3B82F6'),
('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Sales', '#10B981'),
('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Marketing', '#F59E0B'),
('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'HR', '#EF4444'),
('d5d5d5d5-d5d5-d5d5-d5d5-d5d5d5d5d5d5', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Finance', '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- Insert box definitions (9-box grid - Sonance Framework)
INSERT INTO box_definitions (organization_id, key, label, description, action_hint, color, grid_x, grid_y) VALUES
-- Low Potential Column
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '1-1', 'Realign & Redirect', 'Not delivering results, cannot adapt', 'Realign or exit within 3-6 months', '#EF4444', 1, 1),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '2-1', 'Core Foundation', 'Solid at current level, limited advancement potential', 'Valuable team member, maintain at current level', '#F59E0B', 2, 1),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '3-1', 'Master Craftsperson', 'Expert in specific area, at appropriate level', 'Valuable for knowledge transfer and mentoring', '#10B981', 3, 1),

-- Medium Potential Column
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '1-2', 'Evaluate Further', 'Some potential but not meeting standards', 'Improve or move within 6 months', '#FB923C', 1, 2),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '2-2', 'Steady Contributor', 'Reliable performer, meets expectations', 'Potential for one level advancement', '#3B82F6', 2, 2),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '3-2', 'Performance Leader', 'Exceptional results in current role', 'Ready for next level within 24 months', '#06B6D4', 3, 2),

-- High Potential Column
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '1-3', 'Rising Talent', 'High potential but underperforming', 'Needs coaching to reach full performance', '#FBBF24', 1, 3),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '2-3', 'Emerging Leader', 'Meets/exceeds expectations, high capacity for growth', 'Ready for stretch assignments and challenges', '#8B5CF6', 2, 3),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '3-3', 'Star/Top Talent', 'Consistently exceeds standards, learns fast', 'Ready for multiple level advancement, succession planning', '#10B981', 3, 3)
ON CONFLICT (organization_id, key) DO NOTHING;

-- ============================================
-- OPTIONAL: Sample talent_grid_assessments
-- ============================================
-- Uncomment the following to add sample 9-box placements for existing users
-- You'll need to replace the employee_id UUIDs with actual user_profiles.id values

/*
INSERT INTO talent_grid_assessments (organization_id, employee_id, performance, potential, box_key, assessed_at) VALUES
-- Star/Top Talent (3-3)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'YOUR-USER-ID-1', 'high', 'high', '3-3', NOW()),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'YOUR-USER-ID-2', 'high', 'high', '3-3', NOW()),

-- Performance Leader (3-2)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'YOUR-USER-ID-3', 'high', 'medium', '3-2', NOW()),

-- Emerging Leader (2-3)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'YOUR-USER-ID-4', 'medium', 'high', '2-3', NOW())
ON CONFLICT (employee_id) DO NOTHING;
*/

-- ============================================
-- GRANT PERMISSIONS (matching your existing setup)
-- ============================================
GRANT ALL ON TABLE organizations TO anon;
GRANT ALL ON TABLE organizations TO authenticated;
GRANT ALL ON TABLE organizations TO service_role;

GRANT ALL ON TABLE departments TO anon;
GRANT ALL ON TABLE departments TO authenticated;
GRANT ALL ON TABLE departments TO service_role;

GRANT ALL ON TABLE box_definitions TO anon;
GRANT ALL ON TABLE box_definitions TO authenticated;
GRANT ALL ON TABLE box_definitions TO service_role;

GRANT ALL ON TABLE talent_grid_assessments TO anon;
GRANT ALL ON TABLE talent_grid_assessments TO authenticated;
GRANT ALL ON TABLE talent_grid_assessments TO service_role;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Verify the 'employees' VIEW returns data: SELECT * FROM employees LIMIT 5;
-- 2. Verify departments exist: SELECT * FROM departments;
-- 3. Verify box_definitions exist: SELECT * FROM box_definitions;
-- 4. Test the front-end application
-- 5. Optionally populate talent_grid_assessments with real data
-- ============================================
