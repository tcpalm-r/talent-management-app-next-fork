export type Performance = 'low' | 'medium' | 'high';
export type Potential = 'low' | 'medium' | 'high';
export type UserRole = 'org_admin' | 'department_manager' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ManagerNote {
  id: string;
  employee_id: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_private: boolean;
  tags?: string[]; // e.g., ["performance", "feedback", "achievement"]
  requires_acknowledgment?: boolean; // If true, employee must acknowledge
  acknowledged_at?: string; // When employee acknowledged
  acknowledged_by?: string; // Employee name who acknowledged
  severity?: 'low' | 'medium' | 'high' | 'critical'; // Severity level for concerns
}

export interface Employee {
  id: string;
  organization_id: string;
  employee_id: string | null;
  name: string;
  email: string | null;
  department_id: string | null;
  department?: Department;
  manager_name: string | null;
  title: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  assessment?: Assessment;
  manager_notes?: ManagerNote[];
  one_on_one_meetings?: OneOnOneMeetingWithDetails[];
  is_critical_role?: boolean;
  critical_role_id?: string;
  
  // Job Description fields
  job_description?: string;
  key_responsibilities?: string[];
  required_skills?: string[];
  preferred_qualifications?: string;
  
  // Org hierarchy
  reports_to_id?: string;
  reports_to?: Employee; // Manager (populated via join)
  direct_reports?: Employee[]; // Direct reports (populated via query)
}

// Skills library for autocomplete
export interface Skill {
  id: string;
  organization_id: string;
  skill_name: string;
  category: 'technical' | 'soft_skill' | 'domain_knowledge' | 'certification' | 'language';
  description?: string;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

// Job description template
export interface JobDescriptionTemplate {
  id: string;
  organization_id?: string;
  title: string;
  category: 'engineering' | 'product' | 'sales' | 'marketing' | 'operations' | 'leadership' | 'support' | 'finance' | 'hr';
  description_template: string;
  responsibilities_template: string[];
  required_skills_template: string[];
  preferred_qualifications_template?: string;
  is_system_template: boolean;
  is_active: boolean;
  usage_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  organization_id: string;
  employee_id: string;
  performance: Performance | null;
  potential: Potential | null;
  box_key: string | null;
  note: string | null;
  assessed_by: string | null;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export type PlanType = 'development' | 'performance_improvement' | 'retention' | 'succession';
export type ActionItemPriority = 'high' | 'medium' | 'low';
export type ActionItemStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'overdue';
export type WorkingGenius = 'wonder' | 'invention' | 'discernment' | 'galvanizing' | 'enablement' | 'tenacity';

export interface ActionItem {
  id: string;
  description: string;
  dueDate: string; // ISO date string - now required for tracking
  completed: boolean;
  completedDate?: string; // ISO date when marked complete
  owner: string; // Required - who's responsible (employee, manager, HR)
  priority: ActionItemPriority;
  status: ActionItemStatus;
  notes?: string; // Progress notes or blockers
  skillArea?: string; // e.g., "Leadership", "Technical", "Communication"
  estimatedHours?: number; // Time investment needed
}

export interface PlanMilestone {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  completedDate?: string;
  description?: string;
}

// Retention Plan Specific Types
export interface StayInterviewNote {
  id: string;
  question: string;
  answer: string;
  sentiment?: 'positive' | 'neutral' | 'concerning';
  follow_up_needed: boolean;
  recorded_date: string;
}

export interface RetentionStrategy {
  id: string;
  category: 'compensation' | 'career_growth' | 'work_life_balance' | 'recognition' | 'culture';
  action: string;
  target_date: string;
  status: 'planned' | 'in_progress' | 'completed';
  owner: string;
}

export interface LTIPDetails {
  eligible: boolean;
  enrolled?: boolean;
  grant_date?: string;
  vesting_schedule?: string;
  phantom_shares?: number;
  notes?: string;
}

export interface RetentionPlanData {
  flight_risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
  risk_factors: string[];
  stay_interview_notes: StayInterviewNote[];
  retention_strategies: RetentionStrategy[];
  ltip_details?: LTIPDetails;
  last_stay_interview?: string;
  next_stay_interview?: string;
  compensation_review_date?: string;
  career_aspirations?: string;
  concerns?: string[];
}

export interface EmployeePlan {
  id: string;
  employee_id: string;
  plan_type: PlanType;
  title: string;
  objectives: string[];
  action_items: ActionItem[];
  milestones?: PlanMilestone[]; // Key checkpoints
  timeline: string;
  success_metrics: string[];
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_reviewed?: string; // Track when plan was last reviewed
  next_review_date?: string; // Schedule next check-in
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  progress_percentage?: number; // Auto-calculated from action items
  budget_allocated?: number; // Development budget
  budget_spent?: number; // Track spending
  retention_data?: RetentionPlanData; // Only populated for retention plan_type
}

export interface BoxDefinition {
  id: string;
  organization_id: string | null;
  key: string;
  label: string;
  description: string | null;
  action_hint: string | null;
  color: string;
  grid_x: number;
  grid_y: number;
  created_at: string;
  updated_at: string;
}

export interface ImportMapping {
  sourceColumn: string;
  targetField: keyof Employee | 'performance' | 'potential';
}

export interface ImportPreview {
  valid: Employee[];
  invalid: Array<{
    row: Record<string, string>;
    errors: string[];
  }>;
  duplicates: Employee[];
}

// 360 Survey Types
export type Survey360Status = 'draft' | 'active' | 'completed' | 'closed';
export type ParticipantRelationship = 'manager' | 'peer' | 'direct_report' | 'self' | 'other';
export type ParticipantStatus = 'pending' | 'in_progress' | 'completed';
export type QuestionType = 'rating' | 'text' | 'multiple_choice';
export type SentimentType = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface SurveyQuestion {
  id: string;
  question: string;
  type: QuestionType;
  required: boolean;
  options?: string[]; // for multiple_choice
  scale_min?: number; // for rating (e.g., 1)
  scale_max?: number; // for rating (e.g., 5)
  scale_labels?: { min: string; max: string }; // e.g., { min: "Poor", max: "Excellent" }
}

export interface Survey360 {
  id: string;
  organization_id?: string; // Not in DB schema, used by UI only
  employee_id: string;
  employee_name?: string; // Computed/joined field, not in DB
  created_by: string;
  status: Survey360Status;
  survey_name: string; // Actual DB column name
  survey_title?: string; // Alias for survey_name
  custom_questions?: SurveyQuestion[];
  due_date: string | null;
  sent_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Survey360Participant {
  id: string;
  survey_id: string;
  participant_name: string;
  participant_email: string;
  relationship: ParticipantRelationship;
  status: ParticipantStatus;
  access_token: string;
  invited_at: string;
  completed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Survey360Response {
  id: string;
  survey_id: string;
  participant_id: string;
  responses: Record<string, any>; // question_id -> answer
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface ThemeAnalysis {
  theme: string;
  sentiment: SentimentType;
  frequency: number; // How many participants mentioned this
  supporting_quotes: string[];
  relationships_mentioned: ParticipantRelationship[];
}

export interface Survey360Report {
  id: string;
  survey_id: string;
  themes: ThemeAnalysis[];
  overall_strengths: string[];
  development_areas: string[];
  recommendations: string[];
  sentiment_by_relationship: Record<ParticipantRelationship, number>;
  key_insights: string[];
  consensus_areas: string[]; // Areas where most participants agree
  outlier_opinions: string[]; // Unique or contrasting views
  generated_at: string;
  generated_by: string;
  manager_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Survey360WithDetails extends Survey360 {
  participants?: Survey360Participant[];
  responses?: Survey360Response[];
  report?: Survey360Report;
  response_count?: number;
  completion_percentage?: number;
}

// One-on-One Meeting Types
export type OneOnOneMeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type OneOnOneMeetingType = 'regular' | 'performance' | 'development' | 'check_in' | 'other';
export type OneOnOneActionItemStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface OneOnOneMeeting {
  id: string;
  employee_id: string;
  organization_id: string;
  manager_id: string;
  manager_name: string;
  meeting_date: string;
  status: OneOnOneMeetingStatus;
  duration_minutes: number;
  location?: string;
  meeting_type: OneOnOneMeetingType;
  created_at: string;
  updated_at: string;
}

export interface OneOnOneAgendaItem {
  id: string;
  meeting_id: string;
  title: string;
  description?: string;
  added_by: string;
  order_index: number;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OneOnOneSharedNote {
  id: string;
  meeting_id: string;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  working_genius?: WorkingGenius[];
}

export interface OneOnOnePrivateNote {
  id: string;
  meeting_id: string;
  note: string;
  created_by: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  working_genius?: WorkingGenius[];
}

export interface OneOnOneActionItem {
  id: string;
  meeting_id: string;
  title: string;
  description?: string;
  assigned_to: string;
  due_date?: string;
  status: OneOnOneActionItemStatus;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  working_genius?: WorkingGenius[];
}

export interface OneOnOneAgendaComment {
  id: string;
  agenda_item_id: string;
  meeting_id: string;
  author_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface OneOnOneMeetingComment {
  id: string;
  meeting_id: string;
  author_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface OneOnOneTranscript {
  id: string;
  meeting_id: string;
  recorded_at: string;
  tags: string[];
  content: string;
  source: 'uploaded' | 'pasted';
  file_name?: string;
  detected_format?: string;
  participants?: string[];
  warnings?: string[];
  created_at: string;
}

export interface OneOnOneMeetingRecording {
  id: string;
  meeting_id: string;
  created_by: string;
  created_at: string;
  url: string;
  duration_seconds?: number;
  mime_type?: string;
}

export interface OneOnOneMeetingSummaryInsight {
  summary: string;
  highlights: string[];
  suggested_action_items: string[];
  tone?: 'positive' | 'neutral' | 'caution';
}

export interface OneOnOneMeetingWithDetails extends OneOnOneMeeting {
  agenda_items?: OneOnOneAgendaItem[];
  shared_notes?: OneOnOneSharedNote[];
  private_notes?: OneOnOnePrivateNote[];
  action_items?: OneOnOneActionItem[];
  agenda_comments?: OneOnOneAgendaComment[];
  meeting_comments?: OneOnOneMeetingComment[];
  recordings?: OneOnOneMeetingRecording[];
  transcripts?: OneOnOneTranscript[];
  summary_insights?: OneOnOneMeetingSummaryInsight;
  employee_name?: string;
}

// ==================== Performance Improvement Plan (PIP) Types ====================

export type PIPStatus = 'active' | 'completed' | 'terminated' | 'extended';
export type PIPPhase = '30_day' | '60_day' | '90_day';
export type PIPExpectationStatus = 'pending' | 'in_progress' | 'met' | 'not_met' | 'partially_met';
export type PIPCheckInType = 'daily' | 'weekly' | 'milestone' | 'ad_hoc';
export type PIPCheckInStatus = 'on_track' | 'at_risk' | 'off_track' | 'needs_attention';
export type PIPResourceType = 'training' | 'documentation' | 'mentoring' | 'tool' | 'course' | 'book' | 'video' | 'other';
export type PIPResourceStatus = 'assigned' | 'in_progress' | 'completed' | 'skipped';
export type PIPReminderType = 'check_in' | 'milestone_review' | 'resource_due' | 'plan_ending' | 'custom';
export type PIPReminderRecipient = 'manager' | 'employee' | 'both' | 'hr';
export type PIPReminderStatus = 'pending' | 'sent' | 'dismissed';
export type PIPMilestone = '30_day' | '60_day' | '90_day';
export type PIPOverallRating = 'exceeds' | 'meets' | 'partially_meets' | 'does_not_meet';
export type PIPDecision = 'continue' | 'extend' | 'complete_success' | 'terminate' | 'escalate';

export interface PerformanceImprovementPlan {
  id: string;
  employee_id: string;
  organization_id: string;
  manager_id: string;
  manager_name: string;

  // Plan Status
  status: PIPStatus;

  // Timeline
  start_date: string;
  end_date: string;
  day_30_review_date: string;
  day_60_review_date: string;
  day_90_review_date: string;

  // Plan Details
  reason_for_pip: string;
  consequences: string;
  support_provided?: string;

  // Outcomes
  outcome?: string;
  outcome_date?: string;
  outcome_notes?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface PIPExpectation {
  id: string;
  pip_id: string;

  // Milestone Phase
  phase: PIPPhase;

  // Expectation Details
  category: string;
  expectation: string;
  success_criteria: string;

  // Status
  status: PIPExpectationStatus;
  progress_percentage: number;

  // Review
  reviewed_date?: string;
  reviewed_by?: string;
  review_notes?: string;

  // Order
  order_index: number;

  created_at: string;
  updated_at: string;
}

export interface PIPCheckIn {
  id: string;
  pip_id: string;

  // Check-in Details
  check_in_date: string;
  check_in_type: PIPCheckInType;

  // Meeting Info
  duration_minutes?: number;
  attendees?: string[];

  // Content
  progress_summary: string;
  challenges?: string;
  manager_feedback?: string;
  employee_feedback?: string;
  action_items?: string;

  // Status
  overall_status?: PIPCheckInStatus;

  // Documentation
  conducted_by: string;
  created_at: string;
  updated_at: string;
}

export interface PIPResource {
  id: string;
  pip_id: string;

  // Resource Details
  resource_type: PIPResourceType;
  title: string;
  description?: string;
  url?: string;

  // Assignment
  assigned_date: string;
  due_date?: string;

  // Status
  status: PIPResourceStatus;
  completed_date?: string;

  // Feedback
  employee_notes?: string;
  helpful_rating?: number;

  created_at: string;
  updated_at: string;
}

export interface PIPReminder {
  id: string;
  pip_id: string;

  // Reminder Details
  reminder_type: PIPReminderType;
  reminder_date: string;

  // Content
  title: string;
  message: string;

  // Recipients
  recipient_type: PIPReminderRecipient;

  // Status
  status: PIPReminderStatus;
  sent_date?: string;

  created_at: string;
}

export interface PIPMilestoneReview {
  id: string;
  pip_id: string;

  // Review Details
  milestone: PIPMilestone;
  review_date: string;
  conducted_by: string;

  // Performance Assessment
  overall_rating?: PIPOverallRating;
  progress_summary: string;

  // Strengths and Areas
  strengths?: string[];
  areas_for_improvement?: string[];

  // Expectations Met
  expectations_met: number;
  expectations_partially_met: number;
  expectations_not_met: number;

  // Decision
  decision: PIPDecision;
  decision_rationale: string;
  next_steps?: string;

  // Documentation
  employee_signature_date?: string;
  manager_signature_date?: string;
  employee_comments?: string;

  created_at: string;
  updated_at: string;
}

export interface PIPWithDetails extends PerformanceImprovementPlan {
  expectations?: PIPExpectation[];
  check_ins?: PIPCheckIn[];
  resources?: PIPResource[];
  reminders?: PIPReminder[];
  milestone_reviews?: PIPMilestoneReview[];
  employee_name?: string;
  days_remaining?: number;
  next_milestone?: string;
}

// ============================================
// SUCCESSION PLANNING TYPES
// ============================================

export type RoleLevel = 'executive' | 'vp' | 'director' | 'manager' | 'individual_contributor';
export type FlightRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReadinessTier = 'ready_now' | 'ready_soon' | 'future_pipeline' | 'emergency_backup';
export type DevelopmentActivityType = 'stretch_assignment' | 'job_rotation' | 'mentorship' | 'training' | 'executive_education' | 'special_project' | 'shadowing' | 'acting_role';
export type DevelopmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';
export type SuccessionReviewType = 'quarterly' | 'annual' | 'emergency' | 'ad_hoc';
export type SuccessionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type KnowledgeTransferStatus = 'not_started' | 'in_progress' | 'completed';

export interface CriticalRole {
  id: string;
  organization_id: string;

  role_title: string;
  department: string;
  level: RoleLevel;

  current_incumbent_id?: string;
  current_incumbent_name?: string;

  // Risk assessment
  criticality_score?: number; // 1-10
  flight_risk_level?: FlightRiskLevel;
  retirement_risk_date?: string;

  // Requirements
  key_responsibilities?: string;
  required_competencies?: string[];
  required_experience_years?: number;
  required_education?: string;

  // Succession readiness
  has_emergency_backup: boolean;
  emergency_backup_id?: string;
  emergency_backup_name?: string;

  succession_health_score?: number; // 0-100

  created_at: string;
  updated_at: string;
}

export interface SuccessionCandidate {
  id: string;
  organization_id: string;
  critical_role_id: string;

  employee_id: string;
  employee_name: string;
  current_title: string;

  // Readiness tier
  readiness_tier: ReadinessTier;

  // Readiness assessment
  readiness_percentage?: number; // 0-100
  estimated_ready_date?: string;

  // Gap analysis
  competency_gaps?: string[];
  experience_gaps?: string[];
  development_needs?: string;

  // Experience tracking
  completed_stretch_assignments: number;
  completed_rotations?: string[];
  proven_in_similar_role: boolean;

  // Notes
  strengths?: string;
  concerns?: string;
  recommendation?: string;

  // Metadata
  nominated_by?: string;
  nominated_date: string;
  last_reviewed_date?: string;

  created_at: string;
  updated_at: string;
}

export interface SuccessionDevelopmentPlan {
  id: string;
  organization_id: string;
  succession_candidate_id: string;

  activity_type: DevelopmentActivityType;

  activity_title: string;
  activity_description?: string;

  // Timeline
  start_date?: string;
  target_completion_date?: string;
  actual_completion_date?: string;

  // Progress
  status: DevelopmentStatus;
  progress_percentage: number; // 0-100

  // Impact
  competencies_developed?: string[];
  outcome_notes?: string;
  effectiveness_rating?: number; // 1-5

  created_at: string;
  updated_at: string;
}

export interface SuccessionReview {
  id: string;
  organization_id: string;
  critical_role_id: string;

  review_date: string;
  review_type: SuccessionReviewType;

  attendees?: string[];
  facilitator?: string;

  // Review outcomes
  succession_bench_strength?: number; // 1-5
  candidates_added: number;
  candidates_removed: number;
  candidates_advanced: number;

  // Decisions and actions
  key_decisions?: string;
  action_items?: string[];
  risk_level?: SuccessionRiskLevel;

  notes?: string;
  next_review_date?: string;

  created_at: string;
}

export interface KnowledgeTransferPlan {
  id: string;
  organization_id: string;
  critical_role_id: string;

  plan_name: string;

  // Transfer details
  from_employee_id?: string;
  from_employee_name?: string;
  to_employee_id?: string;
  to_employee_name?: string;

  // Timeline
  transfer_start_date?: string;
  transfer_end_date?: string;

  // Content areas
  key_relationships?: string[];
  critical_processes?: string[];
  specialized_knowledge?: string[];
  systems_and_tools?: string[];

  // Progress tracking
  status: KnowledgeTransferStatus;
  completion_percentage: number; // 0-100

  // Documentation
  documentation_links?: string[];
  transition_notes?: string;

  created_at: string;
  updated_at: string;
}

export interface SuccessionAnalyticsSnapshot {
  id: string;
  organization_id: string;

  snapshot_date: string;

  // Overall metrics
  overall_health_score?: number; // 0-100
  total_critical_roles: number;
  roles_with_successors: number;
  roles_at_risk: number;

  // Bench strength by level
  executive_bench_strength?: number; // decimal like 2.1
  vp_bench_strength?: number;
  director_bench_strength?: number;
  manager_bench_strength?: number;

  // Ready now pipeline
  ready_now_count: number;
  ready_soon_count: number;
  future_pipeline_count: number;

  // Risk indicators
  high_flight_risk_roles: number;
  retirement_risk_12_months: number;
  single_successor_roles: number;

  // Alerts
  immediate_attention_roles?: string[];

  created_at: string;
}

export interface CriticalRoleWithDetails extends CriticalRole {
  candidates?: SuccessionCandidate[];
  reviews?: SuccessionReview[];
  knowledge_transfer?: KnowledgeTransferPlan[];
  candidate_count?: number;
  ready_now_count?: number;
}

// ============================================
// ONBOARDING MODULE TYPES
// ============================================

export type OnboardingRoleLevel = 'executive' | 'manager' | 'individual_contributor' | 'intern';
export type OnboardingLocationType = 'remote' | 'hybrid' | 'in_office';
export type OnboardingStatus = 'pre_boarding' | 'active' | 'completed' | 'extended' | 'terminated';
export type OnboardingOutcome = 'successful' | 'needs_extension' | 'not_successful';
export type OnboardingPhase = 'pre_boarding' | 'day_1' | 'week_1' | 'day_30' | 'day_60' | 'day_90';
export type OnboardingTaskCategory = 'paperwork' | 'equipment' | 'training' | 'meetings' | 'deliverable' | 'review' | 'cultural' | 'systems' | 'other';
export type OnboardingTaskAssignee = 'new_hire' | 'manager' | 'buddy' | 'hr' | 'it' | 'other';
export type OnboardingTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type OnboardingTaskPriority = 'high' | 'medium' | 'low';
export type OnboardingMilestoneType = 'day_1' | 'week_1' | 'day_30' | 'day_60' | 'day_90' | 'custom';
export type OnboardingMilestoneStatus = 'upcoming' | 'in_progress' | 'completed' | 'overdue';
export type OnboardingMilestoneRating = 'exceeds_expectations' | 'meets_expectations' | 'needs_improvement' | 'concerning';
export type OnboardingRecommendation = 'on_track' | 'needs_support' | 'extend_onboarding' | 'escalate_concerns';
export type StakeholderImportance = 'critical' | 'important' | 'helpful' | 'optional';
export type StakeholderMeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'pending';
export type TrainingModuleType = 'systems' | 'compliance' | 'product' | 'process' | 'culture' | 'technical' | 'soft_skills';
export type TrainingDeliveryMethod = 'online' | 'in_person' | 'shadowing' | 'self_paced' | 'mentored';
export type TrainingModuleStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type OnboardingFeedbackType = 'manager_to_new_hire' | 'new_hire_to_manager' | 'buddy_to_manager' | 'new_hire_to_program' | 'team_to_new_hire';
export type FeedbackSentiment = 'positive' | 'neutral' | 'concern' | 'critical';

export interface OnboardingTemplate {
  id: string;
  organization_id: string;

  template_name: string;
  description?: string;

  // Customization criteria
  role_level?: OnboardingRoleLevel;
  department?: string;
  location_type?: OnboardingLocationType;

  // Template settings
  is_default: boolean;
  is_active: boolean;

  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingPlan {
  id: string;
  organization_id: string;
  template_id?: string;

  // New hire details
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  title: string;
  department: string;

  // Key people
  manager_id?: string;
  manager_name: string;
  buddy_id?: string;
  buddy_name?: string;
  hr_contact?: string;

  // Timeline
  offer_accepted_date?: string;
  start_date: string;
  day_30_date: string;
  day_60_date: string;
  day_90_date: string;

  // Status
  status: OnboardingStatus;
  current_day: number;
  completion_percentage: number;

  // Outcomes
  outcome?: OnboardingOutcome;
  outcome_notes?: string;
  outcome_date?: string;

  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  organization_id: string;
  onboarding_plan_id: string;
  template_id?: string;

  // Task details
  phase: OnboardingPhase;
  task_title: string;
  task_description?: string;
  task_category?: OnboardingTaskCategory;

  // Assignment
  assigned_to: OnboardingTaskAssignee;
  assigned_person_name?: string;

  // Timeline
  due_date?: string;
  target_day?: number;

  // Status
  status: OnboardingTaskStatus;
  completed_date?: string;
  completed_by?: string;

  // Priority and dependencies
  priority: OnboardingTaskPriority;
  is_critical: boolean;
  depends_on_task_id?: string;

  // Notes
  notes?: string;
  blocker_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface OnboardingMilestone {
  id: string;
  organization_id: string;
  onboarding_plan_id: string;

  // Milestone details
  milestone_type: OnboardingMilestoneType;
  milestone_name: string;
  target_date: string;

  // Review
  review_date?: string;
  conducted_by?: string;
  attendees?: string[];

  // Assessment
  status: OnboardingMilestoneStatus;
  overall_rating?: OnboardingMilestoneRating;

  // Content
  progress_summary?: string;
  strengths?: string[];
  areas_for_development?: string[];
  goals_for_next_phase?: string[];

  // Feedback
  manager_feedback?: string;
  new_hire_feedback?: string;
  new_hire_questions?: string;

  // Decision
  recommendation?: OnboardingRecommendation;
  action_items?: string[];

  created_at: string;
  updated_at: string;
}

export interface OnboardingStakeholderMeeting {
  id: string;
  organization_id: string;
  onboarding_plan_id: string;

  // Stakeholder details
  stakeholder_name: string;
  stakeholder_title?: string;
  stakeholder_department?: string;
  relationship_importance: StakeholderImportance;

  // Meeting details
  purpose?: string;
  suggested_topics?: string[];

  // Status
  status: StakeholderMeetingStatus;
  scheduled_date?: string;
  completed_date?: string;

  // Follow-up
  meeting_notes?: string;
  key_takeaways?: string[];
  follow_up_needed: boolean;
  follow_up_notes?: string;

  created_at: string;
  updated_at: string;
}

export interface OnboardingTrainingModule {
  id: string;
  organization_id: string;
  onboarding_plan_id: string;

  // Module details
  module_name: string;
  module_type?: TrainingModuleType;
  description?: string;

  // Delivery
  delivery_method?: TrainingDeliveryMethod;
  duration_hours?: number;

  // Resources
  resource_links?: string[];
  trainer_name?: string;

  // Timeline
  target_completion_day?: number;
  due_date?: string;

  // Status
  status: TrainingModuleStatus;
  started_date?: string;
  completed_date?: string;
  progress_percentage: number;

  // Assessment
  assessment_required: boolean;
  assessment_score?: number;
  assessment_passed?: boolean;

  // Feedback
  new_hire_rating?: number;
  new_hire_feedback?: string;

  created_at: string;
  updated_at: string;
}

export interface OnboardingFeedback {
  id: string;
  organization_id: string;
  onboarding_plan_id: string;

  // Feedback details
  feedback_type: OnboardingFeedbackType;
  feedback_date: string;

  // Source and recipient
  from_person: string;
  to_person?: string;

  // Content
  feedback_text: string;
  sentiment?: FeedbackSentiment;
  tags?: string[];

  // Action
  requires_action: boolean;
  action_taken?: string;
  action_date?: string;

  // Visibility
  is_private: boolean;

  created_at: string;
}

export interface OnboardingAnalyticsSnapshot {
  id: string;
  organization_id: string;

  snapshot_date: string;

  // Overall metrics
  total_active_onboarding: number;
  total_completed_this_quarter: number;
  average_completion_percentage?: number;
  average_time_to_productivity?: number;

  // Success metrics
  successful_completions: number;
  extended_onboarding: number;
  early_terminations: number;
  success_rate?: number;

  // Task metrics
  total_tasks_due: number;
  total_tasks_overdue: number;
  total_tasks_completed_on_time: number;
  on_time_completion_rate?: number;

  // Milestone metrics
  milestones_completed_on_time: number;
  milestones_overdue: number;

  // Manager accountability
  manager_tasks_overdue: number;
  managers_with_overdue_tasks?: string[];

  // New hire satisfaction
  average_new_hire_satisfaction?: number;

  created_at: string;
}

export interface OnboardingPlanWithDetails extends OnboardingPlan {
  tasks?: OnboardingTask[];
  milestones?: OnboardingMilestone[];
  stakeholder_meetings?: OnboardingStakeholderMeeting[];
  training_modules?: OnboardingTrainingModule[];
  feedback?: OnboardingFeedback[];

  // Computed fields
  tasks_completed?: number;
  tasks_total?: number;
  tasks_overdue?: number;
  next_milestone?: OnboardingMilestone;
  days_until_next_milestone?: number;
}

// ============================================
// MATRIX ORGANIZATION TYPES
// ============================================

export type RelationshipType = 'primary' | 'brand' | 'channel' | 'functional';
export type EntityType = 'brand' | 'channel' | 'department';

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface SalesChannel {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface MatrixRelationship {
  id: string;
  employee_id: string;
  manager_id: string;
  relationship_type: RelationshipType;
  entity_id?: string; // brand_id, channel_id, or department_id
  entity_type?: EntityType;
  allocation_percentage: number; // 0-100
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeBrand {
  id: string;
  employee_id: string;
  brand_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface EmployeeChannel {
  id: string;
  employee_id: string;
  channel_id: string;
  is_primary: boolean;
  created_at: string;
}

// Enhanced employee type with matrix organization fields
export interface MatrixEmployee extends Employee {
  primary_manager_id?: string;
  primary_manager?: Employee;

  // Multi-dimensional affiliations
  brands?: Array<Brand & { is_primary: boolean }>;
  channels?: Array<SalesChannel & { is_primary: boolean }>;

  // Matrix reporting relationships
  matrix_managers?: Array<{
    manager_id: string;
    manager_name: string;
    manager?: Employee;
    relationship_type: RelationshipType;
    entity_id?: string;
    entity_type?: EntityType;
    allocation_percentage: number;
  }>;

  // Direct reports (for org chart)
  direct_reports?: MatrixEmployee[];
  matrix_reports?: MatrixEmployee[];
}

// Org chart node for visualization
export interface OrgChartNode {
  id: string;
  employee: MatrixEmployee;
  position?: { x: number; y: number };
  level?: number; // Hierarchy level (0 = CEO, 1 = VP, etc.)
}

// Org chart edge/connection
export interface OrgChartEdge {
  id: string;
  source: string; // employee_id
  target: string; // employee_id
  type: 'primary' | 'matrix';
  relationship_type: RelationshipType;
  entity_id?: string;
  entity_type?: EntityType;
  allocation_percentage?: number;
}

// Org chart view configuration
export type OrgChartViewMode = 'functional' | 'brand' | 'channel' | 'matrix';

export interface OrgChartViewConfig {
  mode: OrgChartViewMode;
  showPrimaryLines: boolean;
  showMatrixLines: boolean;
  selectedBrandIds?: string[];
  selectedChannelIds?: string[];
  selectedDepartmentIds?: string[];
  expandedNodeIds?: string[];
}
