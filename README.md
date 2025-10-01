# mcp-filter

MCP server proxy to filter tools, resources, and prompts from upstream MCP servers.

## Installation

```bash
npm install -g mcp-filter
# or use with npx
npx mcp-filter [options] -- <upstream-command>
```

## Usage

```bash
# Filter out playwright tools
npx mcp-filter --disable "playwright*" -- npx @playwright/mcp

# Filter multiple patterns
npx mcp-filter --disable "playwright*" --disable "unsafe_*" -- npx @playwright/mcp

# Use with any MCP server
npx mcp-filter --disable "debug*" -- node my-mcp-server.js
```

## Options

- `--disable <pattern>` - Glob pattern for tools/resources/prompts to disable (can be specified multiple times)
- `--` - Separates filter options from upstream server command

## Pattern Examples

- `playwright*` - Match all items starting with "playwright"
- `*_admin` - Match all items ending with "_admin"
- `test_*_debug` - Match items with pattern in middle
- `exact_name` - Match exact name

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

# Test locally
./dist/index.js --disable "playwright*" -- npx tsx test-server.ts
```

## License

MIT
