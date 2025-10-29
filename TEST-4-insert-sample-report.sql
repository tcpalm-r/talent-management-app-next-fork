-- ============================================================================
-- TEST 4: Insert Sample Report
-- ============================================================================
-- Replace 'PASTE_SURVEY_ID_HERE' with an actual survey ID from TEST-3

-- STEP 1: Replace the survey_id below with a real UUID from TEST-3
-- Then run this INSERT statement

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
    '3ed5b6c0-62cf-4774-8260-f978b72ff7fb'::uuid,  -- ⚠️ REPLACE THIS WITH ACTUAL SURVEY ID
    '[
        {
            "theme": "Strong Communication Skills",
            "sentiment": "positive",
            "frequency": 7,
            "supporting_quotes": [
                "Always clear and concise in team meetings",
                "Great at explaining complex technical concepts"
            ],
            "relationships_mentioned": ["peer", "manager", "direct_report"]
        },
        {
            "theme": "Time Management Challenges",
            "sentiment": "mixed",
            "frequency": 4,
            "supporting_quotes": [
                "Sometimes misses deadlines during busy periods",
                "Could improve prioritization of tasks"
            ],
            "relationships_mentioned": ["peer", "manager"]
        },
        {
            "theme": "Excellent Technical Expertise",
            "sentiment": "positive",
            "frequency": 8,
            "supporting_quotes": [
                "Deep knowledge of system architecture",
                "Go-to person for complex technical problems"
            ],
            "relationships_mentioned": ["peer", "direct_report", "manager"]
        }
    ]'::jsonb,
    '{
        "manager": 0.85,
        "peer": 0.78,
        "direct_report": 0.92,
        "self": 0.70,
        "other": 0.80
    }'::jsonb,
    ARRAY['Excellent technical expertise', 'Strong collaboration skills', 'Proactive problem-solver'],
    ARRAY['Time management during peak periods', 'Delegation skills', 'Strategic thinking'],
    ARRAY['Consider time management training', 'Practice delegating routine tasks', 'Shadow senior leadership for strategic exposure'],
    ARRAY['Strong consensus on technical abilities', 'Mixed feedback on workload management', 'Universally praised for team collaboration'],
    ARRAY['Self-assessment is lower than peer feedback'],
    ARRAY['Manager feels time management needs work'],
    NOW(),
    'claude-sonnet-4-20250514'
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
-- Should return 1 row showing:
-- - id: newly generated UUID
-- - survey_id: the UUID you pasted
-- - generated_by: 'claude-sonnet-4-20250514'
-- - created_at: current timestamp
-- - updated_at: current timestamp
