---
name: extract-learnings
description: Extract important learnings from conversation and update project documentation
---

# Extract Learnings - Capture Important Session Insights for Future LLM Sessions

## Overview

This command analyzes the current conversation to extract important information, patterns, preferences, and technical decisions that should be preserved for future LLM sessions. It proposes documentation updates and applies them only after user confirmation.

## Process

### 1. Conversation Analysis Phase

I'll analyze the conversation to identify:

- **User Preferences**: Workflow choices, coding conventions, testing approaches
- **Technical Decisions**: Architecture choices, library selections, implementation patterns
- **Problem Solutions**: Issues encountered and their resolutions
- **MCP Patterns**: Reusable patterns and best practices for MCP servers/clients
- **Configuration Changes**: Important setup or configuration modifications
- **Common Pitfalls**: Things to avoid based on user feedback

### 2. Categorization Phase

I'll categorize findings into:

- **MCP Integration Patterns**: Transport usage, client/server patterns, SDK best practices
- **Filter Logic & Patterns**: Glob patterns, rsync-style evaluation, edge cases
- **Tooling & Configuration**: Build tools, testing setup, development environment
- **Workflow Preferences**: Git practices, documentation style, code organization
- **Technical Constraints**: Performance considerations, subprocess management, package publishing

### 3. Proposal Phase (NEW)

I'll present a numbered list of proposed changes, grouped by target file:

```
## Proposed Documentation Updates

### CLAUDE.md
1. Add MCP transport initialization pattern (line 65)
   - Document StdioClientTransport usage for upstream
   - Document StdioServerTransport for client-facing interface

2. Update testing requirements (line 45)
   - Add fixture server pattern with simple-server.ts
   - Document subprocess spawning test approach

### docs/architecture-decisions.md
3. Add decision about resource filtering strategy
   - Document why resources/read is forwarded without URI filtering

Total: 3 changes across 2 files

Confirm changes? (yes/no)
```

### 4. Documentation Update Phase

**Only after user confirmation**, I'll update relevant documentation:

- **CLAUDE.md**: Primary source for session-to-session continuity
  - User preferences and conventions
  - Technical patterns and anti-patterns
  - Workflow and tooling preferences
- **Project-specific docs**: When appropriate
  - Architecture decisions in docs/architecture-decisions.md
  - Testing patterns and examples
  - Configuration notes in setup documentation
  - Development workflow in docs/roadmap.md

### 5. Validation Phase

I'll ensure:

- No redundant information is added
- Updates are concise and actionable
- Format remains consistent with existing documentation
- Critical learnings are prominently placed

## Categories of Information Extracted

### User Preferences

- Code style preferences (e.g., no `as any`, no ignoring unused vars with `_`)
- Testing approaches and patterns
- Documentation style (concise, no unnecessary examples)
- Commit message conventions

### Technical Patterns

- MCP SDK usage patterns
- TypeScript patterns for MCP servers/clients
- Filter logic and glob pattern handling
- Transport and communication patterns

### Configuration & Setup

- Build tool configurations (pnpm, TypeScript)
- Testing setup (Vitest, fixtures)
- MCP server subprocess management
- Package publishing configuration

### Problem Resolutions

- Common MCP integration issues
- Subprocess communication challenges
- Pattern matching edge cases
- Testing strategies for proxy servers

## Output Format

After extraction, I'll:

1. Show a summary of key learnings identified
2. **Present numbered proposals grouped by file with line references**
3. **Wait for user confirmation (yes/no)**
4. Apply the updates to appropriate files (only if confirmed)
5. Confirm successful documentation update

## Example Usage

```
/extract-learnings
```

The command will:

1. Analyze the entire conversation history
2. Extract important patterns and decisions
3. **Propose numbered changes with file locations**
4. **Wait for user approval**
5. Update CLAUDE.md and other docs as confirmed
6. Provide a summary of what was captured

## Example Proposal Output

```
## Proposed Documentation Updates

### CLAUDE.md
1. Add MCP SDK client method pattern (after line 95)
   - Document preferred use of `client.listTools()` over low-level requests
   - Add transport initialization patterns

2. Update Testing Approach section (line 45)
   - Add fixture server pattern for integration tests
   - Document subprocess spawning test strategy

3. Add to Code Organization (line 20)
   - "Prefer pure functions for filter logic"
   - "Keep transport concerns in proxy layer"

### docs/architecture-decisions.md
4. Add decision about error handling in proxy layer
   - Document when to block vs forward errors

Total: 4 changes across 2 files

Apply these changes? Reply 'yes' to confirm or 'no' to cancel.
```

## Important Notes

- Focuses on actionable, specific information
- Avoids generic or obvious patterns
- Preserves user's exact preferences and feedback
- Maintains documentation conciseness
- Updates are additive - doesn't remove existing important information
- **Changes are only applied after explicit user confirmation**
- Particularly useful after:
  - Complex problem-solving sessions
  - User preference clarifications
  - New MCP integration patterns discovered
  - Configuration troubleshooting
  - Testing strategy refinements
