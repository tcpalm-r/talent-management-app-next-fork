-- ============================================================================
-- TEST 7: Query Sentiment Scores by Relationship
-- ============================================================================
-- This tests extraction of sentiment scores from JSONB

SELECT
    r.id as report_id,
    r.survey_id,
    s.survey_name,

    -- Extract sentiment scores for each relationship type
    (r.sentiment_by_relationship->>'manager')::numeric as manager_sentiment,
    (r.sentiment_by_relationship->>'peer')::numeric as peer_sentiment,
    (r.sentiment_by_relationship->>'direct_report')::numeric as direct_report_sentiment,
    (r.sentiment_by_relationship->>'self')::numeric as self_sentiment,
    (r.sentiment_by_relationship->>'other')::numeric as other_sentiment,

    -- Calculate average sentiment across all relationships
    (
        (r.sentiment_by_relationship->>'manager')::numeric +
        (r.sentiment_by_relationship->>'peer')::numeric +
        (r.sentiment_by_relationship->>'direct_report')::numeric +
        (r.sentiment_by_relationship->>'self')::numeric +
        (r.sentiment_by_relationship->>'other')::numeric
    ) / 5.0 as avg_sentiment
FROM feedback_360_reports r
INNER JOIN feedback_360_surveys s ON s.id = r.survey_id
ORDER BY r.created_at DESC;

-- Expected Result:
-- Should show sentiment scores:
-- - manager: 0.85
-- - peer: 0.78
-- - direct_report: 0.92
-- - self: 0.70
-- - other: 0.80
-- - avg_sentiment: 0.81
