# Supabase Database Operations in Feedback360Dashboard.tsx

## Overview
This document lists all unique Supabase database operations found in `/Users/thomas.palmer/talent-management-next/components/Feedback360Dashboard.tsx`

---

## 1. SURVEY OPERATIONS

### 1.1 SELECT: Load All Surveys with Reviewers
**Location:** Line 141-148 (loadSurveys function)
**Table:** feedback_360_surveys + feedback_360_survey_reviewers
**Operation Type:** SELECT (with JOIN)
**Filters/Conditions:**
- `organization_id = organizationId`
- Order by `created_at` descending

**Data Fetched:**
```
All survey fields + related reviewers:
  - reviewers.id
  - reviewers.status
  - reviewers.reviewer_email
  - reviewers.access_token
```

**Purpose:** Load all surveys for the dashboard with reviewer status information

---

### 1.2 SELECT: Get Single Survey with Reviewers
**Location:** Line 717-721 (loadRawSurveyData function)
**Table:** feedback_360_surveys
**Operation Type:** SELECT
**Filters/Conditions:**
- `id = surveyId`
- `.single()` - returns single record

**Data Fetched:** All survey fields

**Purpose:** Fetch raw survey data for display in details modal

---

### 1.3 SELECT: Refresh Survey Details
**Location:** Line 904-911 (sendBackward function)
**Table:** feedback_360_surveys + feedback_360_survey_reviewers
**Operation Type:** SELECT (with JOIN)
**Filters/Conditions:**
- `id = selectedSurvey.id`
- `.single()` - returns single record

**Data Fetched:**
```
All survey fields + related reviewers:
  - reviewers.id
  - reviewers.status
  - reviewers.reviewer_email
  - reviewers.access_token
```

**Purpose:** Refresh survey data after status change to ensure UI reflects current state

---

### 1.4 SELECT: Fetch Fresh Survey for Modal
**Location:** Line 1458-1465 (onClick handler for survey cards)
**Table:** feedback_360_surveys + feedback_360_survey_reviewers
**Operation Type:** SELECT (with JOIN)
**Filters/Conditions:**
- `id = survey.id`
- `.single()` - returns single record

**Data Fetched:**
```
All survey fields + related reviewers:
  - reviewers.id
  - reviewers.status
  - reviewers.reviewer_email
  - reviewers.access_token
```

**Purpose:** Fetch fresh survey data before opening details modal to ensure accurate reviewer counts

---

### 1.5 INSERT: Create Survey (via Survey360Wizard)
**Location:** NOT IN THIS FILE - handled by Survey360Wizard component
**Table:** feedback_360_surveys
**Operation Type:** INSERT
**Data:** Created via external component

**Purpose:** Survey is created by Survey360Wizard, not directly in Dashboard

---

### 1.6 UPDATE: Change Survey Status to "needs_review"
**Location:** Line 503-508 (sendToHRForReanalysis function)
**Table:** feedback_360_surveys
**Operation Type:** UPDATE
**Filters/Conditions:**
- `id = surveyId`

**Data Modified:**
```
{
  status: 'needs_review'
}
```

**Purpose:** Flag survey for HR reanalysis

---

### 1.7 UPDATE: Change Survey Status to "finalized"
**Location:** Line 610-616 (finalizeSurvey function)
**Table:** feedback_360_surveys
**Operation Type:** UPDATE
**Filters/Conditions:**
- `id = surveyId`

**Data Modified:**
```
{
  status: 'finalized',
  flagged_for_admin: false  // Clear the "needs review" tag
}
```

**Purpose:** Finalize survey and clear admin review flag

---

### 1.8 UPDATE: Flag Survey for Admin Review
**Location:** Line 644-647 (sendToHR function)
**Table:** feedback_360_surveys
**Operation Type:** UPDATE
**Filters/Conditions:**
- `id = surveyId`

**Data Modified:**
```
{
  flagged_for_admin: true
}
```

**Purpose:** Flag survey for admin attention (keep status as completed)

---

### 1.9 UPDATE: Clear Reanalysis Flag
**Location:** Line 675-678 (resolveNeedsReview function)
**Table:** feedback_360_surveys
**Operation Type:** UPDATE
**Filters/Conditions:**
- `id = surveyId`

**Data Modified:**
```
{
  flagged_for_reanalysis: false
}
```

**Purpose:** Remove "Needs Reanalysis" tag from survey

---

### 1.10 UPDATE: Send Survey Backward (Status Regression)
**Location:** Line 872-875 (sendBackward function)
**Table:** feedback_360_surveys
**Operation Type:** UPDATE
**Filters/Conditions:**
- `id = surveyId`

**Data Modified:**
```
{
  status: targetStatus,  // 'draft', 'in_progress', or 'completed'
  flagged_for_reanalysis: false  // If moving back from completed/finalized
}
```

**Purpose:** Move survey back to a previous status (undo/reopen workflow)

---

### 1.11 UPDATE: Change Survey Status After Reviewer Added/Removed
**Location:** Line 993-996 (removeReviewer) & Line 1098-1101 (addReviewer)
**Table:** feedback_360_surveys
**Operation Type:** UPDATE
**Filters/Conditions:**
- `id = selectedSurvey.id`

**Data Modified:**
```
{
  status: newStatus  // Recalculated based on reviewer count/completion
}
```

**Purpose:** Automatically update survey status when reviewers are added or removed

---

### 1.12 DELETE: Delete Draft Survey
**Location:** Line 410-414 (deleteDraftSurvey function)
**Table:** feedback_360_surveys
**Operation Type:** DELETE
**Filters/Conditions:**
- `id = surveyId`
- `status = 'draft'` (safety constraint)

**Purpose:** Delete only draft surveys (safety measure)

---

### 1.13 DELETE: Delete In-Progress Survey (Cascade)
**Location:** Line 475-478 (deleteInProgressSurvey function)
**Table:** feedback_360_surveys
**Operation Type:** DELETE
**Filters/Conditions:**
- `id = surveyId`

**Purpose:** Delete survey (after deleting related responses, reviewers, questions)

---

---

## 2. REVIEWER OPERATIONS

### 2.1 SELECT: Get Incomplete Reviewers
**Location:** Line 254-258 (sendReminders function)
**Table:** feedback_360_survey_reviewers
**Operation Type:** SELECT
**Filters/Conditions:**
- `survey_id = surveyId`
- `status != 'completed'` (neq)

**Data Fetched:** All reviewer fields for incomplete reviewers

**Purpose:** Identify reviewers who haven't completed their feedback

---

### 2.2 SELECT: Load All Reviewers for Survey
**Location:** Line 945-949 (loadReviewers function)
**Table:** feedback_360_survey_reviewers
**Operation Type:** SELECT
**Filters/Conditions:**
- `survey_id = surveyId`
- Order by `created_at` ascending

**Data Fetched:** All reviewer fields

**Purpose:** Load reviewers into details modal

---

### 2.3 SELECT: Get Reviewer Count After Modification
**Location:** Line 971-974 (removeReviewer) & Line 1076-1079 (addReviewer)
**Table:** feedback_360_survey_reviewers
**Operation Type:** SELECT
**Filters/Conditions:**
- `survey_id = selectedSurvey.id`

**Data Fetched:**
```
{
  status
}
```

**Purpose:** Count completed vs total reviewers to determine survey status

---

### 2.4 INSERT: Add New Reviewer
**Location:** Line 1044-1055 (addReviewer function)
**Table:** feedback_360_survey_reviewers
**Operation Type:** INSERT
**Filters/Conditions:** None (new record)

**Data Inserted:**
```
{
  survey_id: selectedSurvey.id,
  reviewer_name: selectedReviewerEmployee.name,
  reviewer_email: selectedReviewerEmployee.email,
  relationship: newReviewerRelationship,
  status: 'pending',
  access_token: token
}
```

**Purpose:** Add reviewer to survey and generate access token

---

### 2.5 DELETE: Remove Reviewer from Survey
**Location:** Line 962-965 (removeReviewer function)
**Table:** feedback_360_survey_reviewers
**Operation Type:** DELETE
**Filters/Conditions:**
- `id = reviewerId`

**Purpose:** Remove specific reviewer from survey

---

### 2.6 DELETE: Delete All Reviewers for Survey
**Location:** Line 463-466 (deleteInProgressSurvey function)
**Table:** feedback_360_survey_reviewers
**Operation Type:** DELETE
**Filters/Conditions:**
- `survey_id = surveyId`

**Purpose:** Cascade delete all reviewers when survey is deleted

---

### 2.7 DELETE: Delete Reviewers When Sending to Draft
**Location:** Line 855-858 (sendBackward function)
**Table:** feedback_360_survey_reviewers
**Operation Type:** DELETE
**Filters/Conditions:**
- `survey_id = surveyId`

**Purpose:** Invalidate reviewer access links when moving survey back to draft

---

---

## 3. RESPONSE OPERATIONS

### 3.1 DELETE: Delete All Responses for Survey
**Location:** Line 457-460 (deleteInProgressSurvey function)
**Table:** feedback_360_responses
**Operation Type:** DELETE
**Filters/Conditions:**
- `survey_id = surveyId`

**Purpose:** Cascade delete all survey responses when survey is deleted

---

---

## 4. SURVEY QUESTION OPERATIONS

### 4.1 SELECT: Load Survey Questions with Question Details
**Location:** Line 739-748 (loadRawSurveyData function)
**Table:** feedback_360_survey_questions + feedback_360_questions
**Operation Type:** SELECT (with JOIN)
**Filters/Conditions:**
- `survey_id = surveyId`
- Order by `question_order`

**Data Fetched:**
```
{
  id,
  question_id,
  question_order,
  question: {
    id,
    question_text,
    category
  }
}
```

**Purpose:** Load survey questions for raw data display

---

### 4.2 DELETE: Delete Survey Questions
**Location:** Line 469-472 (deleteInProgressSurvey function)
**Table:** feedback_360_survey_questions
**Operation Type:** DELETE
**Filters/Conditions:**
- `survey_id = surveyId`

**Purpose:** Cascade delete all questions associated with survey

---

---

## 5. USER/EMPLOYEE OPERATIONS

### 5.1 SELECT: Get Employee Details
**Location:** Line 726-730 (loadRawSurveyData function)
**Table:** user_profiles
**Operation Type:** SELECT
**Filters/Conditions:**
- `id = survey.employee_id`
- `.single()` - returns single record

**Data Fetched:**
```
{
  id,
  full_name,
  email,
  title
}
```

**Purpose:** Load employee details for raw survey data display

---

---

## 6. SURVEY COMPLETION FLOW OPERATIONS

### 6.1 SELECT: Load Survey Responses
**Location:** Line 751-754 (loadRawSurveyData function)
**Table:** feedback_360_responses
**Operation Type:** SELECT
**Filters/Conditions:**
- `survey_id = surveyId`

**Data Fetched:**
```
{
  id,
  reviewer_email,
  question_id,
  response_text,
  rating
}
```

**Purpose:** Load all responses for raw data display

---

---

## SUMMARY STATISTICS

### Total Unique Database Tables Accessed: 6
1. feedback_360_surveys
2. feedback_360_survey_reviewers
3. feedback_360_responses
4. feedback_360_survey_questions
5. feedback_360_questions
6. user_profiles

### Operations by Type:
- **SELECT:** 11 operations
- **INSERT:** 1 operation
- **UPDATE:** 6 operations
- **DELETE:** 7 operations

### Total Operations: 25

### Most Frequently Accessed Table:
**feedback_360_surveys** - 13 operations

### Role-Based Filtering:
Yes - Uses `currentUser.app_role` to determine visibility:
- Admin: See all surveys
- Leader: See own surveys, subject surveys, direct report surveys, surveys where reviewer
- User: See own surveys, surveys as subject/reviewer (finalized only)

---

## RECOMMENDED API ROUTES

Based on these operations, consider creating API routes for:

1. `/api/360-surveys/list` - GET: Load all surveys (with filtering)
2. `/api/360-surveys/[id]` - GET: Load single survey details
3. `/api/360-surveys/[id]` - PUT: Update survey status/flags
4. `/api/360-surveys/[id]` - DELETE: Delete survey
5. `/api/360-surveys/[id]/reviewers` - GET: Load reviewers
6. `/api/360-surveys/[id]/reviewers` - POST: Add reviewer
7. `/api/360-surveys/[id]/reviewers/[reviewerId]` - DELETE: Remove reviewer
8. `/api/360-surveys/[id]/raw-data` - GET: Load raw survey data
9. `/api/360-surveys/[id]/reanalyze` - POST: Trigger reanalysis

---

