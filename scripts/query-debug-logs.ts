/**
 * Query debug logs from Supabase
 * Run with: npx tsx scripts/query-debug-logs.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getLogs() {
  const hours = parseInt(process.argv[2] || '1', 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  console.log(`Querying logs from the last ${hours} hour(s)...\n`);

  const { data, error } = await supabase
    .from('debug_logs')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No logs found');
    return;
  }

  // Group by session
  const sessions = new Map<string, typeof data>();
  data.forEach(log => {
    const existing = sessions.get(log.session_id) || [];
    existing.push(log);
    sessions.set(log.session_id, existing);
  });

  console.log(`Found ${data.length} logs across ${sessions.size} session(s)\n`);
  console.log('='.repeat(80));

  sessions.forEach((logs, sessionId) => {
    const first = logs[0];
    const last = logs[logs.length - 1];

    console.log(`\nSession: ${sessionId}`);
    console.log(`Survey ID: ${first.survey_id || 'N/A'}`);
    console.log(`Started: ${new Date(first.created_at).toLocaleTimeString()}`);
    console.log(`Total elapsed: ${last.elapsed_ms}ms`);
    console.log('-'.repeat(60));

    logs.forEach(log => {
      const prefix = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : '✓';
      console.log(`${prefix} [${log.elapsed_ms}ms] ${log.stage}`);
      console.log(`    ${log.message}`);

      const meta = log.metadata || {};
      if (Object.keys(meta).length > 0) {
        // Format important metrics
        if (meta.participantCount) console.log(`    Participants: ${meta.participantCount}`);
        if (meta.questionCount) console.log(`    Questions: ${meta.questionCount}`);
        if (meta.durationMs) console.log(`    Duration: ${meta.durationMs}ms`);
        if (meta.outputTokens) console.log(`    Output tokens: ${meta.outputTokens}`);
        if (meta.totalCitations) console.log(`    Citations: ${meta.totalCitations}`);
        if (meta.citationCoverage) console.log(`    Coverage: ${meta.citationCoverage}%`);
      }
    });

    console.log('='.repeat(80));
  });
}

getLogs().catch(console.error);
