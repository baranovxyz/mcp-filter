---
name: smart-commit
description: Analyze project changes and create atomic conventional commits grouped by type
---

# Smart Commit - Intelligent Change Analysis and Conventional Commits

## Overview
This command analyzes all uncommitted changes in your project, intelligently groups them by conventional commit types, and creates atomic commits with well-structured messages.

## Process

### 1. Change Analysis Phase
First, I'll analyze your changes by:
- Running `git status` to see all modified and untracked files
- Running `git diff` to understand the nature of staged and unstaged changes
- Running `git log --oneline -5` to understand recent commit patterns and style

### 2. Intelligent Grouping Phase
I'll thoughtfully group changes by:
- **Conventional commit types**: feat, fix, docs, style, refactor, test, chore, build, ci, perf
- **Logical relationships**: Changes that belong together functionally
- **Dependencies**: Files that must be committed together to maintain consistency
- **Scope**: Related components or modules

### 3. Commit Strategy Phase
For each group of changes, I'll:
- Determine the appropriate conventional commit type
- Identify the scope (if applicable)
- Write a clear, concise commit message focusing on the "why"
- Consider whether changes need to be split into multiple commits for clarity

### 4. Execution Phase
I'll then:
- Stage the appropriate files for each commit group
- Create commits with properly formatted messages
- Verify each commit was successful
- Provide a summary of what was committed

## Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

## Conventional Commit Types
- **feat**: New feature or functionality
- **fix**: Bug fixes
- **docs**: Documentation changes only
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix bugs nor add features
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates
- **build**: Build system or external dependency changes
- **ci**: CI/CD configuration changes
- **perf**: Performance improvements

## Best Practices I Follow
1. **Atomic commits**: Each commit represents one logical change
2. **Clear messages**: Focus on why the change was made, not just what
3. **Proper grouping**: Related changes are committed together
4. **No mixing**: Don't mix features with refactoring or fixes
5. **Staging verification**: Always verify what's being staged before committing
6. **Test consideration**: Ensure tests are included with their related code changes
7. **No AI attribution**: Never mention Claude, Anthropic, or AI generation in commit messages per project rules

## Example Usage
```
/smart-commit
```

The command will:
1. Analyze all your current changes
2. Show you a proposed commit plan with grouped changes
3. Execute the commits after your approval
4. Provide a summary of what was committed

## Important Notes
- I'll always show you the commit plan before executing
- Complex changes may require multiple commits for clarity
- I'll respect your project's existing commit style patterns
- Configuration files and their related code changes will be grouped together
- I'll ensure no breaking changes are split across commits
- Commit messages follow this project's pattern: optional conventional type prefix, clear description
- Recent commit style examples from this repo:
  - `feat: implement rsync-style pattern evaluation`
  - `test: update tests for rsync-style filtering`
  - `docs: update documentation for v0.2.0`
  - `chore: add context/ to gitignore`