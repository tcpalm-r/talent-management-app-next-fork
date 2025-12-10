-- Add citation support to 360 survey reports
-- This enables AI audit trail functionality for HR admins

-- 1. Add citation metadata columns to existing reports table
ALTER TABLE "public"."feedback_360_reports"
ADD COLUMN IF NOT EXISTS "has_citations" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "citation_version" text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "total_citations" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "citation_coverage" numeric(5,2) DEFAULT 0;

-- 2. Create citations junction table
-- Stores individual citation mappings between report statements and source responses
CREATE TABLE IF NOT EXISTS "public"."feedback_360_report_citations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL,
  "response_id" uuid NOT NULL,

  -- Location within the report structure
  "section_type" text NOT NULL,           -- 'theme', 'strength', 'development', 'insight', 'recommendation', 'consensus', 'outlier'
  "section_index" integer NOT NULL,        -- Index within the section array (e.g., which theme)
  "statement_index" integer DEFAULT 0,     -- For nested arrays like theme.supporting_evidence

  -- Citation content
  "snippet" text NOT NULL,                 -- 20-50 word excerpt from source response
  "relevance_score" numeric(3,2),          -- 0.00-1.00, how relevant the citation is

  "created_at" timestamp with time zone DEFAULT now(),

  CONSTRAINT "feedback_360_report_citations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_360_report_citations_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "public"."feedback_360_reports"("id") ON DELETE CASCADE,
  CONSTRAINT "feedback_360_report_citations_section_type_check"
    CHECK ("section_type" IN ('theme', 'strength', 'development', 'insight', 'recommendation', 'consensus', 'outlier'))
);

-- 3. Create indexes for efficient citation lookups
CREATE INDEX IF NOT EXISTS "idx_report_citations_report_id"
  ON "public"."feedback_360_report_citations" ("report_id");

CREATE INDEX IF NOT EXISTS "idx_report_citations_section"
  ON "public"."feedback_360_report_citations" ("report_id", "section_type", "section_index");

-- 4. Add comment for documentation
COMMENT ON TABLE "public"."feedback_360_report_citations" IS
  'Stores citation mappings between AI-generated report statements and their source survey responses. Enables audit trail for HR admins to verify AI output.';

COMMENT ON COLUMN "public"."feedback_360_report_citations"."snippet" IS
  'A 20-50 word excerpt from the original response that informed the report statement. Anonymous - no reviewer attribution.';
