-- Migration: Replace 'peer' relationship with 'cross_functional' and add 'slt'
-- This script:
-- 1. Updates all existing 'peer' relationships to 'cross_functional'
-- 2. Documents the new relationship types

-- Update all existing 'peer' relationships to 'cross_functional'
UPDATE feedback_360_reviewers
SET relationship = 'cross_functional'
WHERE relationship = 'peer';

-- Verify the change
SELECT
  relationship,
  COUNT(*) as count
FROM feedback_360_reviewers
GROUP BY relationship
ORDER BY relationship;

-- Documentation of valid relationship types:
-- 'manager' - Direct manager
-- 'slt' - Senior Leadership Team member
-- 'direct_report' - Someone who reports to the survey subject
-- 'cross_functional' - Cross-functional colleague (formerly 'peer')
