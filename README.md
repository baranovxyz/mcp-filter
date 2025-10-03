# mcp-filter

[![npm version](https://badge.fury.io/js/mcp-filter.svg)](https://www.npmjs.com/package/mcp-filter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server proxy to filter tools, resources, and prompts from upstream MCP servers.

## Installation

```bash
npm install -g mcp-filter
# or use with npx
npx mcp-filter [options] -- <upstream-command>
```

## Usage

### Basic Usage

```bash
# Exclude mode: filter out specific tools
npx mcp-filter --exclude "playwright*" -- npx @playwright/mcp

# Include mode: only allow specific tools
npx mcp-filter --include "browser_navigate" --include "browser_screenshot" -- npx @playwright/mcp

# Combination: include with exceptions
npx mcp-filter --include "browser_*" --exclude "browser_close" -- npx @playwright/mcp

# Multiple patterns
npx mcp-filter --exclude "playwright*" --exclude "unsafe_*" -- npx @playwright/mcp

# Use with any MCP server
npx mcp-filter --exclude "debug*" -- node my-mcp-server.js
```

## Options

- `--exclude <pattern>` - Exclude tools/resources/prompts matching this pattern (like rsync --exclude)
- `--include <pattern>` - Include ONLY tools/resources/prompts matching this pattern (like rsync --include)
- `--` - Separates filter options from upstream server command

Both options can be specified multiple times and combined together.

## Filtering Modes

### Exclude Mode (--exclude only)

Blocks specific items, allows everything else:

```bash
# Block browser_close and browser_evaluate tools
npx mcp-filter --exclude "browser_close" --exclude "browser_evaluate" -- npx @playwright/mcp
```

### Include Mode (--include only)

Allows ONLY specified items, blocks everything else:

```bash
# Only allow safe, read-only browser tools
npx mcp-filter --include "browser_navigate" --include "browser_screenshot" -- npx @playwright/mcp
```

### Combination Mode (--include + --exclude)

Include patterns with exceptions. **Exclude patterns always take precedence** (same as rsync):

```bash
# Allow all browser tools EXCEPT close and evaluate
npx mcp-filter --include "browser_*" --exclude "browser_close" --exclude "browser_evaluate" -- npx @playwright/mcp
```

**Precedence Rule:** `--exclude` > `--include` > default allow

When a tool matches both `--include` and `--exclude`, it will be **excluded** (rsync-style behavior).

## Pattern Examples

- `playwright*` - Match all items starting with "playwright"
- `*_admin` - Match all items ending with "\_admin"
- `test_*_debug` - Match items with pattern in middle
- `exact_name` - Match exact name
- `browser_*` - Match all browser-related tools

## Using with Cursor IDE

Add to your `.cursor/mcp.json` or `~/.cursor/mcp.json`:

### Example 1: Exclude dangerous tools

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude",
        "browser_close",
        "--exclude",
        "browser_evaluate",
        "--",
        "npx",
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

### Example 2: Include safe tools only

```json
{
  "mcpServers": {
    "playwright-safe": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include",
        "browser_navigate",
        "--include",
        "browser_screenshot",
        "--include",
        "browser_snapshot",
        "--",
        "npx",
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

### Example 3: Include category with exceptions

```json
{
  "mcpServers": {
    "playwright-filtered": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include",
        "browser_*",
        "--exclude",
        "browser_close",
        "--",
        "npx",
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

After adding the configuration, restart Cursor completely to apply the changes.

## How It Works

mcp-filter acts as a proxy between an MCP client and an upstream MCP server:

1. Spawns the upstream MCP server as a subprocess
2. Connects to it as an MCP client
3. Exposes a filtered MCP server interface
4. Filters `tools/list`, `resources/list`, and `prompts/list` responses
5. Blocks calls to filtered items with error responses

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm test

# Test locally
./dist/index.js --disable "playwright*" -- npx tsx test-server.ts
```

## Links

- [npm package](https://www.npmjs.com/package/mcp-filter)
- [GitHub repository](https://github.com/baranovxyz/mcp-filter)

## License

MIT
