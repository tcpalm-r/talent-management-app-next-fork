const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserProfile() {
  console.log('=== Checking User Profiles ===\n');

  // Check the creator of the surveys
  const creatorId = '7c511164-a69c-4a8c-913d-a691d3b169b5';

  const { data: creator, error: creatorError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', creatorId)
    .single();

  if (creatorError) {
    console.error('Error fetching creator:', creatorError);
  } else {
    console.log('Survey Creator Profile:');
    console.log(`  ID: ${creator.id}`);
    console.log(`  Email: ${creator.email}`);
    console.log(`  Name: ${creator.full_name}`);
    console.log(`  Role: ${creator.app_role}`);
    console.log(`  Active: ${creator.is_active}`);
    console.log('');
  }

  // Check Thomas Palmer profiles
  const { data: thomasProfiles, error: thomasError } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('email', '%thomas.palmer%');

  if (thomasError) {
    console.error('Error fetching Thomas profiles:', thomasError);
  } else {
    console.log(`Found ${thomasProfiles.length} Thomas Palmer profile(s):\n`);
    thomasProfiles.forEach((profile, i) => {
      console.log(`${i + 1}. ${profile.full_name}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Role: ${profile.app_role}`);
      console.log(`   Active: ${profile.is_active}`);
      console.log('');
    });
  }

  // Check Elliott Amador
  const { data: elliott, error: elliottError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', '466142ab-fa6c-4c14-b4f4-f074ee762e6e')
    .single();

  if (elliottError) {
    console.error('Error fetching Elliott:', elliottError);
  } else {
    console.log('Elliott Amador (Survey Subject):');
    console.log(`  ID: ${elliott.id}`);
    console.log(`  Email: ${elliott.email}`);
    console.log(`  Name: ${elliott.full_name}`);
    console.log(`  Role: ${elliott.app_role}`);
    console.log('');
  }
}

checkUserProfile();
