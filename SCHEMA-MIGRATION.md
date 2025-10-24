# Schema Migration Summary

## Overview
All Supabase queries in the codebase have been updated to align with the actual database schema defined in `existing-schema.sql`.

## Changes Made

### 1. Table Name Corrections

#### `feedback_360_reviewers` → `feedback_360_survey_reviewers`
Updated in:
- `components/Feedback360Dashboard.tsx:49` - Query join
- `components/Survey360Wizard.tsx:186` - Insert operation
- `components/Quick360Modal.tsx:191` - Insert operation
- `components/Feedback360CreateModal.tsx:181` - Insert operation

### 2. Column Name Corrections

#### `unique_token` → `access_token`
Updated in:
- `types/index.ts:283` - Survey360Participant interface
- `components/Survey360Modal.tsx` - Multiple references (lines 255, 710, 713, 717, 727)
- `components/Survey360Wizard.tsx:181` - Insert operation

Note: `Quick360Modal.tsx` and `Feedback360CreateModal.tsx` were already using `access_token` correctly.

### 3. Removed Non-Existent Columns

#### Removed `organization_id` from `feedback_360_surveys`
The database schema does not include `organization_id` in the `feedback_360_surveys` table.

Updated in:
- `components/Survey360Wizard.tsx:161` - Removed from insert
- `components/Feedback360Dashboard.tsx:51` - Removed filter condition
- `components/Quick360Modal.tsx:163` - Removed from insert
- `components/Feedback360CreateModal.tsx:152` - Removed from insert

### 4. Removed Non-Existent Tables

#### Removed references to `feedback_360_templates` and `feedback_360_template_questions`
These tables do not exist in the actual database schema.

Updated in:
- `components/Quick360Modal.tsx:175-210` - Removed template creation logic
- `components/Feedback360CreateModal.tsx:164-199` - Removed template creation logic

**Note:** Added comments indicating that question linking should be done via the `feedback_360_survey_questions` junction table with questions from `feedback_360_questions` table.

### 5. Column Adjustments

#### Changed `sent_at` → `invited_at`
The schema uses `invited_at` for tracking when reviewers were invited.

Updated in:
- `components/Quick360Modal.tsx:187` - Changed column name
- `components/Feedback360CreateModal.tsx:177` - Changed column name

### 6. Type Definition Updates

#### Updated `Survey360` interface
- Made `organization_id` optional (UI-only field)
- Added `survey_name` as the actual DB column
- Made `survey_title` optional (alias)
- Made `due_date` nullable
- Added `sent_at` field
- Made `completed_at` nullable

#### Updated `Survey360Participant` interface
- Changed `unique_token` to `access_token`
- Made `updated_at` optional

## Verification

✅ No references to old table names (`feedback_360_reviewers`) remain
✅ No references to old column names (`unique_token`) remain
✅ No references to non-existent tables (`feedback_360_templates`) remain
✅ No references to non-existent columns (`organization_id` in surveys) remain
✅ Dev server compiles successfully with no errors
✅ All type definitions align with actual database schema

## Database Schema Reference

The following tables are correctly referenced in the codebase:
- `feedback_360_surveys` - Main survey table
- `feedback_360_survey_reviewers` - Reviewers/participants in surveys
- `feedback_360_questions` - Question library
- `feedback_360_survey_questions` - Junction table linking surveys to questions
- `feedback_360_responses` - Survey responses

## Notes

1. **Question Linking**: The code currently simplified question handling. In production, questions should be:
   - Stored in or selected from `feedback_360_questions`
   - Linked to surveys via `feedback_360_survey_questions` junction table

2. **Organization Scoping**: The `organization_id` field was removed from queries as it doesn't exist in the database. If multi-tenancy is needed, consider adding this column to the schema or implementing organization-level filtering at the application layer.

3. **Mock Data**: `Survey360Modal.tsx` uses mock data and doesn't interact with the database directly, but its types have been updated for consistency.

## Files Modified

1. `components/Feedback360Dashboard.tsx`
2. `components/Survey360Wizard.tsx`
3. `components/Quick360Modal.tsx`
4. `components/Feedback360CreateModal.tsx`
5. `components/Survey360Modal.tsx`
6. `types/index.ts`

## Migration Complete

All Supabase queries now correctly reference tables and columns as defined in `existing-schema.sql`.

---

**Migration Date:** October 23, 2025
**Status:** ✅ Complete and Verified
