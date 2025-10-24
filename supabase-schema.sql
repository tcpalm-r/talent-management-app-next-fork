-- 9-Box Talent Assessment Database Schema
-- Run this in Supabase SQL Editor

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS box_definitions;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (keeping for future auth if needed)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_name TEXT,
    title TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Box definitions table
CREATE TABLE box_definitions (
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

-- Assessments table
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    performance TEXT CHECK (performance IN ('low', 'medium', 'high')),
    potential TEXT CHECK (potential IN ('low', 'medium', 'high')),
    box_key TEXT,
    note TEXT,
    assessed_by UUID,
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id)
);

-- Disable Row Level Security for simplified access (no auth)
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE assessments DISABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_departments_org_id ON departments(organization_id);
CREATE INDEX idx_employees_org_id ON employees(organization_id);
CREATE INDEX idx_employees_dept_id ON employees(department_id);
CREATE INDEX idx_assessments_employee_id ON assessments(employee_id);
CREATE INDEX idx_assessments_org_id ON assessments(organization_id);
CREATE INDEX idx_box_definitions_org_id ON box_definitions(organization_id);

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_box_definitions_updated_at BEFORE UPDATE ON box_definitions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 360 Feedback Tables

-- Question templates library
CREATE TABLE feedback_360_question_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- 'Leadership', 'Collaboration', 'Communication', 'Technical Skills', 'Problem Solving', etc.
    question_text TEXT NOT NULL,
    response_type TEXT DEFAULT 'scale', -- 'scale', 'text', 'boolean'
    scale_min INTEGER DEFAULT 1,
    scale_max INTEGER DEFAULT 5,
    is_system_template BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom 360 feedback templates
CREATE TABLE feedback_360_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions selected for each template
CREATE TABLE feedback_360_template_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES feedback_360_templates(id) ON DELETE CASCADE,
    question_template_id UUID REFERENCES feedback_360_question_templates(id),
    custom_question_text TEXT, -- Allows customization of template question
    category TEXT NOT NULL,
    response_type TEXT DEFAULT 'scale',
    scale_min INTEGER DEFAULT 1,
    scale_max INTEGER DEFAULT 5,
    sort_order INTEGER DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 360 feedback surveys sent out
CREATE TABLE feedback_360_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES feedback_360_templates(id),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE, -- Subject of feedback
    survey_name TEXT NOT NULL,
    status TEXT DEFAULT 'draft', -- 'draft', 'active', 'closed'
    due_date TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reviewers invited to provide feedback
CREATE TABLE feedback_360_reviewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES feedback_360_surveys(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL,
    reviewer_email TEXT NOT NULL,
    relationship TEXT NOT NULL, -- 'manager', 'peer', 'direct_report', 'cross_functional'
    access_token TEXT UNIQUE, -- Unique link for anonymous feedback
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    sent_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual responses to questions
CREATE TABLE feedback_360_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES feedback_360_surveys(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES feedback_360_reviewers(id) ON DELETE CASCADE,
    question_id UUID REFERENCES feedback_360_template_questions(id),
    response_scale INTEGER,
    response_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable Row Level Security
ALTER TABLE feedback_360_question_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_template_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_reviewers DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_360_responses DISABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_360_templates_org_id ON feedback_360_templates(organization_id);
CREATE INDEX idx_360_template_questions_template_id ON feedback_360_template_questions(template_id);
CREATE INDEX idx_360_surveys_employee_id ON feedback_360_surveys(employee_id);
CREATE INDEX idx_360_reviewers_survey_id ON feedback_360_reviewers(survey_id);
CREATE INDEX idx_360_responses_survey_id ON feedback_360_responses(survey_id);
CREATE INDEX idx_360_responses_reviewer_id ON feedback_360_responses(reviewer_id);

-- Update triggers
CREATE TRIGGER update_360_templates_updated_at BEFORE UPDATE ON feedback_360_templates
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_360_surveys_updated_at BEFORE UPDATE ON feedback_360_surveys
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();