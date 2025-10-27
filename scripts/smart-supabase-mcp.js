#!/usr/bin/env node
/**
 * Smart Supabase MCP Manager
 *
 * Intelligently manages the MCP Supabase server configuration.
 * Features:
 * - Auto-detects Supabase configuration from environment
 * - Manages MCP server lifecycle
 * - Provides health checks and monitoring
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLAUDE_DIR = path.join(__dirname, '..', '.claude');
const MCP_CONFIG_PATH = path.join(CLAUDE_DIR, 'mcp.json');

class MCPManager {
  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.projectId = this.extractProjectId(this.supabaseUrl);
  }

  extractProjectId(url) {
    if (!url) return null;
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    return match ? match[1] : null;
  }

  checkEnvironment() {
    console.log('🔍 Checking environment configuration...\n');

    if (!this.supabaseUrl) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in environment');
      return false;
    }

    if (!this.projectId) {
      console.error('❌ Could not extract project ID from Supabase URL');
      return false;
    }

    console.log(`✓ Supabase URL: ${this.supabaseUrl}`);
    console.log(`✓ Project ID: ${this.projectId}\n`);
    return true;
  }

  ensureClaudeDirectory() {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
      console.log('✓ Created .claude directory\n');
    }
  }

  readExistingConfig() {
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      try {
        const content = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.warn(`⚠️  Could not parse existing MCP config: ${error.message}`);
        return null;
      }
    }
    return null;
  }

  generateConfig(accessToken = null) {
    const config = {
      mcpServers: {
        'supabase-talent-management': {
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-supabase',
            this.projectId
          ]
        }
      }
    };

    // Add access token if provided
    if (accessToken) {
      config.mcpServers['supabase-talent-management'].env = {
        SUPABASE_ACCESS_TOKEN: accessToken
      };
    }

    return config;
  }

  writeConfig(config) {
    this.ensureClaudeDirectory();
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`✓ MCP configuration written to ${MCP_CONFIG_PATH}\n`);
  }

  verifyMCPPackage() {
    console.log('📦 Verifying MCP package availability...\n');

    try {
      // Check if package is available
      execSync('npm view @modelcontextprotocol/server-supabase version', {
        stdio: 'pipe'
      });
      console.log('✓ @modelcontextprotocol/server-supabase is available\n');
      return true;
    } catch (error) {
      console.error('❌ @modelcontextprotocol/server-supabase not found');
      console.error('   This package will be installed automatically when needed by npx\n');
      return false;
    }
  }

  status() {
    console.log('\n📊 MCP Configuration Status\n');
    console.log('='.repeat(50));
    console.log('');

    // Check environment
    const envOk = this.checkEnvironment();
    if (!envOk) {
      console.log('\n❌ Environment configuration incomplete\n');
      return false;
    }

    // Check if config exists
    const existingConfig = this.readExistingConfig();
    if (!existingConfig) {
      console.log('ℹ️  No MCP configuration found');
      console.log('   Run: npm run setup-mcp\n');
      return false;
    }

    // Display config
    console.log('Current MCP Configuration:');
    console.log(JSON.stringify(existingConfig, null, 2));
    console.log('');

    // Check for access token
    const hasToken = existingConfig.mcpServers?.['supabase-talent-management']?.env?.SUPABASE_ACCESS_TOKEN;
    if (!hasToken) {
      console.log('⚠️  No SUPABASE_ACCESS_TOKEN configured');
      console.log('   Some MCP features may be limited\n');
    } else {
      console.log('✓ SUPABASE_ACCESS_TOKEN configured\n');
    }

    console.log('='.repeat(50));
    console.log('');
    return true;
  }

  update(accessToken = null) {
    console.log('\n🔄 Updating MCP Configuration\n');
    console.log('='.repeat(50));
    console.log('');

    if (!this.checkEnvironment()) {
      process.exit(1);
    }

    // Read existing config to preserve other servers
    const existingConfig = this.readExistingConfig();
    const newConfig = this.generateConfig(accessToken);

    if (existingConfig && existingConfig.mcpServers) {
      // Merge with existing config
      newConfig.mcpServers = {
        ...existingConfig.mcpServers,
        ...newConfig.mcpServers
      };
    }

    this.writeConfig(newConfig);

    console.log('✅ MCP configuration updated successfully\n');
    console.log('Next steps:');
    console.log('1. Restart Claude Code to load the new configuration');
    console.log('2. Test with: npm run verify-db\n');
  }

  remove() {
    console.log('\n🗑️  Removing MCP Configuration\n');

    if (fs.existsSync(MCP_CONFIG_PATH)) {
      const existingConfig = this.readExistingConfig();

      if (existingConfig && existingConfig.mcpServers) {
        delete existingConfig.mcpServers['supabase-talent-management'];

        if (Object.keys(existingConfig.mcpServers).length === 0) {
          // No other servers, remove the file
          fs.unlinkSync(MCP_CONFIG_PATH);
          console.log('✓ MCP configuration file removed\n');
        } else {
          // Other servers exist, just update the file
          this.writeConfig(existingConfig);
          console.log('✓ Supabase MCP server removed from configuration\n');
        }
      }
    } else {
      console.log('ℹ️  No MCP configuration found\n');
    }
  }
}

function printHelp() {
  console.log(`
Usage: node scripts/smart-supabase-mcp.js [command]

Commands:
  status    Show current MCP configuration status (default)
  update    Update MCP configuration with current environment
  remove    Remove Supabase MCP server from configuration
  help      Show this help message

Examples:
  node scripts/smart-supabase-mcp.js status
  node scripts/smart-supabase-mcp.js update
  node scripts/smart-supabase-mcp.js remove
  `);
}

async function main() {
  const command = process.argv[2] || 'status';
  const manager = new MCPManager();

  switch (command) {
    case 'status':
      manager.status();
      break;

    case 'update':
      manager.update();
      break;

    case 'remove':
      manager.remove();
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
