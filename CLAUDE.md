# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`mcp-filter` is an MCP (Model Context Protocol) proxy server that filters tools, resources, and prompts from upstream MCP servers using glob patterns. It acts as a middleware layer between MCP clients and servers.

## Development Commands

```bash
# Package manager: pnpm (required)
pnpm install              # Install dependencies
pnpm run build            # Compile TypeScript to dist/
pnpm run dev              # Watch mode for development
pnpm test                 # Run all tests once
pnpm test:watch           # Run tests in watch mode
pnpm test:coverage        # Generate coverage report
```

### Running Tests

```bash
# Run specific test file
pnpm test tests/unit/cli.test.ts

# Run tests matching pattern
pnpm test filter

# Integration tests only
pnpm test tests/integration/
```

### Manual Testing

```bash
# Build first
pnpm run build

# Test with the included test server
./dist/index.js --disable "playwright*" -- npx tsx test-server.ts

# Test with multiple patterns
./dist/index.js --disable "test*" --disable "blocked_*" -- npx tsx test-server.ts
```

## Architecture

### Three-Layer Proxy Design

1. **CLI Layer** (`src/cli.ts`)
   - Parses `--disable <pattern>` arguments
   - Extracts upstream command after `--` separator
   - Returns `FilterConfig` with patterns and command

2. **Filter Engine** (`src/filter.ts`)
   - Uses `minimatch` for glob pattern matching
   - Filters MCP items (tools/resources/prompts) by name
   - Simple API: `shouldDisable(name)` and `filterList(items)`

3. **Proxy Server** (`src/proxy.ts`)
   - **Dual role**: Acts as both MCP client (to upstream) and MCP server (to caller)
   - **Client side**: Connects to upstream server via `StdioClientTransport`
   - **Server side**: Exposes filtered interface via `StdioServerTransport`
   - **Request handlers**: Intercepts list requests, applies filters, forwards call requests

### Data Flow

```
MCP Client → [ProxyServer.server] → Filter → [ProxyServer.client] → Upstream MCP Server
             ↑ stdio in/out                                          ↑ spawned subprocess
```

### Key Implementation Details

- **Transport**: Uses stdio for both upstream connection and client-facing interface
- **Subprocess management**: `index.ts` spawns upstream server as child process
- **Filtering strategy**:
  - `tools/list`, `resources/list`, `prompts/list` → filter response before returning
  - `tools/call`, `prompts/get` → block if name matches disabled pattern
  - `resources/read` → forwarded (cannot filter by URI easily)

## Code Organization

```
src/
├── index.ts      # Entry point: CLI parsing, subprocess spawning, transport wiring
├── cli.ts        # Argument parser (pure function, well-tested)
├── filter.ts     # Pattern matching logic (pure class, well-tested)
└── proxy.ts      # ProxyServer class: dual MCP client/server

tests/
├── unit/         # Fast isolated tests (cli, filter)
├── integration/  # Full MCP communication tests (proxy.test.ts)
└── fixtures/     # Test helper servers (simple-server.ts)
```

## Testing Approach

- **Framework**: Vitest (ESM-native, TypeScript, fast)
- **Unit tests**: Test pure functions/classes in isolation
- **Integration tests**: Spawn actual MCP servers and test end-to-end communication
- **Fixtures**: `tests/fixtures/simple-server.ts` provides test MCP server with allowed/blocked tools

## MCP SDK Usage Patterns

When working with MCP SDK:

- **Client methods**: Use high-level methods like `client.listTools()`, `client.callTool(params)`
- **Server handlers**: Use `server.setRequestHandler(Schema, handler)` for each request type
- **Schemas**: Import from `@modelcontextprotocol/sdk/types.js` (e.g., `ListToolsRequestSchema`)
- **Transports**:
  - `StdioClientTransport` for connecting to upstream
  - `StdioServerTransport` for exposing server interface
  - Both use stdin/stdout for JSON-RPC communication

## Module System

- **Type**: ES modules (`"type": "module"` in package.json)
- **Imports**: Always use `.js` extension in imports (TypeScript convention for ESM)
- **Build**: TypeScript compiles to `dist/` with Node16 module resolution
