#!/usr/bin/env node
/**
 * Generate Entity Relationship Diagram (ERD) in Mermaid format
 * 
 * This script creates a visual ERD that can be rendered in Markdown viewers
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function executeQuery(query) {
  try {
    const { data, error } = await client.rpc('exec_sql', { query });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Query error:', err.message);
    return null;
  }
}

async function main() {
  console.log('\n🗺️  Generating Entity Relationship Diagram...\n');

  // Get tables
  const tablesQuery = `
    SELECT table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  const tables = await executeQuery(tablesQuery);

  // Get columns
  const columnsQuery = `
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PK'
        WHEN fk.column_name IS NOT NULL THEN 'FK'
        ELSE ''
      END as key_type
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    LEFT JOIN (
      SELECT ku.table_name, ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
    ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
    LEFT JOIN (
      SELECT ku.table_name, ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position;
  `;
  const columns = await executeQuery(columnsQuery);

  // Get foreign keys
  const fkQuery = `
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `;
  const foreignKeys = await executeQuery(fkQuery);

  if (!tables || !columns || !foreignKeys) {
    console.error('Failed to fetch database schema');
    process.exit(1);
  }

  // Generate Mermaid ERD
  let mermaid = '```mermaid\nerDiagram\n\n';

  // Group columns by table
  const tableColumns = {};
  columns.forEach(col => {
    if (!tableColumns[col.table_name]) {
      tableColumns[col.table_name] = [];
    }
    tableColumns[col.table_name].push(col);
  });

  // Add table definitions
  tables.forEach(table => {
    const cols = tableColumns[table.table_name] || [];
    mermaid += `  ${table.table_name} {\n`;
    
    cols.forEach(col => {
      const keyIndicator = col.key_type ? ` ${col.key_type}` : '';
      mermaid += `    ${col.data_type} ${col.column_name}${keyIndicator}\n`;
    });
    
    mermaid += `  }\n\n`;
  });

  // Add relationships
  foreignKeys.forEach(fk => {
    mermaid += `  ${fk.foreign_table} ||--o{ ${fk.table_name} : "${fk.column_name}"\n`;
  });

  mermaid += '```\n';

  // Save to file
  const outputPath = path.join(__dirname, '..', 'DATABASE_ERD.md');
  let output = '# Database Entity Relationship Diagram\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += '## Schema Visualization\n\n';
  output += mermaid;
  output += '\n\n## Legend\n\n';
  output += '- **PK**: Primary Key\n';
  output += '- **FK**: Foreign Key\n';
  output += '- `||--o{`: One-to-Many relationship\n';

  fs.writeFileSync(outputPath, output);
  
  console.log(`✅ ERD saved to: ${outputPath}\n`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
