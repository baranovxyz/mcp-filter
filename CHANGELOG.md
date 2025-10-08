# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
