---
name: setup-mcp-filter
description: Reference for configuring mcp-filter in MCP client configs (Claude Code, Cursor, VS Code, Claude Desktop). Use when generating JSON args arrays, claude mcp add commands, or setting up tool filtering for MCP servers.
license: MIT
metadata:
  version: "1.0"
---

## When to use

- Generating a JSON `mcpServers` config that includes mcp-filter
- Running `claude mcp add` with mcp-filter
- User asks to filter, exclude, or whitelist MCP server tools
- Configuring mcp-filter for a local (stdio) or remote (HTTP/SSE) server

## Critical: JSON Array Format

Each argument MUST be a separate string in the `args` array.

WRONG:
```json
"args": ["mcp-filter", "--include browser_*", "--", "npx", "server"]
```

CORRECT:
```json
"args": ["mcp-filter", "--include", "browser_*", "--", "npx", "server"]
```

## Transport Selection

| Upstream server type | Flag | Example |
|---------------------|------|---------|
| Local subprocess | `-- <command>` | `"--", "npx", "@playwright/mcp"` |
| Remote HTTP | `--upstream-url <url>` | `"--upstream-url", "https://mcp.stripe.com"` |
| Legacy SSE | `--transport`, `sse`, `--upstream-url <url>` | deprecated, prefer HTTP |

`--upstream-url` and `-- <command>` are mutually exclusive.

## Pattern Ordering

Patterns are evaluated in order. **First match wins** (rsync-style).

To create exceptions within a category, put `--exclude` FIRST, then `--include`:

```
--exclude "browser_close" --exclude "browser_evaluate" --include "browser_*"
```

Result: `browser_close` and `browser_evaluate` blocked, all other `browser_*` tools allowed.

Reversing the order would include everything (the `--include "browser_*"` matches first).

## Default Behavior

| Configuration | Unmatched items are... |
|---------------|------------------------|
| No patterns | Allowed (passthrough) |
| `--exclude` only | Allowed |
| `--include` only | Excluded (whitelist) |
| Mixed | Excluded if any `--include` exists |

## Templates

### Local Server — Exclude

```json
{
  "mcpServers": {
    "SERVER_NAME": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "PATTERN_1",
        "--exclude", "PATTERN_2",
        "--",
        "npx", "UPSTREAM_PACKAGE"
      ]
    }
  }
}
```

### Local Server — Whitelist

```json
{
  "mcpServers": {
    "SERVER_NAME": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include", "ALLOWED_1",
        "--include", "ALLOWED_2",
        "--",
        "npx", "UPSTREAM_PACKAGE"
      ]
    }
  }
}
```

### Local Server — Exclude Then Include

```json
{
  "mcpServers": {
    "SERVER_NAME": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "EXCEPTION",
        "--include", "CATEGORY_*",
        "--",
        "npx", "UPSTREAM_PACKAGE"
      ]
    }
  }
}
```

### Remote HTTP Server

```json
{
  "mcpServers": {
    "SERVER_NAME": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "PATTERN",
        "--upstream-url", "https://example.com/mcp"
      ]
    }
  }
}
```

### Remote HTTP with Auth

```json
{
  "mcpServers": {
    "SERVER_NAME": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "PATTERN",
        "--upstream-url", "https://example.com/mcp",
        "--header", "Authorization: Bearer TOKEN"
      ]
    }
  }
}
```

## Claude Code CLI

Two `--` separators — first for Claude, second for mcp-filter:

```bash
claude mcp add SERVER_NAME -- npx mcp-filter --exclude "PATTERN" -- npx UPSTREAM
#                          ^^                                     ^^
#                     Claude's --                           mcp-filter's --
```

Remote servers (no second `--`):

```bash
claude mcp add SERVER_NAME -- npx mcp-filter --exclude "PATTERN" --upstream-url https://example.com/mcp
```

## Real-World Examples

### Playwright — Safe Browsing

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

### Notion — Read Only

```json
{
  "mcpServers": {
    "notion-readonly": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--exclude", "delete_*",
        "--exclude", "archive_*",
        "--exclude", "update_*",
        "--exclude", "create_*",
        "--upstream-url", "https://mcp.notion.com/mcp",
        "--header", "Authorization: Bearer TOKEN"
      ]
    }
  }
}
```

### Stripe — Block Refunds

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

## Flags Reference

| Flag | Description |
|------|-------------|
| `--exclude <pattern>` | Exclude matching items (repeatable, glob syntax) |
| `--include <pattern>` | Include matching items (repeatable, glob syntax) |
| `--upstream-url <url>` | Remote HTTP/SSE server URL |
| `--transport <type>` | `stdio`, `http`, or `sse` (auto-detected) |
| `--header <header>` | HTTP header as `"Key: Value"` (repeatable) |
| `--` | Separates mcp-filter args from upstream command |
| `--help` | Show help |
| `--version` | Show version |
