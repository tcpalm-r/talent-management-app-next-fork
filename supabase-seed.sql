-- 9-Box Talent Assessment Seed Data
-- Run this after the schema is created

-- Insert organization
INSERT INTO organizations (id, name) VALUES 
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Test Organization');

-- Insert departments
INSERT INTO departments (id, organization_id, name, color) VALUES 
('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Engineering', '#3B82F6'),
('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Sales', '#10B981'),
('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Marketing', '#F59E0B'),
('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'HR', '#EF4444'),
('d5d5d5d5-d5d5-d5d5-d5d5-d5d5d5d5d5d5', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'Finance', '#8B5CF6');

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
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', '3-3', 'Star/Top Talent', 'Consistently exceeds standards, learns fast', 'Ready for multiple level advancement, succession planning', '#10B981', 3, 3);

-- Insert employees
INSERT INTO employees (id, organization_id, employee_id, name, email, department_id, manager_name, title, location) VALUES
-- Star/Top Talent (3-3)
('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E001', 'Sarah Johnson', 'sarah.j@test.com', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Mike Wilson', 'Senior Software Engineer', 'San Francisco'),
('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E002', 'David Chen', 'david.c@test.com', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'Lisa Brown', 'Sales Director', 'New York'),

-- Performance Leader (3-2)
('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E003', 'Jennifer Martinez', 'jennifer.m@test.com', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'Robert Taylor', 'Marketing Manager', 'Chicago'),
('e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E004', 'Michael Brown', 'michael.b@test.com', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Sarah Johnson', 'Lead Developer', 'Austin'),

-- Emerging Leader (2-3)
('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E005', 'Emily Davis', 'emily.d@test.com', 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'Amanda Wilson', 'HR Specialist', 'Boston'),
('e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E006', 'James Wilson', 'james.w@test.com', 'd5d5d5d5-d5d5-d5d5-d5d5-d5d5d5d5d5d5', 'Karen Smith', 'Financial Analyst', 'Seattle'),

-- Steady Contributor (2-2)
('e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E007', 'Lisa Garcia', 'lisa.g@test.com', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'David Chen', 'Sales Representative', 'Los Angeles'),
('e8e8e8e8-e8e8-e8e8-e8e8-e8e8e8e8e8e8', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E008', 'Robert Taylor', 'robert.t@test.com', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'Jennifer Martinez', 'Marketing Coordinator', 'Denver'),
('e9e9e9e9-e9e9-e9e9-e9e9-e9e9e9e9e9e9', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E009', 'Amanda Wilson', 'amanda.w@test.com', 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'Emily Davis', 'HR Manager', 'Portland'),

-- Rising Talent (1-3)
('eAeAeAeA-eAeA-eAeA-eAeA-eAeAeAeAeAeA', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E010', 'Kevin Lee', 'kevin.l@test.com', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Michael Brown', 'Junior Developer', 'Miami'),

-- Master Craftsperson (3-1)
('eBeBeBe8-eBeB-eBeB-eBeB-eBeBeBeBeBe8', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E011', 'Karen Smith', 'karen.s@test.com', 'd5d5d5d5-d5d5-d5d5-d5d5-d5d5d5d5d5d5', 'James Wilson', 'Senior Accountant', 'Phoenix'),

-- Unassigned employees for testing drag and drop
('eCeCeCeC-eCeC-eCeC-eCeC-eCeCeCeCeCeC', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E012', 'Alex Rodriguez', 'alex.r@test.com', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Sarah Johnson', 'Software Engineer', 'Dallas'),
('eDeDeDe8-eDeD-eDeD-eDeD-eDeDeDeDeDe8', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E013', 'Jessica Brown', 'jessica.b@test.com', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'David Chen', 'Account Manager', 'Atlanta'),
('eEeEeEeE-eEeE-eEeE-eEeE-eEeEeEeEeEeE', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E014', 'Mark Thompson', 'mark.t@test.com', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'Jennifer Martinez', 'Content Specialist', 'Minneapolis'),
('eFeFeFe8-eFeF-eFeF-eFeF-eFeFeFeFeFe8', 'f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'E015', 'Rachel Johnson', 'rachel.j@test.com', 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', 'Amanda Wilson', 'Recruiter', 'Nashville');

-- Insert assessments for positioned employees
INSERT INTO assessments (organization_id, employee_id, performance, potential, box_key, assessed_at) VALUES
-- Star/Top Talent (3-3)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'high', 'high', '3-3', NOW()),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', 'high', 'high', '3-3', NOW()),

-- Performance Leader (3-2)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'high', 'medium', '3-2', NOW()),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', 'high', 'medium', '3-2', NOW()),

-- Emerging Leader (2-3)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', 'medium', 'high', '2-3', NOW()),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6', 'medium', 'high', '2-3', NOW()),

-- Steady Contributor (2-2)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', 'medium', 'medium', '2-2', NOW()),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e8e8e8e8-e8e8-e8e8-e8e8-e8e8e8e8e8e8', 'medium', 'medium', '2-2', NOW()),
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'e9e9e9e9-e9e9-e9e9-e9e9-e9e9e9e9e9e9', 'medium', 'medium', '2-2', NOW()),

-- Rising Talent (1-3)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'eAeAeAeA-eAeA-eAeA-eAeA-eAeAeAeAeAeA', 'low', 'high', '1-3', NOW()),

-- Master Craftsperson (3-1)
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'eBeBeBe8-eBeB-eBeB-eBeB-eBeBeBeBeBe8', 'high', 'low', '3-1', NOW());

-- Note: Last 4 employees (E012-E015) have no assessments, so they'll be "unassigned" for testing