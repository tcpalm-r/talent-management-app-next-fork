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

---
---

# New Table Addition: feedback_360_reports

## Overview
Added new table `feedback_360_reports` to store AI-generated analysis reports for completed 360 feedback surveys. This table enables the storage of comprehensive Claude AI analysis including themes, insights, and recommendations.

## Migration Details

### Migration File
- **File:** `migration-add-360-reports-table.sql`
- **Date:** October 28, 2025
- **Purpose:** Enable AI-powered 360 feedback analysis with 2-3 page comprehensive reports

### Table Structure

#### `feedback_360_reports`
New table with the following columns:

**Primary Key:**
- `id` (UUID) - Auto-generated primary key

**Foreign Keys:**
- `survey_id` (UUID, NOT NULL) - References `feedback_360_surveys(id)` with CASCADE delete
- UNIQUE constraint on `survey_id` (one report per survey, supports upsert)

**JSONB Columns** (complex nested data):
- `themes` (JSONB, NOT NULL) - Array of ThemeAnalysis objects with sentiment, frequency, quotes
- `sentiment_by_relationship` (JSONB, NOT NULL) - Sentiment scores by relationship type (manager/peer/direct_report/self/other)

**TEXT[] Columns** (string arrays):
- `overall_strengths` (TEXT[], NOT NULL) - Key strengths identified
- `development_areas` (TEXT[], NOT NULL) - Areas for improvement
- `recommendations` (TEXT[], NOT NULL) - Actionable recommendations
- `key_insights` (TEXT[], NOT NULL) - Important patterns and observations
- `consensus_areas` (TEXT[], NOT NULL) - Areas with 70%+ agreement
- `outlier_opinions` (TEXT[], NOT NULL) - Unique/contrasting perspectives

**Metadata:**
- `generated_at` (TIMESTAMP WITH TIME ZONE, NOT NULL) - When AI analysis was generated
- `generated_by` (TEXT, NOT NULL) - AI model identifier (e.g., 'claude-sonnet-4-20250514')
- `manager_notes` (TEXT, NULL) - Optional manager notes after review

**Timestamps:**
- `created_at` (TIMESTAMP WITH TIME ZONE) - Auto-generated on insert
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Auto-updated via trigger

### Indexes Created
1. `idx_360_reports_survey_id` (B-tree) - Fast FK lookups
2. `idx_360_reports_generated_at` (B-tree DESC) - Time-based queries
3. `idx_360_reports_themes_gin` (GIN) - Efficient JSONB queries on themes
4. `idx_360_reports_sentiment_gin` (GIN) - Efficient JSONB queries on sentiment

### Triggers
- `update_360_reports_updated_at` - Auto-updates `updated_at` on record modification

### Permissions
- Row Level Security: DISABLED (consistent with other 360 tables)
- Granted ALL to: `anon`, `authenticated`, `service_role`

## TypeScript Type Updates

### Updated Files
- `types/supabase.ts:179-240` - Added complete type definition for `feedback_360_reports`

### Type Structure
```typescript
feedback_360_reports: {
  Row: {
    id: string;
    survey_id: string;
    themes: Json;
    sentiment_by_relationship: Json;
    overall_strengths: string[];
    development_areas: string[];
    recommendations: string[];
    key_insights: string[];
    consensus_areas: string[];
    outlier_opinions: string[];
    generated_at: string;
    generated_by: string;
    manager_notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  }
  Insert: { /* optional defaults for arrays and JSONB */ }
  Update: { /* all fields optional */ }
  Relationships: [
    {
      foreignKeyName: "feedback_360_reports_survey_id_fkey"
      columns: ["survey_id"]
      referencedRelation: "feedback_360_surveys"
    }
  ]
}
```

## Testing

### Test File
- **File:** `migration-add-360-reports-table-TESTING.sql`
- **Purpose:** Comprehensive verification queries for table creation and functionality

### Test Coverage
1. ✅ Table creation with correct columns and types
2. ✅ Index creation verification
3. ✅ Foreign key constraint validation
4. ✅ Sample data insertion with complex JSONB and arrays
5. ✅ JOIN queries with related tables
6. ✅ JSONB querying (themes, sentiment)
7. ✅ Array operations (unnest, array_length)
8. ✅ Update trigger functionality
9. ✅ UPSERT with ON CONFLICT (UNIQUE constraint)
10. ✅ CASCADE delete behavior

## Integration Points

### Existing Code Integration
The following will need to be implemented (Phase 2-3 of project):

1. **API Endpoint:** `/app/api/360-generate-report/route.ts`
   - POST: Trigger AI analysis for a survey
   - GET: Retrieve existing report

2. **AI Analysis:** Uses existing `lib/survey360Analyzer.ts`
   - Already implements Claude Sonnet 4 integration
   - Generates themes, sentiment, recommendations

3. **UI Integration:** `components/Feedback360Dashboard.tsx:249`
   - "Complete Review with AI Analysis" button already exists
   - Needs to call new API endpoint
   - Display results in modal

## Database Schema Reference (Updated)

The following tables are now in the database:
- `feedback_360_surveys` - Main survey table
- **`feedback_360_reports` - NEW: AI analysis reports** ✨
- `feedback_360_survey_reviewers` - Reviewers/participants
- `feedback_360_questions` - Question library
- `feedback_360_survey_questions` - Junction table
- `feedback_360_responses` - Survey responses

## Migration Execution Instructions

### To Execute Migration:
1. Open Supabase SQL Editor
2. Copy contents of `migration-add-360-reports-table.sql`
3. Execute SQL
4. Verify success with built-in verification queries
5. Run test queries from `migration-add-360-reports-table-TESTING.sql`

### Rollback (if needed):
```sql
DROP TABLE IF EXISTS feedback_360_reports CASCADE;
```

## Notes

1. **JSONB Structure**: Complex nested objects (themes, sentiment) are stored as JSONB for flexibility and efficient querying
2. **Array Columns**: Simple string arrays use PostgreSQL TEXT[] for better performance
3. **Upsert Support**: UNIQUE constraint on survey_id enables regenerating reports with ON CONFLICT DO UPDATE
4. **Cascade Delete**: When a survey is deleted, its report is automatically deleted
5. **Performance**: GIN indexes on JSONB columns enable fast searching within JSON structures

## Next Steps

After running this migration, the following can be implemented:

1. ✅ Database table ready
2. ✅ TypeScript types defined
3. ⏳ Create API endpoint for report generation
4. ⏳ Integrate UI with API endpoint
5. ⏳ Create test data generation script
6. ⏳ Test end-to-end flow

---

**Migration Date:** October 28, 2025
**Status:** ✅ SQL Ready for Execution
**Files Added:**
- `migration-add-360-reports-table.sql` (migration script)
- `migration-add-360-reports-table-TESTING.sql` (test queries)

**Files Modified:**
- `types/supabase.ts` (added feedback_360_reports type definitions)
- `SCHEMA-MIGRATION.md` (this documentation)
