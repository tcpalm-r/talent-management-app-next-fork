const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backupResponses() {
  console.log('Starting backup of feedback_360_responses...\n');

  // Step 1: Create archive table
  console.log('Step 1: Creating archive table...');
  const { error: createError } = await supabase.from('feedback_360_responses_archive').select('archive_id').limit(1);

  if (createError && createError.code === '42P01') {
    // Table doesn't exist, we need to create it via raw SQL
    // Since we can't run DDL, we'll use a workaround - create via the Supabase dashboard
    console.log('Archive table does not exist. Creating via SQL...');

    // Try using the SQL editor functionality
    const createSQL = `
      CREATE TABLE IF NOT EXISTS feedback_360_responses_archive (
        archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        archived_at TIMESTAMPTZ DEFAULT NOW(),
        archive_reason TEXT DEFAULT 'manual_backup',
        original_id UUID,
        survey_id UUID,
        question_id UUID,
        reviewer_email TEXT,
        response_text TEXT,
        rating INTEGER,
        original_created_at TIMESTAMPTZ,
        original_updated_at TIMESTAMPTZ
      );
    `;
    console.log('\nPlease run this SQL in Supabase dashboard SQL Editor:');
    console.log('---');
    console.log(createSQL);
    console.log('---\n');
    console.log('After creating the table, run this script again.\n');
    return;
  }

  console.log('Archive table exists or was created.\n');

  // Step 2: Fetch all current responses
  console.log('Step 2: Fetching current responses...');
  const { data: responses, error: fetchError } = await supabase
    .from('feedback_360_responses')
    .select('*');

  if (fetchError) {
    console.error('Error fetching responses:', fetchError);
    return;
  }

  console.log(`Found ${responses.length} responses to backup.\n`);

  if (responses.length === 0) {
    console.log('No responses to backup.');
    return;
  }

  // Step 3: Insert into archive
  console.log('Step 3: Inserting into archive...');
  const archiveRecords = responses.map(r => ({
    archive_reason: 'initial_backup_2025_12_12',
    original_id: r.id,
    survey_id: r.survey_id,
    question_id: r.question_id,
    reviewer_email: r.reviewer_email,
    response_text: r.response_text,
    rating: r.rating,
    original_created_at: r.created_at,
    original_updated_at: r.updated_at,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('feedback_360_responses_archive')
    .insert(archiveRecords)
    .select('archive_id');

  if (insertError) {
    console.error('Error inserting archive records:', insertError);
    return;
  }

  console.log(`✅ Successfully archived ${inserted.length} responses!\n`);

  // Step 4: Verify
  console.log('Step 4: Verifying backup...');
  const { data: archived, error: verifyError } = await supabase
    .from('feedback_360_responses_archive')
    .select('archive_id, survey_id, reviewer_email, archived_at')
    .order('archived_at', { ascending: false })
    .limit(5);

  if (verifyError) {
    console.error('Error verifying:', verifyError);
  } else {
    console.log('Recent archive entries:');
    archived.forEach(a => {
      console.log(`  - ${a.reviewer_email} (survey: ${a.survey_id.slice(0,8)}...)`);
    });
  }

  console.log('\n✅ Backup complete! All responses are safely archived.');
}

backupResponses();
