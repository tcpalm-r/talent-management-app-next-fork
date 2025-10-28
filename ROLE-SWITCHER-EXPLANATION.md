# Role Switcher: How It Works

## Overview
The role switcher is a development-only feature that allows you to test the 360° Feedback Dashboard as different user roles **without logging in as different users**. It only appears when running on localhost.

## Test Users

The system has 4 test users with different roles and reporting relationships:

| User | Email | Role | Title | Reports To |
|------|-------|------|-------|------------|
| Admin User [TEST] | admin.test@example.com | `admin` | Chief People Officer | - |
| Leader User [TEST] | leader.test@example.com | `leader` | Engineering Manager | Admin |
| User One [TEST] | user1.test@example.com | `user` | Senior Software Engineer | Leader |
| User Two [TEST] | user2.test@example.com | `user` | Software Engineer | Leader |

## How It Works

### 1. Role Switcher UI (Dashboard.tsx)
- **Location**: Top right of the 360 Feedback Dashboard
- **Visibility**: Only shows when `window.location.hostname === 'localhost'` (development mode)
- **Buttons**: Admin, Leader, User 1, User 2

### 2. State Management
```typescript
const [employeeOverride, setEmployeeOverride] = useState<string | null>('admin.test@example.com');
```
- Defaults to Admin role on page load
- Clicking a button updates this to the selected test user's email

### 3. Employee Resolution
```typescript
const currentUserEmployee = useMemo(() => {
  const userEmail = employeeOverride || userProfile.email;
  return employees.find(e => e.email === userEmail);
}, [employees, userProfile.email, employeeOverride]);
```
- If `employeeOverride` is set, uses that email to find the employee record
- Otherwise, falls back to the actual logged-in user's email
- This employee record is passed to Feedback360Dashboard as `currentUser`

### 4. Permission Filtering (Feedback360Dashboard.tsx)

The dashboard filters surveys based on the current user's role:

#### **Admin Role** (`role: 'admin'`)
- **Can see**: ALL surveys in the system
- **No filtering applied**
- **Use case**: HR/People Ops reviewing all feedback

#### **Leader Role** (`role: 'leader'`)
- **Can see**:
  1. Surveys they created
  2. Surveys where they are the subject/reviewee
  3. Surveys where they are a reviewer
  4. Surveys about their direct reports
- **Use case**: Managers managing their team's feedback

#### **User Role** (`role: 'user'`)
- **Can see**:
  1. Surveys they created
  2. Surveys where they are the subject/reviewee
  3. Surveys where they are a reviewer
- **Use case**: Individual contributors participating in feedback

### 5. Relationship Tags
Each survey card shows color-coded tags indicating the user's relationship:
- **Creator** (Blue): User created this survey
- **Reviewee** (Purple): User is the subject of the survey
- **Reviewer** (Green): User is providing feedback

**Note**: A user can have multiple tags on the same survey!

## Testing Scenarios

### Test 1: Admin Sees Everything
1. Click "Admin" button
2. Should see ALL surveys in the system
3. No filtering applied

### Test 2: Leader Sees Team + Own
1. Click "Leader" button
2. Should see:
   - Surveys about Leader User [TEST] (themselves)
   - Surveys about User One [TEST] (direct report)
   - Surveys about User Two [TEST] (direct report)
   - Any surveys where Leader is a reviewer
   - Any surveys Leader created

### Test 3: User Sees Only Related
1. Click "User 1" button
2. Should see:
   - Surveys about User One [TEST] (themselves)
   - Any surveys where User One is a reviewer
   - Any surveys User One created
3. Should NOT see surveys about unrelated employees

### Test 4: Multiple Roles
1. Create a survey as Admin for Leader User [TEST]
2. Add Leader User [TEST] as a reviewer on their own survey
3. Switch to "Leader" button
4. Should see tags: **Reviewee** + **Reviewer** (both tags visible)

## Implementation Details

### Key Code Locations

**Dashboard.tsx** (lines 46-58):
- `employeeOverride` state
- `currentUserEmployee` calculation
- Role switcher UI (lines 209-265)

**Feedback360Dashboard.tsx** (lines 93-149):
- Role-based filtering logic
- Admin/Leader/User permission checks

**Feedback360Dashboard.tsx** (lines 758-798):
- Survey card rendering
- Relationship tag logic (isCreator, isReviewee, isReviewer)

## Robustness Verification

The implementation is robust because:

1. **Proper employee lookup**: Uses email to find the correct employee record with role
2. **Cascading checks**: Each role check is independent and cumulative
3. **Multiple relationship support**: Tags can show multiple roles simultaneously
4. **Reporting hierarchy**: Leader role correctly checks `reports_to_id` for direct reports
5. **Creator tracking**: Surveys track both ID and email for creator matching

## Common Issues & Solutions

### Issue: Not seeing expected surveys
- **Check**: Are the test users created in your database? Run the SQL migration.
- **Check**: Is the `created_by` field set correctly on surveys?
- **Check**: Are reviewers properly linked in `feedback_360_survey_reviewers` table?

### Issue: Tags not showing
- **Check**: Is `created_by` field populated when creating surveys?
- **Check**: Are reviewer emails matching the employee email exactly?

### Issue: Leader not seeing direct reports
- **Check**: Are `reports_to_id` relationships set correctly in user_profiles?
- **Check**: Is the materialized view `employees` refreshed?
