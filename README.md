<p align="center">
  <h1 align="center">mcp-filter</h1>
  <p align="center">
    MCP proxy that filters tools, resources, and prompts using glob patterns.
    <br />
    Any MCP server. Any MCP client. Local or remote.
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

## The Problem

[GitHub MCP Server](https://github.com/github/github-mcp-server) exposes 79 tools — **~52,000 tokens** of context window on every request. A PR review agent needs about 10 of them. The other 69 (gists, stars, security advisories, dependabot, discussions...) consume tokens and make tool selection harder for the model.

Most MCP clients offer blacklists like `disabledTools` — you list what to block. This works until the upstream server adds a new tool. It silently appears in context because it's not in your blocklist. You find out when the agent calls a tool you didn't know existed.

Blacklists describe what you *don't* want. Whitelists describe what you *do* want — and they're immune to upstream changes.

## The Solution

`mcp-filter` is an MCP proxy that sits between your client and server. It intercepts tool/resource/prompt lists, applies glob patterns, and only passes through what matches. Add it to your MCP client's JSON config:

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

No install needed — `npx` downloads it automatically. This config format works with Cursor, VS Code, Claude Desktop, and any MCP client that supports stdio servers.

<details>
<summary>Remote server (HTTP)</summary>

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

<details>
<summary>Remote server with authentication</summary>

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

</details>

<details>
<summary>Claude Code</summary>

Claude Code uses `claude mcp add` instead of JSON config:

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

First `--` separates Claude's options from mcp-filter. Second `--` separates mcp-filter's options from the upstream command.

</details>

## How Filtering Works

mcp-filter supports three filtering modes:

**Exclude mode** blocks specific tools and allows everything else. Use `--exclude` when you trust most tools but want to remove a few dangerous ones: `--exclude "delete_*"` blocks all delete operations.

**Include mode** (whitelist) allows only what you specify and blocks everything else. Use `--include` when you want a tight perimeter: `--include "pull_request_*"` passes through only PR tools. New tools added upstream are automatically blocked.

**Combined mode** uses rsync-style ordering — patterns are evaluated in the order you write them, and the first match wins. This lets you create exceptions within a category:

```
--exclude "merge_pull_request" --include "pull_request_*"
```

Here, `merge_pull_request` hits the exclude rule first, so it's blocked. Other `pull_request_*` tools match the include rule and pass through. Anything that doesn't match any pattern is excluded (because `--include` exists).

Reversing the order would break this: `--include "pull_request_*" --exclude "merge_pull_request"` — now `merge_pull_request` matches `pull_request_*` first and gets included.

<details>
<summary>Pattern syntax and default behavior</summary>

Patterns use glob syntax via [minimatch](https://github.com/isaacs/minimatch):

| Pattern | Matches |
|---------|---------|
| `browser_*` | All items starting with `browser_` |
| `*_admin` | All items ending with `_admin` |
| `test_*_debug` | Items like `test_foo_debug` |
| `exact_name` | Exact match only |
| `*` | Everything |

Default behavior for unmatched items:

| Configuration | Unmatched items are... |
|---------------|------------------------|
| No patterns | Allowed (passthrough) |
| `--exclude` only | Allowed |
| `--include` only | Excluded (whitelist mode) |
| Mixed | Excluded if any `--include` exists |

</details>

## Real-World Examples

The [GitHub MCP Server](https://github.com/github/github-mcp-server) exposes 79 tools across 19 toolsets. Here's how different agents can get exactly the slice they need.

<details>
<summary>PR review agent — whitelist (79 → ~10 tools)</summary>

A code review agent only needs PRs, issues, file contents, and search. Everything else — gists, stars, notifications, security advisories — is noise.

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

When GitHub adds new tools tomorrow, they won't leak through — only the patterns above are visible to the agent.

</details>

<details>
<summary>Read-only agent — exclude mutations</summary>

An analytics agent that collects data for reports shouldn't be able to change anything. Exclude all write operations:

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

The agent can read anything but can't modify anything.

</details>

<details>
<summary>PR tools without merge — rsync-style exceptions</summary>

Allow all PR tools except the ability to merge. First match wins:

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

`merge_pull_request` hits the `--exclude` first and gets blocked. The remaining PR tools match `--include` and pass through.

</details>

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

Transport is auto-detected: `--upstream-url` selects HTTP, `-- <command>` selects stdio.

<details>
<summary>Common mistakes</summary>

**JSON args must be separate strings.** In JSON configs, each argument must be its own array element:

```jsonc
// WRONG
"args": ["mcp-filter", "--include browser_*", "--", "npx", "server"]

// CORRECT
"args": ["mcp-filter", "--include", "browser_*", "--", "npx", "server"]
```

mcp-filter detects this mistake and shows a corrective error message.

**Pattern order matters.** Put `--exclude` before `--include` to create exceptions. First match wins:

```
--exclude "browser_close" --include "browser_*"   (browser_close blocked)
--include "browser_*" --exclude "browser_close"   (browser_close allowed!)
```

**Two `--` in Claude Code.** First `--` separates Claude's options. Second `--` separates mcp-filter's options from the upstream command:

```bash
claude mcp add my-server -- npx mcp-filter --exclude "dangerous_*" -- npx upstream-server
#                        ^^                                        ^^
#                   Claude's --                              mcp-filter's --
```

</details>

<details>
<summary>Transports</summary>

| Transport | Flag | Use Case | Status |
|-----------|------|----------|--------|
| **Stdio** | `-- <command>` | Local servers spawned as subprocesses | Stable |
| **HTTP** | `--upstream-url <url>` | Remote servers via Streamable HTTP | Stable |
| **SSE** | `--transport sse --upstream-url <url>` | Legacy remote servers via Server-Sent Events | Deprecated |

</details>

<details>
<summary>Development</summary>

```bash
git clone https://github.com/baranovxyz/mcp-filter.git
cd mcp-filter
pnpm install
pnpm run build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [TESTING.md](TESTING.md) for the testing guide.

</details>

## Links

- [npm package](https://www.npmjs.com/package/mcp-filter)
- [GitHub repository](https://github.com/baranovxyz/mcp-filter)
- [Changelog](CHANGELOG.md)
- [Spec conformance](docs/spec-conformance.md)
- [Architecture decisions](docs/architecture-decisions.md)
- [MCP specification](https://modelcontextprotocol.io)

## License

[MIT](LICENSE)
