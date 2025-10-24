# Schema Mapping: Inferred (frontend) → Actual (Supabase)

## Tables
| Inferred | Actual | Notes |
|-----------|---------|-------|
| user_profiles | user_profiles | same schema |
| performance_reviews | performance_reviews | same schema |
| performance_participants | performance_review_participants | rename |
| feedback_responses | feedback_360_responses | expanded prefix |
| feedback_reviewers | feedback_360_survey_reviewers | expanded prefix |
| feedback_surveys | feedback_360_surveys | expanded prefix |
| team_matrix | ideal_team_player_matrix | rename |
| user_logs | user_profile_changes | renamed; contains audit data |
| sync_logs | sync_history | renamed; purpose identical |

## Columns (Common Adjustments)
- manager_email → manager_id (type: text → uuid)
- title → job_title (text → text)
- reviewer_token → access_token (text → text)
- performance_id → performance_review_id (uuid)
- last_reminder → last_reminder_at (timestamptz)
