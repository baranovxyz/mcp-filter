# Architecture Decisions

## ADR-001: No Localization Support

**Status**: Decided
**Date**: 2025-01-04

**Decision**: No `--locale` flag for translating tool descriptions.

**Context**: Users in non-English locales might want tool descriptions translated. However, modern LLMs operate in a language-agnostic semantic space — English tool descriptions work well regardless of the conversation language.

**Rationale**:
- LLMs map all languages to a shared conceptual core; English is the "native" internal representation
- Token overhead for non-English comes from tokenization (50-150% more tokens), not reasoning
- Maintenance burden: N tools x M languages = N*M translation files to synchronize
- Anthropic research confirms English tool descriptions work well in non-English conversations

**Alternative**: Focus on filtering to reduce context size. Potential future `--compress` flag for token reduction (see [roadmap](roadmap.md)).

## ADR-002: Rsync-Style Pattern Evaluation

**Status**: Implemented
**Date**: 2025-10-03 (v0.2.0)

**Decision**: `--include` and `--exclude` patterns are evaluated in command-line order. First match wins.

**Context**: Need a familiar, flexible system for combining include/exclude rules.

**Implementation**:
```typescript
for (const pattern of orderedPatterns) {
  if (matches(pattern.glob, name)) {
    return pattern.action; // 'include' or 'exclude'
  }
}
return defaultAction;
```

**Rationale**:
1. **Well-known convention** — Unix users understand rsync/iptables first-match-wins semantics
2. **Fine-grained control** — Exclude specific items, then include a broad category
3. **Simple mental model** — "First rule that matches wins"

**Default behavior**:
- No patterns: allow all (passthrough)
- `--include` only: implicit "exclude all" (whitelist mode)
- `--exclude` only: allow all not matching
- Mixed: evaluate in order, default to whitelist mode if includes exist

**Alternatives considered**:
1. "Exclude always wins" (v0.1.0) — Confusing, non-standard precedence
2. Separate modes (`--mode whitelist/blacklist`) — More complex, less flexible
3. Firewall-style (`--default-deny`) — Verbose, less familiar

## ADR-003: Delegate Subprocess Management to MCP SDK

**Status**: Implemented
**Date**: 2025-10-08 (v0.4.0)

**Decision**: Let `StdioClientTransport` handle all subprocess spawning and lifecycle. Never manually spawn upstream MCP servers.

**Context**: The initial implementation manually spawned the upstream process with `spawn()`, then `StdioClientTransport` also spawned a subprocess — causing double-spawning and connection failures.

**Implementation**:
```typescript
// Correct: transport manages the subprocess
const transport = new StdioClientTransport({
  command: cmd[0],
  args: cmd.slice(1),
  env: process.env as Record<string, string>,
  stderr: "inherit",
});
await client.connect(transport);
```

**Key requirements**:
1. Always pass `env: process.env` (ensures `npx` has PATH access)
2. Use `stderr: "inherit"` for error forwarding
3. No manual `.kill()` calls — transport handles cleanup
4. `index.ts` only configures transport, doesn't manage processes

**Symptoms of double-spawning**:
- Connection timeouts
- "MCP error -32000: Connection closed" after connect
- Process hangs or exits unexpectedly

**Testing**: Architecture validation in `tests/unit/index.test.ts` verifies no `spawn()` imports exist in the entry point.
