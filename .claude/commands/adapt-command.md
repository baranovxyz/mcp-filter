---
name: adapt-command
description: Adapt a Claude Code slash command for this repository's specific context
---

# Adapt Command - Customize Slash Commands for Project Context

## Overview

This command takes an existing slash command template and adapts it for the current project by:
- Replacing generic examples with project-specific ones
- Updating file/documentation references to match this repository
- Removing irrelevant content from other project types
- Ensuring consistency with this project's patterns and conventions

## Process

### 1. Analysis Phase

I'll examine the command file to identify:
- **Generic examples**: Template examples from other projects
- **File references**: Documentation paths that may not exist here
- **Domain-specific content**: Terminology specific to other project types
- **Inconsistent patterns**: References that don't match this project's structure

### 2. Repository Context Gathering

I'll gather information about the current project:
- Check existing documentation structure (glob for `*.md`, `docs/`)
- Review recent commit patterns (`git log`) for style examples
- Identify project-specific terminology from `CLAUDE.md` and `README.md`
- Understand the tech stack from `package.json`, build configs, etc.

### 3. Adaptation Phase

I'll update the command file by:
- Replacing examples with scenarios relevant to this project
- Updating documentation references to actual files in this repo
- Removing content specific to other project types
- Adding project-specific best practices and patterns from `CLAUDE.md`
- Ensuring terminology matches this project's domain

### 4. Verification Phase

I'll verify:
- All file paths reference actual files in the repository
- Examples use this project's actual patterns and code
- Terminology is consistent with this project's domain
- No remnants from other project types remain

## Example Transformations

### Example 1: Domain-Specific Categories

**Before (from UI/component project):**
```markdown
### Component Development Patterns
- Component structure and organization
- CSS approach, color usage, animation preferences
- Storybook configurations
```

**After (adapted for backend/CLI project):**
```markdown
### API Development Patterns
- Service layer organization
- Request/response handling
- Integration test strategies
```

### Example 2: Documentation References

**Before (generic path):**
```markdown
- Architecture decisions in docs/ARCHITECTURE.md
```

**After (checked against actual repo):**
```markdown
- Architecture decisions in docs/architecture-decisions.md
```

### Example 3: Commit Examples

**Before (generic):**
```markdown
- `feat: add new component`
- `fix: resolve styling issue`
```

**After (from actual git log):**
```markdown
- `feat: implement rsync-style pattern evaluation`
- `test: update tests for rsync-style filtering`
```

## Usage

```
/adapt-command <command-file-name>
```

Example:
```
/adapt-command extract-learnings
```

## What Gets Adapted

1. **Examples**: Replace with project-specific scenarios
   - Use actual code patterns from this repository
   - Reference real files and structures
   - Match the project's domain and terminology

2. **File References**: Update to actual paths
   - Verify all mentioned files exist
   - Use correct documentation structure
   - Link to actual configuration files

3. **Terminology**: Project-specific language
   - Extract domain terms from `CLAUDE.md` and `README.md`
   - Match language used in existing code and docs
   - Avoid terminology from unrelated project types

4. **Commit Examples**: Use actual recent commits
   - Run `git log --oneline -10` to get real examples
   - Match the project's commit message style
   - Include conventional commit types if used

## Discovery Process

When adapting, I'll systematically:

1. **Read the command file** to understand what needs adaptation
2. **Glob for documentation**: `*.md`, `docs/**/*.md`
3. **Read project context**: `CLAUDE.md`, `README.md`, `package.json`
4. **Check git history**: `git log --oneline -10` for commit patterns
5. **Identify mismatches**: Compare command content against project reality
6. **Apply updates**: Edit the command file with project-specific content
7. **Verify**: Ensure all references are valid

## Critical Review Checklist

After adaptation, verify:
- [ ] All file paths exist in the repository
- [ ] Examples match this project's tech stack
- [ ] Terminology is consistent with project domain
- [ ] Commit message examples are from actual history
- [ ] No generic placeholders remain
- [ ] Documentation references are accurate
- [ ] Project-specific patterns from `CLAUDE.md` are reflected

## Important Notes

- Always preserves the command's core functionality and structure
- Only updates examples, references, and domain-specific content
- Maintains the original command's purpose and workflow
- Ensures all references are verifiable (actual files, real patterns)
- Works with any project type by discovering context dynamically
- Particularly useful when importing commands from other projects or templates
