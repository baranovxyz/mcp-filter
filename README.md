<p align="center">
  <h1 align="center">mcp-filter</h1>
  <p align="center">
    MCP proxy that filters tools, resources, and prompts from upstream MCP servers using glob patterns.
    <br />
    Works with any MCP client. Supports local and remote servers.
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcp-filter"><img src="https://img.shields.io/npm/v/mcp-filter.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://github.com/baranovxyz/mcp-filter/actions"><img src="https://img.shields.io/github/actions/workflow/status/baranovxyz/mcp-filter/ci.yml?branch=main&style=flat-square&label=tests" alt="CI" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="https://www.npmjs.com/package/mcp-filter"><img src="https://img.shields.io/node/v/mcp-filter?style=flat-square" alt="Node version" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-spec%20conformant-green?style=flat-square" alt="MCP Spec" /></a>
</p>

---

## Why mcp-filter?

MCP servers expose tools, resources, and prompts to AI agents — but you don't always want agents to have access to everything. `mcp-filter` sits between your MCP client and upstream server, filtering what gets through:

- **Security** — Block destructive operations (`delete_*`, `admin_*`) before they reach the agent
- **Focus** — Whitelist only the tools an agent needs for its specific task
- **Cost** — Fewer tools in context means fewer tokens consumed per request
- **Flexibility** — Works with any MCP server, any MCP client, any transport

## Quick Start

```bash
npm install -g mcp-filter
# or use directly with npx (no install needed)
```

```bash
# Filter a local MCP server (stdio)
npx mcp-filter --exclude "browser_close" --exclude "browser_evaluate" -- npx @playwright/mcp

# Filter a remote MCP server (HTTP) — block refunds on Stripe
npx mcp-filter --exclude "create_refund" --upstream-url https://mcp.stripe.com

# Whitelist mode — only allow specific tools
npx mcp-filter --include "browser_navigate" --include "browser_screenshot" -- npx @playwright/mcp
```

## Supported Transports

mcp-filter connects to upstream MCP servers via three transport types:

| Transport | Flag | Use Case | Status |
|-----------|------|----------|--------|
| **Stdio** | `-- <command>` | Local servers spawned as subprocesses | Stable |
| **HTTP** | `--upstream-url <url>` | Remote servers via Streamable HTTP | Stable |
| **SSE** | `--transport sse --upstream-url <url>` | Legacy remote servers via Server-Sent Events | Deprecated |

Transport is auto-detected: `--upstream-url` selects HTTP by default, `-- <command>` selects stdio. Override with `--transport`.

## Usage

### Local Servers (Stdio)

```bash
# Exclude specific tools
npx mcp-filter --exclude "playwright*" -- npx @playwright/mcp

# Include only specific tools (whitelist)
npx mcp-filter --include "browser_navigate" --include "browser_screenshot" -- npx @playwright/mcp

# Rsync-style: exclude exceptions, then include category
npx mcp-filter --exclude "browser_close" --include "browser_*" -- npx @playwright/mcp

# Works with any local MCP server
npx mcp-filter --exclude "debug*" -- node my-mcp-server.js
```

### Remote Servers (HTTP)

```bash
# Block refunds and customer deletion on Stripe
npx mcp-filter --exclude "create_refund" --exclude "delete_*" \
  --upstream-url https://mcp.stripe.com

# Read-only Notion (block all mutations)
npx mcp-filter \
  --exclude "create_*" --exclude "update_*" --exclude "delete_*" --exclude "archive_*" \
  --upstream-url https://mcp.notion.com/mcp

# Multiple headers
npx mcp-filter --exclude "write_*" \
  --upstream-url https://api.example.com/mcp \
  --header "Authorization: Bearer token" \
  --header "X-Team-Id: engineering"
```

### Legacy SSE Servers

```bash
# SSE transport (deprecated — prefer HTTP for new deployments)
npx mcp-filter --transport sse \
  --upstream-url https://mcp.example.com/sse \
  --exclude "dangerous_*"
```

## CLI Reference

```
mcp-filter [options] -- <upstream-command>
mcp-filter [options] --upstream-url <url>
```

### Filtering Options

| Flag | Description |
|------|-------------|
| `--exclude <pattern>` | Exclude items matching glob pattern (repeatable) |
| `--include <pattern>` | Include only items matching glob pattern (repeatable) |

### Transport Options

| Flag | Description |
|------|-------------|
| `--upstream-url <url>` | Connect to remote HTTP/SSE server |
| `--transport <type>` | Transport type: `stdio`, `http`, `sse` (auto-detected) |
| `--header <header>` | HTTP header as `"Key: Value"` (repeatable, HTTP/SSE only) |
| `--` | Separates mcp-filter options from upstream command (stdio only) |

### Other Options

| Flag | Description |
|------|-------------|
| `--help` | Show help message |
| `--version` | Show version number |

> **Note**: `--upstream-url` and `-- <command>` are mutually exclusive.

## Filtering Modes

### Exclude Mode

Block specific items, allow everything else:

```bash
npx mcp-filter --exclude "browser_close" --exclude "browser_evaluate" -- npx @playwright/mcp
```

### Include Mode (Whitelist)

Allow only specified items, block everything else:

```bash
npx mcp-filter --include "browser_navigate" --include "browser_screenshot" -- npx @playwright/mcp
```

### Rsync-Style Combination

Patterns are evaluated **in order** — first match wins. This lets you combine `--include` and `--exclude` for fine-grained control:

```bash
# Exclude specific tools, then include the rest of the category
npx mcp-filter \
  --exclude "browser_close" \
  --exclude "browser_evaluate" \
  --include "browser_*" \
  -- npx @playwright/mcp

# Evaluation:
#   browser_close      → matches --exclude "browser_close"     → EXCLUDED
#   browser_evaluate   → matches --exclude "browser_evaluate"  → EXCLUDED
#   browser_navigate   → matches --include "browser_*"         → included
#   browser_screenshot → matches --include "browser_*"         → included
#   some_other_tool    → no match, --include exists            → excluded (whitelist mode)
```

> **Order matters!** `--exclude "browser_close" --include "browser_*"` excludes `browser_close` then includes the rest. Reversing the order would include `browser_close` (it matches `browser_*` first).

### Pattern Syntax

Patterns use glob syntax via [minimatch](https://github.com/isaacs/minimatch):

| Pattern | Matches |
|---------|---------|
| `browser_*` | All items starting with `browser_` |
| `*_admin` | All items ending with `_admin` |
| `test_*_debug` | Items like `test_foo_debug` |
| `exact_name` | Exact match only |
| `*` | Everything |

### Default Behavior

| Configuration | Unmatched items are... |
|---------------|------------------------|
| No patterns | Allowed (passthrough) |
| `--exclude` only | Allowed |
| `--include` only | Excluded (whitelist mode) |
| Mixed | Excluded if any `--include` exists |

## MCP Spec Conformance

mcp-filter is a fully conformant MCP proxy. It transparently forwards all MCP protocol features while applying filters only to list/call operations.

### Filtered Operations

| Operation | Behavior |
|-----------|----------|
| `tools/list` | Drains all pages, filters by name, returns filtered list |
| `tools/call` | Blocks excluded tools with `-32602 InvalidParams` |
| `resources/list` | Drains all pages, filters by name |
| `resources/templates/list` | Drains all pages, filters by name |
| `resources/read` | Forwarded (filtered resources won't appear in list) |
| `resources/subscribe` | Forwarded to upstream |
| `resources/unsubscribe` | Forwarded to upstream |
| `prompts/list` | Drains all pages, filters by name |
| `prompts/get` | Blocks excluded prompts with `-32602 InvalidParams` |
| `completion/complete` | Blocks if referenced prompt is filtered; forwards resource completions |
| `logging/setLevel` | Forwarded to upstream |

### Forwarded Notifications

| Direction | Notification | Description |
|-----------|-------------|-------------|
| Upstream → Downstream | `notifications/tools/list_changed` | Tool list changed |
| Upstream → Downstream | `notifications/resources/list_changed` | Resource list changed |
| Upstream → Downstream | `notifications/prompts/list_changed` | Prompt list changed |
| Upstream → Downstream | `notifications/resources/updated` | Resource content updated |
| Upstream → Downstream | `notifications/message` | Log messages |
| Downstream → Upstream | `notifications/roots/list_changed` | Client roots changed |

### Reverse-Direction Requests (Server → Client)

| Request | Description |
|---------|-------------|
| `sampling/createMessage` | Forwarded from upstream to downstream client |
| `roots/list` | Forwarded from upstream to downstream client |
| `elicitation/create` | Forwarded from upstream to downstream client |

### Protocol Features

| Feature | Support |
|---------|---------|
| **Capability gating** | Only advertises capabilities the upstream server supports |
| **Instructions forwarding** | Upstream server instructions passed through to downstream |
| **Pagination** | Drains all pages before filtering (max 100 pages) |
| **Progress notifications** | Forwarded on `tools/call`, `prompts/get`, `resources/read` |
| **Cancellation propagation** | Downstream abort triggers upstream `notifications/cancelled` |
| **Graceful shutdown** | SIGINT/SIGTERM cleanly close both transports |
| **Connection timeout** | 30-second timeout prevents hang on unreachable servers |

## Architecture

```
┌─────────────┐         ┌──────────────────────────────────────┐         ┌──────────────┐
│  MCP Client │  stdio  │            mcp-filter                │ stdio/  │   Upstream    │
│  (Claude,   │◄───────►│                                      │ HTTP/   │  MCP Server   │
│   Cursor,   │         │  ┌────────┐  ┌────────┐  ┌────────┐ │  SSE    │  (Playwright, │
│   etc.)     │         │  │ Server │→ │ Filter │→ │ Client │◄┼────────►│   Notion,     │
│             │         │  └────────┘  └────────┘  └────────┘ │         │   etc.)       │
└─────────────┘         └──────────────────────────────────────┘         └──────────────┘
```

**Four-layer design:**

1. **CLI** (`src/cli.ts`) — Parses arguments into a typed `FilterConfig`
2. **Transport Factory** (`src/transport.ts`) — Creates the appropriate client transport (stdio/HTTP/SSE)
3. **Filter Engine** (`src/filter.ts`) — Glob pattern matching via minimatch
4. **Proxy Server** (`src/proxy.ts`) — Dual-role MCP client + server with two-phase initialization

## Integration Guides

### Claude Code

```bash
# Add a filtered MCP server
claude mcp add playwright-safe -- \
  npx mcp-filter \
    --exclude "browser_close" \
    --exclude "browser_evaluate" \
    --include "browser_*" \
    -- npx @playwright/mcp@latest

# Scopes: local (default), user (all projects), project (team-shared .mcp.json)
claude mcp add --scope user playwright-safe -- \
  npx mcp-filter --include "browser_*" -- npx @playwright/mcp@latest
```

**Remote HTTP server (no second `--`):**

```bash
claude mcp add stripe-safe -- \
  npx mcp-filter \
    --exclude "create_refund" \
    --exclude "delete_*" \
    --upstream-url https://mcp.stripe.com
```

**Command structure:** first `--` separates Claude options from mcp-filter; second `--` separates mcp-filter options from the upstream command.

<details>
<summary>More Claude Code examples</summary>

**Read-only monitoring agent:**

```bash
claude mcp add browser-monitor -- \
  npx mcp-filter \
    --include "browser_navigate" \
    --include "browser_snapshot" \
    --include "browser_console_messages" \
    --include "browser_network_requests" \
    --include "browser_take_screenshot" \
    -- npx @playwright/mcp@latest
```

**Testing agent (no destructive actions):**

```bash
claude mcp add browser-test -- \
  npx mcp-filter \
    --exclude "browser_close" \
    --exclude "browser_tabs" \
    --exclude "browser_evaluate" \
    --include "browser_*" \
    -- npx @playwright/mcp@latest
```

**Managing servers:**

```bash
claude mcp list                    # List all servers
claude mcp get playwright-safe     # Show server details
claude mcp remove playwright-safe  # Remove a server
```

</details>

### Cursor IDE

Add to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

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

<details>
<summary>More Cursor examples</summary>

**Whitelist mode:**

```json
{
  "mcpServers": {
    "playwright-readonly": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include", "browser_navigate",
        "--include", "browser_screenshot",
        "--include", "browser_snapshot",
        "--",
        "npx", "@playwright/mcp@latest"
      ]
    }
  }
}
```

**Remote HTTP server (Stripe — block refunds):**

```json
{
  "mcpServers": {
    "stripe-safe": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "create_refund",
        "--exclude", "delete_*",
        "--upstream-url", "https://mcp.stripe.com"
      ]
    }
  }
}
```

</details>

### Any MCP Client

mcp-filter works with any MCP client that supports stdio servers. The upstream server can be local (stdio) or remote (HTTP/SSE):

```json
{
  "command": "npx",
  "args": ["mcp-filter", "--exclude", "pattern", "--", "npx", "your-mcp-server"]
}
```

## Common Mistakes

### JSON args must be separate strings

In JSON configs (Claude Desktop, Cursor, VS Code), each argument must be its own array element. The shell splits arguments for you — JSON doesn't.

**WRONG:**
```json
"args": ["mcp-filter", "--include browser_*", "--", "npx", "server"]
```

**CORRECT:**
```json
"args": ["mcp-filter", "--include", "browser_*", "--", "npx", "server"]
```

mcp-filter detects this mistake and shows a corrective error message.

### Pattern order matters

Put `--exclude` patterns **before** `--include` to create exceptions. First match wins.

```bash
# CORRECT: exclude first, then include the rest
--exclude "browser_close" --include "browser_*"
# Result: browser_close blocked, other browser_* allowed

# WRONG order: include matches first, exclude never fires
--include "browser_*" --exclude "browser_close"
# Result: ALL browser_* allowed including browser_close
```

### Two `--` separators in Claude Code

When using `claude mcp add`, the first `--` separates Claude's options from the mcp-filter command. The second `--` separates mcp-filter's options from the upstream server command:

```bash
claude mcp add my-server -- npx mcp-filter --exclude "dangerous_*" -- npx upstream-server
#                        ^^                                        ^^
#                   Claude's --                              mcp-filter's --
```

## Programmatic API

mcp-filter exports its core modules for use in custom tooling:

```typescript
import { FilterEngine } from 'mcp-filter/filter';
import { ProxyServer } from 'mcp-filter/proxy';
import { createTransport } from 'mcp-filter/transport';
import type { FilterConfig, TransportConfig } from 'mcp-filter/types';
```

## Testing

187+ tests across 15 test suites covering unit tests, integration tests with real MCP servers, and full spec compliance validation.

```bash
pnpm test               # Run all tests
pnpm test:coverage      # With coverage report
pnpm test tests/unit/   # Unit tests only (fast)
```

Tests run on **Node 20, 22, and 24** via GitHub Actions CI.

See [TESTING.md](TESTING.md) for the full testing guide.

## Development

```bash
git clone https://github.com/baranovxyz/mcp-filter.git
cd mcp-filter
pnpm install
pnpm run build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Links

- [npm package](https://www.npmjs.com/package/mcp-filter)
- [GitHub repository](https://github.com/baranovxyz/mcp-filter)
- [Changelog](CHANGELOG.md)
- [MCP specification](https://modelcontextprotocol.io)

## License

[MIT](LICENSE)
