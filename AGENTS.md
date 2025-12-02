# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`mcp-filter` is an MCP (Model Context Protocol) proxy server that filters tools, resources, and prompts from upstream MCP servers using glob patterns. It acts as a middleware layer between MCP clients and servers.

**Published Package**: https://www.npmjs.com/package/mcp-filter

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

# Test with local stdio server
./dist/index.js --exclude "playwright*" -- npx tsx test-server.ts

# Test with multiple patterns
./dist/index.js --exclude "test*" --exclude "blocked_*" -- npx tsx test-server.ts

# Test include mode
./dist/index.js --include "browser_*" --exclude "browser_close" -- npx tsx test-server.ts

# Test with HTTP transport (remote servers)
./dist/index.js --exclude "delete_*" --upstream-url https://mcp.example.com/mcp

# Test with custom headers
./dist/index.js --exclude "admin_*" \
  --upstream-url https://api.example.com/mcp \
  --header "Authorization: Bearer token123"
```

## Architecture

### Four-Layer Proxy Design

1. **CLI Layer** (`src/cli.ts`)

   - Parses `--exclude <pattern>` and `--include <pattern>` arguments (rsync-style)
   - Parses transport options: `--upstream-url`, `--transport`, `--header`
   - Returns `FilterConfig` with patterns and `transportConfig`
   - Supports both stdio (local servers) and HTTP/SSE (remote servers)

2. **Transport Factory** (`src/transport.ts`)

   - Creates appropriate client transport based on configuration
   - **Stdio**: `StdioClientTransport` for local subprocess servers
   - **HTTP**: `StreamableHTTPClientTransport` for remote HTTP servers
   - **SSE**: `SSEClientTransport` for legacy SSE servers (deprecated)
   - Handles transport-specific configuration (headers, env vars, etc.)

3. **Filter Engine** (`src/filter.ts`)

   - Uses `minimatch` for glob pattern matching
   - Filters MCP items (tools/resources/prompts) by name
   - Simple API: `shouldExclude(name)` and `filterList(items)`
   - Transport-agnostic: works with any MCP protocol messages

4. **Proxy Server** (`src/proxy.ts`)
   - **Dual role**: Acts as both MCP client (to upstream) and MCP server (to caller)
   - **Client side**: Connects to upstream via transport factory (stdio/HTTP/SSE)
   - **Server side**: Exposes filtered interface via `StdioServerTransport`
   - **Request handlers**: Intercepts list requests, applies filters, forwards call requests
   - Fully transport-agnostic: works with any client transport type

### Data Flow

#### Local Servers (Stdio)
```
MCP Client → [ProxyServer.server] → Filter → [ProxyServer.client] → Upstream MCP Server
             ↑ stdio in/out                  StdioClientTransport   ↑ spawned subprocess
```

#### Remote Servers (HTTP)
```
MCP Client → [ProxyServer.server] → Filter → [ProxyServer.client] → Upstream MCP Server
             ↑ stdio in/out                  StreamableHTTPClient   ↑ HTTPS connection
```

### Key Implementation Details

- **Multi-Transport Support**: Supports stdio, HTTP, and SSE transports
  - **Upstream**: Transport factory (`src/transport.ts`) creates appropriate client transport
  - **Downstream**: Always uses stdio for CLI compatibility
  - **Auto-detection**: HTTP by default for URLs, stdio for commands

- **Stdio Transport** (local servers):
  - **Subprocess management**: Delegated entirely to `StdioClientTransport`
  - **IMPORTANT**: Do NOT manually spawn subprocesses when using `StdioClientTransport`
  - The transport handles process lifecycle automatically
  - Always pass `env: process.env` to ensure commands like `npx` have access to PATH
  - Use `stderr: "inherit"` for proper error forwarding
  - **Anti-pattern**: Double-spawning (manual `spawn()` + transport spawning) causes connection failures

- **HTTP Transport** (remote servers):
  - Uses `StreamableHTTPClientTransport` from MCP SDK v1.10.0+
  - Supports custom headers via `--header` flag
  - Handles authentication, session management automatically
  - Better scalability than SSE for production use

- **SSE Transport** (deprecated):
  - Supported for backward compatibility with legacy servers
  - Displays deprecation warning when used
  - Consider migrating to HTTP transport for new deployments

- **Filtering strategy** (transport-agnostic):
  - `tools/list`, `resources/list`, `prompts/list` → filter response before returning
  - `tools/call`, `prompts/get` → block if name matches excluded pattern
  - `resources/read` → forwarded (cannot filter by URI easily)
  - Rsync-style: patterns evaluated in order, first match wins

## Code Organization

```
src/
├── index.ts      # Entry point: CLI parsing, transport creation, proxy wiring
├── types.ts      # Type definitions (FilterConfig, TransportConfig, etc.)
├── cli.ts        # Argument parser (pure function, well-tested)
├── transport.ts  # Transport factory: creates stdio/HTTP/SSE transports
├── filter.ts     # Pattern matching logic (pure class, well-tested)
├── logger.ts     # Consola logger configured for stderr output
└── proxy.ts      # ProxyServer class: dual MCP client/server

tests/
├── unit/         # Fast isolated tests (cli, filter, index architecture)
├── integration/  # Full MCP communication tests
│   ├── proxy.test.ts         # Core filtering integration tests
│   ├── subprocess.test.ts    # Stdio transport & subprocess management
│   ├── http-transport.test.ts # HTTP transport tests (requires network)
│   └── readme-examples.test.ts # Validate README examples
└── fixtures/     # Test helper servers (simple-server.ts)
```

## Testing Approach

- **Framework**: Vitest (ESM-native, TypeScript, fast)
- **Unit tests**: Test pure functions/classes in isolation
  - Can verify architecture patterns by reading source files (see `tests/unit/index.test.ts`)
  - Validate no anti-patterns exist (e.g., manual subprocess spawning)
- **Integration tests**: Spawn actual MCP servers and test end-to-end communication
  - Use `describe.sequential()` when spawning multiple MCP servers to avoid EPIPE race conditions
  - Test with real-world MCP servers (e.g., chrome-devtools-mcp) to verify compatibility
  - Each test should properly close clients to avoid resource leaks
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

## Design Decisions

- **No localization (`--locale`)**: English tool descriptions work well cross-lingually. See [docs/architecture-decisions.md](docs/architecture-decisions.md).
- **Rsync-style filtering**: `--include`/`--exclude` patterns evaluated in order, first match wins. Familiar to Unix users.
- **YAGNI approach**: Only implement features when users request them. See [docs/roadmap.md](docs/roadmap.md) for potential future features.

## Debugging MCP Communication Issues

Common issues and their solutions:

- **Connection timeouts or "connection closed" errors**:
  - Check for double-spawning (both manual `spawn()` and transport spawning)
  - Verify `StdioClientTransport` is handling subprocess lifecycle
  - Ensure no manual process management interferes with transport

- **"Command not found" errors with `npx`**:
  - Missing environment variables (especially PATH)
  - Solution: Pass `env: process.env` to `StdioClientTransport`
  - Verify environment is propagated to child processes

- **EPIPE errors in tests**:
  - Multiple tests spawning processes simultaneously
  - Solution: Use `describe.sequential()` for integration test suites
  - Ensure proper client cleanup with `await client.close()`

## Publishing

The package is published to npm at https://www.npmjs.com/package/mcp-filter

### Publishing Checklist

1. Ensure all tests pass: `pnpm test`
2. Update version in `package.json` and `src/index.ts`
3. Update `CHANGELOG.md` with release notes
4. Build: `pnpm run build`
5. Create release branch: `git checkout -b release/X.Y.Z`
6. Commit, push branch, create PR
7. Publish: `pnpm publish` (done manually by maintainer)
8. Merge PR to main

### Package Configuration

- **Dependencies**: Uses peerDependencies for `@modelcontextprotocol/sdk` to allow consumers to bring their own version
- **Files included**: Only `dist/`, `README.md`, and `LICENSE` are published (configured via `files` field)
- **Excluded from package**: Tests, configs, source files (via `.npmignore`)
- **Version locking**: `.npmrc` has `save-exact=true` for reproducible builds

## User Preferences

- **CLI output**: Use `consola` logger (not `console.log`) - outputs to stderr to avoid interfering with MCP JSON-RPC
- **Error messages**: Make them LLM-friendly with clear WRONG/CORRECT examples for actionable fixes
- **README style**: Keep concise, avoid redundancy - prefer tables and quick reference sections
- **Commits/PRs**: Do not mention AI tools in commit messages or PR descriptions
