# mcp-filter

[![npm version](https://badge.fury.io/js/mcp-filter.svg)](https://www.npmjs.com/package/mcp-filter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Filter tools, resources, and prompts from MCP servers. Control what AI agents can access.

## Quick Start

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "playwright-safe": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "browser_close",
        "--exclude", "browser_evaluate",
        "--include", "browser_*",
        "--",
        "npx", "@playwright/mcp@latest"
      ]
    }
  }
}
```

This allows all `browser_*` tools **except** `browser_close` and `browser_evaluate`.

## Why?

- **Security** - Block dangerous tools (eval, delete, admin operations)
- **Control** - Whitelist only the tools your agent needs
- **Works everywhere** - Proxy any MCP server (local or remote)

## Installation

```bash
npx mcp-filter [options] -- <server-command>
# or install globally
npm install -g mcp-filter
```

## How Patterns Work

Use `--include` and `--exclude` with glob patterns:

```bash
--include "browser_*"     # Allow all browser_* tools
--exclude "browser_close" # Block browser_close
--exclude "delete_*"      # Block all delete_* tools
```

**Order matters!** Patterns are evaluated in order, first match wins:

```bash
# CORRECT: exclude first, then include
--exclude "browser_close" --include "browser_*"
# Result: browser_close blocked, other browser_* allowed

# WRONG: include first (exclude never matches!)
--include "browser_*" --exclude "browser_close"
# Result: ALL browser_* allowed (browser_* matches first)
```

## Configuration

### JSON Config (Claude Desktop, Cursor, VS Code)

Each argument must be a **separate string** in the array:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "dangerous_*",
        "--include", "safe_*",
        "--",
        "npx", "your-mcp-server"
      ]
    }
  }
}
```

**Config file locations:**
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- Cursor: `.cursor/mcp.json` or `~/.cursor/mcp.json`

### CLI Usage

```bash
# Local server (stdio)
npx mcp-filter --exclude "admin_*" -- npx @playwright/mcp

# Remote server (HTTP)
npx mcp-filter --exclude "delete_*" --upstream-url https://mcp.example.com/mcp

# With authentication header
npx mcp-filter --exclude "admin_*" \
  --upstream-url https://api.example.com/mcp \
  --header "Authorization: Bearer token"
```

## Common Mistakes

### JSON args must be separate strings

**WRONG:**
```json
"args": ["mcp-filter", "--include browser_* --", "npx", "server"]
```

**CORRECT:**
```json
"args": ["mcp-filter", "--include", "browser_*", "--", "npx", "server"]
```

The shell splits arguments for you. JSON doesn't - you must split them manually.

mcp-filter detects this and shows a helpful error:

```
Malformed argument: "--include browser_* --"

WRONG:
  "args": ["--include browser_* --", ...]

CORRECT:
  "args": ["--include", "browser_*", "--", ...]
```

### Pattern order matters

Put `--exclude` patterns **before** `--include` to create exceptions:

```bash
# Block browser_close, allow other browser_* tools
--exclude "browser_close" --include "browser_*"
```

## Options Reference

| Option | Description |
|--------|-------------|
| `--include <pattern>` | Include items matching pattern (whitelist) |
| `--exclude <pattern>` | Exclude items matching pattern (blocklist) |
| `--upstream-url <url>` | Connect to remote HTTP/SSE server |
| `--transport <type>` | Transport: `stdio`, `http`, `sse` (auto-detected) |
| `--header <header>` | HTTP header (format: `"Key: Value"`) |
| `--help` | Show help |

Options can be repeated. Patterns use glob syntax via [minimatch](https://github.com/isaacs/minimatch).

## How It Works

```
MCP Client → mcp-filter → Upstream MCP Server
                ↓
         Filters tools/list
         Blocks excluded calls
```

1. Proxies requests between your MCP client and upstream server
2. Filters `tools/list`, `resources/list`, `prompts/list` responses
3. Blocks calls to filtered items with error responses

## Development

```bash
pnpm install
pnpm run build
pnpm test
```

## Links

- [npm package](https://www.npmjs.com/package/mcp-filter)
- [GitHub](https://github.com/baranovxyz/mcp-filter)

## License

MIT
