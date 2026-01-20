-- ITP (Ideal Team Player) Self-Assessment Tables
-- Creates tables for storing employee self-assessments based on the ITP framework

-- Clean up any partial previous runs
DROP TABLE IF EXISTS itp_responses CASCADE;
DROP TABLE IF EXISTS itp_assessments CASCADE;

-- ITP Assessments table (stores assessment records)
CREATE TABLE itp_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'archived')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_itp_assessments_employee_id ON itp_assessments(employee_id);
CREATE INDEX idx_itp_assessments_status ON itp_assessments(status);
CREATE INDEX idx_itp_assessments_submitted_at ON itp_assessments(submitted_at DESC);

-- ITP Responses table (stores individual behavior ratings)
CREATE TABLE itp_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES itp_assessments(id) ON DELETE CASCADE NOT NULL,
    behavior_key TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(assessment_id, behavior_key)
);

-- Index for looking up responses by assessment
CREATE INDEX idx_itp_responses_assessment_id ON itp_responses(assessment_id);

-- Disable RLS (follows existing pattern in this codebase)
ALTER TABLE itp_assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE itp_responses DISABLE ROW LEVEL SECURITY;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_itp_assessments_updated_at ON itp_assessments;
CREATE TRIGGER update_itp_assessments_updated_at
    BEFORE UPDATE ON itp_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_itp_responses_updated_at ON itp_responses;
CREATE TRIGGER update_itp_responses_updated_at
    BEFORE UPDATE ON itp_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
