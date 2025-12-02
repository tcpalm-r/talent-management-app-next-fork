-- Add min_words column to feedback_360_questions table
-- This allows admins to set minimum word requirements for each question

-- Add the column (allowing NULL for existing questions)
ALTER TABLE feedback_360_questions
ADD COLUMN IF NOT EXISTS min_words INTEGER;

-- Set a default value for existing questions (50 words)
UPDATE feedback_360_questions
SET min_words = 50
WHERE min_words IS NULL;

-- Add a check constraint to ensure min_words is reasonable (10-500 words)
ALTER TABLE feedback_360_questions
ADD CONSTRAINT check_min_words_range
CHECK (min_words IS NULL OR (min_words >= 10 AND min_words <= 500));

-- Add a comment to document the column
COMMENT ON COLUMN feedback_360_questions.min_words IS 'Minimum word count required for responses to this question';
