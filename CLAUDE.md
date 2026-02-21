# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:sync        # Tests sync infrastructure (33 tests)
npm run test:security    # Tests security scanning patterns
npm run test:knowledge   # Tests knowledge discovery system
npm run test:backup      # Tests backup/restore functionality

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Installation & Setup
```bash
# Install Claude Craft to system (creates symlinks from repo to ~/.claude/)
./install.sh

# Install from remote (one-liner)
curl -fsSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash

# Uninstall with options
./uninstall.sh --dry-run    # Preview what will be removed
./uninstall.sh --yes         # Skip confirmations
./uninstall.sh --keep-repo  # Keep repository, remove symlinks only

# Install git hooks for security
./tools/install-git-hooks.sh [repository-path]
```

### Key Management Scripts
```bash
# Sync engine (core)
./tools/sync-status.sh [status|sync|add|publish]     # All 6 extension types

# Security scanning
./tools/security-scan.sh [directory] [type] [verbose]  # Pattern-based scanner
./tools/simple-secrets-scan.sh                        # Quick credential detection

# Backup and sync
./tools/backup.sh [list|backup|restore]              # Manage timestamped tar archives
./tools/auto-sync.sh [prompt-check|force]             # Probabilistic sync (3.7% chance per prompt)
```

## Architecture & Core Concepts

### Symlink-Based Extension System

Claude Craft uses symlinks instead of copying files to ~/.claude/, providing:
- **Instant updates** when pulling from repository
- **No sync conflicts** between repository and local files
- **Version control** for all extensions
- **Easy rollback** via automatic backups

Directory structure (6 extension types):
```
~/claude-craft/              # Repository location
├── agents/                # Agent definitions (.md) → ~/.claude/agents/
├── commands/              # Slash commands (.md) → ~/.claude/commands/
├── skills/                # Skill directories → ~/.claude/skills/
├── prompts/               # Prompt templates (.md) → ~/.claude/prompts/
├── references/            # Reference docs (.md) → ~/.claude/references/
├── plugins/               # Plugin directories → ~/.claude/plugins/
│   ├── craft-hooks/       # Core hooks (security + auto-sync)
│   └── reflection-system/ # Session reflection and knowledge
└── tools/                 # Management scripts (not symlinked)
```

### Prompt-as-Code Pattern

The `/prompt` command executes natural language instructions as code. Key implementation:

1. **Template Discovery** (`commands/prompt.md`):
   - Searches in priority order: explicit paths → git parent → profile → current dir
   - Supports fuzzy matching and case-insensitive search
   - Uses `<prompt-arguments>` placeholder for dynamic content

2. **Execution Flow**:
   ```bash
   /prompt template-name args →
   Load template.md →
   Replace <prompt-arguments> →
   Execute as instructions
   ```

3. **Key Prompt Templates**:
   - `prompts/agent-sync.md`: Main repository sync orchestrator
   - `prompts/prompt-ab-test.md`: A/B testing framework for prompts
   - `prompts/ideal-sti-v3.md`: Phased development methodology
   - `prompts/feature-developer.md`: End-to-end feature implementation

### Command System Architecture

Commands are markdown files with YAML frontmatter defining permissions:

```yaml
---
argument-hint: "[args...]"
description: "Command description"
allowed-tools: "all"  # or specific tools like "Bash, Read, Write"
---

[Markdown body with prompt-as-code instructions]
```

Key commands:
- `/agent-sync`: Smart repository synchronization with conflict handling
- `/alias` & `/unalias`: Dynamic command generation system
- `/prompt`: Template executor with discovery and sync capabilities

### Security Infrastructure

Multi-layered security implementation:

1. **Pattern-Based Scanning** (`tools/security-scan.sh`):
   - Detects API keys, tokens, passwords
   - Validates bash commands for dangerous patterns
   - Runs pre-commit and post-pull

2. **Git Hooks** (`.githooks/`):
   - `pre-commit`: Scans staged files for secrets
   - Symlinked to `.git/hooks/` during installation

3. **Hook Plugins** (`plugins/craft-hooks/`):
   - `pre-execution-security.sh`: Validates commands before execution
   - `prompt-sync-check.sh`: Probabilistic auto-sync trigger
   - Uses `${CLAUDE_PLUGIN_ROOT}` paths — loaded natively by Claude Code

### Sync Architecture

All sync operations use `tools/sync-status.sh` — a single data-driven script handling all 6 extension types:
- **File-based** (agents, commands, prompts, references): Per-file symlinks
- **Directory-based** (skills, plugins): Per-directory symlinks
- TYPES array defined in `tools/shared-types.sh` (shared by sync-status.sh and uninstall.sh)
- Skip patterns exclude legacy files (`old-do-not-use-*`) and global commands (`alias.md`, `unalias.md`)
- Local-only files are never overwritten by sync

### Auto-Sync Mechanism

- **Probability**: 1/27 chance (~3.7%) per user prompt
- **Debounce**: 5-second minimum intervals
- **Conflict Handling**: Automatic stash/merge/restore
- **Background Operation**: Never interrupts workflow

Implementation in `tools/auto-sync.sh`.

## Critical Implementation Notes

### Git Operations
- **ALWAYS** use `git -C "<directory>"` to avoid directory context issues
- Never use `cd` followed by git commands
- Handle getcwd errors gracefully when directories are moved

### Shell Best Practices
- Prefer `!` syntax for negation: `! [ -z "$VAR" ]`
- Use robust conditionals: `! [ ! -d "$DIR" ]`
- Implement trap handlers for cleanup
- Always use absolute paths or `git -C`

### Testing Approach
- Tests use Mocha/Chai with fixture-based validation
- No mocking - tests run against actual file operations in temp directories
- `test/sync.test.js`: 33 tests covering all 4 sync actions + error paths + install/uninstall/plugin validation
- Fixtures in `test/fixtures/` contain sample data for security tests

## Prompt Template Development

### Key Prompt Templates

1. **`prompts/prompt-ab-test.md`**: Comprehensive A/B testing framework
   - Parallel execution with Task tool
   - Domain-adaptive scoring weights
   - Git-based version comparison
   - Verbatim output capture with anti-summarization

2. **`prompts/ideal-sti-v3.md`**: Phased development methodology
   - 11-phase structured approach
   - Requirements → Design → Implementation flow
   - Built-in quality gates and testing

3. **`prompts/feature-developer.md`**: End-to-end feature implementation
   - Integrates with ideal-sti phases
   - Handles UI/UX, testing, documentation
   - Works within git worktrees

### Template Best Practices
- Use `<prompt-arguments>` for dynamic content injection
- Implement thinking patterns: intention → action → result → learning
- Include runtime decision-making vs predetermined choices
- Focus on natural language instructions over code
- Structure with clear phases and validation steps

## Repository-Specific Patterns

### Backup System
- Timestamped tar archives in `~/.claude/backups/`
- Format: `claude-backup-YYYYMMDD-HHMMSS.tar.gz`
- Automatic cleanup of backups older than 60 days
- Restore capability via `./uninstall.sh --restore`

### Alias System
The `/alias` command dynamically creates new commands:
- Validates against reserved words
- Generates proper YAML frontmatter
- Marks with `alias-generated: true`
- Supports `--global` and local scopes

### Prompt Discovery Precedence
1. Explicit file paths (highest priority)
2. Git repo parent prompts
3. Profile prompts (`~/.claude/prompts`)
4. Current directory (fallback)

## Common Development Tasks

### Adding a New Command
1. Create file in `commands/` with YAML frontmatter
2. Test locally: `ln -s $(pwd)/commands/new-cmd.md ~/.claude/commands/`
3. Run `/new-cmd` in Claude Code to test
4. Commit and push when ready

### Adding a New Prompt Template
1. Create file in `prompts/` directory
2. Use `<prompt-arguments>` placeholder
3. Test with `/prompt template-name [context]`
4. Run `/agent-sync sync` to symlink to ~/.claude/prompts/

### Debugging Installation Issues
```bash
# Check symlinks
ls -la ~/.claude/commands/ | grep claude-craft

# Verify git hooks
ls -la .git/hooks/

# Review security logs
cat ~/.git-security.log

# Check backups
ls -la ~/.claude/backups/
```

### Running Security Scans
```bash
# Test on fixtures
./tools/security-scan.sh test/fixtures secrets false

# Scan memory fragments
npm run security:scan

# Check staged files
./tools/simple-secrets-scan.sh
```