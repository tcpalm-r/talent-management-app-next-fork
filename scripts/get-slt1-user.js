/**
 * Query database for SLT 1 [TEST] user to get updated information
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

async function getSLT1User() {
  console.log('Querying database for SLT 1 [TEST]...\n');

  // Try to find by full_name first
  let { data, error } = await supabase
    .from('user_profiles')
    .select('id, auth0_id, email, full_name, given_name, family_name, picture, app_role, app_permissions, department, title')
    .eq('full_name', 'SLT 1 [TEST]')
    .eq('is_active', true)
    .single();

  // If not found by name, try by email (in case email wasn't changed)
  if (error || !data) {
    console.log('Not found by name, trying email leader2.test@example.com...\n');
    const result = await supabase
      .from('user_profiles')
      .select('id, auth0_id, email, full_name, given_name, family_name, picture, app_role, app_permissions, department, title')
      .eq('email', 'leader2.test@example.com')
      .eq('is_active', true)
      .single();

    data = result.data;
    error = result.error;
  }

  if (error || !data) {
    console.error('Error: Could not find SLT 1 [TEST] user');
    console.error(error);
    process.exit(1);
  }

  console.log('Found user:\n');
  console.log(`  {
    id: '${data.id}',
    auth0_id: '${data.auth0_id || data.email}',
    email: '${data.email}',
    full_name: '${data.full_name}',
    given_name: ${data.given_name ? `'${data.given_name}'` : 'null'},
    family_name: ${data.family_name ? `'${data.family_name}'` : 'null'},
    picture: ${data.picture ? `'${data.picture}'` : 'null'},
    app_role: '${data.app_role}',
    app_permissions: ${JSON.stringify(data.app_permissions || { read: true, admin: false, write: true })},
    global_role: 'user',
    capabilities: [],
    app_access: true,
    department: ${data.department ? `'${data.department}'` : 'null'},
    title: '${data.title}',
  },\n`);

  console.log('\n✅ Copy the above object and replace the Leader 2 [TEST] entry in lib/auth.ts');
}

getSLT1User().catch(console.error);
