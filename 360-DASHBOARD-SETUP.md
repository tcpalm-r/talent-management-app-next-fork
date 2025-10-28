# 360 Dashboard Role-Based Access Setup

## Overview
The 360 Feedback Dashboard now supports role-based access control with three user types:

1. **Admin** - Can view all 360 reviews in the organization
2. **Leader** - Can view:
   - Their own 360 reviews (as reviewee)
   - 360 reviews where they are a reviewer
   - 360 reviews of their direct reports
3. **User** - Can view:
   - Their own 360 reviews (as reviewee)
   - 360 reviews where they are a reviewer

## Setup Instructions

### 1. Run the Database Migration

Execute the SQL migration file in your Supabase SQL Editor:

```bash
# File location:
supabase-add-employee-roles.sql
```

This migration will:
- Add a `role` column to the `employees` table with values: 'admin', 'leader', or 'user'
- Create 4 test employees with appropriate roles and reporting relationships:
  - Admin User [TEST] - admin@example.com (role: admin)
  - Leader User [TEST] - leader.test@example.com (role: leader)
  - User One [TEST] - user1.test@example.com (role: user)
  - User Two [TEST] - user2.test@example.com (role: user)

**Important:** The two users report to the leader, and the leader reports to the admin.

### 2. Test with the Development Switchers

When running on localhost, you'll see two switcher panels in the top right:

#### **Test as:** (Role Switcher)
- Switch between Admin/Leader/User roles
- This controls overall application permissions

#### **360 as:** (Employee Switcher)
- Switch between Admin/Leader/User1/User2 test employees
- This controls which employee's perspective you see in the 360 dashboard
- Each button is labeled with the test employee name

### 3. Testing Scenarios

#### Scenario 1: Admin View
- **360 as:** Admin
- **Expected:** See ALL 360 reviews in the system

#### Scenario 2: Leader View
- **360 as:** Leader
- **Expected:** See:
  - 360 reviews about the Leader themselves
  - 360 reviews where Leader is a reviewer
  - 360 reviews for User1 and User2 (their direct reports)

#### Scenario 3: User View
- **360 as:** User1 or User2
- **Expected:** See only:
  - 360 reviews about themselves
  - 360 reviews where they are assigned as a reviewer

## Technical Implementation

### Files Modified

1. **types/index.ts**
   - Added `EmployeeRole` type: `'admin' | 'leader' | 'user'`
   - Added `role?: EmployeeRole` field to `Employee` interface

2. **components/Feedback360Dashboard.tsx**
   - Added `currentUser?: Employee` prop
   - Implemented role-based filtering in `loadSurveys()`
   - Filters surveys based on:
     - User role (admin/leader/user)
     - Employee ID (for "my reviews")
     - Reviewer email (for "reviews I'm assigned to")
     - Direct report relationships (for leaders)

3. **components/Dashboard.tsx**
   - Added `employeeOverride` state for testing
   - Added `currentUserEmployee` computed value
   - Passed `currentUser` prop to all `Feedback360Dashboard` instances
   - Added employee switcher UI (purple panel)

### Database Schema

```sql
-- New column added to employees table
ALTER TABLE employees
ADD COLUMN role TEXT CHECK (role IN ('admin', 'leader', 'user'));
```

### Reporting Structure

```
Admin User [TEST]
  └─ Leader User [TEST]
       ├─ User One [TEST]
       └─ User Two [TEST]
```

## Creating 360 Reviews for Testing

1. Click "Create 360" button
2. Select one of the test employees
3. Add questions and reviewers
4. Launch the survey

Try creating surveys for different employees and switching between employee views to see how the filtering works!

## Production Deployment

When deploying to production:

1. Remove or hide the test employee buttons from the switcher
2. Assign the `role` field to all real employees in your database
3. Ensure `reports_to_id` is correctly set for employees who report to managers
4. The dashboard will automatically filter based on the logged-in user's email matching an employee record

## Notes

- The employee switcher only appears in development (localhost)
- Employee records are matched by email address
- If no employee record is found for the logged-in user, no filtering is applied
- Direct reports are identified by the `reports_to_id` field matching the manager's employee ID
