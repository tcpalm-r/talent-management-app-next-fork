# 9-Box Talent Grid Migration Testing Guide

## Overview
This guide walks you through safely testing the hybrid migration that adds 9-box talent grid functionality to your existing Supabase database.

---

## ⚠️ CRITICAL: Pre-Migration Steps

### 1. Back Up Your Production Database

**Using Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your production project
3. Navigate to **Database → Backups**
4. Click **Create Backup** and wait for completion
5. **Verify the backup exists** before proceeding

**Using CLI (Alternative):**
```bash
# Dump your entire database
supabase db dump -f production-backup-$(date +%Y%m%d).sql
```

### 2. Create a Test Project

**Option A: Clone Your Project (Recommended)**
1. In Supabase Dashboard, go to your production project
2. Click **Settings → General**
3. Scroll to **Danger Zone**
4. Click **Pause project** or create a new test project
5. Create a new project called "talent-management-test"
6. Note the new project's URL and anon key

**Option B: Restore to New Project**
1. Create a new Supabase project
2. Restore your production backup to it
3. Navigate to **Database → SQL Editor**
4. Upload and run your production backup SQL file

### 3. Update Your Test Environment Variables

Create a `.env.local.test` file:
```bash
# Test Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-TEST-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key

# Keep your Anthropic API key
NEXT_PUBLIC_ANTHROPIC_API_KEY=your-api-key
```

---

## 🧪 Testing Phase 1: Database Migration

### Step 1: Run the Migration

1. Open your test project in Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New query**
4. Copy and paste the contents of `migration-hybrid-9box.sql`
5. Click **Run**
6. Look for success messages (should complete in ~1-2 seconds)

### Step 2: Verify the Migration

Run these verification queries in the SQL Editor:

```sql
-- 1. Check organizations table
SELECT * FROM organizations;
-- Expected: 1 row (Test Organization)

-- 2. Check departments table
SELECT * FROM departments ORDER BY name;
-- Expected: 5 rows (Engineering, Sales, Marketing, HR, Finance)

-- 3. Check box_definitions table
SELECT key, label, grid_x, grid_y FROM box_definitions ORDER BY grid_x, grid_y;
-- Expected: 9 rows (3x3 grid)

-- 4. Check employees VIEW
SELECT id, name, email, department_id, title FROM employees LIMIT 5;
-- Expected: Your existing user_profiles mapped to employees structure

-- 5. Check talent_grid_assessments table
SELECT * FROM talent_grid_assessments;
-- Expected: 0 rows (empty initially)

-- 6. Verify original data is intact
SELECT COUNT(*) FROM user_profiles WHERE is_active = true;
SELECT COUNT(*) FROM feedback_360_surveys;
SELECT COUNT(*) FROM performance_reviews;
-- Expected: Your existing counts unchanged
```

### Step 3: Check for Errors

```sql
-- Look for any constraint violations or errors
SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction (aborted)';
```

If any queries fail, **STOP HERE** and run the rollback script.

---

## 🚀 Testing Phase 2: Front-End Application

### Step 1: Point Your App to Test Database

```bash
# Use your test environment
cp .env.local.test .env.local
```

### Step 2: Start the Development Server

```bash
npm run dev
```

### Step 3: Test the Application

Open http://localhost:3000 and verify:

#### ✅ Basic Loading
- [ ] Application loads without errors
- [ ] No "Organization query failed" error
- [ ] No console errors in browser DevTools

#### ✅ Organization Data
- [ ] "Test Organization" appears in the header
- [ ] Navigation tabs are visible

#### ✅ 9-Box Grid View
- [ ] Navigate to the 9-box grid (if there's a tab/menu)
- [ ] Grid renders with 9 boxes (3x3 layout)
- [ ] Box labels match: "Star/Top Talent", "Performance Leader", etc.
- [ ] Boxes are color-coded correctly

#### ✅ Employees View
- [ ] Employee list shows your existing users from `user_profiles`
- [ ] Employee names, emails, titles display correctly
- [ ] Departments show correctly (if mapped)

#### ✅ Department Filtering
- [ ] Department filter dropdown shows: Engineering, Sales, Marketing, HR, Finance
- [ ] Filtering by department works (if implemented)

#### ✅ Existing Features Still Work
- [ ] 360 Feedback features still work
- [ ] Performance Reviews still work
- [ ] Ideal Team Player assessments still work

---

## 📊 Testing Phase 3: Add Sample 9-Box Data

### Step 1: Get Some User IDs

```sql
-- Get the first 5 active users
SELECT id, full_name, email, title
FROM user_profiles
WHERE is_active = true
ORDER BY full_name
LIMIT 5;
```

### Step 2: Add Sample Assessments

```sql
-- Replace these UUIDs with actual user IDs from Step 1
INSERT INTO talent_grid_assessments (organization_id, employee_id, performance, potential, box_key, assessed_at)
VALUES
-- Example: Star performer
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'REPLACE-WITH-USER-ID-1', 'high', 'high', '3-3', NOW()),

-- Example: Steady contributor
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'REPLACE-WITH-USER-ID-2', 'medium', 'medium', '2-2', NOW()),

-- Example: Rising talent
('f8a8b8c8-d8e8-4f8f-8f8f-8f8f8f8f8f8f', 'REPLACE-WITH-USER-ID-3', 'low', 'high', '1-3', NOW())
ON CONFLICT (employee_id) DO NOTHING;
```

### Step 3: Verify in Application

- [ ] Refresh the front-end app
- [ ] Navigate to the 9-box grid
- [ ] Employees appear in the correct boxes
- [ ] You can drag and drop employees between boxes (if implemented)
- [ ] Assessment notes display correctly

---

## 🔄 Testing Phase 4: Rollback Test (Optional but Recommended)

### Step 1: Run Rollback Script

In your test project's SQL Editor:
1. Copy and paste the contents of `rollback-hybrid-9box.sql`
2. Click **Run**
3. Verify success messages

### Step 2: Verify Rollback

```sql
-- 1. Verify new tables are gone
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'departments', 'box_definitions', 'talent_grid_assessments');
-- Expected: 0 rows

-- 2. Verify original data is intact
SELECT COUNT(*) FROM user_profiles;
SELECT COUNT(*) FROM feedback_360_surveys;
-- Expected: Original counts unchanged

-- 3. Verify original assessments table is accessible
SELECT COUNT(*) FROM assessments;
-- Expected: Your Ideal Team Player assessment count
```

### Step 3: Re-Run Migration

If rollback was successful, re-run the migration to continue testing.

---

## ✅ Success Criteria

Before applying to production, ensure ALL of these are true:

- [ ] Migration runs without errors
- [ ] All verification queries return expected results
- [ ] Front-end loads without errors
- [ ] 9-box grid displays correctly
- [ ] Employees VIEW shows your user data
- [ ] Existing features (360 feedback, performance reviews) still work
- [ ] Sample 9-box assessments can be created and displayed
- [ ] Rollback script successfully reverses all changes
- [ ] No data loss in existing tables

---

## 🚨 Troubleshooting

### Issue: "Could not find the table 'public.organizations'"

**Solution:** The migration didn't run. Go back to Testing Phase 1.

### Issue: "employees VIEW returns no data"

**Possible causes:**
1. No active users in `user_profiles` where `is_active = true`
2. Check: `SELECT COUNT(*) FROM user_profiles WHERE is_active = true;`

**Solution:** Either activate some users or modify the VIEW definition.

### Issue: "department_id is NULL for all employees"

**This is expected initially.** The VIEW tries to map department names, but:
- Your `user_profiles.department` values may not match the seeded department names
- Check: `SELECT DISTINCT department FROM user_profiles;`
- **Solution:** Either:
  1. Update `user_profiles.department` to match: "Engineering", "Sales", "Marketing", "HR", "Finance"
  2. Add more departments that match your existing values
  3. Accept NULL and handle in application code

### Issue: "Original assessments table conflict"

**Explanation:** The migration creates a VIEW named `assessments` that overlays your original `assessments` table.

**Check which one is active:**
```sql
SELECT table_type FROM information_schema.tables
WHERE table_name = 'assessments' AND table_schema = 'public';
-- Should show: 'VIEW'
```

**To access original Ideal Team Player assessments:**
```sql
-- The VIEW now points to talent_grid_assessments
-- To access your ORIGINAL assessments table, you'd need to query it directly
-- Or we can rename the VIEW

-- Option 1: Rename the VIEW (recommended)
DROP VIEW IF EXISTS assessments;
DROP VIEW IF EXISTS talent_assessments;

CREATE OR REPLACE VIEW talent_assessments AS
SELECT * FROM talent_grid_assessments;

-- Now your original 'assessments' table is accessible again
SELECT * FROM assessments LIMIT 5; -- Original Ideal Team Player data
SELECT * FROM talent_assessments LIMIT 5; -- 9-box data
```

---

## 📝 Applying to Production

Once testing is successful:

1. **Schedule a maintenance window**
   - Notify users of brief downtime
   - Choose a low-traffic time

2. **Final production backup**
   ```bash
   # Create a backup right before migration
   supabase db dump -f pre-migration-backup.sql
   ```

3. **Update environment**
   ```bash
   # Point back to production
   cp .env.local.production .env.local
   ```

4. **Run migration on production**
   - Open production project SQL Editor
   - Run `migration-hybrid-9box.sql`
   - Run verification queries

5. **Deploy and test**
   - Deploy your Next.js app
   - Smoke test critical features
   - Monitor error logs

6. **Keep rollback script handy**
   - If issues arise, you can quickly run `rollback-hybrid-9box.sql`

---

## 📞 Need Help?

If you encounter issues during testing:

1. **Don't panic** - you're testing in a safe environment
2. **Run the rollback script** to restore original state
3. **Check the error messages** carefully
4. **Verify your original data** is still intact
5. **Document the issue** and ask for help

Common issues are usually related to:
- Column name mismatches between `user_profiles` and expected `employees` structure
- Department name mapping
- Permission/RLS settings

---

## 🎉 Migration Complete!

Once everything works in test and production:
- Your existing performance review and 360 feedback data is preserved
- You now have 9-box talent grid functionality
- Both systems work side-by-side
- You can gradually migrate users to use the 9-box assessments
