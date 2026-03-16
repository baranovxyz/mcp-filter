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
   - Supports `--help` and `--version` flags
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
   - **Two-phase initialization**: Connects to upstream first via `connectToUpstream()`, reads upstream capabilities and instructions, then creates the downstream server with mirrored capabilities and instructions
   - **Capability gating**: Only advertises capabilities upstream actually supports — does NOT add tools/resources/prompts if upstream lacks them. Handlers are conditionally registered to match.
   - **Client side**: Connects to upstream via transport factory (stdio/HTTP/SSE)
   - **Server side**: Exposes filtered interface via `StdioServerTransport`
   - **Pagination-aware**: Drains all pages via cursor before filtering (capped at 100 pages to prevent infinite loops). Accepts AbortSignal for cancellation mid-pagination.
   - **Progress forwarding**: Extracts `progressToken` from request `_meta`, relays upstream progress notifications to downstream via `onprogress` callback. Supported on `tools/call`, `prompts/get`, and `resources/read`.
   - **Cancellation propagation**: Forwards `extra.signal` to all upstream client calls including list operations and reverse-direction handlers; downstream abort triggers upstream `notifications/cancelled`
   - **Notification forwarding**: Relays all upstream→downstream notifications (`list_changed`, `resources/updated`, `notifications/message`)
   - **Reverse-direction forwarding**: Forwards `sampling/createMessage`, `roots/list`, `elicitation/create` from upstream server to downstream client (with cancellation support)
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

- **Version**: Read from package.json at runtime via `createRequire` (not hardcoded)

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
  - Custom headers forwarded via fetch wrapper (EventSourceInit doesn't support headers directly)
  - Consider migrating to HTTP transport for new deployments

- **Connection lifecycle**:
  - **30s connection timeout**: Prevents indefinite hang on unreachable upstream servers; timer is cleared on success to prevent leaks
  - **Graceful shutdown**: SIGINT/SIGTERM close server and client transports before exiting
  - **Shutdown guard**: Double-signal protection prevents concurrent cleanup
  - **Upstream close propagation**: `client.onerror`/`client.onclose` handlers detect upstream transport failures and trigger graceful shutdown

- **Filtering strategy** (transport-agnostic):
  - `tools/list`, `resources/list`, `resources/templates/list`, `prompts/list` → drain all pages (with signal forwarding), then filter before returning
  - `tools/call`, `prompts/get` → block with `McpError(ErrorCode.InvalidParams)` (returns `-32602`) if name matches excluded pattern
  - `completion/complete` → block with `McpError(ErrorCode.InvalidParams)` if `ref/prompt` references a filtered prompt; forward `ref/resource` completions (same rationale as `resources/read`)
  - `resources/read` → forwarded with progress support (cannot filter by URI easily; resource won't appear in list if filtered)
  - `resources/subscribe`, `resources/unsubscribe` → forwarded to upstream
  - `logging/setLevel` → forwarded to upstream
  - Notifications (`*/list_changed`, `resources/updated`, `notifications/message`) → forwarded from upstream to downstream
  - Reverse-direction requests (`sampling/createMessage`, `roots/list`, `elicitation/create`) → forwarded from upstream server to downstream client (with signal forwarding)
  - `notifications/roots/list_changed` → forwarded from downstream client to upstream server
  - Rsync-style: patterns evaluated in order, first match wins

## Code Organization

```
src/
├── index.ts      # Entry point: --help/--version, CLI parsing, transport creation, proxy wiring
├── types.ts      # Type definitions (FilterConfig, TransportConfig, etc.)
├── cli.ts        # Argument parser (pure function, well-tested)
├── transport.ts  # Transport factory: creates stdio/HTTP/SSE transports
├── filter.ts     # Pattern matching logic (pure class, well-tested)
├── logger.ts     # Consola logger configured for stderr output
└── proxy.ts      # ProxyServer class: dual MCP client/server

tests/
├── unit/         # Fast isolated tests (cli, filter, transport, index architecture, CLI flags)
├── integration/  # Full MCP communication tests
│   ├── proxy.test.ts             # Core filtering integration tests (stdio)
│   ├── subprocess.test.ts        # Stdio transport & subprocess management
│   ├── local-http.test.ts        # HTTP transport tests (local fixture server)
│   ├── sse-transport.test.ts     # SSE transport tests (local fixture server)
│   ├── http-transport.test.ts    # HTTP transport tests (external, requires network)
│   ├── pagination.test.ts        # Pagination drain-all-pages tests
│   ├── resources-prompts.test.ts # Resource & prompt filtering tests
│   ├── spec-compliance.test.ts   # MCP spec compliance (capabilities, logging, completions, subscriptions, error codes, empty lists)
│   ├── progress-cancellation.test.ts # Progress forwarding & cancellation propagation tests
│   ├── readme-examples.test.ts   # Validate README examples
│   └── reliability.test.ts      # Instructions forwarding, notification forwarding, transport close propagation
└── fixtures/     # Test helper servers
    ├── simple-server.ts          # Basic tools (allowed/blocked)
    ├── browser-server.ts         # Browser-like tools for README examples
    ├── full-server.ts            # Tools + resources + prompts
    ├── spec-server.ts            # Full MCP spec features (logging, completions, subscriptions, progress, instructions)
    ├── minimal-server.ts         # Tools-only server (no resources/prompts) for capability gating tests
    ├── paginated-server.ts       # Paginated tool list (2 pages)
    ├── http-server.ts            # StreamableHTTP server (Express)
    └── sse-server.ts             # SSE server (Express, deprecated transport)
```

## Testing Approach

- **Framework**: Vitest (ESM-native, TypeScript, fast)
- **CI**: GitHub Actions runs tests on Node 20, 22, 24
- **Unit tests**: Test pure functions/classes in isolation
  - Can verify architecture patterns by reading source files (see `tests/unit/index.test.ts`)
  - Validate no anti-patterns exist (e.g., manual subprocess spawning, hardcoded versions)
  - Transport factory tested with all transport types and error paths
  - CLI flag tests (`--help`, `--version`, invalid args)
- **Integration tests**: Spawn actual MCP servers and test end-to-end communication
  - Use `describe.sequential()` when spawning multiple MCP servers to avoid EPIPE race conditions
  - **Local fixtures for all transports**: HTTP and SSE tests use local Express-based fixture servers (no external network dependency)
  - **All MCP primitives tested**: Tools, resources, resource templates, and prompts
  - **Spec compliance tested**: Capability gating, error codes (`-32602`), logging, completions, resource subscriptions, notification forwarding, empty filtered lists
  - **Progress/cancellation tested**: End-to-end progress notification forwarding, downstream abort propagation
  - **Pagination tested**: Fixture server returns 2 pages, verifies filter applies across all pages
  - Test with real-world MCP servers (e.g., chrome-devtools-mcp) to verify compatibility
  - Each test should properly close clients to avoid resource leaks
- **Coverage**: Configured to report on `src/cli.ts`, `src/filter.ts`, `src/transport.ts` (proxy.ts and index.ts are tested via integration but run as subprocesses so v8 can't instrument them)
- **Fixtures**: Express-based servers for HTTP/SSE, stdio servers for tools/resources/prompts/pagination/spec-compliance/progress/minimal-capability

## MCP SDK Usage Patterns

When working with MCP SDK:

- **Client methods**: Use high-level methods like `client.listTools()`, `client.callTool(params)`, `client.complete(params)`, `client.setLoggingLevel(level)`, `client.subscribeResource(params)`
- **Server methods**: `server.createMessage(params)`, `server.elicitInput(params)`, `server.listRoots(params)`, `server.sendLoggingMessage(params)`, `server.sendResourceUpdated(params)`
- **Server handlers**: Use `server.setRequestHandler(Schema, (request, extra) => ...)` — `extra` provides `signal`, `_meta`, `sendNotification`
- **Error handling**: Use `throw new McpError(ErrorCode.InvalidParams, message)` for rejected calls — never plain `Error` (SDK wraps as `-32603` InternalError)
- **Request options**: Pass `{ signal: extra.signal, onprogress }` as `RequestOptions` to client methods for cancellation/progress
- **Schemas**: Import from `@modelcontextprotocol/sdk/types.js` (e.g., `ListToolsRequestSchema`, `McpError`, `ErrorCode`)
- **Capability checks**: SDK enforces capabilities — `setRequestHandler()` checks `assertRequestHandlerCapability()`. Only register handlers for capabilities the server declares
- **Two-phase init pattern**: Connect client to upstream first to read capabilities and instructions, then create server with mirrored capabilities/instructions, then connect server to downstream
- **Transports**:
  - `StdioClientTransport` for connecting to upstream
  - `StdioServerTransport` for exposing server interface
  - Both use stdin/stdout for JSON-RPC communication

## Module System

- **Type**: ES modules (`"type": "module"` in package.json)
- **Imports**: Always use `.js` extension in imports (TypeScript convention for ESM)
- **Build**: TypeScript compiles to `dist/` with Node16 module resolution
- **Exports**: Package exports `filter`, `proxy`, `transport`, and `types` subpaths for programmatic use

## Documentation

- **MUST**: Update `AGENTS.md` in the same commit (or session) as any code change that affects documented structure, capabilities, conventions, test fixtures, or SDK patterns. Do not leave docs stale.
- Sections to check: Code Organization tree, Architecture bullet points, Testing Approach, MCP SDK Usage Patterns, Debugging.

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

1. Bump version in `package.json` (manual, follow semver)
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "chore: release v<version>"`
4. Push to `main`
5. Trigger publish workflow: GitHub Actions → "Publish to npm" → Run workflow
   - Use "Dry run" checkbox first to verify
6. Workflow handles: test → publish (OIDC + provenance) → tag → GitHub Release

### CI/CD Workflows

- **CI** (`.github/workflows/ci.yml`): Runs tests on push/PR to main (Node 20, 22, 24)
- **Publish** (`.github/workflows/publish.yml`): Manual dispatch, OIDC trusted publishing, auto-tags and creates GitHub Release
  - Requires one-time setup: see `PUBLISH-SETUP.md` (gitignored)

### Package Configuration

- **Dependencies**: Uses peerDependencies for `@modelcontextprotocol/sdk` to allow consumers to bring their own version
- **Exports**: Subpath exports for programmatic use (`mcp-filter/filter`, `mcp-filter/proxy`, etc.)
- **Files included**: Only `dist/`, `README.md`, `CHANGELOG.md`, and `LICENSE` are published (configured via `files` field)
- **Excluded from package**: Tests, configs, source files, docs, AGENTS.md (via `.npmignore`)
- **Version locking**: `.npmrc` has `save-exact=true` for reproducible builds

## User Preferences

- **CLI output**: Use `consola` logger (not `console.log`) - outputs to stderr to avoid interfering with MCP JSON-RPC
- **Error messages**: Make them LLM-friendly at two levels:
  - **Setup-time** (cli.ts): WRONG/CORRECT examples for JSON config mistakes
  - **Runtime** (proxy.ts): Actionable guidance like "Use tools/list to see available tools" — avoid leaking internals like "excluded by filter"
- **README style**: Keep concise, avoid redundancy - prefer tables and quick reference sections. Include "Common Mistakes" section for LLM self-correction.
- **Commits/PRs**: Do not mention AI tools in commit messages or PR descriptions
- **Skills**: `.claude/skills/setup-mcp-filter/` contains a reference skill for configuring mcp-filter in MCP client configs
