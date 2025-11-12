# Comprehensive Supabase Operations Reference - Feedback360Dashboard.tsx

## QUICK INDEX

**6 Database Tables**
- feedback_360_surveys (13 operations)
- feedback_360_survey_reviewers (7 operations)
- feedback_360_responses (1 operation)
- feedback_360_survey_questions (2 operations)
- feedback_360_questions (1 operation)
- user_profiles (1 operation)

**25 Total Operations**
- SELECT: 11
- INSERT: 1
- UPDATE: 6
- DELETE: 7

---

## OPERATION DETAIL SHEETS

### Operation 1: LOAD ALL SURVEYS
**Function:** `loadSurveys()`
**Line:** 138-249
**Method:** SELECT
**Table:** feedback_360_surveys (+ JOIN to feedback_360_survey_reviewers)
**Authorization:** Role-based filtering applied in component

**Query Pattern:**
```typescript
const { data, error } = await supabase
  .from('feedback_360_surveys')
  .select(`
    *,
    reviewers:feedback_360_survey_reviewers(id, status, reviewer_email, access_token)
  `)
  .eq('organization_id', organizationId)
  .order('created_at', { ascending: false });
```

**Filters:**
- `organization_id = organizationId` (required)
- Ordered by created_at DESC

**Role-Based Filtering Applied After Query:**
- Admin: All surveys
- Leader: Own surveys, subject surveys, direct report surveys, reviewer surveys
- User: Own surveys, subject surveys (if finalized), reviewer surveys

**Returns:**
- Array of surveys with complete survey object + nested reviewers array
- Each reviewer has: id, status, reviewer_email, access_token

**Potential Issues:**
- No pagination - fetches all surveys at once
- Role filtering done client-side (consider server-side filtering)
- Could be large dataset for organizations with many surveys

---

### Operation 2: GET SINGLE SURVEY (Raw Data)
**Function:** `loadRawSurveyData()`
**Line:** 714-779
**Method:** SELECT
**Table:** feedback_360_surveys
**Authorization:** No server-side auth check (client assumes survey is accessible)

**Query Pattern:**
```typescript
const { data: survey, error: surveyError } = await supabase
  .from('feedback_360_surveys')
  .select('*')
  .eq('id', surveyId)
  .single();
```

**Filters:**
- `id = surveyId` (required)

**Returns:**
- Single survey object with all fields

**Used For:**
- Loading raw survey data for display/debugging
- Basis for fetching related data (employees, reviewers, questions, responses)

---

### Operation 3: REFRESH SURVEY AFTER STATUS CHANGE
**Function:** `sendBackward()`
**Line:** 904-911
**Method:** SELECT
**Table:** feedback_360_surveys (+ JOIN to feedback_360_survey_reviewers)
**Authorization:** No server-side check

**Query Pattern:**
```typescript
const { data } = await supabase
  .from('feedback_360_surveys')
  .select(`
    *,
    reviewers:feedback_360_survey_reviewers(id, status, reviewer_email, access_token)
  `)
  .eq('id', selectedSurvey.id)
  .single();
```

**Filters:**
- `id = selectedSurvey.id` (required)

**Returns:**
- Single survey with nested reviewers

**Purpose:**
- Refresh survey state after status change
- Ensures accurate reviewer counts after move backward

---

### Operation 4: FETCH SURVEY FOR MODAL
**Function:** Survey card click handler
**Line:** 1458-1465
**Method:** SELECT
**Table:** feedback_360_surveys (+ JOIN to feedback_360_survey_reviewers)
**Authorization:** No server-side check

**Query Pattern:**
```typescript
const { data } = await supabase
  .from('feedback_360_surveys')
  .select(`
    *,
    reviewers:feedback_360_survey_reviewers(id, status, reviewer_email, access_token)
  `)
  .eq('id', survey.id)
  .single();
```

**Filters:**
- `id = survey.id` (required)

**Returns:**
- Single survey with nested reviewers

**Purpose:**
- Get fresh survey data before opening details modal
- Ensures accurate completed_count for UI display

---

### Operation 5: UPDATE SURVEY STATUS TO "needs_review"
**Function:** `sendToHRForReanalysis()`
**Line:** 501-545
**Method:** UPDATE
**Table:** feedback_360_surveys
**Authorization:** No explicit check (assumes survey creator)

**Query Pattern:**
```typescript
const { error } = await supabase
  .from('feedback_360_surveys')
  .update({
    status: 'needs_review',
  })
  .eq('id', surveyId);
```

**Filters:**
- `id = surveyId` (required)

**Data Modified:**
- status: 'needs_review'

**Returns:**
- Error object (if any)

**Side Effects:**
- Updates selected survey state
- Triggers survey list reload
- Shows notification

---

### Operation 6: UPDATE SURVEY STATUS TO "finalized"
**Function:** `finalizeSurvey()`
**Line:** 607-639
**Method:** UPDATE
**Table:** feedback_360_surveys
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { error } = await supabase
  .from('feedback_360_surveys')
  .update({
    status: 'finalized',
    flagged_for_admin: false
  })
  .eq('id', surveyId);
```

**Filters:**
- `id = surveyId` (required)

**Data Modified:**
- status: 'finalized'
- flagged_for_admin: false (clears needs review tag)

**Returns:**
- Error object (if any)

**Side Effects:**
- Closes results modal
- Reloads surveys

---

### Operation 7: FLAG SURVEY FOR ADMIN REVIEW
**Function:** `sendToHR()`
**Line:** 641-670
**Method:** UPDATE
**Table:** feedback_360_surveys
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { error } = await supabase
  .from('feedback_360_surveys')
  .update({ flagged_for_admin: true })
  .eq('id', surveyId);
```

**Filters:**
- `id = surveyId` (required)

**Data Modified:**
- flagged_for_admin: true

**Returns:**
- Error object (if any)

**Purpose:**
- Mark survey for admin attention without changing status
- Used when survey is "completed" but needs review

---

### Operation 8: CLEAR REANALYSIS FLAG
**Function:** `resolveNeedsReview()`
**Line:** 672-712
**Method:** UPDATE
**Table:** feedback_360_surveys
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { error } = await supabase
  .from('feedback_360_surveys')
  .update({ flagged_for_reanalysis: false })
  .eq('id', surveyId);
```

**Filters:**
- `id = surveyId` (required)

**Data Modified:**
- flagged_for_reanalysis: false

**Returns:**
- Error object (if any)

**Purpose:**
- Remove "needs reanalysis" tag after HR has reviewed

---

### Operation 9: SEND SURVEY BACKWARD (Status Regression)
**Function:** `sendBackward()`
**Line:** 817-941
**Method:** UPDATE
**Table:** feedback_360_surveys
**Authorization:** Checks survey.created_by or admin role

**Query Pattern:**
```typescript
const updateData: any = { status: targetStatus };
if (status === 'completed' || status === 'finalized') {
  updateData.flagged_for_reanalysis = false;
}

const { error } = await supabase
  .from('feedback_360_surveys')
  .update(updateData)
  .eq('id', surveyId);
```

**Filters:**
- `id = surveyId` (required)

**Data Modified:**
- status: targetStatus (one of: 'draft', 'in_progress', 'completed')
- flagged_for_reanalysis: false (conditional)

**Returns:**
- Error object (if any)

**Status Transitions:**
- finalized -> completed
- completed -> in_progress (clears reanalysis flag)
- in_progress -> draft (deletes all reviewers first)

**Purpose:**
- Undo/reopen workflow
- Move survey back to earlier stage

---

### Operation 10: UPDATE SURVEY STATUS AFTER REVIEWER CHANGE
**Function:** `removeReviewer()` / `addReviewer()`
**Line:** 993-996, 1098-1101
**Method:** UPDATE
**Table:** feedback_360_surveys
**Authorization:** No explicit check

**Query Pattern:**
```typescript
await supabase
  .from('feedback_360_surveys')
  .update({ status: newStatus })
  .eq('id', selectedSurvey.id);
```

**Filters:**
- `id = selectedSurvey.id` (required)

**Data Modified:**
- status: newStatus (calculated based on reviewer counts)

**Logic:**
- 0 reviewers -> 'draft'
- At least 1 reviewer -> 'in_progress'

**Returns:**
- Error object (if any)

---

### Operation 11: DELETE DRAFT SURVEY
**Function:** `deleteDraftSurvey()`
**Line:** 407-434
**Method:** DELETE
**Table:** feedback_360_surveys
**Authorization:** No explicit check (assumes draft owner)

**Query Pattern:**
```typescript
const { error } = await supabase
  .from('feedback_360_surveys')
  .delete()
  .eq('id', surveyId)
  .eq('status', 'draft');
```

**Filters:**
- `id = surveyId` (required)
- `status = 'draft'` (safety constraint)

**Returns:**
- Error object (if any)

**Purpose:**
- Delete only draft surveys (prevents accidental deletion of active surveys)
- Safety measure: double-checks status before delete

**Side Effects:**
- Reloads surveys
- Shows notification

---

### Operation 12: DELETE IN-PROGRESS SURVEY (WITH CASCADE)
**Function:** `deleteInProgressSurvey()`
**Line:** 436-499
**Method:** DELETE (multiple cascade steps)
**Table:** feedback_360_responses, feedback_360_survey_reviewers, feedback_360_survey_questions, feedback_360_surveys
**Authorization:** Checks survey.created_by or admin role

**Query Pattern (Step 1):**
```typescript
await supabase
  .from('feedback_360_responses')
  .delete()
  .eq('survey_id', surveyId);
```

**Query Pattern (Step 2):**
```typescript
await supabase
  .from('feedback_360_survey_reviewers')
  .delete()
  .eq('survey_id', surveyId);
```

**Query Pattern (Step 3):**
```typescript
await supabase
  .from('feedback_360_survey_questions')
  .delete()
  .eq('survey_id', surveyId);
```

**Query Pattern (Step 4):**
```typescript
const { error } = await supabase
  .from('feedback_360_surveys')
  .delete()
  .eq('id', surveyId);
```

**Cascade Order:**
1. Delete all responses
2. Delete all reviewers
3. Delete all questions
4. Delete survey

**Returns:**
- Error object from final survey delete

**Purpose:**
- Complete cleanup of survey and all related data
- Prevents orphaned records

---

### Operation 13: GET INCOMPLETE REVIEWERS
**Function:** `sendReminders()`
**Line:** 251-337
**Method:** SELECT
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data: reviewers, error } = await supabase
  .from('feedback_360_survey_reviewers')
  .select('*')
  .eq('survey_id', surveyId)
  .neq('status', 'completed');
```

**Filters:**
- `survey_id = surveyId` (required)
- `status != 'completed'` (only incomplete reviewers)

**Returns:**
- Array of reviewer objects with all fields

**Purpose:**
- Identify reviewers who haven't completed survey
- Used for sending reminder emails

---

### Operation 14: LOAD ALL REVIEWERS FOR SURVEY
**Function:** `loadReviewers()`
**Line:** 943-956
**Method:** SELECT
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data, error } = await supabase
  .from('feedback_360_survey_reviewers')
  .select('*')
  .eq('survey_id', surveyId)
  .order('created_at', { ascending: true });
```

**Filters:**
- `survey_id = surveyId` (required)
- Ordered by created_at ASC

**Returns:**
- Array of all reviewer objects

**Purpose:**
- Load reviewers into details modal
- Display in reviewers list

---

### Operation 15: GET REVIEWER COUNT AFTER MODIFICATION
**Function:** `removeReviewer()` / `addReviewer()`
**Line:** 971-974, 1076-1079
**Method:** SELECT
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data: allReviewers } = await supabase
  .from('feedback_360_survey_reviewers')
  .select('status')
  .eq('survey_id', selectedSurvey.id);
```

**Filters:**
- `survey_id = selectedSurvey.id` (required)

**Data Fetched:**
- Only status field

**Returns:**
- Array of reviewer status values

**Purpose:**
- Calculate completed vs total reviewers
- Determine survey status after reviewer add/remove

**Logic:**
```
completedCount = reviewers.filter(r => r.status === 'completed').length
totalCount = reviewers.length

if (completedCount === totalCount && completedCount > 0) -> 'in_progress'
else if (completedCount > 0) -> 'in_progress'
else if (totalCount > 0) -> 'in_progress'
```

---

### Operation 16: ADD NEW REVIEWER
**Function:** `addReviewer()`
**Line:** 1033-1131
**Method:** INSERT
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data, error } = await supabase
  .from('feedback_360_survey_reviewers')
  .insert({
    survey_id: selectedSurvey.id,
    reviewer_name: selectedReviewerEmployee.name || '',
    reviewer_email: selectedReviewerEmployee.email || '',
    relationship: newReviewerRelationship,
    status: 'pending',
    access_token: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  } as any)
  .select()
  .single();
```

**Filters:**
- None (new record)

**Data Inserted:**
- survey_id: From selected survey
- reviewer_name: From selected employee
- reviewer_email: From selected employee
- relationship: One of: 'peer', 'manager', 'direct_report', 'mentor', etc.
- status: 'pending' (initial status)
- access_token: Generated UUID

**Returns:**
- Newly created reviewer object

**Side Effects:**
- Sends invitation email via `/api/send-survey-invitation`
- Recalculates survey status
- Updates reviewer list
- Reloads surveys

---

### Operation 17: DELETE SINGLE REVIEWER
**Function:** `removeReviewer()`
**Line:** 958-1019
**Method:** DELETE
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { error } = await supabase
  .from('feedback_360_survey_reviewers')
  .delete()
  .eq('id', reviewerId);
```

**Filters:**
- `id = reviewerId` (required)

**Returns:**
- Error object (if any)

**Side Effects:**
- Recalculates survey status
- Reloads reviewers
- Reloads surveys

**Confirmation:**
- Requires user confirmation dialog

---

### Operation 18: DELETE ALL REVIEWERS (Cascade)
**Function:** `deleteInProgressSurvey()`
**Line:** 463-466
**Method:** DELETE
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
await supabase
  .from('feedback_360_survey_reviewers')
  .delete()
  .eq('survey_id', surveyId);
```

**Filters:**
- `survey_id = surveyId` (required)

**Returns:**
- Error object (if any)

**Purpose:**
- Clean up all reviewers when survey is deleted

---

### Operation 19: DELETE REVIEWERS ON SEND TO DRAFT
**Function:** `sendBackward()`
**Line:** 855-858
**Method:** DELETE
**Table:** feedback_360_survey_reviewers
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { error: deleteError } = await supabase
  .from('feedback_360_survey_reviewers')
  .delete()
  .eq('survey_id', surveyId);
```

**Filters:**
- `survey_id = surveyId` (required)

**Returns:**
- Error object (if any)

**Purpose:**
- Invalidate all reviewer access links when moving survey back to draft
- Prevents reviewers from accessing survey they shouldn't

**Logic:**
- Only deletes when moving in_progress -> draft
- Called with: `deleteParticipants = false` (but variable exists for future use)

---

### Operation 20: DELETE ALL RESPONSES
**Function:** `deleteInProgressSurvey()`
**Line:** 457-460
**Method:** DELETE
**Table:** feedback_360_responses
**Authorization:** No explicit check

**Query Pattern:**
```typescript
await supabase
  .from('feedback_360_responses')
  .delete()
  .eq('survey_id', surveyId);
```

**Filters:**
- `survey_id = surveyId` (required)

**Returns:**
- Error object (if any)

**Purpose:**
- Clean up all survey responses when survey is deleted

---

### Operation 21: LOAD SURVEY QUESTIONS WITH DETAILS
**Function:** `loadRawSurveyData()`
**Line:** 739-748
**Method:** SELECT
**Table:** feedback_360_survey_questions + feedback_360_questions (JOIN)
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data: surveyQuestions } = await supabase
  .from('feedback_360_survey_questions')
  .select(`
    id,
    question_id,
    question_order,
    question:feedback_360_questions(id, question_text, category)
  `)
  .eq('survey_id', surveyId)
  .order('question_order');
```

**Filters:**
- `survey_id = surveyId` (required)
- Ordered by question_order ASC

**Data Fetched:**
- id: Question assignment ID
- question_id: Reference to feedback_360_questions
- question_order: Display order
- question: Related question object with text and category

**Returns:**
- Array of survey questions with nested question details

**Purpose:**
- Load all questions for survey
- Display with full question text for raw data view

---

### Operation 22: DELETE SURVEY QUESTIONS
**Function:** `deleteInProgressSurvey()`
**Line:** 469-472
**Method:** DELETE
**Table:** feedback_360_survey_questions
**Authorization:** No explicit check

**Query Pattern:**
```typescript
await supabase
  .from('feedback_360_survey_questions')
  .delete()
  .eq('survey_id', surveyId);
```

**Filters:**
- `survey_id = surveyId` (required)

**Returns:**
- Error object (if any)

**Purpose:**
- Clean up all questions when survey is deleted

---

### Operation 23: GET EMPLOYEE DETAILS
**Function:** `loadRawSurveyData()`
**Line:** 726-730
**Method:** SELECT
**Table:** user_profiles
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data: employee } = await supabase
  .from('user_profiles')
  .select('id, full_name, email, title')
  .eq('id', survey.employee_id)
  .single();
```

**Filters:**
- `id = survey.employee_id` (required)

**Data Fetched:**
- id
- full_name
- email
- title

**Returns:**
- Single employee object

**Purpose:**
- Load employee details for raw survey data display

---

### Operation 24: LOAD SURVEY RESPONSES
**Function:** `loadRawSurveyData()`
**Line:** 751-754
**Method:** SELECT
**Table:** feedback_360_responses
**Authorization:** No explicit check

**Query Pattern:**
```typescript
const { data: responses } = await supabase
  .from('feedback_360_responses')
  .select('id, reviewer_email, question_id, response_text, rating')
  .eq('survey_id', surveyId);
```

**Filters:**
- `survey_id = surveyId` (required)

**Data Fetched:**
- id
- reviewer_email
- question_id
- response_text
- rating

**Returns:**
- Array of response objects

**Purpose:**
- Load all responses for raw data display
- Combined with reviewers and questions for full data view

---

## SECURITY NOTES

**Authorization Gaps:**
1. No server-side authorization checks - all rely on client-side logic
2. No row-level security (RLS) policies mentioned
3. Organization filtering only on load (not enforced at DB level)
4. Recommend implementing RLS policies to prevent data leakage

**Recommended Improvements:**
1. Move authorization checks to API routes
2. Implement Supabase RLS policies
3. Add audit logging for sensitive operations
4. Validate organization_id on server
5. Check user role/permissions server-side for deletions

---

## PERFORMANCE CONSIDERATIONS

**Potential Bottlenecks:**
1. No pagination on survey list (O(n) for all surveys)
2. Multiple SELECT queries in cascade delete (4 queries)
3. Client-side role filtering (large datasets could be slow)
4. No query caching between operations

**Recommendations:**
1. Implement pagination for survey list
2. Use database transactions for cascade deletes
3. Move filtering to server-side
4. Add query result caching
5. Consider batch operations for multiple reviewer operations

---

