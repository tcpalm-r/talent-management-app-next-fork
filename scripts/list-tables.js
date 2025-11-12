const { createClient } = require('@supabase/supabase-js');

async function listTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Query to get all tables from the public schema
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_type, table_name;
    `
  });

  if (error) {
    // Try alternative method using direct query
    const { data: tables, error: err2 } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public');

    if (err2) {
      console.error('Error fetching tables:', err2);

      // Try one more method - query pg_tables
      const query = `
        SELECT schemaname, tablename, tableowner
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `;

      console.log('Trying alternative query method...');
      console.log('Query:', query);
      process.exit(1);
    } else {
      console.log('Tables in database:');
      console.log(JSON.stringify(tables, null, 2));
    }
  } else {
    console.log('Tables in database:');
    console.log(JSON.stringify(data, null, 2));
  }
}

listTables().catch(console.error);
