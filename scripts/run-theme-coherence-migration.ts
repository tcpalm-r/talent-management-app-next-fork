/**
 * Migration script to add theme_coherence column
 * Run with: npx tsx scripts/run-theme-coherence-migration.ts
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

const MIGRATION_SQL = `
ALTER TABLE feedback_360_reports
ADD COLUMN IF NOT EXISTS theme_coherence JSONB DEFAULT NULL;

COMMENT ON COLUMN feedback_360_reports.theme_coherence IS 'Theme coherence analysis from Pass 3: contradictions, related themes, annotations, and coherence summary';
`;

async function runMigration() {
  console.log('🔄 Adding theme_coherence column to feedback_360_reports...\n');

  // Try the exec_sql RPC first
  const { error: rpcError } = await supabase.rpc('exec_sql', {
    sql: MIGRATION_SQL
  });

  if (!rpcError) {
    console.log('✅ Migration completed successfully via exec_sql RPC!');
    return;
  }

  console.log('RPC not available, trying alternative approach...');

  // Test if column already exists by selecting it
  const { error: selectError } = await supabase
    .from('feedback_360_reports')
    .select('theme_coherence')
    .limit(1);

  if (!selectError) {
    console.log('✅ Column theme_coherence already exists!');
    return;
  }

  if (selectError.message.includes('theme_coherence')) {
    console.error('❌ Column does not exist and RPC is not available.');
    console.error('\nPlease run this SQL in the Supabase Dashboard SQL Editor:');
    console.log('─'.repeat(60));
    console.log(MIGRATION_SQL);
    console.log('─'.repeat(60));
    process.exit(1);
  }

  console.error('Unexpected error:', selectError);
  process.exit(1);
}

runMigration().catch(console.error);
