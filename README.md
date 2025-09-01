# Claude Craft 🚀

**Complete Claude Code development toolkit with safe configuration management**

A comprehensive repository for managing all your Claude Code extensions with intelligent merging, automatic syncing, and zero-risk configuration management.

## Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash
```

**Then restart Claude Code to load the new extensions!**

## What You Get

- **`/craft`** - Simple repository sync command (default: sync latest changes)
- **`/craft auto-sync`** - Intelligent auto-sync with probabilistic triggers
- **`/prompts`** - Quick access to prompt templates  
- **Safe configuration merging** - Never overwrites your existing settings
- **Automatic backups** - All changes backed up before applying
- **Complete extensibility** - Commands, memory, hooks, settings, and more
- **Smart change detection** with restart reminders
- **Rollback capability** - Restore from backups if needed
- **Security scanning** - Pre-commit and post-pull threat detection

## Usage

### Daily Workflow
```bash
# Sync latest changes (dead simple!)
/craft

# Add new content, then push
/craft push "Added security templates"

# Check what's linked
/craft status

# Enable automatic sync (runs ~3.7% of prompts)
/craft auto-sync enable

# Check auto-sync status
/craft auto-sync status
```

### Auto-Sync Features

**Intelligent Background Sync** - Automatically keeps your repository synchronized:
- **Probabilistic Triggers**: Syncs on ~1/27 user prompts (3.7% chance)
- **Debounced**: Minimum 5-second intervals to prevent spam
- **Background Operation**: Never interrupts your workflow
- **Smart Conflict Detection**: Handles stashing/merging automatically
- **Security Integration**: Pre-sync security scanning

```bash
# Enable auto-sync
/craft auto-sync enable

# Check configuration and statistics  
/craft auto-sync status

# Force immediate sync
/craft auto-sync force

# Disable when not needed
/craft auto-sync disable
```

### Commands Available

| Command | Description |
|---------|-------------|
| `/craft` | Sync latest changes (default action) |
| `/craft setup` | Initial setup (same as install script) |
| `/craft push` | Commit and push your changes |
| `/craft status` | Show git status and active symlinks |
| `/craft clean` | Clean and refresh all symlinks |
| `/craft auto-sync enable` | Enable automatic probabilistic sync |
| `/craft auto-sync disable` | Disable automatic sync |
| `/craft auto-sync status` | Show auto-sync configuration |
| `/craft scan` | Run security scan on memory files |
| `/prompts` | Access prompt templates |

### Git Security Commands (installed automatically)

| Command | Description |
|---------|-------------|
| `git pull` | Automatically scans pulled files for threats |
| `git commit` | Automatically blocks commits with secrets |
| `~/claude-craft/tools/install-git-hooks.sh` | Install/reinstall git hooks |

## Folder Structure

```
claude-craft/
├── commands/              # Slash commands (.md) → ~/.claude/commands/
├── memory/                # Memory management
│   ├── fragments/         # Reusable memory fragments
│   ├── templates/         # Complete CLAUDE.md templates  
│   └── includes/          # Import-ready snippets
├── hooks/                 # Hook system
│   ├── scripts/           # Hook scripts (.sh) → ~/.claude/hooks/
│   └── settings/          # Hook settings fragments
├── .githooks/             # Local git hooks (installed automatically)
│   ├── post-merge         # Security scan after git pull
│   └── pre-commit         # Secret detection before commit
├── settings/              # Settings management
│   ├── fragments/         # JSON fragments to merge safely
│   └── templates/         # Complete settings examples
├── agents/                # Agent definitions
├── prompts/               # Prompt templates and examples
├── workflows/             # End-to-end workflow examples
├── configs/               # Configuration samples
└── tools/                 # Management utilities
    ├── merge-settings.sh  # Safe JSON merger
    ├── add-memory.sh      # Memory fragment manager
    ├── install-git-hooks.sh # Git security hook installer
    └── backup.sh          # Backup and restore utility
```

## How It Works

### Complete Setup Lifecycle

1. **Installation** (`/craft setup` or install script):
   - Clones repository to `~/claude-craft` (or existing location)
   - Makes tools executable (`chmod +x tools/*.sh`)
   - **Installs local git hooks for security**
   - Creates symlinks for commands and agents
   - Safe-merges configuration fragments
   - Creates backup of existing settings

2. **Daily Sync** (`/craft` or `/craft sync`):
   - Secure git pull with threat analysis
   - Re-syncs command/agent symlinks (handles new/removed files)
   - Safe-merges any new configuration fragments
   - Shows restart reminder only if changes detected

3. **Auto-Sync** (when enabled):
   - Probabilistic sync (~3.7% chance per user prompt)
   - Background operation with debouncing
   - Intelligent conflict handling (stash/merge/restore)
   - Security scanning before any operations

4. **Built-in Git Security** (automatic after setup):
   - **Post-merge hook**: Scans pulled files for security threats
   - **Pre-commit hook**: Blocks commits with hardcoded secrets
   - Security events logged to `~/.git-security.log`

### Safe Configuration Management

1. **Backup First**: Always creates timestamped backups before any changes
2. **Smart Merging**: 
   - **Commands & Agents**: Direct symlinks (safe, file-level updates)
   - **Settings**: Deep JSON merge preserving your existing config
   - **Memory**: Appends imports without overwriting your content
   - **Hooks**: Symlinks scripts, merges hook settings safely
3. **Change Detection**: Only shows restart reminders when actually needed
4. **Rollback Ready**: Full backup system for easy restoration

### File Types

- **✅ Safe (Direct Symlinks)**: Commands (`.md`), agents (`.md/.json`), hook scripts (`.sh`)
- **🔧 Smart Merge**: `settings.json`, `CLAUDE.md`, hook configurations
- **💾 Always Backed Up**: All existing files before any changes
- **🛡️ Security Scanned**: All operations include pre/post security analysis

## Manual Installation

If you prefer not to use the curl script:

```bash
git clone https://github.com/whichguy/claude-craft.git ~/claude-craft
cd ~/claude-craft
chmod +x install.sh
./install.sh
```

## Security Features

### Automatic Git Hook Protection

Claude Craft automatically installs local git hooks during setup that protect you:

- **Post-merge Security Scanning**: After every `git pull`:
  - Analyzes changed executable files for security threats
  - Detects dangerous shell commands, malicious scripts
  - Can automatically revert suspicious merges
  - Logs security events to `~/.git-security.log`

- **Pre-commit Secret Detection**: Before every `git commit`:
  - Blocks commits with hardcoded API keys, passwords
  - Detects Anthropic, OpenAI, AWS, GitHub tokens
  - Provides specific remediation suggestions
  - Allows emergency bypass with `--no-verify`

- **Smart File Filtering**: Only scans relevant files:
  - Focuses on executable scripts (`.sh`, `.py`, `.js`, etc.)
  - Skips documentation and example files
  - Treats test files with lighter security requirements

### Security Commands

```bash
# Run security scan on memory files
/craft scan

# Install/reinstall git hooks
~/claude-craft/tools/install-git-hooks.sh

# Manual security analysis
~/claude-craft/tools/secure-git.sh pull origin main

# Check for secrets in current directory
~/claude-craft/tools/security-scan.sh . secrets true

# Emergency bypass (use carefully!)
git commit --no-verify    # Skip pre-commit hook
```

### Threat Detection

The security system detects:
- **Destructive Operations**: rm -rf, dd, mkfs, disk writes
- **Credential Theft**: AWS/GCP/Azure key extraction, token harvesting
- **Data Exfiltration**: curl/wget pipes, netcat, base64 encoding
- **Code Injection**: eval, exec, system calls with external input
- **Persistence**: crontab modifications, service installations
- **Development Tool Abuse**: sfdx, clasp, terraform destroy

All security events are logged to `~/.git-security.log` for audit.

## Contributing

1. Fork this repository
2. Add your prompts, commands, agents, or workflows
3. Submit a pull request

## Advanced Usage

### Backup Management
```bash
# List available backups
~/claude-craft/tools/backup.sh list

# Create manual backup
~/claude-craft/tools/backup.sh backup

# Restore from specific backup
~/claude-craft/tools/backup.sh restore 20231201-143022
```

### Memory Management
```bash
# Add memory fragments manually
~/claude-craft/tools/add-memory.sh

# Edit memory fragments
vim ~/claude-craft/memory/fragments/my-fragment.md
```

### Settings Management  
```bash
# Merge settings fragments manually
~/claude-craft/tools/merge-settings.sh

# Edit settings fragments
vim ~/claude-craft/settings/fragments/my-settings.json
```

## File Types & Extensions

| Type | Location | Extension | Sync Method |
|------|----------|-----------|-------------|
| Commands | `commands/` | `.md` | Direct symlink |
| Agents | `agents/` | `.json` | Direct symlink |
| Hook Scripts | `hooks/scripts/` | `.sh` | Direct symlink |
| Memory Fragments | `memory/fragments/` | `.md` | Import-based |
| Settings Fragments | `settings/fragments/` | `.json` | Deep merge |
| Prompts | `prompts/` | `.md` | Repository only |

---

**Made for Claude Code developers who want their extensions organized and always in sync** ⚡