# API Testing Guide: 360 Report Generation

## Overview
This document provides comprehensive testing instructions for the new `/api/360-generate-report` endpoint, which generates AI-powered analysis reports for completed 360 feedback surveys.

**API Endpoint:** `/api/360-generate-report`
**File Location:** `app/api/360-generate-report/route.ts`
**Created:** October 28, 2025

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [API Endpoints](#api-endpoints)
3. [Test Scenarios](#test-scenarios)
4. [Expected Responses](#expected-responses)
5. [Error Handling](#error-handling)
6. [Integration Testing](#integration-testing)

---

## Prerequisites

### Environment Setup
Ensure these environment variables are configured:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic AI
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...
```

### Database State
- ✅ `feedback_360_reports` table created (migration executed)
- ✅ `feedback_360_surveys` table has at least one survey with responses
- ✅ `feedback_360_survey_reviewers` table has reviewers with `relationship` field
- ✅ `feedback_360_responses` table has actual response data

### Dev Server
```bash
npm run dev
# Server running on http://localhost:3004
```

---

## API Endpoints

### 1. POST - Generate AI Report

**Endpoint:** `POST /api/360-generate-report`

**Purpose:** Analyzes survey responses using Claude AI and generates a comprehensive report

**Request Body:**
```json
{
  "survey_id": "uuid-of-survey"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "report": {
    "id": "report-uuid",
    "survey_id": "survey-uuid",
    "themes": [...],
    "sentiment_by_relationship": {...},
    "overall_strengths": [...],
    "development_areas": [...],
    "recommendations": [...],
    "key_insights": [...],
    "consensus_areas": [...],
    "outlier_opinions": [...],
    "generated_at": "2025-10-28T...",
    "generated_by": "claude-sonnet-4-20250514",
    "created_at": "2025-10-28T...",
    "updated_at": "2025-10-28T..."
  },
  "message": "AI analysis completed successfully"
}
```

---

### 2. GET - Retrieve Existing Report

**Endpoint:** `GET /api/360-generate-report?survey_id={uuid}`

**Purpose:** Retrieves an existing report for a survey (if it was already generated)

**Query Parameters:**
- `survey_id` (required): UUID of the survey

**Response (Success - 200):**
```json
{
  "success": true,
  "report": {
    "id": "report-uuid",
    "survey_id": "survey-uuid",
    "themes": [...],
    // ... (same structure as POST response)
    "survey": {
      "id": "survey-uuid",
      "survey_name": "Q4 360 Review",
      "employee_id": "employee-uuid",
      "status": "completed",
      "created_by": "admin-uuid",
      "created_at": "2025-10-15T..."
    }
  }
}
```

---

## Test Scenarios

### Test 1: Find a Survey with Responses

**Purpose:** Identify a survey that has completed responses

**SQL Query:**
```sql
SELECT
    s.id as survey_id,
    s.survey_name,
    s.status,
    s.employee_id,
    COUNT(DISTINCT r.id) as reviewer_count,
    COUNT(resp.id) as response_count
FROM feedback_360_surveys s
LEFT JOIN feedback_360_survey_reviewers r ON r.survey_id = s.id
LEFT JOIN feedback_360_responses resp ON resp.survey_id = s.id
GROUP BY s.id, s.survey_name, s.status, s.employee_id
HAVING COUNT(resp.id) > 0
ORDER BY s.created_at DESC
LIMIT 5;
```

**Expected Result:**
- Find at least one survey with `response_count > 0`
- Copy the `survey_id` for next tests

---

### Test 2: Generate Report (POST Request)

**Using cURL:**
```bash
curl -X POST http://localhost:3004/api/360-generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "survey_id": "YOUR_SURVEY_ID_HERE"
  }'
```

**Using Postman:**
1. Method: `POST`
2. URL: `http://localhost:3004/api/360-generate-report`
3. Headers:
   - `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "survey_id": "3ed5b6c0-62cf-4774-8260-f978b72ff7fb"
   }
   ```

**Expected Result:**
- ✅ Status: `200 OK`
- ✅ Response contains `success: true`
- ✅ Response includes complete `report` object with all fields
- ✅ `themes` array has multiple themes
- ✅ `overall_strengths` array has 3-5 items
- ✅ `development_areas` array has 3-5 items
- ✅ `recommendations` array has 4-6 items
- ✅ `sentiment_by_relationship` has numeric scores (0-1)

**Time:** 10-30 seconds (AI processing time)

**Verify in Database:**
```sql
SELECT
    r.id,
    r.survey_id,
    r.generated_by,
    r.generated_at,
    array_length(r.overall_strengths, 1) as strengths_count,
    array_length(r.development_areas, 1) as development_count,
    jsonb_array_length(r.themes) as themes_count
FROM feedback_360_reports r
ORDER BY r.created_at DESC
LIMIT 1;
```

**Verify Survey Status Updated:**
```sql
SELECT id, survey_name, status, completed_at
FROM feedback_360_surveys
WHERE id = 'YOUR_SURVEY_ID_HERE';
```

Expected: `status = 'completed'`, `completed_at` is not null

---

### Test 3: Retrieve Report (GET Request)

**Using cURL:**
```bash
curl -X GET "http://localhost:3004/api/360-generate-report?survey_id=YOUR_SURVEY_ID_HERE"
```

**Using Browser:**
Navigate to:
```
http://localhost:3004/api/360-generate-report?survey_id=YOUR_SURVEY_ID_HERE
```

**Expected Result:**
- ✅ Status: `200 OK`
- ✅ Response contains `success: true`
- ✅ Response includes complete `report` object
- ✅ Response includes nested `survey` object with survey details
- ✅ Data matches the report generated in Test 2

---

### Test 4: UPSERT Behavior (Regenerate Report)

**Purpose:** Verify that calling POST again updates the existing report instead of creating a duplicate

**Steps:**
1. Run Test 2 again with the SAME survey_id
2. Wait for completion (another 10-30 seconds)
3. Verify in database that only ONE report exists for that survey

**SQL Verification:**
```sql
SELECT COUNT(*) as report_count, survey_id
FROM feedback_360_reports
WHERE survey_id = 'YOUR_SURVEY_ID_HERE'
GROUP BY survey_id;
```

**Expected Result:**
- ✅ `report_count = 1` (not 2!)
- ✅ `updated_at` timestamp is more recent than `created_at`
- ✅ Report content may be different (AI generates new analysis)

---

### Test 5: Error Cases

#### 5a. Missing survey_id

**Request:**
```bash
curl -X POST http://localhost:3004/api/360-generate-report \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "error": "survey_id is required"
}
```
**Status:** `400 Bad Request`

---

#### 5b. Non-existent survey

**Request:**
```bash
curl -X POST http://localhost:3004/api/360-generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "survey_id": "00000000-0000-0000-0000-000000000000"
  }'
```

**Expected Response:**
```json
{
  "error": "Survey not found",
  "details": "..."
}
```
**Status:** `404 Not Found`

---

#### 5c. Survey with no responses

**First, find a survey with no responses:**
```sql
SELECT s.id, s.survey_name
FROM feedback_360_surveys s
LEFT JOIN feedback_360_responses r ON r.survey_id = s.id
WHERE r.id IS NULL
LIMIT 1;
```

**Request:**
```bash
curl -X POST http://localhost:3004/api/360-generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "survey_id": "SURVEY_WITH_NO_RESPONSES"
  }'
```

**Expected Response:**
```json
{
  "error": "No responses found for this survey. Cannot generate analysis without responses."
}
```
**Status:** `400 Bad Request`

---

#### 5d. GET non-existent report

**Request:**
```bash
curl -X GET "http://localhost:3004/api/360-generate-report?survey_id=00000000-0000-0000-0000-000000000000"
```

**Expected Response:**
```json
{
  "error": "No report found for this survey",
  "message": "Report may not have been generated yet"
}
```
**Status:** `404 Not Found`

---

## Expected Responses

### Theme Structure (JSONB)
```json
{
  "theme": "Strong Communication Skills",
  "sentiment": "positive",
  "frequency": 7,
  "supporting_quotes": [
    "Always clear and concise in team meetings",
    "Great at explaining complex technical concepts"
  ],
  "relationships_mentioned": ["peer", "manager", "direct_report"]
}
```

### Sentiment by Relationship (JSONB)
```json
{
  "manager": 0.85,
  "peer": 0.78,
  "direct_report": 0.92,
  "self": 0.70,
  "other": 0.80
}
```

### String Arrays (TEXT[])
- `overall_strengths`: 3-5 items
- `development_areas`: 3-5 items
- `recommendations`: 4-6 items
- `key_insights`: 3-5 items
- `consensus_areas`: 2-4 items
- `outlier_opinions`: 0-3 items

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `survey_id is required` | Missing request body parameter | Include `survey_id` in POST body |
| `Survey not found` | Invalid survey_id | Verify survey exists in database |
| `No reviewers found` | Survey has no reviewers | Add reviewers to survey first |
| `No responses found` | Survey has no completed responses | Wait for reviewers to complete survey |
| `Failed to fetch questions` | Database query error | Check survey_questions table |
| `Internal server error` | AI API error or database error | Check server logs, verify API keys |

### Debug Mode

**Enable detailed error messages:**
- Set `NODE_ENV=development` in `.env.local`
- Check server console for detailed logs
- Look for `🤖 Calling AI analyzer` console messages
- Verify Anthropic API key is valid

---

## Integration Testing

### End-to-End Test Flow

**Prerequisites:**
1. Create a test survey with real employee data
2. Add 5-8 reviewers with different relationships
3. Have reviewers complete the survey with substantial text responses

**Test Steps:**

1. **Verify Survey Readiness**
   ```sql
   SELECT
       s.id,
       s.survey_name,
       COUNT(r.id) as total_reviewers,
       COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reviewers,
       COUNT(resp.id) as total_responses
   FROM feedback_360_surveys s
   LEFT JOIN feedback_360_survey_reviewers r ON r.survey_id = s.id
   LEFT JOIN feedback_360_responses resp ON resp.survey_id = s.id
   WHERE s.id = 'YOUR_SURVEY_ID'
   GROUP BY s.id, s.survey_name;
   ```

2. **Generate Report via API**
   ```bash
   curl -X POST http://localhost:3004/api/360-generate-report \
     -H "Content-Type: application/json" \
     -d '{"survey_id": "YOUR_SURVEY_ID"}' \
     | jq '.'
   ```

3. **Verify Report in Database**
   ```sql
   SELECT * FROM feedback_360_reports WHERE survey_id = 'YOUR_SURVEY_ID';
   ```

4. **Retrieve Report via API**
   ```bash
   curl "http://localhost:3004/api/360-generate-report?survey_id=YOUR_SURVEY_ID" | jq '.'
   ```

5. **Verify Report Quality**
   - Check that themes are relevant to responses
   - Verify sentiment scores are between 0 and 1
   - Confirm strengths/weaknesses align with feedback
   - Ensure recommendations are actionable

---

## Performance Benchmarks

### Expected Performance

| Metric | Value |
|--------|-------|
| API Response Time (POST) | 10-30 seconds |
| API Response Time (GET) | < 500ms |
| Database Insert | < 100ms |
| AI Processing Time | 8-25 seconds |
| Token Usage (Claude) | 2,000-10,000 tokens |
| Cost per Report | $3-15 USD |

### Optimization Tips

- Ensure responses have substantial text (not just ratings)
- At least 5-8 reviewers for meaningful themes
- Mix of relationships (manager, peers, reports)
- Survey should have 8-12 questions

---

## Monitoring & Debugging

### Server Logs

**Look for these log messages:**

```
🤖 Calling AI analyzer for survey: <survey_id>
   - Participants: 8
   - Responses: 8
   - Questions: 12
✅ AI analysis complete
💾 Report saved successfully
```

**Error Patterns:**

```
Error generating 360 report: <error>
Error saving report: <error>
Error fetching responses: <error>
```

### Database Monitoring

**Check report generation status:**
```sql
SELECT
    s.id as survey_id,
    s.survey_name,
    s.status,
    r.id as report_id,
    r.generated_at,
    r.generated_by,
    CASE WHEN r.id IS NOT NULL THEN 'Report Exists' ELSE 'No Report' END as report_status
FROM feedback_360_surveys s
LEFT JOIN feedback_360_reports r ON r.survey_id = s.id
WHERE s.status = 'completed'
ORDER BY s.updated_at DESC;
```

---

## Troubleshooting

### Issue: "ANTHROPIC_API_KEY not found"

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_ANTHROPIC_API_KEY

# Add to .env.local
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-api03-...

# Restart dev server
npm run dev
```

---

### Issue: "relationship column does not exist"

**Solution:**
Run the relationship column migration:
```bash
# In Supabase SQL Editor, run:
# migration-add-relationship-column.sql
```

Then update TypeScript types:
```bash
# Already done - restart dev server
npm run dev
```

---

### Issue: Report content is generic/low quality

**Causes:**
- Not enough text responses (only ratings)
- Too few reviewers (< 5)
- Short, vague responses

**Solution:**
- Ensure survey has open-ended text questions
- Get at least 5-8 reviewers to complete
- Encourage detailed, specific feedback

---

### Issue: "Failed to save report" - Column type mismatch

**Cause:** JSONB/array type mismatch between TypeScript and PostgreSQL

**Solution:**
- Verify TypeScript types in `types/supabase.ts` match database
- Check that arrays use `string[]` type (not `Json`)
- Check that themes/sentiment use `Json` type

---

## Test Results Checklist

Use this checklist to verify all tests pass:

- [ ] ✅ Test 1: Found survey with responses
- [ ] ✅ Test 2: Generated report successfully (POST)
- [ ] ✅ Test 3: Retrieved report successfully (GET)
- [ ] ✅ Test 4: UPSERT behavior works (no duplicates)
- [ ] ✅ Test 5a: Error handling - missing survey_id
- [ ] ✅ Test 5b: Error handling - non-existent survey
- [ ] ✅ Test 5c: Error handling - no responses
- [ ] ✅ Test 5d: Error handling - no report found
- [ ] ✅ Database: Report saved correctly
- [ ] ✅ Database: Survey status updated to 'completed'
- [ ] ✅ Database: No duplicate reports
- [ ] ✅ Report Quality: Themes are relevant
- [ ] ✅ Report Quality: Sentiment scores valid (0-1)
- [ ] ✅ Report Quality: Recommendations actionable
- [ ] ✅ Performance: POST completes in < 30 seconds
- [ ] ✅ Performance: GET completes in < 500ms

---

## Next Steps

After all tests pass:

1. **Phase 3: Frontend Integration**
   - Wire up UI button in `Feedback360Dashboard.tsx`
   - Display report in results modal
   - Add loading states

2. **Phase 4: Test Data Generation**
   - Create script to generate test surveys
   - Populate with realistic responses
   - Automate E2E testing

3. **Production Deployment**
   - Set up environment variables
   - Monitor API costs (Anthropic usage)
   - Set up error alerts
   - Add rate limiting if needed

---

## Support & References

**Related Files:**
- API Route: `app/api/360-generate-report/route.ts`
- AI Analyzer: `lib/survey360Analyzer.ts`
- Database Schema: `migration-add-360-reports-table.sql`
- Type Definitions: `types/supabase.ts`

**Documentation:**
- API Architecture: See original architecture plan in chat history
- Database Migration: `SCHEMA-MIGRATION.md`
- Testing Queries: `TEST-*.sql` files

**External APIs:**
- Anthropic Claude API: https://docs.anthropic.com
- Supabase Docs: https://supabase.com/docs

---

**Last Updated:** October 28, 2025
**Version:** 1.0.0
**Status:** Ready for Testing ✅
