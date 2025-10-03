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

- `--exclude <pattern>` - Exclude tools/resources/prompts matching this pattern
- `--include <pattern>` - Include ONLY tools/resources/prompts matching this pattern (whitelist mode)
- `--` - Separates filter options from upstream server command

Both options can be specified multiple times and combined together.

**Filtering style:** rsync-style evaluation where patterns are evaluated in the order specified, and first match wins.

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

**Rsync-style filtering**: patterns evaluated in order, first match wins.

```bash
# Example 1: Include first, then exclude
npx mcp-filter --include "browser_*" --exclude "browser_close" -- npx @playwright/mcp
# Result: All browser_* tools are INCLUDED (browser_* matched first)
# browser_close is also included because it matches browser_* first

# Example 2: Exclude first, then include (different result!)
npx mcp-filter --exclude "browser_close" --include "browser_*" -- npx @playwright/mcp
# Result: browser_close is EXCLUDED (matched exclude first)
# Other browser_* tools are included

# Example 3: More specific patterns first
npx mcp-filter --exclude "browser_close" --exclude "browser_evaluate" --include "browser_*" -- npx @playwright/mcp
# Result: browser_close and browser_evaluate excluded (matched first)
# All other browser_* tools included
```

**Key principle**: Order matters! The first pattern that matches determines if the item is included or excluded.

## Pattern Examples

Patterns use glob syntax (via minimatch):

- `playwright*` - Match all items starting with "playwright"
- `*_admin` - Match all items ending with "\_admin"
- `test_*_debug` - Match items with pattern in middle
- `exact_name` - Match exact name
- `browser_*` - Match all browser-related tools
- `*` - Match everything

## Rsync-Style Filtering

mcp-filter uses rsync-style pattern evaluation:

1. **Order matters**: Patterns are evaluated in the order you specify them
2. **First match wins**: Once a pattern matches, that determines the outcome
3. **Default behavior**:
   - If no patterns specified: allow everything (passthrough)
   - If only `--include`: items not matching any include are excluded (whitelist mode)
   - If only `--exclude`: items not matching any exclude are included
   - If mixed: items not matching any pattern use whitelist mode if includes exist

**Example workflow**:

```bash
# Put more specific patterns first
npx mcp-filter \
  --exclude "browser_close" \
  --exclude "browser_evaluate" \
  --include "browser_*" \
  -- npx @playwright/mcp

# This works because:
# 1. browser_close matches --exclude "browser_close" first → excluded
# 2. browser_evaluate matches --exclude "browser_evaluate" first → excluded
# 3. browser_navigate matches --include "browser_*" → included
# 4. other_tool doesn't match any pattern, but --include exists → excluded (whitelist mode)
```

## Using with Cursor IDE

Add to your `.cursor/mcp.json` or `~/.cursor/mcp.json`:

### Example 1: Exclude specific dangerous tools

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

### Example 3: Include category with exceptions (rsync-style)

```json
{
  "mcpServers": {
    "playwright-filtered": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude",
        "browser_close",
        "--exclude",
        "browser_evaluate",
        "--include",
        "browser_*",
        "--",
        "npx",
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

Note: Exclude patterns come first to match before the broader include pattern.

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
./dist/index.js --exclude "playwright*" -- npx tsx test-server.ts
```

## Links

- [npm package](https://www.npmjs.com/package/mcp-filter)
- [GitHub repository](https://github.com/baranovxyz/mcp-filter)

## License

MIT
