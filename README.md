# Claude Craft 🚀

**Claude Code development toolkit with prompts, commands, agents, hooks, and workflows**

A streamlined repository for managing your Claude Code extensions with automatic syncing and symlink management.

## Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash
```

**Then restart Claude Code to load the new commands!**

## What You Get

- **`/craft`** - Simple repository sync command (default: sync latest changes)
- **`/prompts`** - Quick access to prompt templates
- **Organized structure** for all your Claude Code extensions
- **Automatic symlinks** that stay in sync with your repository
- **Smart change detection** with restart reminders

## Usage

### Daily Workflow
```bash
# Sync latest changes (dead simple!)
/craft

# Add new content, then push
/craft push "Added security templates"

# Check what's linked
/craft status
```

### Commands Available

| Command | Description |
|---------|-------------|
| `/craft` | Sync latest changes (default action) |
| `/craft setup` | Initial setup (same as install script) |
| `/craft push` | Commit and push your changes |
| `/craft status` | Show git status and active symlinks |
| `/craft clean` | Clean and refresh all symlinks |
| `/prompts` | Access prompt templates |

## Folder Structure

```
claude-craft/
├── prompts/               # Prompt templates and examples
├── commands/              # Slash command definitions  
├── agents/                # Agent definitions
├── hooks/                 # Hook definitions and scripts
├── workflows/             # End-to-end workflow examples
└── configs/               # Configuration samples
```

## How It Works

1. **Install**: Clones repo to `~/claude-craft/`
2. **Symlinks**: Creates symlinks in `~/.claude/` pointing to repo files
3. **Lifecycle**: Automatically manages symlink creation/deletion as files change
4. **Sync**: Simple `/craft` command keeps everything current

## Manual Installation

If you prefer not to use the curl script:

```bash
git clone https://github.com/whichguy/claude-craft.git ~/claude-craft
cd ~/claude-craft
chmod +x install.sh
./install.sh
```

## Contributing

1. Fork this repository
2. Add your prompts, commands, agents, or workflows
3. Submit a pull request

## File Types

- **Commands**: `.md` files in `commands/` folder
- **Agents**: `.json` files in `agents/` folder  
- **Hooks**: `.sh` files in `hooks/` folder
- **Prompts**: `.md` files in `prompts/` folder

---

**Made for Claude Code developers who want their extensions organized and always in sync** ⚡