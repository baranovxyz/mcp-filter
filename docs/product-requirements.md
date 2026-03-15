# Product Requirements

## Target Users

### Primary: AI Agent Developers

- Need fine-grained control over which tools/resources/prompts are exposed to agents
- Want to reduce token consumption by limiting context
- Use MCP clients like Claude Code, Cursor, Windsurf, or custom integrations

### Secondary: Enterprise Teams

- Require safety controls (block destructive operations before they reach agents)
- Need consistent tool access policies across team members
- Want cost optimization through reduced token usage

## Core Value Propositions

### 1. Security Control

**Problem**: MCP servers expose all tools to agents, including destructive operations (delete, admin actions).
**Solution**: `--exclude "delete_*"` blocks dangerous tools before they reach the agent.
**Impact**: Prevents accidental misuse of powerful operations.

### 2. Context-Specific Tool Access

**Problem**: Different agent tasks need different tool sets. A code reviewer doesn't need browser automation; a monitoring agent shouldn't have write access.
**Solution**: Create filtered server profiles with `--include` patterns for each use case.
**Impact**: Better tool selection, reduced agent confusion, more focused behavior.

### 3. Token Savings

**Problem**: MCP tool descriptions consume thousands of tokens per request, even for tools the agent won't use.
**Solution**: Filter out unneeded tools to reduce context size.
**Impact**: Lower API costs, faster responses, more room for actual content.

## Integration Points

mcp-filter works with any MCP client that supports stdio server configuration:

```json
{
  "mcpServers": {
    "filtered-server": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include", "safe_*",
        "--", "npx", "your-mcp-server"
      ]
    }
  }
}
```

Supported clients include Claude Code, Cursor, Windsurf, and any client implementing the MCP specification.

## Success Metrics

- Zero performance overhead: < 50ms added latency
- 100% backward compatible with any MCP server
- Full MCP spec conformance (all protocol features forwarded)
- Works with all three transport types (stdio, HTTP, SSE)

## Non-Goals

- **NOT a security boundary** — MCP clients can bypass filtering by connecting directly to the upstream server
- **NOT replacing the MCP protocol** — only filtering, no modification of tool behavior
- **NOT translating tool descriptions** — see [ADR-001](architecture-decisions.md#adr-001-no-localization-support)
- **NOT rate limiting or throttling** — should be handled by the MCP server itself
