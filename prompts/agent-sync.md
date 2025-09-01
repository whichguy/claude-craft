# Claude Craft Agent Sync

**Purpose**: Manage Claude Code extensions (agents, commands, hooks) through natural language commands. This prompt-as-code template synchronizes your local Claude configuration with the claude-craft repository, discovers unpublished extensions, and maintains your development environment.

**Core Functionality**:
- Synchronize repository changes to local Claude configuration
- Discover and publish local extensions to the shared repository
- Manage automatic synchronization schedules
- Provide status overview of linked extensions
- Initial setup for new users

## Repository Detection

Determine the claude-craft repository location:
1. Check `~/.claude/settings.json` for configured repository path
2. Look for `claude-craft.repo` or `repository.path` in settings
3. If not configured, prompt user to specify location
4. Set `REPO_PATH` variable for use in all commands

```bash
# Detect repository path from settings
if [ -f "$HOME/.claude/settings.json" ]; then
  # Check if jq is available
  if command -v jq >/dev/null 2>&1; then
    REPO_PATH=$(jq -r '.["claude-craft.repo"] // .["repository.path"] // empty' "$HOME/.claude/settings.json" 2>/dev/null)
  else
    # Fallback to grep/sed if jq not available
    REPO_PATH=$(grep -o '"claude-craft\.repo"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/.claude/settings.json" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\1/')
  fi
fi

# If not configured, require user to specify or run setup
if [ -z "$REPO_PATH" ]; then
  echo "❌ Repository path not configured in ~/.claude/settings.json"
  echo "Please run 'setup' first or add 'claude-craft.repo' to your settings"
  exit 1
fi

# Verify repository exists
if [ ! -d "$REPO_PATH" ]; then
  echo "❌ Repository not found at: $REPO_PATH"
  echo "Please run 'setup' to clone the repository"
  exit 1
fi
```

## Natural Language Processing

Parse user intent from: `<prompt-context>`

Map natural language to actions using keywords and context:

### 1. SYNC (default action)
**Triggers**: sync, update, pull, refresh, or empty input
**Function**: Pull repository updates and refresh all symlinks

**Execution Steps**:
1. Pull latest from repository with timeout and error handling:
   ```bash
   # Try to pull with timeout (use gtimeout on macOS if available)
   if command -v timeout >/dev/null 2>&1; then
     timeout 30 git -C "$REPO_PATH" pull origin main 2>/dev/null
   elif command -v gtimeout >/dev/null 2>&1; then
     gtimeout 30 git -C "$REPO_PATH" pull origin main 2>/dev/null
   else
     # No timeout available, just try the pull
     git -C "$REPO_PATH" pull origin main 2>/dev/null
   fi || {
     echo "⚠️ Could not pull latest changes (network issue?). Using local cache."
   }
   ```
2. Refresh all symlinks:
   ```bash
   # Ensure target directories exist
   mkdir -p "$HOME/.claude/commands" "$HOME/.claude/agents" "$HOME/.claude/hooks"
   
   # Remove ALL symlinks (including broken ones) and create new ones
   find "$HOME/.claude/commands" -maxdepth 1 \( -type l -o -xtype l \) -delete 2>/dev/null || true
   
   # Use ripgrep if available, otherwise fall back to find
   if command -v rg >/dev/null 2>&1; then
     [ -d "$REPO_PATH/commands" ] && rg --files "$REPO_PATH/commands" --glob "*.md" 2>/dev/null
   else
     [ -d "$REPO_PATH/commands" ] && find "$REPO_PATH/commands" -name "*.md" -type f 2>/dev/null
   fi | while IFS= read -r f; do
     base=$(basename "$f")
     # Remove existing file/symlink before creating new one
     rm -f "$HOME/.claude/commands/$base" 2>/dev/null || true
     ln -sf "$f" "$HOME/.claude/commands/$base"
   done
   
   find "$HOME/.claude/agents" -maxdepth 1 \( -type l -o -xtype l \) -delete 2>/dev/null || true
   if command -v rg >/dev/null 2>&1; then
     [ -d "$REPO_PATH/agents" ] && rg --files "$REPO_PATH/agents" --glob "*.md" --glob "*.json" 2>/dev/null
   else
     [ -d "$REPO_PATH/agents" ] && find "$REPO_PATH/agents" \( -name "*.md" -o -name "*.json" \) -type f 2>/dev/null
   fi | while IFS= read -r f; do
     base=$(basename "$f")
     rm -f "$HOME/.claude/agents/$base" 2>/dev/null || true
     ln -sf "$f" "$HOME/.claude/agents/$base"
   done
   
   find "$HOME/.claude/hooks" -maxdepth 1 \( -type l -o -xtype l \) -delete 2>/dev/null || true
   if command -v rg >/dev/null 2>&1; then
     [ -d "$REPO_PATH/hooks/scripts" ] && rg --files "$REPO_PATH/hooks/scripts" --glob "*.sh" 2>/dev/null
   else
     [ -d "$REPO_PATH/hooks/scripts" ] && find "$REPO_PATH/hooks/scripts" -name "*.sh" -type f 2>/dev/null
   fi | while IFS= read -r f; do
     base=$(basename "$f")
     rm -f "$HOME/.claude/hooks/$base" 2>/dev/null || true
     ln -sf "$f" "$HOME/.claude/hooks/$base"
   done
   ```
3. Count and report results: "✅ Synced X commands, Y agents, Z hooks"
4. Alert if changes detected: "⚠️ Restart Claude Code to load changes"

### 2. SETUP
**Triggers**: setup, install, init, initialize, clone
**Function**: First-time repository setup and configuration

**Execution Steps**:
1. Prompt for repository location (suggest: `$HOME/repos/claude-craft`)
2. Ensure parent directory exists and clone:
   ```bash
   mkdir -p "$(dirname "$REPO_PATH")"
   git clone https://github.com/whichguy/claude-craft.git "$REPO_PATH"
   ```
3. Update settings.json with repository path:
   ```bash
   # Ensure .claude directory and settings.json exist with proper permissions
   mkdir -p "$HOME/.claude" 2>/dev/null || {
     echo "❌ Cannot create ~/.claude directory. Check permissions."
     exit 1
   }
   [ ! -f "$HOME/.claude/settings.json" ] && echo '{}' > "$HOME/.claude/settings.json" 2>/dev/null || {
     echo "❌ Cannot create settings.json. Check permissions on ~/.claude"
     exit 1
   }
   
   # Add repository path to settings
   if command -v jq >/dev/null 2>&1; then
     jq --arg repo "$REPO_PATH" '. + {"claude-craft.repo": $repo}' "$HOME/.claude/settings.json" > "$HOME/.claude/temp.json" && \
     mv "$HOME/.claude/temp.json" "$HOME/.claude/settings.json"
   else
     echo "⚠️ jq not found. Please manually add 'claude-craft.repo' to settings.json"
   fi
   ```
4. Make tools executable: `chmod +x "$REPO_PATH/tools/"*.sh`
5. Install git hooks for security:
   ```bash
   # Create pre-commit hook using full paths
   ln -sf "$REPO_PATH/tools/pre-commit-hook.sh" "$REPO_PATH/.git/hooks/pre-commit"
   # The hook scans for secrets/credentials before allowing commits
   ```
6. Create initial symlinks (same as SYNC action above)
7. Report: "✅ Claude-craft setup complete! Restart Claude Code."

### 3. PUBLISH  
**Triggers**: publish, discover, find, unpublished, check
**Function**: Discover and publish local extensions not yet in repository

**Execution Steps**:

1. **Discovery Phase** - Find unpublished extensions:
   ```bash
   # Check both local project and global locations
   LOCAL_CLAUDE="$PWD/.claude"
   GLOBAL_CLAUDE="$HOME/.claude"
   
   # Find non-symlink extensions (not pointing to $REPO_PATH)
   # Commands
   if command -v rg >/dev/null 2>&1; then
     rg --files "$GLOBAL_CLAUDE/commands" "$LOCAL_CLAUDE/commands" --glob "*.md" 2>/dev/null
   else
     find "$GLOBAL_CLAUDE/commands" "$LOCAL_CLAUDE/commands" -name "*.md" -type f 2>/dev/null
   fi | while IFS= read -r f; do
     [ -f "$f" ] && [ ! -L "$f" ] && echo "$f"
   done
   
   # Similar for agents (*.md, *.json) and hooks (*.sh)
   ```

2. **Repository Status Check**:
   ```bash
   # Check for uncommitted changes in extension directories
   MODIFIED=$(git -C "$REPO_PATH" status --porcelain 2>/dev/null | \
              grep -E "^( M|MM| D)..(agents|commands|hooks|prompts)/" || true)
   CHANGES=$(echo "$MODIFIED" | grep -c . || echo 0)
   ```

3. **Interactive Presentation**:
   ```
   📦 Claude Code Publishing Status
   Repository: $REPO_PATH ($CHANGES uncommitted changes)
   
   🔄 Modified Items (in repository):
   [Show actual git status for modified files]
   
   🤖 Unpublished Agents (X total):
   📍 Local Project:
   [1] agent-name.md (8.0K)
       Description from file (wrapped to 70 chars)
   
   🌐 Global Profile:
   [2] other-agent.md (4.2K)
       Description continues on second line
   
   ⚡ Unpublished Commands (Y total):
   [3] command.md (2.1K)
       Command description properly wrapped
   
   🪝 Unpublished Hooks (Z total):
   [4] hook.sh (1.5K)
       Hook script description
   
   🎯 Actions:
   [A] ✅ Publish all items
   [S] 📝 Select specific items (e.g., "1,3" or "1-4")
   [R] 👁️ Review content first
   [C] ❌ Cancel
   
   What would you like to do?
   ```

4. **Publishing Workflow** (after user selection):
   ```bash
   # For each selected extension:
   for file in $SELECTED_FILES; do
     type=$(basename "$(dirname "$file")")  # agents, commands, or hooks
     name=$(basename "$file")
     
     # Copy to repository
     mkdir -p "$REPO_PATH/$type"
     cp "$file" "$REPO_PATH/$type/$name"
     
     # Stage immediately
     git -C "$REPO_PATH" add "$type/$name"
     
     # Replace with symlink
     rm "$file"
     ln -sf "$REPO_PATH/$type/$name" "$file"
     
     echo "✅ Published $name to $type/"
   done
   
   # Commit changes
   if [ -n "$SELECTED_FILES" ]; then
     count=$(echo "$SELECTED_FILES" | wc -w)
     git -C "$REPO_PATH" commit -m "Publish $count extensions via agent-sync
   
   Published:
   $(echo "$SELECTED_FILES" | xargs -n1 basename | sed 's/^/- /')"
   fi
   
   # Verification
   echo "✅ All extensions published and symlinked successfully"
   echo "📝 Remember to push changes: git -C \"$REPO_PATH\" push"
   ```

5. **Verification Steps**:
   ```bash
   # Verify symlinks point to repository
   for file in $PUBLISHED_FILES; do
     if [ -L "$file" ] && readlink "$file" | grep -q "$REPO_PATH"; then
       echo "✅ $(basename "$file") → repository"
     fi
   done
   ```

### 4. STATUS
**Triggers**: status, check, info, what
**Function**: Display current synchronization state

**Execution Steps**:
1. Show repository location: `echo "$REPO_PATH"`
2. Count active symlinks by type using ripgrep:
   - Commands: `[ -d "$REPO_PATH/commands" ] && rg --files "$REPO_PATH/commands" --glob "*.md" 2>/dev/null | wc -l || echo 0`
   - Agents: `[ -d "$REPO_PATH/agents" ] && rg --files "$REPO_PATH/agents" --glob "*.md" --glob "*.json" 2>/dev/null | wc -l || echo 0`
   - Hooks: `[ -d "$REPO_PATH/hooks/scripts" ] && rg --files "$REPO_PATH/hooks/scripts" --glob "*.sh" 2>/dev/null | wc -l || echo 0`
3. Check for unpublished items (quick count)
4. Git status: `git -C "$REPO_PATH" status --short`

Output format:
```
📊 Claude Craft Status
Repository: $REPO_PATH (clean)
✅ 15 commands linked
✅ 8 agents linked  
✅ 3 hooks linked
📝 2 unpublished items found (run 'publish' to see)
```

### 5. AUTO-SYNC
**Triggers**: auto-sync, automatic, schedule, hook
**Function**: Configure automatic synchronization via Claude Code hooks

Sub-commands:
- `enable` → Create/enable auto-sync hook in ~/.claude/hooks/
- `disable` → Remove/disable auto-sync hook
- `status` → Check if auto-sync hook is enabled

**Steps for enable**:
1. Create auto-sync hook script in ~/.claude/hooks/:
   ```bash
   mkdir -p "$HOME/.claude/hooks"
   cat > "$HOME/.claude/hooks/auto-sync.sh" << 'EOF'
   #!/bin/bash
   # Auto-sync hook - runs on specified Claude Code events
   # Read repository path from settings
   if [ -f "$HOME/.claude/settings.json" ]; then
     REPO_PATH=$(jq -r '."claude-craft.repo" // ."repository.path" // empty' "$HOME/.claude/settings.json" 2>/dev/null)
     if [ -n "$REPO_PATH" ] && [ -d "$REPO_PATH" ]; then
       git -C "$REPO_PATH" pull origin main --quiet 2>/dev/null
       # TODO: Add symlink refresh logic here if needed
     fi
   fi
   EOF
   chmod +x "$HOME/.claude/hooks/auto-sync.sh"
   ```
2. Configure hook trigger events (e.g., on-startup, on-file-save)
3. Report: "✅ Auto-sync hook enabled"

**Steps for disable**:
1. Remove hook: `rm "$HOME/.claude/hooks/auto-sync.sh"`
2. Report: "✅ Auto-sync hook disabled"

## Command Resolution Logic

Match `<prompt-context>` to actions:
- Empty input or contains "sync" → Execute SYNC
- Contains "setup" or "install" → Execute SETUP
- Contains "publish" or "unpublished" → Execute PUBLISH  
- Contains "status" or "check" → Execute STATUS
- Contains "auto-sync" + modifier → Execute AUTO-SYNC with detected sub-command
- Ambiguous input → Infer most likely action based on context, confirm if uncertain

## Simplified Workflow

Removed complexity:
- No local/global modes (always use configured repository)
- No push/commit (use git directly)
- No security scanning (overkill)
- No clean command (sync handles broken symlinks)

Just 5 focused actions that cover real use cases.

## Error Handling

Keep it simple:
- If repo doesn't exist at $REPO_PATH → Clone it during sync
- If symlinks broken → Fix them during sync
- If permission issues → Explain clearly
- If network issues → Suggest retry

## Example Interpretations

| User Input | Resolved Action |
|------------|-----------------|
| ` ` (empty) | SYNC - default action |
| `sync` | SYNC - explicit request |
| `setup` | SETUP - initialize repository |
| `publish` | PUBLISH - find unpublished items |
| `what do I have?` | STATUS - query for overview |
| `check unpublished` | PUBLISH - discovery request |
| `auto-sync enable` | AUTO-SYNC enable - schedule setup |
| `turn on automatic updates` | AUTO-SYNC enable - natural language |

## File Conventions & Structure

### Repository Layout
```
$REPO_PATH/                     # Main repository
├── agents/                     # Agent definitions
│   ├── *.md                   # Agent markdown files
│   └── *.json                 # Legacy JSON agents
├── commands/                   # Slash commands
│   └── *.md                   # Command markdown files
├── hooks/                      
│   └── scripts/               # Hook scripts
│       ├── *.sh               # Bash hook scripts
│       └── pre-commit-hook.sh # Git security scanner
├── memory/                     # Memory configuration
│   ├── CLAUDE.base.md         # Base memory template
│   ├── fragments/             # Memory fragments to merge
│   └── includes/              # Additional memory includes
├── settings/                   # Settings configuration
│   ├── settings.base.json    # Base settings
│   └── fragments/             # Settings fragments to merge
└── tools/                     # Utility scripts
    ├── secure-git.sh          # Secure git operations
    ├── security-scan.sh       # Scan for secrets
    ├── auto-sync.sh          # Auto-sync script
    └── merge-settings.sh     # Settings merger
```

### Claude Directory Structure
```
~/.claude/                      # Claude Code configuration
├── agents/                     # Symlinks to $REPO_PATH/agents/*
├── commands/                   # Symlinks to $REPO_PATH/commands/*
├── hooks/                      # Symlinks to $REPO_PATH/hooks/scripts/*
├── settings.json              # Merged from claude-craft settings
├── CLAUDE.md                  # Merged from claude-craft memory
└── backups/                   # Automatic backups
```

### Symlink Creation Rules
When syncing, create symlinks following these patterns:
```bash
# Commands: .md files only
ln -sf "$REPO_PATH/commands/"*.md "$HOME/.claude/commands/"

# Agents: .md and .json files  
ln -sf "$REPO_PATH/agents/"*.{md,json} "$HOME/.claude/agents/"

# Hooks: .sh files from scripts subfolder
ln -sf "$REPO_PATH/hooks/scripts/"*.sh "$HOME/.claude/hooks/"

# Note: settings.json and CLAUDE.md are COPIED and MERGED, not symlinked
```

### Publishing Workflow
When publishing an unpublished extension:
1. Copy file to appropriate directory in $REPO_PATH/
2. Stage immediately: `git add <file>`
3. Remove original from ~/.claude/
4. Create symlink back to repository version
5. Commit with descriptive message

### Git Hooks Setup
The pre-commit hook prevents committing secrets:
```bash
# Install during setup
ln -sf "$REPO_PATH/tools/pre-commit-hook.sh" "$REPO_PATH/.git/hooks/pre-commit"

# What it does:
# - Scans for API keys, tokens, passwords
# - Blocks commits containing secrets
# - Logs security events to ~/.git-security.log
```

### Auto-Sync Hook Configuration
Auto-sync is implemented as a Claude Code hook that triggers on specific events:
- **on-startup**: Sync when Claude Code starts
- **on-file-save**: Sync after saving files
- **on-command**: Sync after running commands

The hook script is stored in `~/.claude/hooks/auto-sync.sh` and executes quietly in the background to keep your extensions synchronized.

## Important Notes

- **Symlinks vs Copies**: Extensions use symlinks for instant updates, but settings.json and CLAUDE.md are copied/merged to allow local customization
- **File Permissions**: All .sh files must be executable (`chmod +x`)
- **Restart Required**: After any changes to agents, commands, or hooks, restart Claude Code
- **Git Safety**: Never commit files containing API keys or credentials - the pre-commit hook helps prevent this

## Design Philosophy

This prompt implements a **minimalist command interface** with just five essential actions that cover all typical workflows. The design prioritizes:

- **Natural language understanding** over rigid syntax
- **Safe operations** with automatic git hooks and backup preservation  
- **Performance** through ripgrep optimization
- **Simplicity** by removing unnecessary complexity (no local/global modes, no built-in push/commit)
- **Reliability** with fully qualified paths and no directory changes

The system is designed to "just work" with minimal configuration while maintaining full transparency in its operations.