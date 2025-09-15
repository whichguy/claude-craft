# Claude Code Hook JSON Schema

This document defines the standard JSON format for hook definitions in the claude-craft repository.

## Overview

Hooks in Claude Code can be defined in multiple formats depending on their complexity. The claude-craft system standardizes these into JSON definition files that can be shared and version-controlled.

## Hook JSON Schema

### Base Hook Definition
```json
{
  "name": "string (required)",
  "hookType": "string (required)",
  "format": "simple|object|matcher|toolMatch (required)",
  "command": "string (required)",
  "description": "string (optional)",
  "scope": "profile|project|local (optional, default: profile)",
  "enabled": "boolean (optional, default: true)"
}
```

### Format-Specific Fields

#### Simple Format (format: "simple")
Minimal hook that maps directly to a command string.
```json
{
  "name": "prompt-sync-check",
  "hookType": "onUserPromptSubmit",
  "format": "simple",
  "command": "~/.claude/hooks/prompt-sync-check.sh",
  "description": "Auto-sync prompt templates on user submission",
  "scope": "profile"
}
```

**Generates**: `"onUserPromptSubmit": "~/.claude/hooks/prompt-sync-check.sh"`

#### Object Format (format: "object")
Hook with command and description fields.
```json
{
  "name": "log-prompts",
  "hookType": "userPromptSubmit",
  "format": "object",
  "command": "~/.claude/hooks/log-prompts.sh",
  "description": "Log user prompts for analysis",
  "scope": "profile"
}
```

**Generates**:
```json
"userPromptSubmit": {
  "command": "~/.claude/hooks/log-prompts.sh",
  "description": "Log user prompts for analysis"
}
```

#### Matcher Format (format: "matcher")
Hook that matches specific tools using the legacy `matcher` field.
```json
{
  "name": "bash-journal",
  "hookType": "PreToolUse",
  "format": "matcher",
  "matcher": "Bash",
  "command": "~/.claude/journal/journal_writer.sh PreToolUse",
  "description": "Journal Bash tool usage",
  "scope": "profile"
}
```

**Generates**:
```json
"PreToolUse": [
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "~/.claude/journal/journal_writer.sh PreToolUse"
      }
    ]
  }
]
```

#### ToolMatch Format (format: "toolMatch")
Hook that matches tools using regex patterns with the newer `toolMatch` field.
```json
{
  "name": "validate-bash",
  "hookType": "preToolUse",
  "format": "toolMatch",
  "toolMatch": "Bash.*",
  "command": "~/.claude/hooks/validate-bash.sh",
  "description": "Validate bash commands before execution",
  "scope": "profile"
}
```

**Generates**:
```json
"preToolUse": [
  {
    "toolMatch": "Bash.*",
    "command": "~/.claude/hooks/validate-bash.sh",
    "description": "Validate bash commands before execution"
  }
]
```

## Supported Hook Types

### User Interaction Hooks
- `onUserPromptSubmit` - Simple format, triggered on prompt submission
- `userPromptSubmit` - Object/toolMatch format, triggered on prompt submission
- `UserPromptSubmit` - Matcher format, triggered on prompt submission

### Tool Execution Hooks
- `preToolUse` - Object/toolMatch format, before tool execution
- `PreToolUse` - Matcher format, before tool execution
- `PostToolUse` - Matcher format, after tool execution

### Agent Lifecycle Hooks
- `SubagentStop` - Matcher format, when subagent stops
- `Stop` - Matcher format, when main agent stops

## Scope Levels

### Profile Scope (default)
- **Target**: `~/.claude/settings.json`
- **Usage**: Global hooks available across all projects
- **Installation**: Hooks apply to all Claude Code usage

### Project Scope
- **Target**: `$(dirname $GIT_ROOT)/.claude/settings.json`
- **Usage**: Project-family specific hooks
- **Installation**: Hooks apply to related git repositories

### Local Scope
- **Target**: `$(pwd)/.claude/settings.json` or project-specific settings
- **Usage**: Single project specific hooks
- **Installation**: Hooks apply only to current project context

## File Naming Convention

Hook JSON files should be stored in the repository as:
```
hooks/
├── hook-name.json          # Simple descriptive name
├── validate-bash.json      # Tool-specific hooks
├── log-prompts.json        # Feature-specific hooks
└── project-sync.json       # Workflow-specific hooks
```

## Validation Rules

### Required Fields
- `name`: Unique identifier for the hook
- `hookType`: Must match a valid Claude Code hook type
- `format`: Must be one of: simple, object, matcher, toolMatch
- `command`: Path to executable script or command

### Format-Specific Requirements
- **simple**: No additional fields required
- **object**: `description` recommended but optional
- **matcher**: `matcher` field required (tool name pattern)
- **toolMatch**: `toolMatch` field required (regex pattern)

### File Path Requirements
- Commands should use absolute paths or `~/.claude/` relative paths
- Script files should be executable (`chmod +x`)
- Paths should be portable across different systems

## Integration Workflow

### Publishing Hooks (Local → Repository)
1. Extract hook configuration from local settings.json
2. Convert to standardized JSON format based on detected structure
3. Create hook definition file in repository `hooks/` directory
4. Git add, commit, push the JSON definition

### Syncing Hooks (Repository → Local)
1. Read JSON definition from repository
2. Parse format and generate appropriate settings.json structure
3. Insert into target settings.json at specified scope level
4. Validate hook configuration and script accessibility

## Examples by Use Case

### Security Validation Hook
```json
{
  "name": "security-scan",
  "hookType": "preToolUse",
  "format": "toolMatch",
  "toolMatch": "(Bash|Edit|Write).*",
  "command": "~/.claude/hooks/security-validate.sh",
  "description": "Validate commands for security issues",
  "scope": "profile"
}
```

### Project Sync Hook
```json
{
  "name": "auto-sync",
  "hookType": "onUserPromptSubmit",
  "format": "simple",
  "command": "~/.claude/hooks/project-sync.sh",
  "description": "Auto-sync project changes on prompt",
  "scope": "project"
}
```

### Development Logging Hook
```json
{
  "name": "dev-logger",
  "hookType": "PostToolUse",
  "format": "matcher",
  "matcher": "*",
  "command": "~/.claude/hooks/dev-log.sh PostToolUse",
  "description": "Log all tool usage for development analysis",
  "scope": "local"
}
```

This schema enables team collaboration on hook configurations while maintaining the flexibility of Claude Code's hook system.