#!/usr/bin/env node
/**
 * MCP Setup Script
 *
 * Helps configure MCP (Model Context Protocol) server for this project.
 * Generates .claude/mcp.json configuration based on environment variables.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🔧 MCP Setup for Talent Management System\n');
  console.log('This script will help you configure the MCP server for database access.\n');

  // Read current environment
  const envPath = path.join(__dirname, '..', '.env.local');
  let supabaseUrl = '';
  let supabaseProjectId = '';

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
    if (urlMatch) {
      supabaseUrl = urlMatch[1].trim();
      // Extract project ID from URL (e.g., ynycbfyzbavbgxvniylt from https://ynycbfyzbavbgxvniylt.supabase.co)
      const projectMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (projectMatch) {
        supabaseProjectId = projectMatch[1];
      }
    }
  }

  if (supabaseProjectId) {
    console.log(`✓ Detected Supabase Project ID: ${supabaseProjectId}\n`);
  } else {
    console.log('⚠️  Could not detect Supabase Project ID from .env.local\n');
    supabaseProjectId = await question('Enter your Supabase Project ID: ');
  }

  console.log('\nTo get your Supabase Access Token:');
  console.log('1. Go to https://supabase.com/dashboard/account/tokens');
  console.log('2. Generate a new token');
  console.log('3. Copy the token\n');

  const accessToken = await question('Enter your Supabase Access Token (or press Enter to skip): ');

  // Create .claude directory if it doesn't exist
  const claudeDir = path.join(__dirname, '..', '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
    console.log('\n✓ Created .claude directory');
  }

  // Generate MCP configuration
  const mcpConfig = {
    mcpServers: {
      'supabase-talent-management': {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-supabase',
          supabaseProjectId
        ],
        env: accessToken ? {
          SUPABASE_ACCESS_TOKEN: accessToken
        } : {}
      }
    }
  };

  const mcpPath = path.join(claudeDir, 'mcp.json');
  fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
  console.log(`\n✓ MCP configuration written to ${mcpPath}`);

  if (!accessToken) {
    console.log('\n⚠️  Warning: No access token provided.');
    console.log('   You will need to add SUPABASE_ACCESS_TOKEN to .claude/mcp.json manually.');
    console.log('   Or set it as an environment variable before starting Claude Code.');
  }

  console.log('\n✅ MCP setup complete!');
  console.log('\nNext steps:');
  console.log('1. Restart Claude Code to load the MCP configuration');
  console.log('2. The MCP server will provide database access to Claude Code');
  console.log('3. Test with: npm run verify-db\n');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
