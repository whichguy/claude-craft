# Claude Code Extension Scope Levels

This document clarifies the three different scope levels for installing Claude Code extensions and their practical implications.

## Overview

Claude Code extensions (prompts, agents, commands, hooks) can be installed at three different scope levels, each serving different use cases and affecting different user contexts.

## Scope Level Definitions

### 🌍 Profile Scope (Global)
**Target Directory**: `~/.claude/`
**Settings File**: `~/.claude/settings.json`
**Git Context**: Not tied to any specific git repository

#### Characteristics
- **Availability**: Extensions work across ALL projects and directories
- **User Impact**: Available to the user everywhere Claude Code is used
- **Persistence**: Remains active regardless of current working directory
- **Use Cases**: General-purpose tools, universal workflows, personal utilities

#### Example Use Cases
```bash
# Universal prompt templates
~/.claude/prompts/echo.md          # Works from any directory
~/.claude/prompts/weather.md       # Always available

# Global development tools
~/.claude/agents/code-reviewer.md  # Review code in any project
~/.claude/commands/git-helper.md   # Git utilities for all repos

# Universal hooks
~/.claude/settings.json:
"userPromptSubmit": {
  "command": "~/.claude/hooks/universal-logger.sh"
}
```

#### When to Use Profile Scope
- ✅ Tools you want available everywhere
- ✅ Personal productivity templates
- ✅ Universal development utilities
- ✅ Cross-project workflows
- ✅ Default choice when unsure

### 🏠 Project Scope (Git Family)
**Target Directory**: `$(dirname $GIT_ROOT)/.claude/`
**Settings File**: `$(dirname $GIT_ROOT)/.claude/settings.json`
**Git Context**: Tied to the parent of the git repository root

#### Characteristics
- **Availability**: Extensions work for related git repositories under same parent
- **User Impact**: Shared across a family of related projects
- **Persistence**: Active when working in related git repositories
- **Use Cases**: Organization-specific tools, multi-repo workflows, team standards

#### Example Structure
```bash
# Directory structure
~/workspace/my-company/
├── .claude/
│   ├── prompts/deploy.md        # Company deployment templates
│   ├── agents/code-style.md     # Company coding standards
│   └── settings.json            # Company-specific hooks
├── project-a/                   # Git repo - inherits company extensions
├── project-b/                   # Git repo - inherits company extensions
└── project-c/                   # Git repo - inherits company extensions
```

#### When to Use Project Scope
- ✅ Company/organization specific tools
- ✅ Multi-repository workflows
- ✅ Team collaboration standards
- ✅ Related project families
- ✅ Shared deployment processes

### 🔒 Local Scope (Single Project)
**Target Directory**: `$(pwd)/.claude/` or project-specific location
**Settings File**: Local project settings file
**Git Context**: Tied to current working directory or specific project

#### Characteristics
- **Availability**: Extensions work only in the specific project context
- **User Impact**: Isolated to single project or directory
- **Persistence**: Active only when working in that specific location
- **Use Cases**: Project-specific tools, unique workflows, experimental features

#### Example Use Cases
```bash
# Project-specific extensions
./my-special-project/.claude/
├── prompts/deploy-staging.md    # This project's deployment only
├── agents/custom-linter.md      # Project-specific code analysis
└── settings.json                # Project-specific hooks

# Project-unique workflows
./research-project/.claude/
├── prompts/analyze-data.md      # Research-specific templates
└── agents/ml-pipeline.md        # Machine learning workflows
```

#### When to Use Local Scope
- ✅ Project-specific tools that don't apply elsewhere
- ✅ Experimental or prototype extensions
- ✅ Unique project requirements
- ✅ Isolated development environments
- ✅ Client-specific customizations

## Scope Selection Logic

### Default Behavior
**Profile scope is the default** unless explicitly overridden because:
- Most extensions are generally useful across projects
- Reduces cognitive overhead for users
- Provides the most value with least setup
- Easy to discover and use

### Scope Detection Keywords

#### Profile Scope Indicators
User language that suggests profile-level installation:
- "global", "everywhere", "all projects"
- "profile", "universal", "always available"
- "general purpose", "cross-project"
- No scope specification (default assumption)

#### Project Scope Indicators
User language that suggests project-family installation:
- "project family", "organization", "company"
- "related projects", "multi-repo", "team"
- "shared across repos", "collaborative"

#### Local Scope Indicators
User language that suggests single-project installation:
- "local", "here only", "this project"
- "project-specific", "isolated", "unique"
- "experimental", "prototype", "custom"

### Selection Examples

```bash
# Profile scope (default)
"/prompt sync weather echo"                    # No scope specified
"/prompt sync 5 7 globally"                    # Explicit global
"/prompt sync echo for all projects"           # Cross-project intent

# Project scope
"/prompt sync deploy for this project family"  # Multi-repo context
"/prompt sync 3 for the team"                  # Collaborative intent
"/prompt sync company-standards"               # Organization tools

# Local scope
"/prompt sync custom-linter --local"           # Explicit local flag
"/prompt sync 2 here only"                     # Location-specific
"/prompt sync experimental-tool locally"       # Isolated usage
```

## Practical Implications

### Discovery Priority
When executing templates, Claude Code searches in this order:
1. **Local scope** (most specific) - current project context
2. **Project scope** (family-wide) - related repositories
3. **Profile scope** (global) - universal availability

### Conflict Resolution
If the same extension exists at multiple scopes:
- Local overrides project and profile
- Project overrides profile
- Profile serves as fallback

### Symlink Management
Extensions are symlinked from repository to target scope:
```bash
# Profile scope symlink
~/.claude/prompts/weather.md -> ~/claude-craft/prompts/weather.md

# Project scope symlink
~/workspace/company/.claude/prompts/deploy.md -> ~/claude-craft/prompts/deploy.md

# Local scope symlink
./project/.claude/prompts/custom.md -> ~/claude-craft/prompts/custom.md
```

## Migration Between Scopes

### Moving from Profile to Project
When a universal tool becomes team-specific:
1. Remove symlink from `~/.claude/`
2. Create symlink in `$(dirname $GIT_ROOT)/.claude/`
3. Update any scope-specific configurations

### Moving from Local to Profile
When a project-specific tool proves generally useful:
1. Remove symlink from local `.claude/`
2. Create symlink in `~/.claude/`
3. Test across different project contexts

## Best Practices

### Start with Profile Scope
- Default to profile scope for new extensions
- Migrate to more specific scopes only when needed
- Profile scope provides maximum utility

### Use Project Scope for Collaboration
- Organization standards and workflows
- Multi-repository coordination
- Team-shared development processes

### Reserve Local Scope for Unique Cases
- Project-specific requirements
- Experimental or prototype extensions
- Client-specific customizations
- Isolated development environments

### Scope Documentation
When sharing extensions, document intended scope:
```markdown
# Extension: Deploy Helper
**Recommended Scope**: Project (for team deployment standards)
**Alternative**: Profile (for personal deployment workflows)
```

This scope system provides flexibility while maintaining simplicity, allowing extensions to be installed at the appropriate level of sharing and availability.