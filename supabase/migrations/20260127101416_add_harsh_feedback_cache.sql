-- Add harsh feedback analysis cache table
-- Stores AI-analyzed harsh feedback results for admin review
-- Results are cached per survey to avoid re-running expensive AI analysis

CREATE TABLE IF NOT EXISTS "public"."feedback_360_harsh_feedback" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "survey_id" uuid NOT NULL UNIQUE,
  "result" jsonb NOT NULL,
  "analyzed_at" timestamp with time zone DEFAULT now(),
  "analyzed_by" uuid,

  CONSTRAINT "feedback_360_harsh_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_360_harsh_feedback_survey_id_fkey"
    FOREIGN KEY ("survey_id") REFERENCES "public"."feedback_360_surveys"("id") ON DELETE CASCADE,
  CONSTRAINT "feedback_360_harsh_feedback_analyzed_by_fkey"
    FOREIGN KEY ("analyzed_by") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL
);

-- Create index for efficient lookups by survey
CREATE INDEX IF NOT EXISTS "idx_harsh_feedback_survey_id"
  ON "public"."feedback_360_harsh_feedback" ("survey_id");

-- Disable RLS to match other feedback tables
ALTER TABLE "public"."feedback_360_harsh_feedback" DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "public"."feedback_360_harsh_feedback" IS
  'Caches harsh feedback analysis results to avoid re-running expensive AI analysis. Admin-only feature.';

COMMENT ON COLUMN "public"."feedback_360_harsh_feedback"."result" IS
  'JSONB containing summary stats and findings array with verbatim quotes, severity, and reviewer attribution.';
