-- Migration: Expand feedback_360_surveys status check to support queueing
-- Purpose: Allow 'queued' and 'generating' statuses during AI report generation

ALTER TABLE "public"."feedback_360_surveys"
DROP CONSTRAINT IF EXISTS "feedback_360_surveys_status_check";

ALTER TABLE "public"."feedback_360_surveys"
ADD CONSTRAINT "feedback_360_surveys_status_check"
CHECK (("status" = ANY (ARRAY[
  'draft'::"text",
  'active'::"text",
  'in_progress'::"text",
  'generating'::"text",
  'queued'::"text",
  'completed'::"text",
  'finalized'::"text",
  'cancelled'::"text"
])));
