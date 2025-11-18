#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployeesFields() {
  console.log('=== Checking Employees View Fields ===\n');

  // Fetch one employee to see what fields are returned
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error fetching employee:', error);
    return;
  }

  if (!data) {
    console.log('⚠️  No employees found');
    return;
  }

  console.log('📋 Fields in employees view:\n');
  const fields = Object.keys(data).sort();

  fields.forEach(field => {
    const value = data[field];
    const type = typeof value;
    console.log(`  ${field}: ${type} = ${JSON.stringify(value)}`);
  });

  console.log('\n🔍 Checking for role-related fields:');
  console.log(`  - Has 'role' field: ${fields.includes('role') ? '✅ YES' : '❌ NO'}`);
  console.log(`  - Has 'app_role' field: ${fields.includes('app_role') ? '✅ YES' : '❌ NO'}`);

  if (fields.includes('role')) {
    console.log(`  - role value: "${data.role}"`);
  }
  if (fields.includes('app_role')) {
    console.log(`  - app_role value: "${data.app_role}"`);
  }

  console.log('\n');
}

checkEmployeesFields();
