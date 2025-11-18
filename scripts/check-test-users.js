const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTestUsers() {
  const testEmails = [
    'thomas.palmer@sonance.com',
    'mikes@sonance.com',
    'derickd@sonance.com',
    'user3.test@example.com',
    'user4.test@example.com'
  ];

  console.log('Checking test users in database...\n');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, app_role, title, is_active')
    .in('email', testEmails)
    .order('email');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found users in database:');
  console.table(data);

  console.log('\nMissing users:');
  const foundEmails = data.map(u => u.email);
  const missingEmails = testEmails.filter(e => !foundEmails.includes(e));
  console.log(missingEmails.length > 0 ? missingEmails : 'None');
}

checkTestUsers();
