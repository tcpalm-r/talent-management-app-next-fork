export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assessment_responses: {
        Row: {
          assessment_id: string
          attribute: string
          created_at: string | null
          id: string
          notes: string | null
          rating: number
          updated_at: string | null
          virtue: string
        }
        Insert: {
          assessment_id: string
          attribute: string
          created_at?: string | null
          id?: string
          notes?: string | null
          rating: number
          updated_at?: string | null
          virtue: string
        }
        Update: {
          assessment_id?: string
          attribute?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          rating?: number
          updated_at?: string | null
          virtue?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assessment_responses_assessment_id"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: string
          assessor_id: string | null
          created_at: string | null
          framework_type: string | null
          id: string
          performance_review_id: string | null
          status: string
          submitted_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assessment_type?: string
          assessor_id?: string | null
          created_at?: string | null
          framework_type?: string | null
          id?: string
          performance_review_id?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assessment_type?: string
          assessor_id?: string | null
          created_at?: string | null
          framework_type?: string | null
          id?: string
          performance_review_id?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "active_performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_360_questions: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          question_text: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          question_text: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          question_text?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      feedback_360_responses: {
        Row: {
          created_at: string | null
          id: string
          question_id: string
          rating: number | null
          response_text: string | null
          reviewer_email: string
          survey_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id: string
          rating?: number | null
          response_text?: string | null
          reviewer_email: string
          survey_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string
          rating?: number | null
          response_text?: string | null
          reviewer_email?: string
          survey_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_360_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_question_usage_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_360_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_360_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_360_survey_questions: {
        Row: {
          created_at: string | null
          id: string
          question_id: string
          question_order: number
          survey_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id: string
          question_order?: number
          survey_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string
          question_order?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_360_survey_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_question_usage_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_360_survey_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_360_survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_360_survey_reviewers: {
        Row: {
          access_token: string | null
          completed_at: string | null
          created_at: string | null
          email_error: string | null
          email_sent_at: string | null
          id: string
          invited_at: string | null
          last_reminder_at: string | null
          last_reminder_sent_at: string | null
          reminder_count: number | null
          reviewer_email: string
          reviewer_name: string | null
          started_at: string | null
          status: string
          survey_id: string
        }
        Insert: {
          access_token?: string | null
          completed_at?: string | null
          created_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          invited_at?: string | null
          last_reminder_at?: string | null
          last_reminder_sent_at?: string | null
          reminder_count?: number | null
          reviewer_email: string
          reviewer_name?: string | null
          started_at?: string | null
          status?: string
          survey_id: string
        }
        Update: {
          access_token?: string | null
          completed_at?: string | null
          created_at?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          invited_at?: string | null
          last_reminder_at?: string | null
          last_reminder_sent_at?: string | null
          reminder_count?: number | null
          reviewer_email?: string
          reviewer_name?: string | null
          started_at?: string | null
          status?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_360_survey_reviewers_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "feedback_360_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_360_surveys: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          due_date: string | null
          employee_id: string
          id: string
          sent_at: string | null
          status: string | null
          survey_name: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          due_date?: string | null
          employee_id: string
          id?: string
          sent_at?: string | null
          status?: string | null
          survey_name?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          due_date?: string | null
          employee_id?: string
          id?: string
          sent_at?: string | null
          status?: string | null
          survey_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_360_surveys_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_360_surveys_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_360_surveys_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_modules: {
        Row: {
          bg_gradient: string
          created_at: string
          description: string
          display_order: number
          features: Json
          icon: string
          icon_color: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          bg_gradient?: string
          created_at?: string
          description: string
          display_order?: number
          features?: Json
          icon?: string
          icon_color?: string
          id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          bg_gradient?: string
          created_at?: string
          description?: string
          display_order?: number
          features?: Json
          icon?: string
          icon_color?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ideal_team_player_matrix: {
        Row: {
          attribute: string
          created_at: string | null
          id: number
          living: string
          not_living: string
          performance_review_id: string | null
          role_modeling: string
          updated_at: string | null
          virtue: string
        }
        Insert: {
          attribute: string
          created_at?: string | null
          id?: number
          living: string
          not_living: string
          performance_review_id?: string | null
          role_modeling: string
          updated_at?: string | null
          virtue: string
        }
        Update: {
          attribute?: string
          created_at?: string | null
          id?: number
          living?: string
          not_living?: string
          performance_review_id?: string | null
          role_modeling?: string
          updated_at?: string | null
          virtue?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideal_team_player_matrix_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "active_performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideal_team_player_matrix_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_review_deadlines: {
        Row: {
          created_at: string | null
          deadline_type: string
          due_date: string
          id: string
          performance_review_id: string | null
          reminder_days: number[] | null
        }
        Insert: {
          created_at?: string | null
          deadline_type: string
          due_date: string
          id?: string
          performance_review_id?: string | null
          reminder_days?: number[] | null
        }
        Update: {
          created_at?: string | null
          deadline_type?: string
          due_date?: string
          id?: string
          performance_review_id?: string | null
          reminder_days?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_deadlines_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "active_performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_deadlines_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_review_participants: {
        Row: {
          completed_at: string | null
          id: string
          invited_at: string | null
          performance_review_id: string | null
          role: string | null
          started_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          invited_at?: string | null
          performance_review_id?: string | null
          role?: string | null
          started_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          invited_at?: string | null
          performance_review_id?: string | null
          role?: string | null
          started_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_participants_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "active_performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_participants_performance_review_id_fkey"
            columns: ["performance_review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          framework: string
          id: string
          name: string
          review_type: string
          settings: Json | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          framework?: string
          id?: string
          name: string
          review_type: string
          settings?: Json | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          framework?: string
          id?: string
          name?: string
          review_type?: string
          settings?: Json | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_history: {
        Row: {
          circular_dependencies: Json | null
          created_at: string | null
          errors: Json | null
          id: string
          initiated_by: string | null
          managers_resolved: number | null
          metadata: Json | null
          orphaned_managers: Json | null
          status: string | null
          sync_duration_ms: number | null
          sync_end_time: string | null
          sync_source: string | null
          sync_start_time: string
          sync_type: string
          total_users: number | null
          users_created: number | null
          users_failed: number | null
          users_updated: number | null
        }
        Insert: {
          circular_dependencies?: Json | null
          created_at?: string | null
          errors?: Json | null
          id?: string
          initiated_by?: string | null
          managers_resolved?: number | null
          metadata?: Json | null
          orphaned_managers?: Json | null
          status?: string | null
          sync_duration_ms?: number | null
          sync_end_time?: string | null
          sync_source?: string | null
          sync_start_time: string
          sync_type: string
          total_users?: number | null
          users_created?: number | null
          users_failed?: number | null
          users_updated?: number | null
        }
        Update: {
          circular_dependencies?: Json | null
          created_at?: string | null
          errors?: Json | null
          id?: string
          initiated_by?: string | null
          managers_resolved?: number | null
          metadata?: Json | null
          orphaned_managers?: Json | null
          status?: string | null
          sync_duration_ms?: number | null
          sync_end_time?: string | null
          sync_source?: string | null
          sync_start_time?: string
          sync_type?: string
          total_users?: number | null
          users_created?: number | null
          users_failed?: number | null
          users_updated?: number | null
        }
        Relationships: []
      }
      user_profile_changes: {
        Row: {
          change_source: string | null
          changed_at: string | null
          changed_by: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          user_email: string
        }
        Insert: {
          change_source?: string | null
          changed_at?: string | null
          changed_by?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_email: string
        }
        Update: {
          change_source?: string | null
          changed_at?: string | null
          changed_by?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_email?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          app_access: boolean | null
          app_permissions: Json | null
          app_role: string | null
          auth0_id: string | null
          avatar_url: string | null
          capabilities: Json | null
          cost_center: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          email: string
          employee_number: string | null
          external_id: string | null
          family_name: string | null
          first_login_at: string | null
          full_name: string
          given_name: string | null
          global_role: string | null
          has_logged_in: boolean | null
          id: string
          idx: number
          is_active: boolean | null
          job_title: string | null
          last_login_at: string | null
          last_sync: string | null
          last_updated_by: string | null
          local_permissions: Json | null
          location: string | null
          manager_email: string | null
          manager_id: string | null
          phone: string | null
          picture: string | null
          scim_active: boolean | null
          sync_method: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          app_access?: boolean | null
          app_permissions?: Json | null
          app_role?: string | null
          auth0_id?: string | null
          avatar_url?: string | null
          capabilities?: Json | null
          cost_center?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          email: string
          employee_number?: string | null
          external_id?: string | null
          family_name?: string | null
          first_login_at?: string | null
          full_name: string
          given_name?: string | null
          global_role?: string | null
          has_logged_in?: boolean | null
          id?: string
          idx?: number
          is_active?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          last_sync?: string | null
          last_updated_by?: string | null
          local_permissions?: Json | null
          location?: string | null
          manager_email?: string | null
          manager_id?: string | null
          phone?: string | null
          picture?: string | null
          scim_active?: boolean | null
          sync_method?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          app_access?: boolean | null
          app_permissions?: Json | null
          app_role?: string | null
          auth0_id?: string | null
          avatar_url?: string | null
          capabilities?: Json | null
          cost_center?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          email?: string
          employee_number?: string | null
          external_id?: string | null
          family_name?: string | null
          first_login_at?: string | null
          full_name?: string
          given_name?: string | null
          global_role?: string | null
          has_logged_in?: boolean | null
          id?: string
          idx?: number
          is_active?: boolean | null
          job_title?: string | null
          last_login_at?: string | null
          last_sync?: string | null
          last_updated_by?: string | null
          local_permissions?: Json | null
          location?: string | null
          manager_email?: string | null
          manager_id?: string | null
          phone?: string | null
          picture?: string | null
          scim_active?: boolean | null
          sync_method?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "active_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "pending_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_performance_reviews: {
        Row: {
          completed_participants: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          framework: string | null
          id: string | null
          name: string | null
          review_type: string | null
          settings: Json | null
          start_date: string | null
          status: string | null
          total_participants: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      active_users: {
        Row: {
          days_since_login: number | null
          department: string | null
          email: string | null
          first_login_at: string | null
          full_name: string | null
          has_logged_in: boolean | null
          id: string | null
          last_login_at: string | null
          manager_email: string | null
          title: string | null
        }
        Insert: {
          days_since_login?: never
          department?: string | null
          email?: string | null
          first_login_at?: string | null
          full_name?: string | null
          has_logged_in?: boolean | null
          id?: string | null
          last_login_at?: string | null
          manager_email?: string | null
          title?: string | null
        }
        Update: {
          days_since_login?: never
          department?: string | null
          email?: string | null
          first_login_at?: string | null
          full_name?: string | null
          has_logged_in?: boolean | null
          id?: string | null
          last_login_at?: string | null
          manager_email?: string | null
          title?: string | null
        }
        Relationships: []
      }
      feedback_360_question_usage_stats: {
        Row: {
          category: string | null
          created_by: string | null
          id: string | null
          is_default: boolean | null
          last_used_at: string | null
          question_text: string | null
          times_used: number | null
          total_responses: number | null
        }
        Relationships: []
      }
      pending_users: {
        Row: {
          days_since_sync: number | null
          department: string | null
          email: string | null
          full_name: string | null
          id: string | null
          manager_email: string | null
          sync_method: string | null
          synced_at: string | null
          title: string | null
        }
        Insert: {
          days_since_sync?: never
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          manager_email?: string | null
          sync_method?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Update: {
          days_since_sync?: never
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          manager_email?: string | null
          sync_method?: string | null
          synced_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      recent_profile_changes: {
        Row: {
          change_source: string | null
          changed_at: string | null
          changed_by: string | null
          department: string | null
          field: string | null
          full_name: string | null
          id: string | null
          job_title: string | null
          new_value: string | null
          old_value: string | null
          user_email: string | null
        }
        Relationships: []
      }
      recent_syncs: {
        Row: {
          circular_count: number | null
          created_at: string | null
          error_count: number | null
          id: string | null
          initiated_by: string | null
          managers_resolved: number | null
          orphaned_count: number | null
          status: string | null
          sync_duration_ms: number | null
          sync_source: string | null
          sync_type: string | null
          total_users: number | null
          users_created: number | null
          users_failed: number | null
          users_updated: number | null
        }
        Insert: {
          circular_count?: never
          created_at?: string | null
          error_count?: never
          id?: string | null
          initiated_by?: string | null
          managers_resolved?: number | null
          orphaned_count?: never
          status?: string | null
          sync_duration_ms?: number | null
          sync_source?: string | null
          sync_type?: string | null
          total_users?: number | null
          users_created?: number | null
          users_failed?: number | null
          users_updated?: number | null
        }
        Update: {
          circular_count?: never
          created_at?: string | null
          error_count?: never
          id?: string | null
          initiated_by?: string | null
          managers_resolved?: number | null
          orphaned_count?: never
          status?: string | null
          sync_duration_ms?: number | null
          sync_source?: string | null
          sync_type?: string | null
          total_users?: number | null
          users_created?: number | null
          users_failed?: number | null
          users_updated?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
