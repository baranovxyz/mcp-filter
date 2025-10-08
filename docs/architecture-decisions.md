# Architecture Decisions

## ADR-001: No Localization Support

**Status**: Decided (2025-01-04)

**Decision**: No `--locale` flag for translating tool descriptions.

**Why**:

- Modern LLMs (Claude, GPT-4) operate in language-agnostic semantic space - no "mental translation" overhead
- Token inefficiency is from tokenization (50-150% more tokens for non-English), not reasoning
- Maintenance burden: 15 tools × 5 languages = 75 files to keep synchronized
- English tool descriptions work well in non-English conversations (per Anthropic research)

**What we do instead**:

- Focus on filtering: remove unnecessary tools from context
- Potential future `--compress` flag (see roadmap.md)
- Clear, concise English descriptions work universally

**Evidence**: LLMs map all languages to shared conceptual core. English is the "native" internal representation - translating might hurt performance.

## ADR-002: Rsync-Style Pattern Evaluation

**Status**: Implemented (2025-10-03, released in v0.2.0)

**Decision**: Implement true rsync-style filtering where `--include` and `--exclude` patterns are evaluated in the order specified on the command line, with first match winning.

**Implementation**:

```typescript
// Evaluate patterns in order, first match wins
for (const pattern of orderedPatterns) {
  if (matches(pattern.glob, name)) {
    return pattern.action; // 'include' or 'exclude'
  }
}
return defaultAction; // allow if no patterns, or based on mode
```

**Why rsync-style is better**:

1. **Well-known convention**: Unix users already understand rsync semantics
2. **Order matters**: Predictable behavior based on argument order
3. **Fine-grained control**: Can include broad category, then exclude specific items
4. **Mental model**: "First rule that matches wins" is simple and clear

**Examples**:

```bash
# Exclude specific, then include broad category (browser_close excluded)
mcp-filter --exclude "browser_close" --include "browser_*" -- npx @playwright/mcp
# Result: browser_close matches exclude first → excluded
#         browser_navigate matches include → included

# Include broad, then exclude specific (browser_close INCLUDED!)
mcp-filter --include "browser_*" --exclude "browser_close" -- npx @playwright/mcp
# Result: browser_close matches include first → INCLUDED (first match wins!)

# Layered: include broad, exclude subset, re-include specific
mcp-filter \
  --include "browser_*" \
  --exclude "browser_close*" \
  --include "browser_close_tab" \
  -- npx @playwright/mcp
# Result: browser_close matches include first → INCLUDED
#         browser_close_window matches include first → INCLUDED
#         browser_close_tab matches include first → INCLUDED
# (All match the first include pattern, never reach exclude)
```

**Default behavior**:

- If no patterns specified: allow all (passthrough mode)
- If only `--include`: implicit "exclude all" at the end
- If only `--exclude`: allow all not matching exclude
- If mixed: evaluate in order, default allow at end

**Implementation notes**:

- Implemented in v0.2.0 (no users existed, so no migration needed)
- CLI parser tracks ordered `FilterPattern[]` array
- Filter evaluates patterns in order, first match wins
- Default behavior: if no patterns match and includes exist, exclude (whitelist mode)

**Alternatives considered**:

1. **"Exclude always wins"** (v0.1.0 behavior) - Not standard, confusing precedence
2. **Separate modes** (`--mode whitelist/blacklist`) - More complex, less flexible
3. **Firewall-style** (`--default-deny`) - Verbose, less familiar to CLI users

**References**:

- rsync man page: patterns evaluated in order
- iptables: similar first-match-wins semantics

## ADR-003: Delegate Subprocess Management to MCP SDK Transports

**Status**: Implemented (2025-10-08)

**Decision**: Let `StdioClientTransport` handle all subprocess spawning and lifecycle management. Do not manually spawn upstream MCP servers.

**Context**:

The initial implementation manually spawned the upstream MCP server process using Node's `spawn()`, then separately created a `StdioClientTransport` which also spawns a subprocess. This caused two processes to be spawned for the same upstream server, leading to connection failures.

**Implementation**:

```typescript
// ✅ CORRECT: StdioClientTransport manages subprocess
const clientTransport = new StdioClientTransport({
  command: upstreamCommand[0],
  args: upstreamCommand.slice(1),
  env: process.env as Record<string, string>, // Pass full environment
  stderr: "inherit", // Forward errors to parent
});
await client.connect(clientTransport);

// ❌ WRONG: Manual spawning causes double-spawn
const proc = spawn(upstreamCommand[0], upstreamCommand.slice(1));
const clientTransport = new StdioClientTransport({ ... });
// Now TWO processes are running!
```

**Key Requirements**:

1. **Environment variables**: Always pass `env: process.env` to ensure commands like `npx` have access to PATH
2. **Stderr forwarding**: Use `stderr: "inherit"` to forward upstream errors to parent process
3. **No manual cleanup**: Remove `.kill()` calls - transport handles process termination
4. **Single responsibility**: `index.ts` only configures transport, doesn't manage processes

**Why this is correct**:

- The MCP SDK's `StdioClientTransport` is designed to manage subprocess lifecycle
- Proper environment propagation ensures `npx` and other shell commands work
- Avoids race conditions and connection failures from double-spawning
- Simpler code with fewer moving parts

**Symptoms of double-spawning**:

- Connection timeout errors
- "MCP error -32000: Connection closed" immediately after connect
- Upstream server starts but client can't communicate
- Process hangs or exits unexpectedly

**Testing**:

- Integration tests verify single subprocess spawning (see `tests/integration/subprocess.test.ts`)
- Unit tests validate no `spawn()` imports in `src/index.ts` (see `tests/unit/index.test.ts`)
- Real-world compatibility tests with chrome-devtools-mcp verify environment passing works

**References**:

- MCP SDK documentation on StdioClientTransport
- `tests/integration/subprocess.test.ts` - comprehensive test coverage documenting this pattern
