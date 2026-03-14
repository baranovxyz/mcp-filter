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

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `pnpm test` to ensure all tests pass
4. Run `pnpm run build` to verify compilation
5. Submit a pull request

## Running Tests

```bash
pnpm test                 # All tests
pnpm test tests/unit/     # Unit tests only (fast)
pnpm test tests/integration/  # Integration tests (spawns MCP servers)
pnpm test:coverage        # With coverage report
```

## Code Style

- TypeScript with strict mode
- ES modules (use `.js` extension in imports)
- No linter configured — follow existing patterns

## Architecture

See [AGENTS.md](AGENTS.md) for detailed architecture documentation, including the four-layer proxy design, data flow, and key implementation patterns.

## Reporting Issues

Open an issue at https://github.com/baranovxyz/mcp-filter/issues with:
- Steps to reproduce
- Expected vs actual behavior
- mcp-filter version (`mcp-filter --version`)
- Node.js version
- Upstream MCP server being used

## Security

If you discover a security vulnerability, please open an issue. This tool is a convenience filter, not a security boundary (see [product-requirements.md](docs/product-requirements.md)).
