---
description: Access and apply individual prompt templates from claude-craft repository
allowed-tools: Read, WebFetch
argument-hint: [template-name] [args...]
---

# Prompt Command

Quickly access and apply prompt templates from the claude-craft repository.

## Usage

```
/prompt [template-name] [args...]
```

## Available Templates

- `/prompt list` - Show all available prompt templates
- `/prompt security` - Apply security analysis prompt template
- `/prompt review` - Apply code review prompt template  
- `/prompt test` - Apply test generation prompt template
- `/prompt refactor` - Apply refactoring guidance prompt template

## Examples

```bash
# List all available prompts
/prompt list

# Apply security analysis to current file
/prompt security

# Apply code review with specific focus
/prompt review --focus=performance
```

## Template Location

Templates are stored in `~/claude-craft/prompts/` and automatically synced with your local Claude Code configuration.