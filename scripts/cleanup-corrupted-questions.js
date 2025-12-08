/**
 * Script to clean up corrupted questions in the database
 * These questions have nested JSON like {"text":"{"text":"actual question"}"}
 *
 * Run with: node scripts/cleanup-corrupted-questions.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Unwrap nested JSON to get the actual question text
function unwrapQuestionText(text) {
  if (typeof text !== 'string') return String(text || '');

  let current = text;
  let maxIterations = 20;

  while (maxIterations-- > 0) {
    if (current.startsWith('{') && current.includes('"text"')) {
      try {
        const parsed = JSON.parse(current);
        if (parsed && typeof parsed.text === 'string') {
          current = parsed.text;
          continue;
        }
      } catch {
        break;
      }
    }
    break;
  }

  return current;
}

async function cleanupCorruptedQuestions() {
  console.log('Fetching all questions...');

  // Get all questions
  const { data: allQuestions, error: fetchError } = await supabase
    .from('feedback_360_questions')
    .select('id, question_text, is_default, is_active');

  if (fetchError) {
    console.error('Error fetching questions:', fetchError);
    return;
  }

  console.log(`Found ${allQuestions.length} total questions`);

  // Separate corrupted and clean questions
  const corrupted = allQuestions.filter(q =>
    q.question_text && (
      q.question_text.startsWith('{') ||
      q.question_text.includes('{"text":')
    )
  );

  const clean = allQuestions.filter(q =>
    q.question_text && !q.question_text.startsWith('{')
  );

  console.log(`Corrupted: ${corrupted.length}, Clean: ${clean.length}`);

  // Build a map of clean question text -> question record
  const cleanMap = new Map();
  for (const q of clean) {
    cleanMap.set(q.question_text, q);
  }

  // Process each corrupted question
  let fixed = 0;
  let migrated = 0;
  let deleted = 0;
  let errors = 0;

  for (const corruptedQ of corrupted) {
    const unwrapped = unwrapQuestionText(corruptedQ.question_text);
    console.log(`\nProcessing corrupted ID: ${corruptedQ.id}`);
    console.log(`  Original (truncated): ${corruptedQ.question_text.substring(0, 80)}...`);
    console.log(`  Unwrapped: ${unwrapped.substring(0, 80)}...`);

    // Check if a clean version exists
    const cleanVersion = cleanMap.get(unwrapped);

    if (cleanVersion) {
      console.log(`  -> Clean version exists (ID: ${cleanVersion.id})`);

      // Migrate survey_questions to point to clean version
      const { data: surveyQs, error: sqError } = await supabase
        .from('feedback_360_survey_questions')
        .select('id, survey_id')
        .eq('question_id', corruptedQ.id);

      if (sqError) {
        console.error(`  Error fetching survey_questions:`, sqError);
        errors++;
        continue;
      }

      if (surveyQs && surveyQs.length > 0) {
        console.log(`  -> Migrating ${surveyQs.length} survey_question links to clean version`);

        // Update each survey_question to point to clean version
        for (const sq of surveyQs) {
          // Check if clean version already linked to this survey
          const { data: existing } = await supabase
            .from('feedback_360_survey_questions')
            .select('id')
            .eq('survey_id', sq.survey_id)
            .eq('question_id', cleanVersion.id)
            .maybeSingle();

          if (existing) {
            // Clean version already linked, just delete the corrupted link
            const { error: delError } = await supabase
              .from('feedback_360_survey_questions')
              .delete()
              .eq('id', sq.id);

            if (delError) {
              console.error(`  Error deleting duplicate survey_question:`, delError);
              errors++;
            }
          } else {
            // Update to point to clean version
            const { error: updateError } = await supabase
              .from('feedback_360_survey_questions')
              .update({ question_id: cleanVersion.id })
              .eq('id', sq.id);

            if (updateError) {
              console.error(`  Error updating survey_question:`, updateError);
              errors++;
            }
          }
        }
        migrated++;
      }

      // Delete the corrupted question
      const { error: deleteError } = await supabase
        .from('feedback_360_questions')
        .delete()
        .eq('id', corruptedQ.id);

      if (deleteError) {
        console.error(`  Error deleting corrupted question:`, deleteError);
        errors++;
      } else {
        console.log(`  -> Deleted corrupted question`);
        deleted++;
      }
    } else {
      // No clean version exists, fix in place
      console.log(`  -> No clean version, fixing in place`);

      const { error: updateError } = await supabase
        .from('feedback_360_questions')
        .update({ question_text: unwrapped })
        .eq('id', corruptedQ.id);

      if (updateError) {
        console.error(`  Error fixing question:`, updateError);
        errors++;
      } else {
        console.log(`  -> Fixed in place`);
        fixed++;
        // Add to clean map so subsequent duplicates can be migrated
        cleanMap.set(unwrapped, { ...corruptedQ, question_text: unwrapped });
      }
    }
  }

  console.log('\n========== CLEANUP COMPLETE ==========');
  console.log(`Fixed in place: ${fixed}`);
  console.log(`Migrated & deleted: ${migrated + deleted}`);
  console.log(`Errors: ${errors}`);
}

cleanupCorruptedQuestions().catch(console.error);
