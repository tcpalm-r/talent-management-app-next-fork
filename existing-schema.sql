


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."update_360_question_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_360_question_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_performance_reviews" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "name",
    NULL::"text" AS "description",
    NULL::"text" AS "review_type",
    NULL::"text" AS "framework",
    NULL::timestamp with time zone AS "start_date",
    NULL::timestamp with time zone AS "end_date",
    NULL::"text" AS "status",
    NULL::"text" AS "created_by",
    NULL::"jsonb" AS "settings",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::bigint AS "total_participants",
    NULL::bigint AS "completed_participants";


ALTER VIEW "public"."active_performance_reviews" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "idx" integer NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth0_id" "text",
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "given_name" "text",
    "family_name" "text",
    "picture" "text",
    "avatar_url" "text",
    "global_role" "text" DEFAULT 'user'::"text",
    "capabilities" "jsonb" DEFAULT '[]'::"jsonb",
    "app_role" "text" DEFAULT 'user'::"text",
    "app_permissions" "jsonb" DEFAULT '{"read": true, "admin": false, "write": false}'::"jsonb",
    "app_access" boolean DEFAULT true,
    "local_permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "department" "text",
    "title" "text",
    "phone" "text",
    "location" "text",
    "manager_id" "uuid",
    "last_sync" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "last_updated_by" "uuid",
    "is_active" boolean DEFAULT true,
    "manager_email" "text",
    "employee_number" "text",
    "cost_center" "text",
    "external_id" "text",
    "scim_active" boolean DEFAULT true,
    "job_title" "text",
    "has_logged_in" boolean DEFAULT false,
    "first_login_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "sync_method" character varying(50) DEFAULT 'unknown'::character varying,
    CONSTRAINT "user_profiles_app_role_check" CHECK (("app_role" = ANY (ARRAY['admin'::"text", 'leader'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."scim_active" IS 'SCIM active status from AI Intranet';



CREATE OR REPLACE VIEW "public"."active_users" AS
 SELECT "id",
    "email",
    "full_name",
    "department",
    "title",
    "manager_email",
    "has_logged_in",
    "first_login_at",
    "last_login_at",
    "date_part"('day'::"text", ("now"() - "last_login_at")) AS "days_since_login"
   FROM "public"."user_profiles"
  WHERE (("has_logged_in" = true) AND ("is_active" = true))
  ORDER BY "last_login_at" DESC;


ALTER VIEW "public"."active_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assessment_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assessment_id" "uuid" NOT NULL,
    "virtue" character varying(20) NOT NULL,
    "attribute" character varying(100) NOT NULL,
    "rating" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_responses_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 10)))
);


ALTER TABLE "public"."assessment_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "assessment_type" character varying(100) DEFAULT 'self-assessment'::character varying NOT NULL,
    "status" character varying(50) DEFAULT 'in_progress'::character varying NOT NULL,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assessor_id" "uuid",
    "performance_review_id" "uuid",
    "framework_type" "text" DEFAULT 'ideal-team-player'::"text",
    CONSTRAINT "assessments_framework_type_check" CHECK (("framework_type" = ANY (ARRAY['ideal-team-player'::"text", '360'::"text"]))),
    CONSTRAINT "assessments_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying])::"text"[])))
);


ALTER TABLE "public"."assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_360_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_text" "text" NOT NULL,
    "category" "text",
    "is_default" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "updated_by" "text"
);


ALTER TABLE "public"."feedback_360_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_360_questions" IS 'Stores all available 360 feedback questions (default and custom)';



COMMENT ON COLUMN "public"."feedback_360_questions"."is_default" IS 'True for system default questions, false for custom user-created questions';



COMMENT ON COLUMN "public"."feedback_360_questions"."created_at" IS 'Timestamp when the question was created';



COMMENT ON COLUMN "public"."feedback_360_questions"."updated_at" IS 'Timestamp when the question was last updated';



COMMENT ON COLUMN "public"."feedback_360_questions"."created_by" IS 'Email or user ID of the person who created this question';



COMMENT ON COLUMN "public"."feedback_360_questions"."updated_by" IS 'Email or user ID of the person who last updated this question';



CREATE TABLE IF NOT EXISTS "public"."feedback_360_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "reviewer_email" "text" NOT NULL,
    "response_text" "text",
    "rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_360_responses_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback_360_responses" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_360_responses" IS 'Stores the actual feedback responses from reviewers';



CREATE TABLE IF NOT EXISTS "public"."feedback_360_survey_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "question_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feedback_360_survey_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_360_survey_questions" IS 'Junction table linking surveys to the specific questions used';



CREATE TABLE IF NOT EXISTS "public"."feedback_360_surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "employee_id" "uuid" NOT NULL,
    "survey_name" "text",
    "sent_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "text" NOT NULL,
    "due_date" timestamp without time zone,
    CONSTRAINT "feedback_360_surveys_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."feedback_360_surveys" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_360_surveys" IS 'Tracks 360 feedback survey sessions for employees';



COMMENT ON COLUMN "public"."feedback_360_surveys"."employee_id" IS 'The employee who is the subject of this 360 feedback survey';



COMMENT ON COLUMN "public"."feedback_360_surveys"."created_by" IS 'User ID or email of the person who created this survey (usually HR or manager)';



COMMENT ON COLUMN "public"."feedback_360_surveys"."due_date" IS 'Due date for completing the 360 feedback survey';



CREATE OR REPLACE VIEW "public"."feedback_360_question_usage_stats" AS
 SELECT "q"."id",
    "q"."question_text",
    "q"."category",
    "q"."is_default",
    "q"."created_by",
    "count"(DISTINCT "sq"."survey_id") AS "times_used",
    "max"("s"."created_at") AS "last_used_at",
    "count"(DISTINCT "r"."id") AS "total_responses"
   FROM ((("public"."feedback_360_questions" "q"
     LEFT JOIN "public"."feedback_360_survey_questions" "sq" ON (("q"."id" = "sq"."question_id")))
     LEFT JOIN "public"."feedback_360_surveys" "s" ON (("sq"."survey_id" = "s"."id")))
     LEFT JOIN "public"."feedback_360_responses" "r" ON (("q"."id" = "r"."question_id")))
  GROUP BY "q"."id", "q"."question_text", "q"."category", "q"."is_default", "q"."created_by";


ALTER VIEW "public"."feedback_360_question_usage_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."feedback_360_question_usage_stats" IS 'Provides usage statistics for each 360 feedback question';



CREATE TABLE IF NOT EXISTS "public"."feedback_360_survey_reviewers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "reviewer_email" "text" NOT NULL,
    "reviewer_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_sent_at" timestamp without time zone,
    "email_error" "text",
    "reminder_count" integer DEFAULT 0,
    "last_reminder_at" timestamp without time zone,
    "access_token" "text",
    "last_reminder_sent_at" timestamp with time zone,
    CONSTRAINT "feedback_360_survey_reviewers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."feedback_360_survey_reviewers" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_360_survey_reviewers" IS 'Tracks who was invited to provide feedback for each survey';



COMMENT ON COLUMN "public"."feedback_360_survey_reviewers"."email_sent_at" IS 'Timestamp when invitation email was sent';



COMMENT ON COLUMN "public"."feedback_360_survey_reviewers"."email_error" IS 'Error message if email sending failed';



COMMENT ON COLUMN "public"."feedback_360_survey_reviewers"."reminder_count" IS 'Number of reminder emails sent';



COMMENT ON COLUMN "public"."feedback_360_survey_reviewers"."last_reminder_at" IS 'Timestamp of most recent reminder email';



COMMENT ON COLUMN "public"."feedback_360_survey_reviewers"."access_token" IS 'Unique token for secure survey access';



CREATE TABLE IF NOT EXISTS "public"."hr_modules" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" DEFAULT 'Users'::"text" NOT NULL,
    "status" "text" DEFAULT 'coming-soon'::"text" NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "bg_gradient" "text" DEFAULT 'from-gray-50 to-slate-50'::"text" NOT NULL,
    "icon_color" "text" DEFAULT 'text-gray-400'::"text" NOT NULL,
    "display_order" integer DEFAULT 999 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hr_modules_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'coming-soon'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."hr_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ideal_team_player_matrix" (
    "id" integer NOT NULL,
    "virtue" character varying(20) NOT NULL,
    "attribute" character varying(100) NOT NULL,
    "not_living" "text" NOT NULL,
    "living" "text" NOT NULL,
    "role_modeling" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "performance_review_id" "uuid",
    CONSTRAINT "ideal_team_player_matrix_virtue_check" CHECK ((("virtue")::"text" = ANY ((ARRAY['HUMBLE'::character varying, 'HUNGRY'::character varying, 'PEOPLE SMART'::character varying])::"text"[])))
);


ALTER TABLE "public"."ideal_team_player_matrix" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ideal_team_player_matrix_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ideal_team_player_matrix_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ideal_team_player_matrix_id_seq" OWNED BY "public"."ideal_team_player_matrix"."id";



CREATE OR REPLACE VIEW "public"."pending_users" AS
 SELECT "id",
    "email",
    "full_name",
    "department",
    "title",
    "manager_email",
    "sync_method",
    "created_at" AS "synced_at",
    "date_part"('day'::"text", ("now"() - "created_at")) AS "days_since_sync"
   FROM "public"."user_profiles"
  WHERE (("has_logged_in" = false) AND ("is_active" = true))
  ORDER BY "created_at" DESC;


ALTER VIEW "public"."pending_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_review_deadlines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "performance_review_id" "uuid",
    "deadline_type" "text" NOT NULL,
    "due_date" timestamp with time zone NOT NULL,
    "reminder_days" integer[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_review_deadlines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_review_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "performance_review_id" "uuid",
    "user_id" "text" NOT NULL,
    "role" "text" DEFAULT 'employee'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "performance_review_participants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'exempt'::"text"])))
);


ALTER TABLE "public"."performance_review_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "review_type" "text" NOT NULL,
    "framework" "text" DEFAULT 'ideal_team_player'::"text" NOT NULL,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "created_by" "text",
    "settings" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "performance_reviews_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."performance_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profile_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" character varying(255) NOT NULL,
    "field" character varying(100) NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "changed_by" character varying(255),
    "change_source" character varying(50) DEFAULT 'ai_intranet_sync'::character varying
);


ALTER TABLE "public"."user_profile_changes" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_profile_changes" IS 'Audit log of changes to user profiles from AI Intranet sync';



COMMENT ON COLUMN "public"."user_profile_changes"."user_email" IS 'Email of the user whose profile was changed';



COMMENT ON COLUMN "public"."user_profile_changes"."field" IS 'Name of the field that was changed';



COMMENT ON COLUMN "public"."user_profile_changes"."old_value" IS 'Previous value of the field';



COMMENT ON COLUMN "public"."user_profile_changes"."new_value" IS 'New value of the field';



COMMENT ON COLUMN "public"."user_profile_changes"."changed_at" IS 'Timestamp when the change was made';



COMMENT ON COLUMN "public"."user_profile_changes"."changed_by" IS 'User who made the change (system for auto-sync)';



COMMENT ON COLUMN "public"."user_profile_changes"."change_source" IS 'Source of the change (ai_intranet_sync, manual, etc)';



CREATE OR REPLACE VIEW "public"."recent_profile_changes" AS
 SELECT "upc"."id",
    "upc"."user_email",
    "upc"."field",
    "upc"."old_value",
    "upc"."new_value",
    "upc"."changed_at",
    "upc"."changed_by",
    "upc"."change_source",
    "up"."full_name",
    "up"."department",
    "up"."job_title"
   FROM ("public"."user_profile_changes" "upc"
     LEFT JOIN "public"."user_profiles" "up" ON (("up"."email" = ("upc"."user_email")::"text")))
  WHERE ("upc"."changed_at" > ("now"() - '7 days'::interval))
  ORDER BY "upc"."changed_at" DESC;


ALTER VIEW "public"."recent_profile_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" character varying(50) NOT NULL,
    "sync_source" character varying(100),
    "initiated_by" character varying(255),
    "total_users" integer DEFAULT 0,
    "users_created" integer DEFAULT 0,
    "users_updated" integer DEFAULT 0,
    "users_failed" integer DEFAULT 0,
    "managers_resolved" integer DEFAULT 0,
    "orphaned_managers" "jsonb" DEFAULT '[]'::"jsonb",
    "circular_dependencies" "jsonb" DEFAULT '[]'::"jsonb",
    "errors" "jsonb" DEFAULT '[]'::"jsonb",
    "sync_start_time" timestamp with time zone NOT NULL,
    "sync_end_time" timestamp with time zone,
    "sync_duration_ms" integer,
    "status" character varying(20) DEFAULT 'running'::character varying,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sync_history" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recent_syncs" AS
 SELECT "id",
    "sync_type",
    "sync_source",
    "initiated_by",
    "total_users",
    "users_created",
    "users_updated",
    "users_failed",
    "managers_resolved",
    "jsonb_array_length"("orphaned_managers") AS "orphaned_count",
    "jsonb_array_length"("circular_dependencies") AS "circular_count",
    "jsonb_array_length"("errors") AS "error_count",
    "status",
    "sync_duration_ms",
    "created_at"
   FROM "public"."sync_history"
  WHERE ("created_at" > ("now"() - '30 days'::interval))
  ORDER BY "created_at" DESC;


ALTER VIEW "public"."recent_syncs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_profiles_idx_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_profiles_idx_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_profiles_idx_seq" OWNED BY "public"."user_profiles"."idx";



ALTER TABLE ONLY "public"."ideal_team_player_matrix" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ideal_team_player_matrix_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_profiles" ALTER COLUMN "idx" SET DEFAULT "nextval"('"public"."user_profiles_idx_seq"'::"regclass");



ALTER TABLE ONLY "public"."assessment_responses"
    ADD CONSTRAINT "assessment_responses_assessment_id_virtue_attribute_key" UNIQUE ("assessment_id", "virtue", "attribute");



ALTER TABLE ONLY "public"."assessment_responses"
    ADD CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_360_questions"
    ADD CONSTRAINT "feedback_360_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_360_responses"
    ADD CONSTRAINT "feedback_360_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_360_responses"
    ADD CONSTRAINT "feedback_360_responses_unique_response" UNIQUE ("survey_id", "question_id", "reviewer_email");



ALTER TABLE ONLY "public"."feedback_360_survey_questions"
    ADD CONSTRAINT "feedback_360_survey_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_360_survey_questions"
    ADD CONSTRAINT "feedback_360_survey_questions_survey_id_question_id_key" UNIQUE ("survey_id", "question_id");



ALTER TABLE ONLY "public"."feedback_360_survey_reviewers"
    ADD CONSTRAINT "feedback_360_survey_reviewers_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."feedback_360_survey_reviewers"
    ADD CONSTRAINT "feedback_360_survey_reviewers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_360_survey_reviewers"
    ADD CONSTRAINT "feedback_360_survey_reviewers_survey_id_reviewer_email_key" UNIQUE ("survey_id", "reviewer_email");



ALTER TABLE ONLY "public"."feedback_360_surveys"
    ADD CONSTRAINT "feedback_360_surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hr_modules"
    ADD CONSTRAINT "hr_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ideal_team_player_matrix"
    ADD CONSTRAINT "ideal_team_player_matrix_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ideal_team_player_matrix"
    ADD CONSTRAINT "ideal_team_player_matrix_virtue_attribute_key" UNIQUE ("virtue", "attribute");



ALTER TABLE ONLY "public"."performance_review_deadlines"
    ADD CONSTRAINT "performance_review_deadlines_performance_review_id_deadline_key" UNIQUE ("performance_review_id", "deadline_type");



ALTER TABLE ONLY "public"."performance_review_deadlines"
    ADD CONSTRAINT "performance_review_deadlines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_review_participants"
    ADD CONSTRAINT "performance_review_participan_performance_review_id_user_id_key" UNIQUE ("performance_review_id", "user_id", "role");



ALTER TABLE ONLY "public"."performance_review_participants"
    ADD CONSTRAINT "performance_review_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_history"
    ADD CONSTRAINT "sync_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile_changes"
    ADD CONSTRAINT "user_profile_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_auth0_id_key" UNIQUE ("auth0_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("idx");



CREATE INDEX "idx_360_questions_active" ON "public"."feedback_360_questions" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_360_questions_created_by" ON "public"."feedback_360_questions" USING "btree" ("created_by");



CREATE INDEX "idx_assessment_responses_assessment" ON "public"."assessment_responses" USING "btree" ("assessment_id");



CREATE INDEX "idx_assessment_responses_assessment_id" ON "public"."assessment_responses" USING "btree" ("assessment_id");



CREATE INDEX "idx_assessment_responses_attribute" ON "public"."assessment_responses" USING "btree" ("attribute");



CREATE INDEX "idx_assessment_responses_virtue" ON "public"."assessment_responses" USING "btree" ("virtue");



CREATE INDEX "idx_assessments_framework_type" ON "public"."assessments" USING "btree" ("framework_type");



CREATE INDEX "idx_assessments_performance_review_id" ON "public"."assessments" USING "btree" ("performance_review_id");



CREATE INDEX "idx_assessments_type" ON "public"."assessments" USING "btree" ("assessment_type");



CREATE INDEX "idx_assessments_user_id" ON "public"."assessments" USING "btree" ("user_id");



CREATE INDEX "idx_changed_at" ON "public"."user_profile_changes" USING "btree" ("changed_at");



CREATE INDEX "idx_field" ON "public"."user_profile_changes" USING "btree" ("field");



CREATE INDEX "idx_hr_modules_display_order" ON "public"."hr_modules" USING "btree" ("display_order");



CREATE INDEX "idx_hr_modules_status" ON "public"."hr_modules" USING "btree" ("status");



CREATE INDEX "idx_matrix_performance_review_id" ON "public"."ideal_team_player_matrix" USING "btree" ("performance_review_id");



CREATE INDEX "idx_matrix_virtue" ON "public"."ideal_team_player_matrix" USING "btree" ("virtue");



CREATE INDEX "idx_responses_question_id" ON "public"."feedback_360_responses" USING "btree" ("question_id");



CREATE INDEX "idx_responses_reviewer_email" ON "public"."feedback_360_responses" USING "btree" ("reviewer_email");



CREATE INDEX "idx_responses_survey_id" ON "public"."feedback_360_responses" USING "btree" ("survey_id");



CREATE INDEX "idx_reviewer_access_token" ON "public"."feedback_360_survey_reviewers" USING "btree" ("access_token");



CREATE INDEX "idx_reviewer_email" ON "public"."feedback_360_survey_reviewers" USING "btree" ("reviewer_email");



CREATE INDEX "idx_reviewer_email_status" ON "public"."feedback_360_survey_reviewers" USING "btree" ("reviewer_email", "status");



CREATE INDEX "idx_reviewer_status" ON "public"."feedback_360_survey_reviewers" USING "btree" ("status");



CREATE INDEX "idx_survey_questions_question_id" ON "public"."feedback_360_survey_questions" USING "btree" ("question_id");



CREATE INDEX "idx_survey_questions_survey_id" ON "public"."feedback_360_survey_questions" USING "btree" ("survey_id");



CREATE INDEX "idx_survey_reviewers_email" ON "public"."feedback_360_survey_reviewers" USING "btree" ("reviewer_email");



CREATE INDEX "idx_survey_reviewers_status" ON "public"."feedback_360_survey_reviewers" USING "btree" ("status");



CREATE INDEX "idx_survey_reviewers_survey_id" ON "public"."feedback_360_survey_reviewers" USING "btree" ("survey_id");



CREATE INDEX "idx_surveys_created_by" ON "public"."feedback_360_surveys" USING "btree" ("created_by");



CREATE INDEX "idx_surveys_employee_id" ON "public"."feedback_360_surveys" USING "btree" ("employee_id");



CREATE INDEX "idx_surveys_status" ON "public"."feedback_360_surveys" USING "btree" ("status");



CREATE INDEX "idx_sync_history_created_at" ON "public"."sync_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sync_history_initiated_by" ON "public"."sync_history" USING "btree" ("initiated_by");



CREATE INDEX "idx_sync_history_status" ON "public"."sync_history" USING "btree" ("status");



CREATE INDEX "idx_user_email" ON "public"."user_profile_changes" USING "btree" ("user_email");



CREATE INDEX "idx_user_profiles_auth0_id" ON "public"."user_profiles" USING "btree" ("auth0_id");



CREATE INDEX "idx_user_profiles_email" ON "public"."user_profiles" USING "btree" ("email");



CREATE INDEX "idx_user_profiles_employee_number" ON "public"."user_profiles" USING "btree" ("employee_number");



CREATE INDEX "idx_user_profiles_has_logged_in" ON "public"."user_profiles" USING "btree" ("has_logged_in");



CREATE INDEX "idx_user_profiles_is_active" ON "public"."user_profiles" USING "btree" ("is_active");



CREATE INDEX "idx_user_profiles_last_login" ON "public"."user_profiles" USING "btree" ("last_login_at" DESC);



CREATE INDEX "idx_user_profiles_manager_email" ON "public"."user_profiles" USING "btree" ("manager_email");



COMMENT ON INDEX "public"."idx_user_profiles_manager_email" IS 'Index for efficient manager email lookups when resolving manager relationships';



CREATE INDEX "idx_user_profiles_manager_id" ON "public"."user_profiles" USING "btree" ("manager_id");



CREATE INDEX "idx_user_profiles_sync_method" ON "public"."user_profiles" USING "btree" ("sync_method");



CREATE OR REPLACE VIEW "public"."active_performance_reviews" AS
 SELECT "pr"."id",
    "pr"."name",
    "pr"."description",
    "pr"."review_type",
    "pr"."framework",
    "pr"."start_date",
    "pr"."end_date",
    "pr"."status",
    "pr"."created_by",
    "pr"."settings",
    "pr"."created_at",
    "pr"."updated_at",
    "count"(DISTINCT "prp"."user_id") AS "total_participants",
    "count"(DISTINCT
        CASE
            WHEN ("prp"."status" = 'completed'::"text") THEN "prp"."user_id"
            ELSE NULL::"text"
        END) AS "completed_participants"
   FROM ("public"."performance_reviews" "pr"
     LEFT JOIN "public"."performance_review_participants" "prp" ON (("pr"."id" = "prp"."performance_review_id")))
  WHERE ("pr"."status" = 'active'::"text")
  GROUP BY "pr"."id";



CREATE OR REPLACE TRIGGER "trigger_update_360_question_timestamp" BEFORE UPDATE ON "public"."feedback_360_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_360_question_timestamp"();



CREATE OR REPLACE TRIGGER "update_360_questions_updated_at" BEFORE UPDATE ON "public"."feedback_360_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_360_responses_updated_at" BEFORE UPDATE ON "public"."feedback_360_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_360_surveys_updated_at" BEFORE UPDATE ON "public"."feedback_360_surveys" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_performance_reviews_updated_at" BEFORE UPDATE ON "public"."performance_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."assessment_responses"
    ADD CONSTRAINT "assessment_responses_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_performance_review_id_fkey" FOREIGN KEY ("performance_review_id") REFERENCES "public"."performance_reviews"("id");



ALTER TABLE ONLY "public"."feedback_360_responses"
    ADD CONSTRAINT "feedback_360_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."feedback_360_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_360_responses"
    ADD CONSTRAINT "feedback_360_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."feedback_360_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_360_survey_questions"
    ADD CONSTRAINT "feedback_360_survey_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."feedback_360_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_360_survey_questions"
    ADD CONSTRAINT "feedback_360_survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."feedback_360_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_360_survey_reviewers"
    ADD CONSTRAINT "feedback_360_survey_reviewers_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."feedback_360_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_360_surveys"
    ADD CONSTRAINT "feedback_360_surveys_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assessment_responses"
    ADD CONSTRAINT "fk_assessment_responses_assessment_id" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ideal_team_player_matrix"
    ADD CONSTRAINT "ideal_team_player_matrix_performance_review_id_fkey" FOREIGN KEY ("performance_review_id") REFERENCES "public"."performance_reviews"("id");



ALTER TABLE ONLY "public"."performance_review_deadlines"
    ADD CONSTRAINT "performance_review_deadlines_performance_review_id_fkey" FOREIGN KEY ("performance_review_id") REFERENCES "public"."performance_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_review_participants"
    ADD CONSTRAINT "performance_review_participants_performance_review_id_fkey" FOREIGN KEY ("performance_review_id") REFERENCES "public"."performance_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."user_profiles"("id");



CREATE POLICY "Admins have full access" ON "public"."user_profiles" USING ((( SELECT ("user_profiles_1"."app_permissions" ->> 'admin'::"text")
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."auth0_id" = ("auth"."uid"())::"text")) = 'true'::"text"));



CREATE POLICY "Users can read own profile and direct reports" ON "public"."user_profiles" FOR SELECT USING (((("auth"."uid"())::"text" = "auth0_id") OR (("manager_id")::"text" = ( SELECT ("user_profiles_1"."id")::"text" AS "id"
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."auth0_id" = ("auth"."uid"())::"text"))) OR (( SELECT ("user_profiles_1"."app_permissions" ->> 'admin'::"text")
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."auth0_id" = ("auth"."uid"())::"text")) = 'true'::"text")));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING ((("auth"."uid"())::"text" = "auth0_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_360_question_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_360_question_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_360_question_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."active_performance_reviews" TO "anon";
GRANT ALL ON TABLE "public"."active_performance_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."active_performance_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."active_users" TO "anon";
GRANT ALL ON TABLE "public"."active_users" TO "authenticated";
GRANT ALL ON TABLE "public"."active_users" TO "service_role";



GRANT ALL ON TABLE "public"."assessment_responses" TO "anon";
GRANT ALL ON TABLE "public"."assessment_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."assessment_responses" TO "service_role";



GRANT ALL ON TABLE "public"."assessments" TO "anon";
GRANT ALL ON TABLE "public"."assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."assessments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_360_questions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_360_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_360_questions" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_360_responses" TO "anon";
GRANT ALL ON TABLE "public"."feedback_360_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_360_responses" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_360_survey_questions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_360_survey_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_360_survey_questions" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_360_surveys" TO "anon";
GRANT ALL ON TABLE "public"."feedback_360_surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_360_surveys" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_360_question_usage_stats" TO "anon";
GRANT ALL ON TABLE "public"."feedback_360_question_usage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_360_question_usage_stats" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_360_survey_reviewers" TO "anon";
GRANT ALL ON TABLE "public"."feedback_360_survey_reviewers" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_360_survey_reviewers" TO "service_role";



GRANT ALL ON TABLE "public"."hr_modules" TO "anon";
GRANT ALL ON TABLE "public"."hr_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_modules" TO "service_role";



GRANT ALL ON TABLE "public"."ideal_team_player_matrix" TO "anon";
GRANT ALL ON TABLE "public"."ideal_team_player_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."ideal_team_player_matrix" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ideal_team_player_matrix_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ideal_team_player_matrix_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ideal_team_player_matrix_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pending_users" TO "anon";
GRANT ALL ON TABLE "public"."pending_users" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_users" TO "service_role";



GRANT ALL ON TABLE "public"."performance_review_deadlines" TO "anon";
GRANT ALL ON TABLE "public"."performance_review_deadlines" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_review_deadlines" TO "service_role";



GRANT ALL ON TABLE "public"."performance_review_participants" TO "anon";
GRANT ALL ON TABLE "public"."performance_review_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_review_participants" TO "service_role";



GRANT ALL ON TABLE "public"."performance_reviews" TO "anon";
GRANT ALL ON TABLE "public"."performance_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile_changes" TO "anon";
GRANT ALL ON TABLE "public"."user_profile_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile_changes" TO "service_role";



GRANT ALL ON TABLE "public"."recent_profile_changes" TO "anon";
GRANT ALL ON TABLE "public"."recent_profile_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_profile_changes" TO "service_role";



GRANT ALL ON TABLE "public"."sync_history" TO "anon";
GRANT ALL ON TABLE "public"."sync_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_history" TO "service_role";



GRANT ALL ON TABLE "public"."recent_syncs" TO "anon";
GRANT ALL ON TABLE "public"."recent_syncs" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_syncs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_profiles_idx_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_profiles_idx_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_profiles_idx_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
