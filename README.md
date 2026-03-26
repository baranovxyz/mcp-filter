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

[GitHub MCP Server](https://github.com/github/github-mcp-server) exposes 79 tools — **~52,000 tokens** of context window per request. A PR review agent needs maybe 10 of them. The other 69 (gists, stars, security advisories, dependabot, discussions...) are noise that costs tokens and confuses tool selection.

`mcp-filter` sits between your MCP client and upstream server, filtering what gets through:

- **Cost** — 79 tools → 10 tools = ~80% fewer tokens per request
- **Focus** — Fewer tools means better tool selection by the model
- **Security** — Block destructive operations (`delete_*`, `push_*`) before they reach the agent
- **Future-proof** — `--include` whitelists are immune to upstream adding new tools

## Quick Start

Add mcp-filter to your MCP client config. No install needed — `npx` downloads it automatically.

**Local server** — filter tools from a stdio MCP server:

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

**Remote server** — filter tools from an HTTP MCP server:

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

**Remote server with authentication:**

```json
{
  "mcpServers": {
    "api-readonly": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "write_*",
        "--exclude", "delete_*",
        "--upstream-url", "https://api.example.com/mcp",
        "--authorization", "Bearer your-oauth-token"
      ]
    }
  }
}
```

For additional headers, use `--header "Key: Value"` (repeatable).

This JSON format works with Cursor (`.cursor/mcp.json`), VS Code (`.vscode/mcp.json`), Claude Desktop (`claude_desktop_config.json`), and any MCP client that supports stdio servers.

## Examples: GitHub MCP Server

The [GitHub MCP Server](https://github.com/github/github-mcp-server) is a good example of a large server that benefits from filtering. All examples below work with any MCP client that supports the JSON config format.

**PR review agent** — whitelist only what's needed (79 → ~10 tools):

```json
{
  "mcpServers": {
    "github-pr-review": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include", "pull_request_*",
        "--include", "issue_*",
        "--include", "get_file_contents",
        "--include", "list_commits",
        "--include", "search_code",
        "--",
        "github-mcp-server", "stdio"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

When GitHub adds new tools tomorrow, they won't leak through — only `pull_request_*`, `issue_*`, and the explicitly listed tools are visible.

**Read-only agent** — exclude all mutations, keep all reads:

```json
{
  "mcpServers": {
    "github-readonly": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "create_*",
        "--exclude", "update_*",
        "--exclude", "delete_*",
        "--exclude", "push_*",
        "--exclude", "merge_*",
        "--exclude", "fork_*",
        "--exclude", "*_write",
        "--",
        "github-mcp-server", "stdio"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

**PR tools without merge** — rsync-style, first match wins:

```json
{
  "mcpServers": {
    "github-pr-safe": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "merge_pull_request",
        "--include", "pull_request_*",
        "--include", "list_pull_requests",
        "--include", "search_pull_requests",
        "--",
        "github-mcp-server", "stdio"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

`merge_pull_request` matches `--exclude` first, so it's blocked. The remaining `pull_request_*` tools pass through.

### Claude Code

Claude Code uses `claude mcp add` instead of JSON:

```bash
# Local server (two -- separators: first for Claude, second for mcp-filter)
claude mcp add playwright-safe -- \
  npx mcp-filter \
    --exclude "browser_close" \
    --exclude "browser_evaluate" \
    --include "browser_*" \
    -- npx @playwright/mcp@latest

# Remote HTTP server (no second --)
claude mcp add stripe-safe -- \
  npx mcp-filter \
    --exclude "create_refund" \
    --exclude "delete_*" \
    --upstream-url https://mcp.stripe.com
```

## Options

| Option | Description |
|--------|-------------|
| `--exclude <pattern>` | Exclude items matching glob pattern (repeatable) |
| `--include <pattern>` | Include only items matching glob pattern (repeatable) |
| `--upstream-url <url>` | Connect to remote HTTP/SSE server (mutually exclusive with `--`) |
| `--transport <type>` | Transport type: `stdio`, `http`, `sse` (auto-detected) |
| `--authorization <value>` | Set Authorization header (e.g. `"Bearer token"`, HTTP/SSE only) |
| `--header <header>` | HTTP header as `"Key: Value"` (repeatable, HTTP/SSE only) |
| `--` | Separates mcp-filter options from upstream command (stdio only) |

## Filtering

### Pattern Syntax

Patterns use glob syntax via [minimatch](https://github.com/isaacs/minimatch):

| Pattern | Matches |
|---------|---------|
| `browser_*` | All items starting with `browser_` |
| `*_admin` | All items ending with `_admin` |
| `test_*_debug` | Items like `test_foo_debug` |
| `exact_name` | Exact match only |
| `*` | Everything |

### Modes

| Configuration | Unmatched items are... |
|---------------|------------------------|
| No patterns | Allowed (passthrough) |
| `--exclude` only | Allowed |
| `--include` only | Excluded (whitelist mode) |
| Mixed | Excluded if any `--include` exists |

### Rsync-Style Ordering

Patterns are evaluated **in order** — first match wins. This lets you combine `--include` and `--exclude` for fine-grained control:

```json
"args": [
  "mcp-filter",
  "--exclude", "merge_pull_request",
  "--include", "pull_request_*",
  "--include", "list_pull_requests",
  "--",
  "github-mcp-server", "stdio"
]
```

```
merge_pull_request  → matches --exclude              → EXCLUDED
pull_request_read   → matches --include              → included
list_pull_requests  → matches --include              → included
create_gist         → no match, --include exists     → excluded (whitelist mode)
```

> **Order matters!** `--exclude "merge_pull_request" --include "pull_request_*"` blocks merge then includes the rest. Reversing the order would include `merge_pull_request` (it matches `pull_request_*` first).

## Common Mistakes

### JSON args must be separate strings

In JSON configs, each argument must be its own array element. The shell splits arguments for you — JSON doesn't.

```jsonc
// WRONG
"args": ["mcp-filter", "--include browser_*", "--", "npx", "server"]

// CORRECT
"args": ["mcp-filter", "--include", "browser_*", "--", "npx", "server"]
```

mcp-filter detects this mistake and shows a corrective error message.

### Pattern order matters

Put `--exclude` patterns **before** `--include` to create exceptions. First match wins.

```bash
# CORRECT: exclude first, then include the rest
--exclude "browser_close" --include "browser_*"

# WRONG: include matches first, exclude never fires
--include "browser_*" --exclude "browser_close"
```

### Two `--` separators in Claude Code

When using `claude mcp add`, the first `--` separates Claude's options from the mcp-filter command. The second `--` separates mcp-filter's options from the upstream server command:

```bash
claude mcp add my-server -- npx mcp-filter --exclude "dangerous_*" -- npx upstream-server
#                        ^^                                        ^^
#                   Claude's --                              mcp-filter's --
```

## Transports

| Transport | Flag | Use Case | Status |
|-----------|------|----------|--------|
| **Stdio** | `-- <command>` | Local servers spawned as subprocesses | Stable |
| **HTTP** | `--upstream-url <url>` | Remote servers via Streamable HTTP | Stable |
| **SSE** | `--transport sse --upstream-url <url>` | Legacy remote servers via Server-Sent Events | Deprecated |

## Development

```bash
git clone https://github.com/baranovxyz/mcp-filter.git
cd mcp-filter
pnpm install
pnpm run build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [TESTING.md](TESTING.md) for the testing guide.

## Links

- [npm package](https://www.npmjs.com/package/mcp-filter)
- [GitHub repository](https://github.com/baranovxyz/mcp-filter)
- [Changelog](CHANGELOG.md)
- [Spec conformance](docs/spec-conformance.md)
- [Architecture decisions](docs/architecture-decisions.md)
- [MCP specification](https://modelcontextprotocol.io)

## License

[MIT](LICENSE)
