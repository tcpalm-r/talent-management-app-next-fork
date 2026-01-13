-- Migration: Add indexes to speed 360 survey listing
-- Purpose: Improve query performance for survey list and reviewer status lookups

CREATE INDEX IF NOT EXISTS idx_feedback_360_surveys_org_status_employee
ON feedback_360_surveys (organization_id, status, employee_id);

CREATE INDEX IF NOT EXISTS idx_feedback_360_survey_reviewers_survey_status
ON feedback_360_survey_reviewers (survey_id, status);
