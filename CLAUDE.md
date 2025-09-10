# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Reference

**CRITICAL**: All agents and architectural decisions reference the consolidated architecture specification at `./docs/architecture-specification.md`. This single source of truth contains:
- Technology stack decisions and implementation details
- Test framework specifications (Playwright MCP, Mocha+Chai, Supertest)
- Implementation patterns for authentication, API, UI, data access
- Testing patterns for unit, integration, and E2E testing
- Deployment, security, and performance patterns
- Agent-specific reference guides

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

# Install from remote (one-liner)
curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash

# Uninstall with options
./uninstall.sh --dry-run    # Preview what will be removed
./uninstall.sh --yes         # Skip confirmations
./uninstall.sh --keep-repo  # Keep repository, remove symlinks only

# Install git hooks for security
./tools/install-git-hooks.sh [repository-path]
```

### Web Server Development
```bash
# Start the web interface
cd server && npm start

# Development mode with auto-reload
cd server && npm run dev

# Server runs on http://localhost:3456 by default
```

### Web Server Architecture
The `server/` directory provides a local development interface:
- **Express.js + WebSocket**: Real-time project management
- **Security**: Helmet.js headers, rate limiting
- **File Watching**: Live updates via Chokidar
- **Default Port**: http://localhost:3456
- **Features**: Project browsing, real-time collaboration tools

### Key Tools Available
Core management scripts in `tools/` directory:
```bash
# Security and validation
./tools/security-scan.sh [directory] [type] [verbose]     # Comprehensive security scanner
./tools/simple-secrets-scan.sh                           # Lightweight credential detection
./tools/install-git-hooks.sh [repository-path]          # Git security hook installer

# Configuration management  
./tools/merge-settings.sh                               # Safe JSON configuration merger
./tools/claude-craft-config.sh                         # Configuration file generator
./tools/add-memory.sh                                   # Memory fragment manager

# Backup and sync
./tools/backup.sh [list|backup|restore]                 # Backup management utility
./tools/auto-sync.sh                                    # Auto-synchronization system
./tools/knowledge-sync.sh                               # Knowledge discovery sync

# Development utilities
./tools/setup-web-server.sh                            # Web server setup and configuration
./tools/secure-git.sh                                  # Git operation security wrapper
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
2. **Determine user intent** from context "<prompt-arguments>":
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

### Prompt Template Discovery
Search precedence for `/prompt` command:
1. **Explicit file paths** (highest priority)
2. **Git repo parent prompts** (`$(dirname $(git rev-parse --show-toplevel))/prompts`)
3. **Profile prompts** (`~/.claude/prompts`)
4. **Current directory** (fallback)

Templates use `<prompt-arguments>` placeholders for dynamic content injection.

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

## Critical Implementation Notes

### Git Operations
- **ALWAYS** use `git -C "<directory>"` for all git operations to avoid directory context issues
- Never use `cd` followed by git commands in scripts
- Handle getcwd errors gracefully when directories are moved during operations

### Shell Command Best Practices
- **Prefer `!` syntax** for negation: `! [ -z "$VAR" ]` over `[ -n "$VAR" ]`
- **Use robust conditionals**: `! [ ! -d "$DIR" ]` for directory checks
- **Implement proper cleanup** with trap handlers for error conditions
- **Use `&&` with negation** for cleaner conditional execution
- **Always use absolute paths** or `git -C` for directory-independent execution
- **Run git from CWD**: `git rev-parse --show-toplevel` then look in parent directories for project config

### Directory Structure Awareness
- Repository location: `~/claude-craft/`
- Claude config location: `~/.claude/`
- Backups stored in: `~/.claude/backups/`
- Git hooks in: `.githooks/` (symlinked to `.git/hooks/`)

### File Type Handling
- **Commands & Agents**: Markdown files with YAML frontmatter
- **Settings**: JSON fragments for merging
- **Memory**: Markdown fragments with special import markers
- **Prompts**: Markdown with `<prompt-arguments>` placeholders

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

### Auto-Sync Configuration
Auto-sync behavior controlled via `settings/fragments/auto-sync-settings.json`:
- **Probability**: 1/27 chance (~3.7%) per user prompt
- **Debounce**: 5-second minimum intervals
- **Conflict Handling**: Automatic stash/merge/restore workflow
- **Triggers**: Configurable per event type (userPrompt, etc.)

### Prompt Command Enhancements
The `/prompt --list` command provides comprehensive sync management:
- **Two-section interface**: "Already Synced" vs "Available to Sync"
- **Level detection**: 📁 project vs 👤 profile scope indicators
- **Contiguous numbering**: Sequential numbering (1, 2, 3...) across all sections
- **Enhanced formatting**: Bold item names, wrapped descriptions, proper spacing
- **Configuration discovery**: Uses claude-craft.json for repository path resolution

## Common Development Tasks

### Adding a New Command
1. Create file in `commands/` with proper frontmatter:
   ```yaml
   ---
   argument-hint: "[args...]"
   description: "Command description"
   allowed-tools: "all"
   ---
   ```
2. Test locally: `ln -s $(pwd)/commands/new-cmd.md ~/.claude/commands/`
3. Run `/new-cmd` in Claude Code to test
4. Commit and push when ready

### Adding a New Prompt Template
1. Create file in `prompts/` directory
2. Use `<prompt-arguments>` for dynamic injection
3. Test with `/prompt template-name [context]`
4. Focus on natural language instructions over code

### Debugging Installation Issues
- Check symlinks: `ls -la ~/.claude/commands/ | grep claude-craft`
- Verify git hooks: `ls -la .git/hooks/`
- Review logs: `~/.git-security.log`
- Check backups: `ls -la ~/.claude/backups/`

### Security Testing
```bash
# Test security scanner on fixtures
./tools/security-scan.sh test/fixtures secrets false

# Run pre-commit hook manually
./.githooks/pre-commit

# Check for secrets in staged files
./tools/simple-secrets-scan.sh
```