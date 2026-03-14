# Testing Guide

## Overview

mcp-filter has comprehensive test coverage with **187+ tests** across **15 test suites**, covering unit tests, integration tests with real MCP server communication, and full MCP spec compliance validation.

**Framework**: [Vitest](https://vitest.dev/) — ESM-native, TypeScript-first, fast execution.
**CI**: GitHub Actions on Node 18, 20, and 22.

## Running Tests

```bash
pnpm test                         # Run all tests once
pnpm test:watch                   # Watch mode (during development)
pnpm test:coverage                # Generate coverage report
pnpm test tests/unit/             # Unit tests only (fast)
pnpm test tests/integration/      # Integration tests only
pnpm test tests/unit/filter.test.ts  # Specific test file
```

## Test Structure

```
tests/
├── unit/                              # Fast, isolated unit tests
│   ├── cli.test.ts                    # CLI argument parsing, --help, --version, errors
│   ├── filter.test.ts                 # Glob pattern matching, list filtering, edge cases
│   ├── transport.test.ts              # Transport factory (stdio/HTTP/SSE), error paths
│   └── index.test.ts                  # Architecture validation (no anti-patterns)
│
├── integration/                       # Real MCP server communication
│   ├── proxy.test.ts                  # Core tool filtering (stdio, exclude/include)
│   ├── subprocess.test.ts             # Stdio transport & subprocess lifecycle
│   ├── local-http.test.ts             # HTTP transport with local Express fixture
│   ├── sse-transport.test.ts          # SSE transport with local Express fixture
│   ├── http-transport.test.ts         # HTTP transport (external endpoint, requires network)
│   ├── pagination.test.ts             # Multi-page response handling across all pages
│   ├── resources-prompts.test.ts      # Resource & prompt filtering
│   ├── spec-compliance.test.ts        # MCP spec conformance (see below)
│   ├── progress-cancellation.test.ts  # Progress forwarding & cancellation propagation
│   ├── readme-examples.test.ts        # Validates README examples work as documented
│   └── reliability.test.ts           # Instructions forwarding, notifications, transport close
│
└── fixtures/                          # Test MCP servers
    ├── simple-server.ts               # Basic tools (allowed_tool, blocked_tool)
    ├── browser-server.ts              # Browser-like tools for README examples
    ├── full-server.ts                 # Tools + resources + prompts
    ├── spec-server.ts                 # Full MCP spec (logging, completions, subscriptions, progress, instructions)
    ├── minimal-server.ts              # Tools-only (no resources/prompts) for capability gating
    ├── paginated-server.ts            # Returns 2 pages of tools
    ├── http-server.ts                 # Express-based StreamableHTTP server
    └── sse-server.ts                  # Express-based SSE server (deprecated transport)
```

## What's Tested

### Unit Tests

| Suite | Tests | What's Covered |
|-------|-------|----------------|
| **CLI Parser** | ~15 | Pattern parsing, command extraction, transport options, `--help`/`--version`, error handling |
| **Filter Engine** | ~10 | Glob matching, list filtering, rsync-style ordering, edge cases |
| **Transport Factory** | ~8 | Stdio/HTTP/SSE creation, header parsing, auto-detection, error paths |
| **Architecture** | ~4 | No manual subprocess spawning, no hardcoded versions, correct imports |

### Integration Tests

| Suite | Tests | What's Covered |
|-------|-------|----------------|
| **Core Proxy** | ~8 | Tool listing with filters, allowed/blocked calls, multiple patterns |
| **Subprocess** | ~4 | Process lifecycle, environment propagation, stderr forwarding |
| **HTTP Transport** | ~6 | Local Express fixture, remote endpoints, custom headers |
| **SSE Transport** | ~4 | Legacy SSE communication, header forwarding |
| **Pagination** | ~3 | Multi-page drain, filter across all pages |
| **Resources & Prompts** | ~10 | Resource filtering, template filtering, prompt filtering |
| **Spec Compliance** | ~25 | See detailed breakdown below |
| **Progress & Cancel** | ~6 | Progress notification forwarding, abort propagation |
| **README Examples** | ~4 | Validates documented examples actually work |
| **Reliability** | ~6 | Instructions forwarding, notification forwarding, transport close |

### MCP Spec Compliance Tests

The `spec-compliance.test.ts` suite validates conformance with the MCP specification:

- **Capability gating** — Only advertises capabilities the upstream server supports
- **Error codes** — Returns `-32602 InvalidParams` for excluded tool calls and prompt gets
- **Logging** — Forwards `logging/setLevel` for all valid log levels
- **Completions** — Forwards `completion/complete` for allowed prompts, blocks for excluded
- **Resource subscriptions** — Forwards `subscribe`/`unsubscribe` to upstream
- **Notification forwarding** — Relays `list_changed`, `resources/updated`, `message`
- **Empty filtered lists** — Returns empty arrays when all items are filtered
- **Passthrough mode** — No filtering when no patterns specified
- **Whitelist mode** — Include-only patterns block unmatched items
- **Exclude mode** — Exclude-only patterns block matched items
- **Unknown tools** — Forwarded to upstream (proxy doesn't validate existence)

## Coverage

Coverage is configured for `src/cli.ts`, `src/filter.ts`, and `src/transport.ts` — the modules that can be instrumented by v8 directly. `src/proxy.ts` and `src/index.ts` are tested via integration tests but run as subprocesses, so v8 can't instrument them.

```bash
pnpm test:coverage    # Generates text, JSON, and HTML reports
```

## Writing Tests

### Unit Tests

Place in `tests/unit/`. Test pure functions and classes in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { FilterEngine } from '../../src/filter.js';

describe('FilterEngine', () => {
  it('should exclude matching items', () => {
    const filter = new FilterEngine([{ type: 'exclude', pattern: 'test_*' }]);
    expect(filter.shouldExclude('test_foo')).toBe(true);
  });
});
```

### Integration Tests

Place in `tests/integration/`. Use `describe.sequential()` when spawning MCP servers to avoid EPIPE race conditions:

```typescript
import { describe, it, expect } from 'vitest';

describe.sequential('My Feature', () => {
  it('should work end-to-end', async () => {
    // Spawn fixture server, connect client, test, close
  });
});
```

### Fixture Servers

Place in `tests/fixtures/`. Each fixture is a standalone MCP server that exercises specific features:

- Use `StdioServerTransport` for stdio fixtures
- Use Express for HTTP/SSE fixtures
- Keep fixtures focused on what they test
- Always close clients in tests to avoid resource leaks
