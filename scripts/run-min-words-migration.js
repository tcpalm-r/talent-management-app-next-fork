#!/usr/bin/env node

/**
 * Migration script to add min_words column to feedback_360_questions table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting migration: add min_words to feedback_360_questions');

  try {
    // Step 1: Add the column
    console.log('\n📝 Step 1: Adding min_words column...');
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE feedback_360_questions ADD COLUMN IF NOT EXISTS min_words INTEGER;'
    });

    if (addColumnError && !addColumnError.message.includes('already exists')) {
      console.error('❌ Error adding column:', addColumnError);
      // Continue anyway - column might already exist
    } else {
      console.log('✅ Column added successfully');
    }

    // Step 2: Update existing questions with default value
    console.log('\n📝 Step 2: Setting default value for existing questions...');
    const { data: updateData, error: updateError } = await supabase
      .from('feedback_360_questions')
      .update({ min_words: 50 })
      .is('min_words', null)
      .select();

    if (updateError) {
      console.error('❌ Error updating existing questions:', updateError);
    } else {
      console.log(`✅ Updated ${updateData?.length || 0} existing questions with default min_words=50`);
    }

    // Step 3: Verify the migration
    console.log('\n📝 Step 3: Verifying migration...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('feedback_360_questions')
      .select('id, question_text, min_words')
      .limit(5);

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
    } else {
      console.log('✅ Migration verified. Sample questions:');
      verifyData?.forEach((q, i) => {
        console.log(`   ${i + 1}. ${q.question_text.substring(0, 50)}... (min_words: ${q.min_words})`);
      });
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your dev server if needed');
    console.log('   2. Go to Admin Settings to configure minimum word counts for questions');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
