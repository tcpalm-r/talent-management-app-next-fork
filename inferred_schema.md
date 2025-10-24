# Inferred Database Schema (from Code Analysis)

**Analysis Date:** 2025-10-23
**Project:** Talent Management Next.js Application
**Database:** Supabase (PostgreSQL)
**Total Tables Identified:** 14 tables

---

## Table Inventory

Based on code analysis, the following tables were found:
1. `organizations`
2. `users`
3. `departments`
4. `employees`
5. `assessments`
6. `box_definitions`
7. `skills_library`
8. `job_description_templates`
9. `feedback_360_surveys`
10. `feedback_360_reviewers`
11. `feedback_360_templates`
12. `feedback_360_template_questions`
13. `feedback_360_question_templates`
14. `admin_activity_log`

---

## Detailed Table Schemas

### Table: `organizations`

**Purpose:** Root entity for multi-tenancy

**Fields:**
- `id`: uuid (PK)
- `name`: text
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/app/AppWrapper.tsx` → `.from('organizations').select('*')`
- `/components/OrganizationSetup.tsx` → Creates and manages organizations

**Relationships:**
- One-to-many with: departments, employees, users, assessments

---

### Table: `users`

**Purpose:** User accounts and authentication

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id, nullable)
- `email`: text (unique)
- `full_name`: text (nullable)
- `role`: text (enum: 'org_admin', 'department_manager', 'viewer')
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/QuickAuthForm.tsx` → User authentication logic

**Type Definition:** `types/index.ts:21-29`

---

### Table: `departments`

**Purpose:** Organizational departments

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `name`: text
- `color`: text (hex color code)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/Dashboard.tsx:154` → `.from('departments').select('*').eq('organization_id', organization.id).order('name')`
- `/components/DepartmentManager.tsx` → CRUD operations for departments

**Type Definition:** `types/index.ts:12-19`

**Relationships:**
- Parent: organizations (many-to-one)
- Children: employees (one-to-many)

---

### Table: `employees`

**Purpose:** Employee records and profiles

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `employee_id`: text (nullable, custom employee ID)
- `name`: text
- `email`: text (nullable)
- `department_id`: uuid (FK → departments.id, nullable)
- `manager_name`: text (nullable)
- `title`: text (nullable, job title)
- `location`: text (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz
- `job_description`: text (nullable)
- `key_responsibilities`: text[] (array, nullable)
- `required_skills`: text[] (array, nullable)
- `preferred_qualifications`: text (nullable)
- `reports_to_id`: uuid (FK → employees.id, self-referential, nullable)
- `is_critical_role`: boolean (nullable)
- `critical_role_id`: uuid (nullable)

**References:**
- `/components/Dashboard.tsx:143` → `.from('employees').select('*, department:departments(*), assessment:assessments(*), ...')`
- `/components/NineBoxGrid.tsx` → Assessment updates and employee queries
- `/components/ImportModal.tsx` → Bulk employee import
- `/components/JobDescriptionEditor.tsx` → Job description management

**Type Definition:** `types/index.ts:46-75`

**Relationships:**
- Parent: organizations (many-to-one)
- Parent: departments (many-to-one, nullable)
- Self-referential: reports_to_id (hierarchical structure)
- Children: assessments (one-to-many)
- Children: manager_notes (one-to-many, inferred)
- Children: one_on_one_meetings (one-to-many, inferred)

**Complex Queries:**
```sql
-- Dashboard employee load with relationships
SELECT *, 
  department:departments(*),
  assessment:assessments(*)
FROM employees
WHERE organization_id = ?
```

---

### Table: `assessments`

**Purpose:** Performance and potential ratings (9-box grid)

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `employee_id`: uuid (FK → employees.id)
- `performance`: text (nullable, enum: 'low', 'medium', 'high')
- `potential`: text (nullable, enum: 'low', 'medium', 'high')
- `box_key`: text (nullable, grid position key)
- `note`: text (nullable)
- `assessed_by`: text (nullable, assessor name)
- `assessed_at`: timestamptz
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/NineBoxGrid.tsx:231` → `.from('assessments').update({performance, potential, box_key, ...})`
- `/components/NineBoxGrid.tsx:252` → `.from('assessments').insert({...})`
- `/components/NineBoxGrid.tsx:280` → `.from('assessments').delete().eq('organization_id', organizationId)`

**Type Definition:** `types/index.ts:108-120`

**Relationships:**
- Parent: organizations (many-to-one)
- Parent: employees (many-to-one)

**Operations:**
- UPDATE: Performance/potential ratings
- INSERT: New assessments
- DELETE: Bulk delete by organization

---

### Table: `box_definitions`

**Purpose:** 9-box grid configuration

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id, nullable for system defaults)
- `key`: text (grid position identifier, e.g., 'high-high')
- `label`: text (display label)
- `description`: text (nullable)
- `action_hint`: text (nullable, recommended actions)
- `color`: text (hex color code)
- `grid_x`: integer (x-axis position, 0-2)
- `grid_y`: integer (y-axis position, 0-2)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/admin/BoxDefinitionsManager.tsx` → CRUD operations for box definitions
- `/hooks/useBoxDefinitions.ts` → Fetches box definitions

**Type Definition:** `types/index.ts:215-227`

**Relationships:**
- Parent: organizations (many-to-one, nullable for system defaults)

---

### Table: `skills_library`

**Purpose:** Centralized skills taxonomy for autocomplete

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `skill_name`: text
- `category`: text (enum: 'technical', 'soft_skill', 'domain_knowledge', 'certification', 'language')
- `description`: text (nullable)
- `usage_count`: integer (tracks how often used)
- `last_used_at`: timestamptz (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/lib/skillsLibrary.ts` → Skill CRUD operations and analytics
- `/components/JobDescriptionEditor.tsx` → Skill autocomplete

**Type Definition:** `types/index.ts:78-88`

**Relationships:**
- Parent: organizations (many-to-one)

**Analytics Queries:**
- Most used skills
- Skill usage trends
- Category distribution

---

### Table: `job_description_templates`

**Purpose:** Reusable job description templates

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id, nullable for system templates)
- `title`: text (template name)
- `category`: text (enum: 'engineering', 'product', 'sales', 'marketing', 'operations', 'leadership', 'support', 'finance', 'hr')
- `description_template`: text
- `responsibilities_template`: text[] (array)
- `required_skills_template`: text[] (array)
- `preferred_qualifications_template`: text (nullable)
- `is_system_template`: boolean (system vs custom)
- `is_active`: boolean
- `usage_count`: integer (tracks template usage)
- `created_by`: text (nullable, user ID)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/JobDescriptionEditor.tsx` → Template selection and application

**Type Definition:** `types/index.ts:91-106`

**Relationships:**
- Parent: organizations (many-to-one, nullable for system templates)

---

### Table: `feedback_360_surveys`

**Purpose:** 360-degree feedback surveys

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `employee_id`: uuid (FK → employees.id)
- `employee_name`: text
- `created_by`: text (user ID)
- `status`: text (enum: 'draft', 'active', 'completed', 'closed')
- `survey_title`: text
- `custom_questions`: jsonb (nullable, array of question objects)
- `due_date`: timestamptz
- `completed_at`: timestamptz (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/Feedback360Dashboard.tsx` → Survey management
- `/components/Feedback360CreateModal.tsx` → Survey creation
- `/components/Quick360Modal.tsx` → Quick survey creation

**Type Definition:** `types/index.ts:261-274`

**Relationships:**
- Parent: organizations (many-to-one)
- Parent: employees (many-to-one, subject)
- Children: feedback_360_reviewers (one-to-many)

**Complex Fields:**
- `custom_questions`: JSONB array containing:
  ```typescript
  {
    id: string,
    question: string,
    type: 'rating' | 'text' | 'multiple_choice',
    required: boolean,
    options?: string[],
    scale_min?: number,
    scale_max?: number,
    scale_labels?: { min: string, max: string }
  }
  ```

---

### Table: `feedback_360_reviewers`

**Purpose:** Participants in 360 surveys

**Fields:**
- `id`: uuid (PK)
- `survey_id`: uuid (FK → feedback_360_surveys.id)
- `participant_name`: text
- `participant_email`: text
- `relationship`: text (enum: 'manager', 'peer', 'direct_report', 'self', 'other')
- `status`: text (enum: 'pending', 'in_progress', 'completed')
- `unique_token`: text (authentication token)
- `invited_at`: timestamptz
- `completed_at`: timestamptz (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/Survey360Wizard.tsx` → Reviewer management

**Type Definition:** `types/index.ts:276-288`

**Relationships:**
- Parent: feedback_360_surveys (many-to-one)

---

### Table: `feedback_360_templates`

**Purpose:** Reusable 360 survey templates

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `template_name`: text
- `is_system_template`: boolean (system vs custom)
- `is_active`: boolean
- `usage_count`: integer
- `created_by`: text (nullable, user ID)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/Feedback360CreateModal.tsx` → Template selection

**Relationships:**
- Parent: organizations (many-to-one)
- Children: feedback_360_template_questions (one-to-many)

---

### Table: `feedback_360_template_questions`

**Purpose:** Questions in 360 templates

**Fields:**
- `id`: uuid (PK)
- `template_id`: uuid (FK → feedback_360_templates.id)
- `question`: text
- `question_type`: text (enum: 'rating', 'text', 'multiple_choice')
- `category`: text (e.g., 'leadership', 'communication')
- `order_index`: integer
- `is_required`: boolean
- `scale_min`: integer (nullable, for rating questions)
- `scale_max`: integer (nullable, for rating questions)
- `options`: jsonb (nullable, for multiple choice)
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/Feedback360CreateModal.tsx` → Question library

**Relationships:**
- Parent: feedback_360_templates (many-to-one)

---

### Table: `feedback_360_question_templates`

**Purpose:** Individual reusable questions

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id, nullable for system questions)
- `question`: text
- `question_type`: text (enum: 'rating', 'text', 'multiple_choice')
- `category`: text
- `is_system_question`: boolean
- `usage_count`: integer
- `created_at`: timestamptz
- `updated_at`: timestamptz

**References:**
- `/components/Feedback360CreateModal.tsx` → Question bank

**Relationships:**
- Parent: organizations (many-to-one, nullable for system questions)

---

### Table: `admin_activity_log`

**Purpose:** Audit trail for admin actions

**Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `user_id`: text
- `user_name`: text
- `action`: text (action type)
- `entity_type`: text (e.g., 'employee', 'department')
- `entity_id`: uuid (nullable)
- `details`: jsonb (action details)
- `ip_address`: text (nullable)
- `user_agent`: text (nullable)
- `created_at`: timestamptz

**References:**
- `/components/admin/ActivityAuditLog.tsx` → Activity logging and viewing

**Relationships:**
- Parent: organizations (many-to-one)

**Complex Fields:**
- `details`: JSONB containing action-specific data

---

## Inferred Tables (Not Directly Queried but Referenced in Types)

Based on type definitions, these tables likely exist but weren't found in direct queries:

### `manager_notes`
**Type Definition:** `types/index.ts:31-44`
**Inferred Fields:**
- `id`: uuid (PK)
- `employee_id`: uuid (FK → employees.id)
- `note`: text
- `created_by`: text
- `created_at`: timestamptz
- `updated_at`: timestamptz
- `is_private`: boolean
- `tags`: text[] (array, nullable)
- `requires_acknowledgment`: boolean (nullable)
- `acknowledged_at`: timestamptz (nullable)
- `acknowledged_by`: text (nullable)
- `severity`: text (nullable, enum: 'low', 'medium', 'high', 'critical')

### `employee_plans`
**Type Definition:** `types/index.ts:192-213`
**Inferred Fields:**
- `id`: uuid (PK)
- `employee_id`: uuid (FK → employees.id)
- `plan_type`: text (enum: 'development', 'performance_improvement', 'retention', 'succession')
- `title`: text
- `objectives`: text[] (array)
- `action_items`: jsonb (array of action item objects)
- `milestones`: jsonb (nullable, array of milestone objects)
- `timeline`: text
- `success_metrics`: text[] (array)
- `notes`: text
- `created_by`: text
- `created_at`: timestamptz
- `updated_at`: timestamptz
- `last_reviewed`: timestamptz (nullable)
- `next_review_date`: timestamptz (nullable)
- `status`: text (enum: 'active', 'completed', 'on_hold', 'cancelled')
- `progress_percentage`: integer (nullable)
- `budget_allocated`: numeric (nullable)
- `budget_spent`: numeric (nullable)
- `retention_data`: jsonb (nullable, for retention plans)

### `one_on_one_meetings`
**Type Definition:** `types/index.ts:339-352`
**Inferred Fields:**
- `id`: uuid (PK)
- `employee_id`: uuid (FK → employees.id)
- `organization_id`: uuid (FK → organizations.id)
- `manager_id`: text
- `manager_name`: text
- `meeting_date`: timestamptz
- `status`: text (enum: 'scheduled', 'in_progress', 'completed', 'cancelled')
- `duration_minutes`: integer
- `location`: text (nullable)
- `meeting_type`: text (enum: 'regular', 'performance', 'development', 'check_in', 'other')
- `created_at`: timestamptz
- `updated_at`: timestamptz

### `one_on_one_agenda_items`
**Type Definition:** `types/index.ts:354-365`
**Inferred Fields:**
- `id`: uuid (PK)
- `meeting_id`: uuid (FK → one_on_one_meetings.id)
- `title`: text
- `description`: text (nullable)
- `added_by`: text
- `order_index`: integer
- `is_completed`: boolean
- `completed_at`: timestamptz (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

### `one_on_one_shared_notes`
**Type Definition:** `types/index.ts:367-375`

### `one_on_one_private_notes`
**Type Definition:** `types/index.ts:377-386`

### `one_on_one_action_items`
**Type Definition:** `types/index.ts:388-400`

### `one_on_one_transcripts`
**Type Definition:** `types/index.ts:421-433`

### `performance_improvement_plans`
**Type Definition:** `types/index.ts:481-511`
**Inferred Fields:**
- Comprehensive PIP system with 30/60/90 day reviews
- Related tables: pip_expectations, pip_check_ins, pip_resources, pip_reminders, pip_milestone_reviews

### `critical_roles`
**Type Definition:** `types/index.ts:677-708`
**Purpose:** Succession planning - critical role definitions

### `succession_candidates`
**Type Definition:** `types/index.ts:710-748`
**Purpose:** Succession planning - candidate pipeline

### `succession_development_plans`
**Type Definition:** `types/index.ts:750-776`
**Purpose:** Development activities for succession candidates

### `succession_reviews`
**Type Definition:** `types/index.ts:778-804`
**Purpose:** Succession planning review meetings

### `knowledge_transfer_plans`
**Type Definition:** `types/index.ts:806-839`
**Purpose:** Knowledge transfer for critical roles

### `succession_analytics_snapshots`
**Type Definition:** `types/index.ts:841-873`
**Purpose:** Point-in-time succession planning metrics

### `onboarding_templates`
**Type Definition:** `types/index.ts:908-927`
**Purpose:** Reusable onboarding plan templates

### `onboarding_plans`
**Type Definition:** `types/index.ts:929-967`
**Purpose:** Employee onboarding plans (30/60/90 days)

### `onboarding_tasks`
**Type Definition:** `types/index.ts:969-1005`
**Purpose:** Tasks within onboarding plans

### `onboarding_milestones`
**Type Definition:** `types/index.ts:1007-1043`
**Purpose:** Milestone reviews (Day 1, Week 1, Day 30, etc.)

### `onboarding_stakeholder_meetings`
**Type Definition:** `types/index.ts:1045-1073`
**Purpose:** Key stakeholder introductions

### `onboarding_training_modules`
**Type Definition:** `types/index.ts:1075-1114`
**Purpose:** Training requirements and tracking

### `onboarding_feedback`
**Type Definition:** `types/index.ts:1116-1143`
**Purpose:** Feedback collection during onboarding

### `onboarding_analytics_snapshots`
**Type Definition:** `types/index.ts:1145-1181`
**Purpose:** Onboarding program metrics

### Matrix Organization Tables

### `brands`
**Type Definition:** `types/index.ts:1205-1213`
**Inferred Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `name`: text
- `color`: text
- `description`: text (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

### `sales_channels`
**Type Definition:** `types/index.ts:1215-1223`
**Inferred Fields:**
- `id`: uuid (PK)
- `organization_id`: uuid (FK → organizations.id)
- `name`: text
- `color`: text
- `description`: text (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

### `matrix_relationships`
**Type Definition:** `types/index.ts:1225-1236`
**Inferred Fields:**
- `id`: uuid (PK)
- `employee_id`: uuid (FK → employees.id)
- `manager_id`: uuid (FK → employees.id)
- `relationship_type`: text (enum: 'primary', 'brand', 'channel', 'functional')
- `entity_id`: uuid (nullable, brand_id/channel_id/department_id)
- `entity_type`: text (nullable, enum: 'brand', 'channel', 'department')
- `allocation_percentage`: integer (0-100)
- `notes`: text (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

### `employee_brands`
**Type Definition:** `types/index.ts:1238-1244`
**Inferred Fields:**
- `id`: uuid (PK)
- `employee_id`: uuid (FK → employees.id)
- `brand_id`: uuid (FK → brands.id)
- `is_primary`: boolean
- `created_at`: timestamptz

### `employee_channels`
**Type Definition:** `types/index.ts:1246-1252`
**Inferred Fields:**
- `id`: uuid (PK)
- `employee_id`: uuid (FK → employees.id)
- `channel_id`: uuid (FK → sales_channels.id)
- `is_primary`: boolean
- `created_at`: timestamptz

### `survey_360_responses`
**Type Definition:** `types/index.ts:290-298`
**Inferred Fields:**
- `id`: uuid (PK)
- `survey_id`: uuid (FK → feedback_360_surveys.id)
- `participant_id`: uuid (FK → feedback_360_reviewers.id)
- `responses`: jsonb (question_id → answer mapping)
- `submitted_at`: timestamptz
- `created_at`: timestamptz
- `updated_at`: timestamptz

### `survey_360_reports`
**Type Definition:** `types/index.ts:308-324`
**Inferred Fields:**
- `id`: uuid (PK)
- `survey_id`: uuid (FK → feedback_360_surveys.id)
- `themes`: jsonb (array of theme analysis objects)
- `overall_strengths`: text[] (array)
- `development_areas`: text[] (array)
- `recommendations`: text[] (array)
- `sentiment_by_relationship`: jsonb (relationship → score mapping)
- `key_insights`: text[] (array)
- `consensus_areas`: text[] (array)
- `outlier_opinions`: text[] (array)
- `generated_at`: timestamptz
- `generated_by`: text
- `manager_notes`: text (nullable)
- `created_at`: timestamptz
- `updated_at`: timestamptz

---

## Entity Relationship Diagram (ERD)

### Core Hierarchy
```
organizations (root)
  ├── departments
  ├── employees
  │   ├── assessments (9-box ratings)
  │   ├── manager_notes
  │   ├── employee_plans
  │   ├── one_on_one_meetings
  │   ├── feedback_360_surveys (as subject)
  │   └── self-referential (reports_to_id)
  ├── users
  ├── box_definitions
  ├── skills_library
  ├── job_description_templates
  ├── feedback_360_templates
  ├── feedback_360_question_templates
  └── admin_activity_log
```

### 360 Feedback Module
```
feedback_360_surveys
  ├── feedback_360_reviewers (participants)
  ├── survey_360_responses
  └── survey_360_reports

feedback_360_templates
  └── feedback_360_template_questions
```

### PIP Module
```
performance_improvement_plans
  ├── pip_expectations
  ├── pip_check_ins
  ├── pip_resources
  ├── pip_reminders
  └── pip_milestone_reviews
```

### Succession Planning Module
```
critical_roles
  ├── succession_candidates
  ├── succession_development_plans
  ├── succession_reviews
  ├── knowledge_transfer_plans
  └── succession_analytics_snapshots
```

### Onboarding Module
```
onboarding_templates
onboarding_plans
  ├── onboarding_tasks
  ├── onboarding_milestones
  ├── onboarding_stakeholder_meetings
  ├── onboarding_training_modules
  ├── onboarding_feedback
  └── onboarding_analytics_snapshots
```

### Matrix Organization Module
```
organizations
  ├── brands
  ├── sales_channels
  └── employees
      ├── employee_brands (many-to-many)
      ├── employee_channels (many-to-many)
      └── matrix_relationships (reporting structures)
```

---

## Key Relationships

### One-to-Many Relationships
1. **organizations → departments** (1:N)
2. **organizations → employees** (1:N)
3. **organizations → users** (1:N)
4. **departments → employees** (1:N)
5. **employees → assessments** (1:1 or 1:N)
6. **employees → manager_notes** (1:N)
7. **employees → employee_plans** (1:N)
8. **employees → one_on_one_meetings** (1:N)
9. **feedback_360_surveys → feedback_360_reviewers** (1:N)
10. **feedback_360_templates → feedback_360_template_questions** (1:N)
11. **critical_roles → succession_candidates** (1:N)
12. **onboarding_plans → onboarding_tasks** (1:N)

### Many-to-Many Relationships
1. **employees ↔ brands** (via employee_brands)
2. **employees ↔ sales_channels** (via employee_channels)
3. **employees ↔ employees** (via matrix_relationships, for matrix reporting)

### Self-Referential Relationships
1. **employees.reports_to_id → employees.id** (organizational hierarchy)
2. **matrix_relationships** (complex reporting structures)

---

## JSONB Field Structures

### feedback_360_surveys.custom_questions
```typescript
[
  {
    id: string,
    question: string,
    type: 'rating' | 'text' | 'multiple_choice',
    required: boolean,
    options?: string[],
    scale_min?: number,
    scale_max?: number,
    scale_labels?: { min: string, max: string }
  }
]
```

### employee_plans.action_items
```typescript
[
  {
    id: string,
    description: string,
    dueDate: string,
    completed: boolean,
    completedDate?: string,
    owner: string,
    priority: 'high' | 'medium' | 'low',
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'overdue',
    notes?: string,
    skillArea?: string,
    estimatedHours?: number
  }
]
```

### employee_plans.milestones
```typescript
[
  {
    id: string,
    title: string,
    targetDate: string,
    completed: boolean,
    completedDate?: string,
    description?: string
  }
]
```

### employee_plans.retention_data (for retention plans)
```typescript
{
  flight_risk_score: number,
  risk_level: 'high' | 'medium' | 'low',
  risk_factors: string[],
  stay_interview_notes: StayInterviewNote[],
  retention_strategies: RetentionStrategy[],
  ltip_details?: LTIPDetails,
  last_stay_interview?: string,
  next_stay_interview?: string,
  compensation_review_date?: string,
  career_aspirations?: string,
  concerns?: string[]
}
```

### admin_activity_log.details
```typescript
{
  // Action-specific data
  // Varies by action type
  [key: string]: any
}
```

### survey_360_responses.responses
```typescript
{
  [question_id: string]: string | number | string[]
}
```

### survey_360_reports.themes
```typescript
[
  {
    theme: string,
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed',
    frequency: number,
    supporting_quotes: string[],
    relationships_mentioned: ParticipantRelationship[]
  }
]
```

---

## Code File References by Table

### organizations
- `/app/AppWrapper.tsx:55-58` → SELECT all organizations
- `/components/OrganizationSetup.tsx` → Organization management

### departments
- `/components/Dashboard.tsx:154-158` → SELECT with organization filter and ordering
- `/components/DepartmentManager.tsx` → Full CRUD operations

### employees
- `/components/Dashboard.tsx:143-153` → Complex SELECT with joins (departments, assessments)
- `/components/NineBoxGrid.tsx` → Assessment operations
- `/components/ImportModal.tsx` → Bulk INSERT operations
- `/components/JobDescriptionEditor.tsx` → Job description updates
- `/app/AppWrapper.tsx:73-80` → INSERT with organization context

### assessments
- `/components/NineBoxGrid.tsx:231-242` → UPDATE performance/potential
- `/components/NineBoxGrid.tsx:252-262` → INSERT new assessments
- `/components/NineBoxGrid.tsx:280-283` → DELETE bulk by organization
- `/components/Dashboard.tsx` → JOIN with employees query

### box_definitions
- `/components/admin/BoxDefinitionsManager.tsx` → CRUD operations
- `/hooks/useBoxDefinitions.ts` → Fetch and cache

### skills_library
- `/lib/skillsLibrary.ts` → Full CRUD + analytics
- `/components/JobDescriptionEditor.tsx` → Autocomplete queries

### job_description_templates
- `/components/JobDescriptionEditor.tsx` → Template selection and application

### feedback_360_surveys
- `/components/Feedback360Dashboard.tsx` → Survey listing and management
- `/components/Feedback360CreateModal.tsx` → Survey creation
- `/components/Quick360Modal.tsx` → Quick survey workflow
- `/components/Dashboard.tsx:172-176` → Existence check

### feedback_360_reviewers
- `/components/Survey360Wizard.tsx` → Reviewer management

### feedback_360_templates
- `/components/Feedback360CreateModal.tsx` → Template selection

### feedback_360_template_questions
- `/components/Feedback360CreateModal.tsx` → Question library access

### feedback_360_question_templates
- `/components/Feedback360CreateModal.tsx` → Individual question selection

### admin_activity_log
- `/components/admin/ActivityAuditLog.tsx` → Activity logging and audit trail

---

## Database Patterns & Conventions

### Naming Conventions
- **Tables:** snake_case, plural nouns
- **Primary Keys:** `id` (uuid)
- **Foreign Keys:** `{table}_id` or `{relationship}_id`
- **Timestamps:** `created_at`, `updated_at` (timestamptz)
- **Soft deletes:** Not observed (hard deletes used)

### Common Patterns
1. **Multi-tenancy:** `organization_id` in most tables
2. **Timestamps:** All tables have `created_at` and `updated_at`
3. **UUIDs:** Used for all primary keys
4. **JSONB:** Used for flexible/nested data structures
5. **Arrays:** PostgreSQL arrays for lists (text[], integer[])
6. **Enums:** Stored as text with application-level validation

### Query Patterns
1. **Filtering:** `.eq('organization_id', id)` for multi-tenancy
2. **Joins:** Using Supabase's nested select syntax
3. **Ordering:** `.order('name')` or `.order('created_at', { ascending: false })`
4. **Pagination:** Not observed in code (likely loads all data)

---

## Inferred RPC Functions

No explicit RPC function calls were found in the codebase. All database operations use standard CRUD methods (.select(), .insert(), .update(), .delete()).

---

## Missing Schema Elements

Based on comprehensive type definitions but lacking database queries:

### Not Found in Code but Expected
1. **Performance Improvement Plan (PIP) tables:**
   - `performance_improvement_plans`
   - `pip_expectations`
   - `pip_check_ins`
   - `pip_resources`
   - `pip_reminders`
   - `pip_milestone_reviews`

2. **Succession Planning tables:**
   - `critical_roles`
   - `succession_candidates`
   - `succession_development_plans`
   - `succession_reviews`
   - `knowledge_transfer_plans`
   - `succession_analytics_snapshots`

3. **Onboarding tables:**
   - `onboarding_templates`
   - `onboarding_plans`
   - `onboarding_tasks`
   - `onboarding_milestones`
   - `onboarding_stakeholder_meetings`
   - `onboarding_training_modules`
   - `onboarding_feedback`
   - `onboarding_analytics_snapshots`

4. **One-on-One tables:**
   - `one_on_one_meetings`
   - `one_on_one_agenda_items`
   - `one_on_one_shared_notes`
   - `one_on_one_private_notes`
   - `one_on_one_action_items`
   - `one_on_one_transcripts`
   - `one_on_one_recordings`

5. **Matrix Organization tables:**
   - `brands`
   - `sales_channels`
   - `matrix_relationships`
   - `employee_brands`
   - `employee_channels`

6. **Survey Response tables:**
   - `survey_360_responses`
   - `survey_360_reports`

7. **Employee Plans:**
   - `employee_plans`
   - `manager_notes`

**Note:** These tables have complete TypeScript definitions but no database queries were found in the analyzed code. They may be:
- Planned features not yet implemented
- Legacy/unused features
- Handled by separate services not in this codebase

---

## Security & Access Patterns

### Row Level Security (RLS)
- Not explicitly configured in code
- Fixed organization ID used: `f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f`
- Multi-tenancy filter applied at application level via `.eq('organization_id', orgId)`

### Authentication
- Mock user approach used (`mock-user-123`)
- No Supabase Auth integration in queries
- Direct database access mode

---

## Summary Statistics

### Confirmed Tables: 14
1. organizations
2. users
3. departments
4. employees
5. assessments
6. box_definitions
7. skills_library
8. job_description_templates
9. feedback_360_surveys
10. feedback_360_reviewers
11. feedback_360_templates
12. feedback_360_template_questions
13. feedback_360_question_templates
14. admin_activity_log

### Inferred Tables (from types, not queried): ~40
Including PIP, Succession, Onboarding, One-on-One, Matrix Org, and Survey Response tables

### Total Expected Tables: ~54

### JSONB Fields: 7+
- feedback_360_surveys.custom_questions
- employee_plans.action_items
- employee_plans.milestones
- employee_plans.retention_data
- admin_activity_log.details
- survey_360_responses.responses
- survey_360_reports.themes

### Array Fields: 10+
- employees.key_responsibilities (text[])
- employees.required_skills (text[])
- employee_plans.objectives (text[])
- employee_plans.success_metrics (text[])
- manager_notes.tags (text[])
- And various other text[] fields

---

## Recommendations for Schema Verification

1. **Run this SQL to verify tables:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. **Check for missing indexes:**
   - organization_id (on all multi-tenant tables)
   - employee_id (on related tables)
   - Foreign key columns

3. **Verify JSONB structure:**
   - Validate custom_questions schema
   - Ensure action_items structure matches types

4. **Check for RLS policies:**
   - Confirm if RLS is enabled on tables
   - Verify organization isolation

---

**End of Inferred Schema Document**

Generated by analyzing:
- 119 TypeScript files
- 21 files with direct database queries
- 66 database query occurrences
- Complete type definitions from types/index.ts

For questions or discrepancies, compare against actual database schema using:
```bash
psql -h <host> -U postgres -d <database> -c "\d+ <table_name>"
```
