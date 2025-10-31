-- Add missing columns to feedback_360_surveys table for admin review and reanalysis flags
ALTER TABLE "public"."feedback_360_surveys"
ADD COLUMN "flagged_for_admin" boolean DEFAULT false,
ADD COLUMN "flagged_for_reanalysis" boolean DEFAULT false;

-- Update the status check constraint to include 'finalized' status
ALTER TABLE "public"."feedback_360_surveys"
DROP CONSTRAINT IF EXISTS "feedback_360_surveys_status_check";

ALTER TABLE "public"."feedback_360_surveys"
ADD CONSTRAINT "feedback_360_surveys_status_check"
CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'completed'::"text", 'finalized'::"text", 'cancelled'::"text"])));
