#!/bin/bash

# Phase 1 Database Cleanup - One Command Execution
# Run this script to execute the cleanup

# Load environment variables
source .env.local 2>/dev/null || true

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in .env.local"
  exit 1
fi

echo "🗑️  Database Cleanup - Phase 1"
echo "======================================"
echo ""
echo "Executing 9 DROP statements..."
echo ""

# Execute the cleanup SQL
psql "$DATABASE_URL" << 'EOF'
-- Phase 1 Cleanup
DROP TABLE IF EXISTS performance_review_participants CASCADE;
DROP TABLE IF EXISTS performance_review_deadlines CASCADE;
DROP TABLE IF EXISTS user_profile_changes CASCADE;
DROP VIEW IF EXISTS active_performance_reviews CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_performance_reviews CASCADE;
DROP VIEW IF EXISTS active_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS active_users CASCADE;
DROP VIEW IF EXISTS pending_users CASCADE;
DROP MATERIALIZED VIEW IF EXISTS pending_users CASCADE;

-- Verification
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All objects successfully removed!'
    ELSE '⚠️  Some objects may still exist'
  END as result
FROM (
  SELECT tablename as name FROM pg_tables WHERE schemaname = 'public'
    AND tablename IN ('performance_review_participants', 'performance_review_deadlines', 'user_profile_changes')
  UNION
  SELECT viewname as name FROM pg_views WHERE schemaname = 'public'
    AND viewname IN ('active_performance_reviews', 'active_users', 'pending_users')
  UNION
  SELECT matviewname as name FROM pg_matviews WHERE schemaname = 'public'
    AND matviewname IN ('active_performance_reviews', 'active_users', 'pending_users')
) subquery;
EOF

echo ""
echo "✅ Phase 1 cleanup completed!"
echo ""
echo "📋 Next steps:"
echo "  1. Test your app"
echo "  2. Run: node scripts/verify-supabase.js"
echo ""
