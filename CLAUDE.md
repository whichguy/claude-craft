# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:security    # Security-specific tests
npm run test:knowledge   # Knowledge management tests
npm run test:backup      # Backup functionality tests

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Run a single test file
mocha test/security.test.js
```

### Code Quality
```bash
# Lint the codebase
npm run lint

# Security scan on memory fragments
npm run security:scan
```

### Installation & Setup
```bash
# Install Claude Craft to system
./install.sh

# Uninstall with options
./uninstall.sh --dry-run    # Preview what will be removed
./uninstall.sh --yes         # Skip confirmations
./uninstall.sh --keep-repo  # Keep repository, remove symlinks only
```

## Architecture & Core Concepts

### Extension System Architecture

Claude Craft operates as a **symlink-based extension manager** for Claude Code. Instead of directly modifying ~/.claude files, it creates symlinks from the repository to the Claude configuration directory. This provides:

1. **Version Control**: All extensions tracked in git
2. **Safe Updates**: Pull changes without overwriting local modifications
3. **Rollback Capability**: Automatic backups before any changes
4. **Multi-Profile Support**: Separate local/global command spaces

### Prompt-as-Code Pattern

The `/prompt` command system implements a **prompt-as-code pattern** where natural language instructions become executable specifications. Key files:

- `prompts/agent-sync.md`: Main orchestration prompt using declarative intent mapping
- `commands/prompt.md`: Base prompt executor with YAML frontmatter metadata
- `commands/alias.md` & `unalias.md`: Dynamic command generation using prompt directives

Prompts use structured directives instead of traditional scripting:
```markdown
2. **Determine user intent** from context "<prompt-context>":
   - **Status intent**: Contains "status", "what", "ready"...
```

### Security Infrastructure

Multi-layered security scanning implemented through:

1. **Git Hooks** (`hooks/scripts/`):
   - `pre-execution-security.sh`: Validates commands before execution
   - `validate-bash.sh`: Checks bash commands for dangerous patterns

2. **Security Scanners** (`tools/`):
   - `security-scan.sh`: Comprehensive pattern-based scanner
   - `simple-secrets-scan.sh`: Lightweight credential detection
   - `secure-git.sh`: Git operation security wrapper

3. **Security Commands** (`commands/`):
   - `code-security.md`, `git-security.md`, `memory-security.md`
   - Each implements different security analysis strategies

### Configuration Management

**Smart Merging Strategy**:
- Settings files: Deep JSON merge preserving user customizations
- Memory files: Append-only imports using fragment system
- Commands/Agents: Direct symlinks (no merging needed)

Key components:
- `tools/merge-settings.sh`: Intelligent JSON merger
- `tools/add-memory.sh`: Memory fragment manager
- `settings/fragments/`: Modular configuration pieces

### Command Routing System

Commands follow this execution flow:
1. User invokes `/command-name args`
2. Claude Code reads `~/.claude/commands/command-name.md`
3. YAML frontmatter defines tool permissions and argument hints
4. Markdown body contains prompt-as-code instructions
5. AI interprets instructions with context and executes tools

### Alias System Implementation

The alias system (`commands/alias.md`, `commands/unalias.md`) creates new command files dynamically:
- Validates alias names against reserved words
- Generates new .md files with proper frontmatter
- Marks files with `alias-generated: true` metadata
- Supports --global and local scopes

## Key Design Decisions

### Why Symlinks Over Copying
- Instant updates when pulling from repository
- No sync conflicts between copies
- Clear ownership (repository vs user files)
- Easy removal without affecting user data

### Why Prompt-as-Code Over Scripts
- Adaptive to context and edge cases
- Self-documenting through natural language
- Composable without complex dependencies
- Leverages AI reasoning instead of brittle logic

### Why Fragment-Based Configuration
- Modular updates without full file replacement
- Users can selectively adopt features
- Maintains backward compatibility
- Enables A/B testing of configurations

## Repository-Specific Patterns

### Testing Approach
Tests use Mocha/Chai with fixture-based validation:
- `test/fixtures/`: Sample data for testing
- Tests focus on security scanning and backup integrity
- No mocking - tests run against actual file operations

### Backup System
- Timestamped tar archives in `~/.claude/backups/`
- Automatic cleanup of backups older than 60 days
- Backup before any destructive operation
- Restore capability via uninstaller

### Auto-Sync Mechanism
- Probabilistic triggering (~3.7% of prompts)
- Debounced to prevent rapid firing
- Stash/pop for handling uncommitted changes
- Silent operation in background