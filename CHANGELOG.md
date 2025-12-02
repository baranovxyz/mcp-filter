# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-12-02

### Added
- **Consola Logging**: Modern CLI output with colors, icons, and semantic log levels
  - `info` for startup information
  - `success` for connection and ready states
  - `error` for errors with actionable messages
  - `fatal` for unrecoverable errors
- **Argument Validation**: Detects common JSON configuration mistakes
  - Catches combined flag+pattern in single string (e.g., `"--include pattern"`)
  - Catches multiple flags in single string (e.g., `"--include pattern --"`)
  - LLM-friendly error messages with WRONG/CORRECT examples

### Changed
- **README restructured** for better onboarding (490 → 189 lines)
- Replaced all `console.*` calls with `consola` logger

## [0.5.0] - 2025-11-22

### Added
- **Multi-Transport Support**: Filter both local and remote MCP servers
  - HTTP transport for remote MCP servers (Streamable HTTP)
  - SSE transport for legacy servers (deprecated, backward compatibility)
  - Stdio transport for local servers (existing functionality, unchanged)
- `--upstream-url <url>` flag to connect to remote HTTP/SSE servers
- `--transport <type>` flag to explicitly specify transport type (stdio/http/sse)
- `--header <header>` flag to add custom HTTP headers (e.g., authentication)
- `--help` flag to show usage information
- Transport factory pattern for clean separation of transport logic
- HTTP transport integration tests with context7 public endpoint
- Comprehensive CLI tests for new transport options

### Changed
- **Breaking**: `FilterConfig` now uses `transportConfig` instead of `upstreamCommand`
- Upgraded `@modelcontextprotocol/sdk` from 1.0.4 to 1.22.0
- Updated peerDependencies to require SDK >=1.10.0 (for HTTP transport)
- CLI now auto-detects transport type (HTTP for URLs, stdio for commands)
- Updated documentation with HTTP/SSE usage examples
- Reorganized codebase with new `src/types.ts` and `src/transport.ts` modules

### Fixed
- Increased timeout for integration tests using `npx` to prevent flaky failures
- Updated architecture validation tests for new transport factory pattern

## [0.4.0] - 2025-10-08

### Fixed
- Fixed connection failures caused by double-spawning upstream MCP server subprocess
- Fixed "command not found" errors with `npx` by properly passing environment variables
- Fixed stderr forwarding from upstream servers

### Changed
- Delegated subprocess management entirely to `StdioClientTransport` (breaking change in internal architecture)
- Improved error forwarding by using `stderr: "inherit"` instead of `"pipe"`

### Added
- Comprehensive integration tests for subprocess management and real-world MCP server compatibility
- Architecture validation tests to prevent regression of subprocess spawning anti-patterns
- Debugging guide for common MCP communication issues in CLAUDE.md
- ADR-003 documenting subprocess delegation pattern
- Claude Code configuration with custom slash commands

## [0.3.0] - 2025-01-XX

### Added
- Rsync-style pattern evaluation (first match wins)
- Support for both `--include` and `--exclude` patterns

### Changed
- Pattern matching now evaluates in order with first-match-wins semantics

## [0.2.0] - 2025-01-XX

### Added
- Comprehensive documentation updates
- Testing infrastructure with Vitest

## [0.1.0] - 2025-01-XX

### Added
- Initial release
- Basic MCP proxy server with pattern-based filtering
- Support for filtering tools, resources, and prompts
- Glob pattern matching using minimatch
