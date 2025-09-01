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

# Expand tilde in path if present
[ -n "$REPO_PATH" ] && REPO_PATH="${REPO_PATH/#\~/$HOME}"

# If not configured, require user to specify or run setup
if [ -z "$REPO_PATH" ]; then
  echo "❌ Repository path not configured in ~/.claude/settings.json"
  echo ""
  echo "To fix this, run: /prompt agent-sync setup"
  echo "Or manually add to settings.json:"
  echo '  "claude-craft.repo": "/path/to/claude-craft"'
  exit 1
fi

# Verify repository exists
if [ ! -d "$REPO_PATH" ]; then
  echo "❌ Repository not found at: $REPO_PATH"
  echo ""
  echo "To fix this, run: /prompt agent-sync setup"
  echo "This will clone the repository to the configured location"
  exit 1
fi

# Verify it's a git repository
if [ ! -d "$REPO_PATH/.git" ]; then
  echo "❌ Directory exists but is not a git repository: $REPO_PATH"
  echo ""
  echo "To fix this, either:"
  echo "  1. Remove the directory and run: /prompt agent-sync setup"
  echo "  2. Initialize git in the directory: git -C \"$REPO_PATH\" init"
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
2. Intelligent Symlink Management (handles file lifecycle):
   ```bash
   # Ensure target directories exist
   mkdir -p "$HOME/.claude/commands" "$HOME/.claude/agents" "$HOME/.claude/hooks"
   
   # Step 1: Clean up broken/obsolete symlinks (files deleted from repo)
   echo "🧹 Cleaning obsolete symlinks..."
   for dir in commands agents hooks; do
     find "$HOME/.claude/$dir" -maxdepth 1 -type l 2>/dev/null | while IFS= read -r link; do
       # Check if symlink target exists and is in our repo
       target=$(readlink "$link")
       if [ ! -e "$target" ] || ! echo "$target" | grep -q "$REPO_PATH"; then
         echo "  Removing broken/external symlink: $(basename "$link")"
         rm -f "$link"
       fi
     done
   done
   
   # Step 2: Create/update symlinks for all repo files
   echo "🔗 Creating/updating symlinks..."
   
   # Optimize file discovery based on available tools
   if command -v rg >/dev/null 2>&1; then
     # Use ripgrep for fast file discovery
     
     # Commands (.md files)
     [ -d "$REPO_PATH/commands" ] && {
       rg --files "$REPO_PATH/commands" --glob "*.md" 2>/dev/null | while IFS= read -r f; do
         base=$(basename "$f")
         target="$HOME/.claude/commands/$base"
         
         if [ ! -e "$target" ] || [ -L "$target" ]; then
           ln -sf "$f" "$target"
           echo "  ✓ commands/$base"
         else
           echo "  ⚠️ Skipping commands/$base (local file exists)"
         fi
       done
     }
     
     # Agents (.md and .json files)
     [ -d "$REPO_PATH/agents" ] && {
       rg --files "$REPO_PATH/agents" --glob "*.{md,json}" 2>/dev/null | while IFS= read -r f; do
         base=$(basename "$f")
         target="$HOME/.claude/agents/$base"
         
         if [ ! -e "$target" ] || [ -L "$target" ]; then
           ln -sf "$f" "$target"
           echo "  ✓ agents/$base"
         else
           echo "  ⚠️ Skipping agents/$base (local file exists)"
         fi
       done
     }
     
     # Hooks (.sh files)
     [ -d "$REPO_PATH/hooks/scripts" ] && {
       rg --files "$REPO_PATH/hooks/scripts" --glob "*.sh" 2>/dev/null | while IFS= read -r f; do
         base=$(basename "$f")
         target="$HOME/.claude/hooks/$base"
         
         if [ ! -e "$target" ] || [ -L "$target" ]; then
           ln -sf "$f" "$target"
           echo "  ✓ hooks/$base"
         else
           echo "  ⚠️ Skipping hooks/$base (local file exists)"
         fi
       done
     }
   else
     # Fallback to find for compatibility
     
     # Commands
     [ -d "$REPO_PATH/commands" ] && {
       find "$REPO_PATH/commands" -maxdepth 1 -name "*.md" -type f 2>/dev/null | while IFS= read -r f; do
         base=$(basename "$f")
         target="$HOME/.claude/commands/$base"
         
         if [ ! -e "$target" ] || [ -L "$target" ]; then
           ln -sf "$f" "$target"
           echo "  ✓ commands/$base"
         else
           echo "  ⚠️ Skipping commands/$base (local file exists)"
         fi
       done
     }
     
     # Agents
     [ -d "$REPO_PATH/agents" ] && {
       find "$REPO_PATH/agents" -maxdepth 1 \( -name "*.md" -o -name "*.json" \) -type f 2>/dev/null | while IFS= read -r f; do
         base=$(basename "$f")
         target="$HOME/.claude/agents/$base"
         
         if [ ! -e "$target" ] || [ -L "$target" ]; then
           ln -sf "$f" "$target"
           echo "  ✓ agents/$base"
         else
           echo "  ⚠️ Skipping agents/$base (local file exists)"
         fi
       done
     }
     
     # Hooks
     [ -d "$REPO_PATH/hooks/scripts" ] && {
       find "$REPO_PATH/hooks/scripts" -maxdepth 1 -name "*.sh" -type f 2>/dev/null | while IFS= read -r f; do
         base=$(basename "$f")
         target="$HOME/.claude/hooks/$base"
         
         if [ ! -e "$target" ] || [ -L "$target" ]; then
           ln -sf "$f" "$target"
           echo "  ✓ hooks/$base"
         else
           echo "  ⚠️ Skipping hooks/$base (local file exists)"
         fi
       done
     }
   fi
   
   # Step 3: Report any conflicts that need resolution
   CONFLICTS=$(find "$HOME/.claude/"{commands,agents,hooks} -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
   [ "$CONFLICTS" -gt 0 ] && echo "⚠️ Found $CONFLICTS local files that may need publishing"
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

1. **Pre-Flight Validation**:
   ```bash
   # Verify repository exists and is valid
   [ ! -d "$REPO_PATH/.git" ] && {
     echo "❌ Invalid repository at $REPO_PATH"
     echo "Run 'setup' first to initialize repository"
     exit 1
   }
   
   # Count uncommitted changes for context
   CHANGES=$(git -C "$REPO_PATH" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
   [ "$CHANGES" -gt 0 ] && echo "⚠️ Repository has $CHANGES uncommitted changes"
   ```

2. **Smart Discovery Process**:
   ```bash
   # Initialize discovery variables
   LOCAL_CLAUDE="$PWD/.claude"
   GLOBAL_CLAUDE="$HOME/.claude"
   UNPUBLISHED_COMMANDS=""
   UNPUBLISHED_AGENTS=""
   UNPUBLISHED_HOOKS=""
   
   # Discovery function to check if file is unpublished
   is_unpublished() {
     local file="$1"
     # Skip if file doesn't exist
     [ ! -e "$file" ] && return 1
     # Not a symlink = unpublished
     [ ! -L "$file" ] && return 0
     # Symlink but not to our repo = unpublished
     if [ -L "$file" ]; then
       target=$(readlink "$file")
       echo "$target" | grep -q "$REPO_PATH" || return 0
     fi
     return 1  # Is published (symlink to our repo)
   }
   
   # Scan for unpublished extensions
   echo "🔍 Scanning for unpublished extensions..."
   
   # Commands (.md files)
   for dir in "$LOCAL_CLAUDE/commands" "$GLOBAL_CLAUDE/commands"; do
     [ -d "$dir" ] || continue
     # Use find to get all .md files in the directory
     find "$dir" -maxdepth 1 -name "*.md" -type f -o -type l 2>/dev/null | while IFS= read -r f; do
       if is_unpublished "$f"; then
         location=$(echo "$f" | grep -q "^$LOCAL_CLAUDE" && echo "local" || echo "global")
         UNPUBLISHED_COMMANDS="${UNPUBLISHED_COMMANDS}${f}:${location}\n"
       fi
     done
   done
   
   # Agents (.md and .json files)
   for dir in "$LOCAL_CLAUDE/agents" "$GLOBAL_CLAUDE/agents"; do
     [ -d "$dir" ] || continue
     find "$dir" -maxdepth 1 \( -name "*.md" -o -name "*.json" \) \( -type f -o -type l \) 2>/dev/null | while IFS= read -r f; do
       if is_unpublished "$f"; then
         location=$(echo "$f" | grep -q "^$LOCAL_CLAUDE" && echo "local" || echo "global")
         UNPUBLISHED_AGENTS="${UNPUBLISHED_AGENTS}${f}:${location}\n"
       fi
     done
   done
   
   # Hooks (.sh files)
   for dir in "$LOCAL_CLAUDE/hooks" "$GLOBAL_CLAUDE/hooks"; do
     [ -d "$dir" ] || continue
     find "$dir" -maxdepth 1 -name "*.sh" \( -type f -o -type l \) 2>/dev/null | while IFS= read -r f; do
       if is_unpublished "$f"; then
         location=$(echo "$f" | grep -q "^$LOCAL_CLAUDE" && echo "local" || echo "global")
         UNPUBLISHED_HOOKS="${UNPUBLISHED_HOOKS}${f}:${location}\n"
       fi
     done
   done
   ```

3. **Repository Status Assessment**:
   ```bash
   # Get modified files in extension directories (excluding untracked)
   MODIFIED_FILES=$(git -C "$REPO_PATH" status --porcelain 2>/dev/null | \
                    grep "^[ M]M\|^[ M]D" | grep -E "(agents|commands|hooks|prompts)/" || true)
   ```

4. **Interactive Presentation**:
   ```bash
   # Process and display discovered files
   echo "📦 Claude Code Publishing Status"
   echo "📁 Repository: $REPO_PATH ($CHANGES uncommitted changes)"
   echo ""
   
   # Show modified files in repository
   if [ -n "$MODIFIED_FILES" ]; then
     echo "🔄 Modified Items (in repository):"
     echo "$MODIFIED_FILES" | while IFS= read -r line; do
       echo "  $line"
     done
     echo ""
   fi
   
   # Counter for numbering items
   ITEM_NUM=1
   
   # Display unpublished agents
   if [ -n "$UNPUBLISHED_AGENTS" ]; then
     echo "🤖 Unpublished Agents:"
     echo ""
     
     # Process local agents first
     echo -e "$UNPUBLISHED_AGENTS" | grep ":local$" | while IFS=: read -r file location; do
       [ -z "$file" ] && continue
       echo "📍 Local Project:"
       name=$(basename "$file")
       size=$(ls -lh "$file" 2>/dev/null | awk '{print $5}')
       desc=$(grep -m1 "^description:" "$file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
       [ -z "$desc" ] && desc=$(head -5 "$file" 2>/dev/null | grep -v "^#" | head -1)
       
       echo "[$ITEM_NUM] $name ($size)"
       echo "$desc" | fold -s -w 70 | head -2 | sed 's/^/    /'
       echo ""
       ITEM_NUM=$((ITEM_NUM + 1))
     done
     
     # Process global agents
     echo -e "$UNPUBLISHED_AGENTS" | grep ":global$" | while IFS=: read -r file location; do
       [ -z "$file" ] && continue
       echo "🌐 Global Profile:"
       name=$(basename "$file")
       size=$(ls -lh "$file" 2>/dev/null | awk '{print $5}')
       desc=$(grep -m1 "^description:" "$file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
       [ -z "$desc" ] && desc=$(head -5 "$file" 2>/dev/null | grep -v "^#" | head -1)
       
       echo "[$ITEM_NUM] $name ($size)"
       echo "$desc" | fold -s -w 70 | head -2 | sed 's/^/    /'
       echo ""
       ITEM_NUM=$((ITEM_NUM + 1))
     done
   fi
   
   # Display unpublished commands (similar pattern)
   if [ -n "$UNPUBLISHED_COMMANDS" ]; then
     echo "⚡ Unpublished Commands:"
     echo ""
     # Similar processing as agents...
   fi
   
   # Display unpublished hooks (similar pattern)
   if [ -n "$UNPUBLISHED_HOOKS" ]; then
     echo "🪝 Unpublished Hooks:"
     echo ""
     # Similar processing as agents...
   fi
   
   # Show actions menu
   echo "🎯 Actions:"
   echo "[A] ✅ Publish all items"
   echo "[S] 📝 Select specific items (e.g., \"1,3\" or \"1-4\")"
   echo "[R] 👁️ Review content first"
   echo "[C] ❌ Cancel"
   echo ""
   echo "What would you like to do?"
   ```

5. **Publishing Workflow** (after user selection):
   ```bash
   # Process user selection and publish files
   publish_files() {
     local files="$1"
     
     # For each selected extension
     echo "$files" | while IFS= read -r file; do
       [ -z "$file" ] && continue
       
       # Determine type from path
       if echo "$file" | grep -q "/commands/"; then
         type="commands"
       elif echo "$file" | grep -q "/agents/"; then
         type="agents"
       elif echo "$file" | grep -q "/hooks/"; then
         type="hooks"
       else
         echo "⚠️ Unknown type for $file, skipping"
         continue
       fi
       
       name=$(basename "$file")
       
       # Create target directory
       mkdir -p "$REPO_PATH/$type"
       
       # Copy to repository
       cp "$file" "$REPO_PATH/$type/$name"
       
       # Stage immediately
       git -C "$REPO_PATH" add "$type/$name"
       
       # Replace original with symlink
       rm -f "$file"
       ln -sf "$REPO_PATH/$type/$name" "$file"
       
       echo "✅ Published $name to $type/"
     done
     
     # Commit if files were published
     if [ -n "$files" ]; then
       count=$(echo "$files" | grep -c .)
       git -C "$REPO_PATH" commit -m "Publish $count extensions via agent-sync
   
   Published:
   $(echo "$files" | xargs -n1 basename | sed 's/^/- /')" 2>/dev/null || {
         echo "⚠️ Nothing to commit (files may already be staged)"
       }
     fi
     
     echo ""
     echo "✅ All extensions published and symlinked"
     echo "📝 Remember to push: git -C \"$REPO_PATH\" push"
   }
   ```

6. **Verification Steps**:
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
```bash
# Get repository info
echo "📊 Claude Craft Status"
echo "📁 Repository: $REPO_PATH"

# Check git status
if git -C "$REPO_PATH" diff --quiet HEAD 2>/dev/null; then
  echo "✅ Repository: clean"
else
  CHANGES=$(git -C "$REPO_PATH" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  echo "⚠️ Repository: $CHANGES uncommitted changes"
fi
echo ""

# Count linked extensions (symlinks pointing to our repo)
CMD_COUNT=0
AGENT_COUNT=0
HOOK_COUNT=0

# Count command symlinks
if [ -d "$HOME/.claude/commands" ]; then
  CMD_COUNT=$(find "$HOME/.claude/commands" -maxdepth 1 -type l 2>/dev/null | while read -r link; do
    readlink "$link" | grep -q "$REPO_PATH" && echo "x"
  done | wc -l | tr -d ' ')
fi

# Count agent symlinks
if [ -d "$HOME/.claude/agents" ]; then
  AGENT_COUNT=$(find "$HOME/.claude/agents" -maxdepth 1 -type l 2>/dev/null | while read -r link; do
    readlink "$link" | grep -q "$REPO_PATH" && echo "x"
  done | wc -l | tr -d ' ')
fi

# Count hook symlinks
if [ -d "$HOME/.claude/hooks" ]; then
  HOOK_COUNT=$(find "$HOME/.claude/hooks" -maxdepth 1 -type l 2>/dev/null | while read -r link; do
    readlink "$link" | grep -q "$REPO_PATH" && echo "x"
  done | wc -l | tr -d ' ')
fi

echo "🔗 Linked Extensions:"
echo "  ⚡ $CMD_COUNT commands"
echo "  🤖 $AGENT_COUNT agents"
echo "  🪝 $HOOK_COUNT hooks"
echo ""

# Quick check for unpublished items
UNPUB_COUNT=0
for dir in commands agents hooks; do
  [ -d "$HOME/.claude/$dir" ] && {
    UNPUB_COUNT=$((UNPUB_COUNT + $(find "$HOME/.claude/$dir" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')))
  }
  [ -d "$PWD/.claude/$dir" ] && {
    UNPUB_COUNT=$((UNPUB_COUNT + $(find "$PWD/.claude/$dir" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')))
  }
done

[ "$UNPUB_COUNT" -gt 0 ] && echo "📝 $UNPUB_COUNT unpublished items found (run 'publish' to review)"
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