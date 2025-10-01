# Testing Guide

## Test Structure (Enterprise Approach)

```
tests/
├── unit/              # Fast, isolated unit tests
│   ├── cli.test.ts    # CLI argument parsing
│   └── filter.test.ts # Pattern matching logic
├── integration/       # Tests with real MCP communication
│   └── proxy.test.ts  # End-to-end proxy functionality
└── fixtures/          # Test helper servers
    └── simple-server.ts
```

## Running Tests

```bash
# Run all tests once
pnpm test

# Watch mode (during development)
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Test Framework

Using **Vitest** - Fast, modern testing framework with:
- Native ESM support
- TypeScript out of the box
- Jest-compatible API
- Fast watch mode
- Built-in coverage

## Test Coverage

Current test suites:

### Unit Tests (18 tests)
- **CLI Parser** (8 tests)
  - Pattern parsing
  - Command extraction
  - Error handling

- **Filter Engine** (10 tests)
  - Glob pattern matching
  - List filtering
  - Edge cases

### Integration Tests (3 tests)
- **Proxy Server**
  - Tool listing with filters
  - Allowed tool calls
  - Blocked tool calls

## Adding New Tests

1. **Unit tests** → `tests/unit/` - for pure functions
2. **Integration tests** → `tests/integration/` - for MCP communication
3. **Test fixtures** → `tests/fixtures/` - for helper servers

## CI/CD Ready

The test setup is ready for:
- GitHub Actions
- GitLab CI
- Jenkins
- Any CI that runs `pnpm test`
