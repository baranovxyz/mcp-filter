# MCP Spec Conformance

mcp-filter is a fully conformant MCP proxy. It transparently forwards all MCP protocol features while applying filters only to list/call operations.

## Filtered Operations

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

## Forwarded Notifications

| Direction | Notification | Description |
|-----------|-------------|-------------|
| Upstream -> Downstream | `notifications/tools/list_changed` | Tool list changed |
| Upstream -> Downstream | `notifications/resources/list_changed` | Resource list changed |
| Upstream -> Downstream | `notifications/prompts/list_changed` | Prompt list changed |
| Upstream -> Downstream | `notifications/resources/updated` | Resource content updated |
| Upstream -> Downstream | `notifications/message` | Log messages |
| Downstream -> Upstream | `notifications/roots/list_changed` | Client roots changed |

## Reverse-Direction Requests (Server -> Client)

| Request | Description |
|---------|-------------|
| `sampling/createMessage` | Forwarded from upstream to downstream client |
| `roots/list` | Forwarded from upstream to downstream client |
| `elicitation/create` | Forwarded from upstream to downstream client |

## Protocol Features

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

## Programmatic API

mcp-filter exports its core modules for use in custom tooling:

```typescript
import { FilterEngine } from 'mcp-filter/filter';
import { ProxyServer } from 'mcp-filter/proxy';
import { createTransport } from 'mcp-filter/transport';
import type { FilterConfig, TransportConfig } from 'mcp-filter/types';
```
