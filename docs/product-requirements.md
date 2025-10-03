# Product Requirements

## Target Users

### Primary: Claude Code Power Users

- Need fine-grained control over tool exposure
- Want to optimize token usage
- Use subagents and slash commands extensively

### Secondary: Enterprise Teams

- Require security controls (block dangerous tools)
- Need consistent tool access across team
- Want cost optimization

## Core Value Propositions

### 1. Token Savings (Future)

**Problem**: MCP tool descriptions consume 3,000+ tokens per request
**Solution**: Future `--compress aggressive` flag could reduce by 70%
**Impact**: Potential $0.80+ savings per 100 sessions

### 2. Security Control

**Problem**: Some MCP tools are too powerful for certain contexts
**Solution**: `--exclude "admin_*"` blocks dangerous tools
**Impact**: Prevent accidental misuse

### 3. Context-Specific Tools

**Problem**: Code reviewers don't need browser automation
**Solution**: Different profiles for different subagents
**Impact**: Better tool selection, less confusion

## Integration with Claude Code

### Subagent Integration

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "playwright_readonly": {
      "command": "npx",
      "args": [
        "mcp-filter",
        "--include",
        "browser_navigate",
        "--",
        "npx",
        "@playwright/mcp"
      ]
    }
  }
}
```

### Slash Command Usage

```markdown
---
allowed-tools: mcp__playwright_filtered
---

Use only filtered Playwright tools
```

## Success Metrics

- Zero performance overhead: <50ms added latency
- 100% backward compatible with existing MCP servers
- Fine-grained control over tool exposure

## Non-Goals

- **NOT** a security boundary (client can bypass)
- **NOT** replacing MCP protocol
- **NOT** translating tool descriptions (see [architecture-decisions.md](architecture-decisions.md))
