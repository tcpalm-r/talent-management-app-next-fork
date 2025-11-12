# MCP Configuration - Fixed

## What Was Wrong

Your MCP configuration was trying to use **non-existent packages**:

1. ❌ `@modelcontextprotocol/server-supabase` - **Does not exist in npm**
2. ❌ `@modelcontextprotocol/server-vercel` - **Does not exist in npm**
3. ✅ `@modelcontextprotocol/server-github` - **Exists** (kept this one)

## What I Fixed

### 1. Removed Broken Packages
- Removed the non-existent `@modelcontextprotocol/server-supabase`
- Removed the non-existent `@modelcontextprotocol/server-vercel`

### 2. Installed Working Supabase MCP
Replaced with **`supabase-mcp`** (v1.5.0) - a real, working package for Supabase CRUD operations

**New configuration:**
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "supabase-mcp@latest",
        "supabase-mcp-claude"
      ],
      "env": {
        "SUPABASE_URL": "https://ynycbfyzbavbgxvniylt.supabase.co",
        "SUPABASE_ANON_KEY": "[your-anon-key]",
        "SUPABASE_SERVICE_ROLE_KEY": "[your-service-role-key]",
        "MCP_API_KEY": "talent-management-mcp-key-2025"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": ""
      }
    }
  }
}
```

## Backups Created

- **`.claude/mcp.json.backup`** - Original backup (already existed)
- **`.claude/mcp.json.broken-backup`** - Backup of the broken config before fixing

## How to Use the Supabase MCP

The `supabase-mcp` package provides these operations:

1. **Query data** - SELECT with filters
2. **Insert data** - INSERT new records
3. **Update data** - UPDATE existing records
4. **Delete data** - DELETE records
5. **List tables** - Show all tables in your database

## Next Steps

1. **Restart Claude Code** to load the new MCP configuration
2. The Supabase MCP server will auto-install when first used via `npx`
3. You can now use MCP commands to interact with your Supabase database

## Testing

To verify the MCP is working, try asking Claude to:
- "List all tables in the Supabase database"
- "Query the user_profiles table"
- "Show me the feedback_360_surveys table schema"

---

**Fixed on:** 2025-11-12
**Package used:** `supabase-mcp@1.5.0`
**Repository:** https://github.com/Cappahccino/SB-MCP
