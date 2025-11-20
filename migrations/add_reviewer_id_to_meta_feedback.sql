-- Add reviewer_id to allow multiple reviewers to submit feedback per survey
ALTER TABLE survey_meta_feedback ADD COLUMN reviewer_id UUID;

-- Link to reviewer table
ALTER TABLE survey_meta_feedback
ADD CONSTRAINT fk_survey_meta_feedback_reviewer
FOREIGN KEY (reviewer_id) REFERENCES feedback_360_reviewers(id) ON DELETE CASCADE;

-- Drop old constraint (replace 'survey_meta_feedback_survey_id_key' with actual name if different)
ALTER TABLE survey_meta_feedback DROP CONSTRAINT IF EXISTS survey_meta_feedback_survey_id_key;

-- New constraint: one feedback per reviewer per survey
ALTER TABLE survey_meta_feedback
ADD CONSTRAINT unique_survey_reviewer_feedback
UNIQUE (survey_id, reviewer_id);
