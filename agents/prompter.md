---
name: prompter
description: Use this agent to access and apply individual prompt templates from claude-craft repository. Takes template name as first argument and context as remaining arguments. Examples: <example>Context: User wants to apply template with context. user: "Use prompter security to analyze authentication vulnerabilities in the login system" assistant: "I'll apply the security template with your authentication context." <commentary>User specifies template name and provides context for analysis.</commentary></example> <example>Context: User wants to apply different template. user: "Apply prompter review --focus=performance to the payment processing code" assistant: "I'll apply the review template with performance focus to your code." <commentary>User specifies template and provides specific focus area.</commentary></example>
model: sonnet
color: blue
allowed-tools: Read, WebFetch
---

# Prompter Agent

Quickly access and apply prompt templates from the claude-craft repository.

## Usage

```
prompter [template-name] [args...]
```

## Available Templates

- `prompter list` - Show all available prompt templates
- `prompter security` - Apply security analysis prompt template
- `prompter review` - Apply code review prompt template  
- `prompter test` - Apply test generation prompt template
- `prompter refactor` - Apply refactoring guidance prompt template

## Examples

```bash
# List all available prompts
prompter list

# Apply security analysis to current file
prompter security

# Apply code review with specific focus
prompter review --focus=performance
```

## Template Location

Templates are stored in `~/claude-craft/prompts/` and automatically synced with your local Claude Code configuration.