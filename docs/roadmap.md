# Roadmap

## Current Version: 0.2.0

### ✅ Implemented

- `--exclude <pattern>` - Block items matching glob pattern
- `--include <pattern>` - Whitelist mode with glob patterns
- Rsync-style filtering (first match wins)
- Pattern evaluation order preservation
- Basic error messages

## Potential Future Features

These features are **not implemented** and may be added based on user demand.

### Configuration & Profiles

**`--config <path>`**

- Load patterns from JSON/YAML file
- Useful for complex setups with many patterns
- Example: `.mcp-filter/config.json`

**`--profile <name>`**

- Named filter profiles
- Example: `mcp-filter --profile safe-browsing -- ...`
- Profiles stored in `.mcp-filter/profiles/`

### Token Optimization

**`--compress <mode>`**

- Compress tool descriptions to reduce token usage
- Modes: `none` | `minimal` | `aggressive`
- Target: 70% token reduction with aggressive mode
- Example: strip verbose descriptions, keep only essential parameter info

### Developer Tools

**`--dry-run`**

- Show what would be filtered without running upstream server
- Useful for testing filter patterns
- Output: list of allowed/blocked tools

**`--list-tools`**

- Connect to upstream and show available tools
- Apply filters and show results
- Exit without starting proxy

**`--verbose`**

- Debug output showing pattern evaluation
- Show why each tool was included/excluded
- Useful for troubleshooting complex patterns

### Advanced Filtering

**`--default-deny`**

- Change default from allow-all to deny-all
- Requires explicit `--include` patterns
- Useful for high-security contexts

**Negative patterns** (e.g., `!browser_close`)

- Inline negation within patterns
- Compatibility with more complex rsync-style rules

## Non-Goals

These features will **not** be implemented:

- `--locale` - Tool description translation (see ADR-001)
- Built-in rate limiting (should be in MCP server)
- Tool transformation/modification (only filtering)
- Authentication/authorization (client-side only)

## Decision Process

Features move from "Potential" to "Planned" when:

1. Multiple users request it
2. Clear use case is demonstrated
3. Doesn't violate YAGNI or add significant complexity

Submit feature requests via GitHub issues.
