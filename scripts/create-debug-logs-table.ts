/**
 * One-off script to create the debug_logs table
 * Run with: npx tsx scripts/create-debug-logs-table.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  console.log('Creating debug_logs table...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS debug_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        session_id TEXT NOT NULL,
        survey_id TEXT,
        level TEXT NOT NULL DEFAULT 'info',
        stage TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        elapsed_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_debug_logs_session ON debug_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_debug_logs_survey ON debug_logs(survey_id);
      CREATE INDEX IF NOT EXISTS idx_debug_logs_created ON debug_logs(created_at DESC);
    `
  });

  if (error) {
    // Try direct insert to see if table exists
    console.log('RPC not available, trying direct table creation via insert test...');

    const { error: insertError } = await supabase
      .from('debug_logs')
      .insert({
        session_id: 'test',
        stage: 'init',
        message: 'Table creation test',
      });

    if (insertError && insertError.code === '42P01') {
      console.error('Table does not exist and cannot be created via this script.');
      console.error('Please run this SQL in the Supabase Dashboard SQL Editor:');
      console.log(`
CREATE TABLE IF NOT EXISTS debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT NOT NULL,
  survey_id TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  stage TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  elapsed_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_debug_logs_session ON debug_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_survey ON debug_logs(survey_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created ON debug_logs(created_at DESC);
      `);
      process.exit(1);
    } else if (insertError) {
      console.error('Insert error:', insertError);
    } else {
      console.log('Table already exists! Cleaning up test row...');
      await supabase.from('debug_logs').delete().eq('session_id', 'test');
    }
  } else {
    console.log('Table created successfully!');
  }
}

createTable().catch(console.error);
