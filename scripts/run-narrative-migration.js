const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running narrative fields migration...');

  const sql = fs.readFileSync('migrations/add_narrative_fields.sql', 'utf8');

  console.log('SQL to execute:');
  console.log(sql);
  console.log('\n---\n');
  console.log('Please run the above SQL in your Supabase SQL Editor:');
  console.log(`${supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql')}`);
  console.log('\nOr use a PostgreSQL client to connect and run the migration.');
}

runMigration();
