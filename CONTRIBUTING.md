# Contributing to mcp-filter

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/baranovxyz/mcp-filter.git
cd mcp-filter
pnpm install
pnpm run build
pnpm test
```

**Requirements**: Node.js >= 18, pnpm

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `pnpm test` to ensure all tests pass
4. Run `pnpm run build` to verify compilation
5. Update `AGENTS.md` if your changes affect documented structure, capabilities, or patterns
6. Submit a pull request

## Running Tests

```bash
pnpm test                         # All tests
pnpm test tests/unit/             # Unit tests only (fast)
pnpm test tests/integration/      # Integration tests (spawns MCP servers)
pnpm test:coverage                # With coverage report
pnpm test:watch                   # Watch mode
```

See [TESTING.md](TESTING.md) for the full testing guide, test structure, and how to write new tests.

## Code Style

- TypeScript with strict mode
- ES modules (use `.js` extension in imports)
- No linter configured — follow existing patterns in the codebase

## Project Architecture

See [AGENTS.md](AGENTS.md) for detailed architecture documentation including:
- Four-layer proxy design
- Data flow diagrams
- Transport types
- MCP SDK usage patterns

## Adding New Features

1. **Unit tests first** — add tests in `tests/unit/` for pure logic
2. **Integration tests** — add tests in `tests/integration/` for MCP communication
3. **Fixture servers** — add new fixtures in `tests/fixtures/` if needed
4. **Documentation** — update AGENTS.md and README.md as needed

## Reporting Issues

Open an issue at https://github.com/baranovxyz/mcp-filter/issues with:

- Steps to reproduce
- Expected vs actual behavior
- mcp-filter version (`mcp-filter --version`)
- Node.js version
- Upstream MCP server being used

## Security

If you discover a security vulnerability, please open an issue. mcp-filter is a convenience filter, not a security boundary — the MCP client can always bypass filtering by connecting directly to the upstream server.
