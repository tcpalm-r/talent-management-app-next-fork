# Supabase Operations Quick Reference - Feedback360Dashboard.tsx

## At a Glance

**Total Database Operations:** 25
**Tables Involved:** 6
**Component File:** `/components/Feedback360Dashboard.tsx`

---

## Operations by Table

### feedback_360_surveys (13 operations)
```
SELECT  (4x):
  - Load all surveys with reviewers               [Line 141-148]
  - Get single survey (raw data)                  [Line 717-721]
  - Refresh survey after status change            [Line 904-911]
  - Fetch fresh survey for modal                  [Line 1458-1465]

UPDATE  (6x):
  - Change status to "needs_review"              [Line 503-508]
  - Change status to "finalized"                 [Line 610-616]
  - Flag for admin review                        [Line 644-647]
  - Clear reanalysis flag                        [Line 675-678]
  - Send survey backward (status regression)     [Line 872-875]
  - Update status after reviewer change          [Line 993-996, 1098-1101]

DELETE  (2x):
  - Delete draft survey                          [Line 410-414]
  - Delete in-progress survey                    [Line 475-478]

INSERT  (1x):
  - Create survey                                [Survey360Wizard component]
```

### feedback_360_survey_reviewers (7 operations)
```
SELECT  (3x):
  - Get incomplete reviewers                     [Line 254-258]
  - Load all reviewers for survey                [Line 945-949]
  - Get reviewer count after modification        [Line 971-974, 1076-1079]

INSERT  (1x):
  - Add new reviewer                             [Line 1044-1055]

DELETE  (3x):
  - Delete single reviewer                       [Line 962-965]
  - Delete all reviewers (cascade)               [Line 463-466]
  - Delete reviewers on send to draft            [Line 855-858]
```

### feedback_360_responses (1 operation)
```
DELETE  (1x):
  - Delete all responses for survey              [Line 457-460]
```

### feedback_360_survey_questions (2 operations)
```
SELECT  (1x):
  - Load survey questions with details           [Line 739-748]

DELETE  (1x):
  - Delete survey questions                      [Line 469-472]
```

### feedback_360_questions (1 operation)
```
SELECT  (1x):
  - Fetched via JOIN with survey_questions       [Line 739-748]
```

### user_profiles (1 operation)
```
SELECT  (1x):
  - Get employee details                         [Line 726-730]
```

---

## Operation Summary Matrix

| Operation | Table | Type | Filters | Purpose |
|-----------|-------|------|---------|---------|
| loadSurveys | feedback_360_surveys | SELECT | org_id | Dashboard list |
| sendReminders | feedback_360_survey_reviewers | SELECT | survey_id, status!='completed' | Get incomplete |
| sendToHRForReanalysis | feedback_360_surveys | UPDATE | survey_id | Flag for reanalysis |
| deleteDraftSurvey | feedback_360_surveys | DELETE | survey_id, status='draft' | Delete draft only |
| deleteInProgressSurvey | feedback_360_surveys | DELETE | survey_id | Full cascade delete |
| loadRawSurveyData | feedback_360_surveys | SELECT | survey_id | Raw data display |
| finalizeSurvey | feedback_360_surveys | UPDATE | survey_id | Mark as finalized |
| sendToHR | feedback_360_surveys | UPDATE | survey_id | Flag for admin |
| resolveNeedsReview | feedback_360_surveys | UPDATE | survey_id | Clear reanalysis flag |
| sendBackward | feedback_360_surveys | UPDATE | survey_id | Status regression |
| loadReviewers | feedback_360_survey_reviewers | SELECT | survey_id | Load reviewers list |
| removeReviewer | feedback_360_survey_reviewers | DELETE | reviewer_id | Remove reviewer |
| addReviewer | feedback_360_survey_reviewers | INSERT | - | Add new reviewer |
| ...more | ... | ... | ... | ... |

---

## Key Functions and Their Database Operations

### loadSurveys()
- **Location:** Lines 138-249
- **Queries:**
  1. SELECT from feedback_360_surveys with nested reviewers
- **Role-Based Filtering:** YES (client-side after query)
- **Used By:** Component initialization, survey list reload

### sendReminders()
- **Location:** Lines 251-337
- **Queries:**
  1. SELECT incomplete reviewers
- **Side Effects:** Sends emails via API
- **Used By:** Reminder button on dashboard

### deleteDraftSurvey()
- **Location:** Lines 407-434
- **Queries:**
  1. DELETE with status safety check
- **Confirmation:** Required
- **Used By:** Draft survey management

### deleteInProgressSurvey()
- **Location:** Lines 436-499
- **Queries:**
  1. DELETE responses
  2. DELETE reviewers
  3. DELETE questions
  4. DELETE survey
- **Authorization Check:** YES (sponsor or admin)
- **Confirmation:** Required
- **Used By:** Survey deletion

### sendToHRForReanalysis()
- **Location:** Lines 501-545
- **Queries:**
  1. UPDATE survey status
- **Used By:** HR review workflow

### finalizeSurvey()
- **Location:** Lines 607-639
- **Queries:**
  1. UPDATE survey status and flags
- **Used By:** Complete survey review workflow

### sendToHR()
- **Location:** Lines 641-670
- **Queries:**
  1. UPDATE survey flags
- **Used By:** Flag survey for admin attention

### resolveNeedsReview()
- **Location:** Lines 672-712
- **Queries:**
  1. UPDATE clear reanalysis flag
- **Used By:** Admin workflow

### sendBackward()
- **Location:** Lines 817-941
- **Queries:**
  1. DELETE reviewers (conditional)
  2. UPDATE survey status and flags
  3. SELECT fresh survey
  4. SELECT reviewers for refresh
- **Status Transitions:**
  - finalized -> completed
  - completed -> in_progress
  - in_progress -> draft
- **Used By:** Undo/reopen workflow

### loadRawSurveyData()
- **Location:** Lines 714-779
- **Queries:**
  1. SELECT survey
  2. SELECT employee
  3. SELECT reviewers
  4. SELECT questions with details
  5. SELECT responses
- **Combined:** All data assembled in component
- **Used By:** Raw data display (debugging)

### loadReviewers()
- **Location:** Lines 943-956
- **Queries:**
  1. SELECT all reviewers
- **Used By:** Details modal initialization

### removeReviewer()
- **Location:** Lines 958-1019
- **Queries:**
  1. DELETE reviewer
  2. SELECT remaining reviewers
  3. UPDATE survey status
- **Confirmation:** Required
- **Used By:** Reviewer management

### addReviewer()
- **Location:** Lines 1033-1131
- **Queries:**
  1. INSERT new reviewer
  2. SELECT reviewers to count
  3. UPDATE survey status
- **Side Effects:**
  - Sends invitation email
  - Resets form
  - Reloads data
- **Used By:** Reviewer addition

---

## Data Flow Diagram

```
Dashboard Component
├─ useEffect: loadSurveys()
│  └─ SELECT feedback_360_surveys + reviewers
│     └─ Client-side role filtering
│        └─ setSurveys()
│
├─ Survey Card Click
│  ├─ If draft + sponsor: Open wizard for edit
│  ├─ If finalized + viewed: loadAndShowResults()
│  └─ Else: Fetch fresh survey data
│     └─ SELECT fresh survey + reviewers
│        └─ Open details modal
│
├─ Details Modal Open
│  └─ useEffect: loadReviewers()
│     └─ SELECT all reviewers
│        └─ setSurveyReviewers()
│
├─ Add Reviewer
│  ├─ INSERT new reviewer (generates token)
│  ├─ POST /api/send-survey-invitation (email)
│  ├─ SELECT reviewers to calculate status
│  └─ UPDATE survey status
│
├─ Remove Reviewer
│  ├─ DELETE reviewer
│  ├─ SELECT remaining reviewers
│  └─ UPDATE survey status
│
├─ Send Backward
│  ├─ DELETE reviewers (if in_progress -> draft)
│  ├─ UPDATE survey status + flags
│  ├─ SELECT fresh survey
│  └─ SELECT reviewers refresh
│
└─ Delete Survey
   ├─ DELETE responses
   ├─ DELETE reviewers
   ├─ DELETE questions
   └─ DELETE survey
```

---

## Query Performance Notes

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| loadSurveys | O(n) | No pagination - loads all surveys |
| sendReminders | O(r) | r = reviewers in survey |
| loadRawSurveyData | O(q+r+s) | q = questions, r = responses, s = survey |
| addReviewer | O(r) | r = reviewers after insert |
| deleteInProgressSurvey | O(r+q+s) | Cascade delete 4 tables |
| sendBackward | O(n) | Reloads all surveys |

**Optimization Opportunities:**
1. Add pagination to loadSurveys()
2. Batch reviewer operations
3. Use transactions for cascade deletes
4. Cache role filtering on server

---

## Security Considerations

| Area | Current State | Recommended |
|------|---------------|-------------|
| Auth | Client-side checks | Move to API/RLS |
| Filtering | Client-side role filtering | Server-side + RLS |
| Organization | Checked on query | Validate on server |
| Deletion | Basic checks | Add RLS policies |
| Audit | None | Add audit logging |

**High Priority:**
1. Implement Row-Level Security (RLS) for all tables
2. Move authorization to API routes
3. Validate organization_id server-side
4. Add deletion audit logging

---

## Creating API Routes

**Recommended Priority Order:**

1. **GET /api/360-surveys** - Replace loadSurveys
   - Accepts: organizationId, userId, userRole
   - Returns: Filtered surveys with role-based permissions
   - Benefits: Server-side filtering, RLS enforcement

2. **GET /api/360-surveys/[id]** - Replace survey SELECT queries
   - Accepts: surveyId, userId
   - Returns: Single survey + reviewers
   - Benefits: Authorization check, RLS

3. **PUT /api/360-surveys/[id]** - Replace UPDATE queries
   - Accepts: surveyId, updates, userId
   - Returns: Updated survey
   - Benefits: Transaction support, audit logging

4. **DELETE /api/360-surveys/[id]** - Replace DELETE queries
   - Accepts: surveyId, userId
   - Returns: Success confirmation
   - Benefits: Cascade handling, RLS

5. **POST /api/360-surveys/[id]/reviewers** - Replace addReviewer
   - Accepts: surveyId, reviewerData, userId
   - Returns: New reviewer + confirmation
   - Benefits: Email sending, transaction

6. **DELETE /api/360-surveys/[id]/reviewers/[reviewerId]** - Replace removeReviewer
   - Accepts: surveyId, reviewerId, userId
   - Returns: Success confirmation
   - Benefits: RLS enforcement

---

## File Locations

**Documentation Files (NEW):**
- `/SUPABASE_OPERATIONS_SUMMARY.md` - High-level overview
- `/SUPABASE_OPERATIONS_DETAILED.md` - Complete operation details
- `/SUPABASE_OPERATIONS_QUICK_REFERENCE.md` - This file

**Source Component:**
- `/components/Feedback360Dashboard.tsx` - Main component (2,584 lines)

**Related Components:**
- `/components/Survey360Wizard.tsx` - Survey creation
- `/components/Quick360Modal.tsx` - Quick survey
- `/components/EmployeeDetailModal.tsx` - Employee profile

**Related API Routes:**
- `/app/api/360-generate-report/route.ts` - Report generation
- `/app/api/send-survey-invitation/route.ts` - Email sending

---

