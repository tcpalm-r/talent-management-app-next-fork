# Narrative Generation Feature - Implementation Summary

## Overview
Added a new "Generate Narrative" feature that requires sponsors/admins to create an AI-generated one-page narrative summary before finalizing 360 reports.

## What Was Implemented

### 1. Database Schema Changes
**File:** `migrations/add_narrative_fields.sql`

Added three new columns to `feedback_360_surveys` table:
- `final_narrative` (TEXT) - Stores the AI-generated narrative
- `narrative_generated_at` (TIMESTAMP) - Tracks when narrative was last generated
- `narrative_version` (INTEGER) - Version tracking for future use

**ACTION REQUIRED:** Run this migration in your Supabase SQL Editor:
```sql
ALTER TABLE feedback_360_surveys
ADD COLUMN IF NOT EXISTS final_narrative TEXT,
ADD COLUMN IF NOT EXISTS narrative_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS narrative_version INTEGER DEFAULT 0;
```

### 2. API Endpoint
**File:** `app/api/ai/generate-narrative/route.ts`

New POST endpoint `/api/ai/generate-narrative` that:
- Takes survey data (raw responses + analyzed report sections)
- Calls Claude API to generate a 500-700 word professional narrative
- Returns formatted narrative text
- Uses Claude Sonnet 4 model with temperature 0.7 for creative writing

**Request Format:**
```typescript
{
  surveyId: string;
  subjectName: string;
  rawResponses: Array<{ question: string; responses: string[] }>;
  reportData: {
    executive_summary?: string;
    themes?: Array<{ theme: string; description: string }>;
    strengths?: string[];
    development_areas?: string[];
    key_insights?: string[];
    recommendations?: string[];
  };
}
```

### 3. UI Components
**File:** `components/Feedback360Dashboard.tsx`

#### New State Variables:
- `finalNarrative` - Stores the generated narrative text
- `isGeneratingNarrative` - Loading state for generation
- `narrativeOutdated` - Flags when report edits are ahead of narrative

#### New Tab Added:
- **"Narrative"** tab added as the final tab in the report modal
- Shows empty state with "Generate Narrative" button when no narrative exists
- Shows generated narrative with "Regenerate Narrative" button after generation
- Displays warning banner when narrative is outdated due to report edits

#### Key Features:
1. **Empty State** - Clear call-to-action to generate narrative
2. **Generated State** - Beautiful display of narrative with subject's first name
3. **Outdated Warning** - Amber alert when report sections are modified after generation
4. **Auto-save** - Narrative automatically saved to database after generation
5. **Loading States** - Spinner and disabled state during API calls

### 4. Finalization Blocking Logic

**Modified Function:** `finalizeSurvey()`

Now checks if `finalNarrative` exists before allowing finalization:
- If no narrative → Shows error toast
- Automatically switches to "Narrative" tab
- Prevents finalization API call
- Clear error message: "You must generate a narrative before finalizing..."

### 5. Narrative Outdated Detection

**Triggers:**
- When any theme, strength, development area, or insight is adjusted
- When recommendations are edited/added/deleted
- Sets `narrativeOutdated` flag to `true`
- Warning banner appears in Narrative tab

### 6. Narrative Loading

**On Results Modal Open:**
- Loads `final_narrative` from survey object (via `/api/surveys/[id]/details`)
- Sets narrative state if it exists
- Resets outdated flag

## User Flow

### For Sponsors/Admins:

1. **Complete Review** → Click "Complete Review with AI Analysis"
2. **Review Sections** → Navigate through tabs, make any desired tweaks
3. **Generate Narrative** → Go to "Narrative" tab, click "Generate Narrative"
4. **Wait (~10-20 seconds)** → AI generates comprehensive 1-page summary
5. **Review Narrative** → Read generated content
6. **Regenerate if needed** → Make more edits → Click "Regenerate Narrative"
7. **Finalize** → Click "Finalize" button (now unblocked)

### Blocked Scenario:
- Sponsor tries to finalize without generating narrative
- Error toast appears: "Narrative Required - You must generate a narrative..."
- Automatically switches to Narrative tab
- Sponsor generates narrative
- Can now finalize successfully

## Technical Details

### Claude API Prompt
The narrative generation uses a sophisticated prompt that:
- Synthesizes raw feedback responses AND analyzed report sections
- Creates flowing narrative prose (not bullet points or sections)
- Maintains professional yet warm developmental tone
- References specific feedback for authenticity
- Approximately 500-700 words
- Uses third person perspective
- Personalized with subject's name throughout

### Error Handling
- Missing data validation
- API error catching with user-friendly messages
- Graceful fallbacks for missing survey data
- Console logging for debugging

### Performance
- API call takes ~10-20 seconds (Claude Sonnet 4)
- Loading states prevent duplicate requests
- Narrative cached in state and database

## Files Modified/Created

### Created:
- `app/api/ai/generate-narrative/route.ts` - API endpoint
- `migrations/add_narrative_fields.sql` - Database migration
- `scripts/run-narrative-migration.js` - Migration helper script

### Modified:
- `components/Feedback360Dashboard.tsx` - UI, state management, blocking logic

## Testing Checklist

- [ ] Run database migration in Supabase SQL Editor
- [ ] Complete a 360 survey analysis
- [ ] Navigate to Narrative tab (should show empty state)
- [ ] Click "Generate Narrative" (should generate ~500-700 word narrative)
- [ ] Verify narrative appears with subject's first name
- [ ] Edit a recommendation or theme
- [ ] Verify "Narrative Outdated" warning appears
- [ ] Click "Regenerate Narrative"
- [ ] Verify warning disappears after regeneration
- [ ] Try to finalize without narrative → Should block with error
- [ ] Generate narrative → Try to finalize → Should succeed
- [ ] Verify narrative persists when reopening survey

## Future Enhancements (Optional)

1. **Edit Narrative** - Allow inline editing of generated text
2. **Narrative Templates** - Provide tone/style options
3. **Version History** - Track multiple narrative versions
4. **Export Options** - Download narrative as separate document
5. **Character Count** - Show word/character count in UI
6. **Draft Saving** - Auto-save narrative drafts during editing

## Notes

- Only sponsors and admins can generate narratives (role-based)
- Narrative becomes first page of final report PDF
- Uses same auth/permission system as other 360 features
- Integrates cleanly with existing report export workflow
