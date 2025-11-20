/**
 * Query database for test users to add to lib/auth.ts
 *
 * This script fetches the complete user information for test users
 * and outputs them in the format needed for the TEST_USERS array.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTestUsers() {
  const emails = [
    'admin.test@example.com',
    'leader1.test@example.com',
    'leader2.test@example.com'
  ];

  console.log('Querying database for test users...\n');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, auth0_id, email, full_name, given_name, family_name, picture, app_role, app_permissions, department, title')
    .in('email', emails)
    .eq('is_active', true);

  if (error) {
    console.error('Error querying database:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error('No users found with those emails');
    process.exit(1);
  }

  console.log(`Found ${data.length} users:\n`);

  // Format output for easy copy-paste into lib/auth.ts
  data.forEach(user => {
    console.log(`  {
    id: '${user.id}',
    auth0_id: '${user.auth0_id || user.email}',
    email: '${user.email}',
    full_name: '${user.full_name}',
    given_name: ${user.given_name ? `'${user.given_name}'` : 'null'},
    family_name: ${user.family_name ? `'${user.family_name}'` : 'null'},
    picture: ${user.picture ? `'${user.picture}'` : 'null'},
    app_role: '${user.app_role}',
    app_permissions: ${JSON.stringify(user.app_permissions || { read: true, admin: user.app_role === 'admin', write: user.app_role !== 'user' })},
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: ${user.department ? `'${user.department}'` : 'null'},
    title: '${user.title}',
  },\n`);
  });

  console.log('\n✅ Copy the above objects and add them to the TEST_USERS array in lib/auth.ts');
}

getTestUsers().catch(console.error);
