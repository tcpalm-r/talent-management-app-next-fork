# Fixed Migration Script - V2

## What Was The Problem?

The original migration script failed with this error:
```
ERROR: 42809: "assessments" is not a view
```

**Root cause:** Your existing database already has a **TABLE** named `assessments` (for Ideal Team Player framework). PostgreSQL won't let us create a **VIEW** with the same name as an existing table without handling it first.

---

## What Does V2 Fix?

The updated migration script (`migration-hybrid-9box-v2.sql`) now:

1. ✅ **Renames your existing `assessments` table to `itp_assessments`**
   - Preserves 100% of your Ideal Team Player assessment data
   - Updates all foreign keys to point to the renamed table
   - Updates all indexes to reflect the new name

2. ✅ **Creates a new `assessments` VIEW**
   - Points to `talent_grid_assessments` for the 9-box grid
   - Allows the front-end to work without code changes

3. ✅ **Adds all the new tables**
   - `organizations`, `departments`, `box_definitions`, `talent_grid_assessments`
   - Creates `employees` VIEW mapping to your `user_profiles`

---

## How Your Data Is Organized After Migration

```
BEFORE MIGRATION:
└── assessments (TABLE) - Ideal Team Player data

AFTER MIGRATION:
├── itp_assessments (TABLE) - Your original Ideal Team Player data (renamed)
│   └── Referenced by: assessment_responses
│
├── talent_grid_assessments (TABLE) - New 9-box assessment data
│   └── Accessed via: assessments VIEW
│
└── assessments (VIEW) - Points to talent_grid_assessments
    └── Used by: Front-end 9-box grid
```

---

## How To Access Your Data

### Ideal Team Player Assessments (Your Original Data)
```sql
-- Access your original assessment data
SELECT * FROM itp_assessments;

-- Join with responses (foreign keys updated automatically)
SELECT a.*, r.*
FROM itp_assessments a
JOIN assessment_responses r ON r.assessment_id = a.id;
```

### 9-Box Talent Grid Assessments (New Feature)
```sql
-- Access 9-box assessments (through the VIEW)
SELECT * FROM assessments;

-- Or directly from the table
SELECT * FROM talent_grid_assessments;
```

### Employees (Mapped from user_profiles)
```sql
-- View all employees for the 9-box grid
SELECT * FROM employees;

-- Original user profiles still accessible
SELECT * FROM user_profiles;
```

---

## Step-by-Step: Run The Fixed Migration

### 1. **Clear Any Partial Migration** (if you tried V1)

If you already ran the first version partially, clean it up first:

```sql
-- Drop any partial objects from V1
DROP VIEW IF EXISTS assessments CASCADE;
DROP VIEW IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS talent_grid_assessments CASCADE;
DROP TABLE IF EXISTS box_definitions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
```

### 2. **Run V2 Migration**

1. Open Supabase SQL Editor
2. Copy the contents of `migration-hybrid-9box-v2.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Watch for success notices

**Expected output:**
```
NOTICE: Renamed existing assessments table to itp_assessments
NOTICE: Updated foreign keys and indexes
NOTICE: ==============================================
NOTICE: MIGRATION COMPLETED SUCCESSFULLY
NOTICE: ==============================================
```

### 3. **Verify The Migration**

Run these queries in SQL Editor:

```sql
-- Should return 1 organization
SELECT * FROM organizations;

-- Should return 5 departments
SELECT * FROM departments;

-- Should return 9 box definitions
SELECT * FROM box_definitions;

-- Should return your users
SELECT * FROM employees LIMIT 5;

-- Should be empty (no 9-box assessments yet)
SELECT * FROM assessments;

-- Should show your Ideal Team Player data
SELECT * FROM itp_assessments LIMIT 5;

-- Should still work - assessment responses
SELECT ar.*, itp.user_id, itp.framework_type
FROM assessment_responses ar
JOIN itp_assessments itp ON ar.assessment_id = itp.id
LIMIT 5;
```

### 4. **Test The Front-End**

1. Start your dev server: `npm run dev`
2. Open http://localhost:3000
3. Should now load successfully!
4. Navigate to the 9-box grid view

---

## If Something Goes Wrong

### Rollback To Original State

Run `rollback-hybrid-9box-v2.sql` to:
- Remove all new tables and views
- Rename `itp_assessments` back to `assessments`
- Restore all foreign keys and indexes
- Return to pre-migration state

```sql
-- In Supabase SQL Editor, run:
-- (paste contents of rollback-hybrid-9box-v2.sql)
```

---

## Common Questions

### Q: Will my existing code that queries `assessments` break?

**A:** It depends on what it's querying:

**If your code expects Ideal Team Player data:**
```typescript
// BEFORE: This worked
const { data } = await supabase.from('assessments').select('*');

// AFTER: Change to
const { data } = await supabase.from('itp_assessments').select('*');
```

**If it's the front-end 9-box code:**
```typescript
// This will work unchanged (VIEW redirects to talent_grid_assessments)
const { data } = await supabase.from('assessments').select('*');
```

### Q: Can I query both types of assessments together?

**A:** Yes! You can UNION them if needed:

```sql
-- Get all assessment types
SELECT 'ITP' as type, user_id as employee_id, framework_type, status, created_at
FROM itp_assessments
UNION ALL
SELECT '9BOX' as type, employee_id, box_key, NULL as status, created_at
FROM talent_grid_assessments;
```

### Q: What about existing API endpoints?

**A:** You may need to update any API routes that query the `assessments` table:

```typescript
// OLD: This now gets 9-box data (via VIEW)
const assessments = await supabase.from('assessments').select('*');

// NEW: Be explicit about which assessments you want
const itpAssessments = await supabase.from('itp_assessments').select('*');
const talentAssessments = await supabase.from('assessments').select('*');
```

### Q: Is my data safe?

**A:** Yes! The migration:
- ✅ Only renames tables (no data deletion)
- ✅ Preserves all foreign keys
- ✅ Updates all indexes
- ✅ Can be fully rolled back

---

## Next Steps After Successful Migration

1. **Update any backend code** that queries the old `assessments` table
   - Change to `itp_assessments` where appropriate

2. **Test all existing features:**
   - [ ] Ideal Team Player assessments
   - [ ] 360 Feedback surveys
   - [ ] Performance reviews
   - [ ] User management

3. **Test the new 9-box grid:**
   - [ ] Grid displays correctly
   - [ ] Employees show up
   - [ ] Can create assessments
   - [ ] Drag-and-drop works (if implemented)

4. **Populate 9-box data:**
   - Add sample assessments for testing
   - Eventually migrate/create real 9-box assessments

---

## File Reference

- **migration-hybrid-9box-v2.sql** ← Use this one (FIXED)
- **rollback-hybrid-9box-v2.sql** ← Matching rollback
- **migration-hybrid-9box.sql** ← Old version (DON'T USE)
- **rollback-hybrid-9box.sql** ← Old rollback (DON'T USE)

---

## Need Help?

If you encounter issues:
1. **Don't panic** - you can always rollback
2. **Check the error message** carefully
3. **Run the verification queries** to see what state your DB is in
4. **Document the error** and reach out for help

Your data is safe as long as you tested in a cloned environment first! 🎉
