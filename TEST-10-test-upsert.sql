-- ============================================================================
-- TEST 10: Test UPSERT (ON CONFLICT)
-- ============================================================================
-- This tests the UNIQUE constraint on survey_id and UPSERT functionality

-- STEP 1: Try to insert the same survey_id again - should UPDATE, not INSERT
-- Replace 'PASTE_SURVEY_ID_HERE' with the same survey ID you used in TEST-4

INSERT INTO feedback_360_reports (
    survey_id,
    themes,
    sentiment_by_relationship,
    overall_strengths,
    development_areas,
    recommendations,
    key_insights,
    consensus_areas,
    outlier_opinions,
    generated_at,
    generated_by
) VALUES (
    '3ed5b6c0-62cf-4774-8260-f978b72ff7fb'::uuid,  -- ⚠️ Use SAME survey ID as TEST-4
    '[
        {
            "theme": "UPDATED THEME - Leadership Potential",
            "sentiment": "positive",
            "frequency": 9,
            "supporting_quotes": ["Shows strong leadership qualities"],
            "relationships_mentioned": ["manager"]
        }
    ]'::jsonb,
    '{
        "manager": 0.95,
        "peer": 0.88,
        "direct_report": 0.93,
        "self": 0.80,
        "other": 0.85
    }'::jsonb,
    ARRAY['UPDATED: Leadership potential'],
    ARRAY['UPDATED: Continue developing strategic skills'],
    ARRAY['UPDATED: Consider for management track'],
    ARRAY['UPDATED: Strong leadership indicators'],
    ARRAY['UPDATED: All positive feedback'],
    ARRAY['UPDATED: No negative patterns'],
    NOW(),
    'claude-sonnet-4-20250514-REGENERATED'
)
ON CONFLICT (survey_id) DO UPDATE SET
    themes = EXCLUDED.themes,
    sentiment_by_relationship = EXCLUDED.sentiment_by_relationship,
    overall_strengths = EXCLUDED.overall_strengths,
    development_areas = EXCLUDED.development_areas,
    recommendations = EXCLUDED.recommendations,
    key_insights = EXCLUDED.key_insights,
    consensus_areas = EXCLUDED.consensus_areas,
    outlier_opinions = EXCLUDED.outlier_opinions,
    generated_at = EXCLUDED.generated_at,
    generated_by = EXCLUDED.generated_by,
    updated_at = NOW()
RETURNING id, survey_id, generated_by, created_at, updated_at;

-- Expected Result:
-- - Same id as before (not a new row)
-- - generated_by now shows 'claude-sonnet-4-20250514-REGENERATED'
-- - created_at is unchanged (original creation time)
-- - updated_at is recent (just now)

-- STEP 2: Verify no duplicates exist
SELECT COUNT(*) as record_count, survey_id
FROM feedback_360_reports
GROUP BY survey_id
HAVING COUNT(*) > 1;

-- Expected Result:
-- NO ROWS should be returned (proves UNIQUE constraint works)

-- STEP 3: View the updated record
SELECT
    id,
    survey_id,
    overall_strengths[1] as first_strength,  -- Should show "UPDATED: Leadership potential"
    generated_by,                             -- Should show "REGENERATED"
    created_at,
    updated_at,
    updated_at > created_at as was_updated
FROM feedback_360_reports
ORDER BY updated_at DESC
LIMIT 1;
