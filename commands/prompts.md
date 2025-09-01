# Prompts Command

Quickly access and apply prompt templates from the claude-craft repository.

## Usage

```
/prompts [template-name] [args...]
```

## Available Templates

- `/prompts list` - Show all available prompt templates
- `/prompts security` - Apply security analysis prompt template
- `/prompts review` - Apply code review prompt template  
- `/prompts test` - Apply test generation prompt template
- `/prompts refactor` - Apply refactoring guidance prompt template

## Examples

```bash
# List all available prompts
/prompts list

# Apply security analysis to current file
/prompts security

# Apply code review with specific focus
/prompts review --focus=performance
```

## Template Location

Templates are stored in `~/claude-craft/prompts/` and automatically synced with your local Claude Code configuration.