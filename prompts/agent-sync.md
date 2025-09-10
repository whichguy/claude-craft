---
argument-hint: "[action] [context...]"
description: "Manage Claude Code agents, commands, and hooks through natural language"
allowed-tools: "all"
---

# Claude Craft Agent Sync

**Context**: <prompt-arguments>

## Natural Language Instructions

Based on the provided context, perform Claude Code synchronization operations using the following guidance:

### 1. Determine User Intent

From the context "<prompt-arguments>", classify the user's request:

- **Status intent**: Contains "status", "what", "ready", "available", "check", "current" → Show current sync status
- **Publish intent**: Contains "publish", "list", "show", "detail" → Show local files ready to publish  
- **Sync all intent**: Contains "sync all", "sync everything", "sync", "all" → Sync all available items
- **Sync specific intent**: Contains numbers like "sync 1,3,5" or "sync 2-4" → Sync specific items
- **Auto-sync intent**: Contains "auto", "automatic", "schedule", "hook" → Configure auto-sync
- **Default**: If unclear, show status

### 2. Repository Discovery (Project and Profile Scoped)

Execute these exact bash commands to discover repository locations for both project and profile scopes:

```bash
# Discover repository for a specific scope (project or profile)
discover_repo_for_scope() {
  local scope="$1"  # "project" or "profile"
  local settings_file=""
  local repo_path=""
  
  if [ "$scope" = "project" ]; then
    # Look for project-specific settings
    if [ -n "$PROJECT_CLAUDE" ] && [ -f "$PROJECT_CLAUDE/settings.json" ]; then
      settings_file="$PROJECT_CLAUDE/settings.json"
    fi
  else
    # Look for global/profile settings
    if [ -f "$HOME/.claude/settings.json" ]; then
      settings_file="$HOME/.claude/settings.json"
    fi
  fi
  
  # 1. Check settings.json for configured path
  if [ -n "$settings_file" ]; then
    repo_path=$(grep -o '"claude-craft"[^}]*"path"[^"]*"[^"]*"' "$settings_file" 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"')
  fi
  
  # 2. Try scope-specific common locations if not in settings
  if [ -z "$repo_path" ] || [ ! -d "$repo_path" ]; then
    if [ "$scope" = "project" ]; then
      # Project-relative locations
      for candidate in "./claude-craft" "../claude-craft" "$(dirname "$PROJECT_CLAUDE")/claude-craft"; do
        if [ -d "$candidate/.git" ] && [ -d "$candidate/agents" ]; then
          repo_path="$(cd "$candidate" && pwd)"
          break
        fi
      done
    else
      # Profile/global locations  
      for candidate in "$HOME/repos/claude-craft" "$HOME/claude-craft"; do
        if [ -d "$candidate/.git" ] && [ -d "$candidate/agents" ]; then
          repo_path="$candidate"
          break
        fi
      done
    fi
  fi
  
  # 3. Search in current directory tree (fallback)
  if [ -z "$repo_path" ] || [ ! -d "$repo_path" ]; then
    current_dir="$(pwd)"
    while [ "$current_dir" != "/" ]; do
      if [ -d "$current_dir/claude-craft/.git" ] && [ -d "$current_dir/claude-craft/agents" ]; then
        repo_path="$current_dir/claude-craft"
        break
      fi
      current_dir="$(dirname "$current_dir")"
    done
  fi
  
  echo "$repo_path"
}

# Discover repositories for both scopes
PROJECT_REPO=""
PROFILE_REPO=""

if [ -n "$PROJECT_CLAUDE" ]; then
  PROJECT_REPO=$(discover_repo_for_scope "project")
fi

PROFILE_REPO=$(discover_repo_for_scope "profile")

# Determine primary repository (prefer project-specific if available)
if [ -n "$PROJECT_REPO" ] && [ -d "$PROJECT_REPO" ]; then
  REPO_PATH="$PROJECT_REPO"
  REPO_SCOPE="project"
elif [ -n "$PROFILE_REPO" ] && [ -d "$PROFILE_REPO" ]; then
  REPO_PATH="$PROFILE_REPO"
  REPO_SCOPE="profile"
else
  echo "❌ Claude-craft repository not found in project or profile scope"
  echo "   Searched locations:"
  [ -n "$PROJECT_CLAUDE" ] && echo "   - Project settings: $PROJECT_CLAUDE/settings.json"
  echo "   - Profile settings: $HOME/.claude/settings.json"
  echo "   - Common locations relative to current scope"
  exit 1
fi

echo "📁 Repository: $REPO_PATH ($REPO_SCOPE scope)"
```

### 3. Execute Based on Intent

#### For STATUS Intent:
Execute these commands in sequence:

1. **Repository Health Check**:
```bash
echo "📊 Claude Craft Status"
echo "📁 Repository: $REPO_PATH"
echo "🔄 Updating repository..."
git -C "$REPO_PATH" pull origin main 2>/dev/null || echo "⚠️ Could not pull latest changes"
```

2. **Discover Claude Code Locations (Following Claude Code's Discovery Path)**:
```bash
# Find project-specific .claude directory (Claude Code searches up the directory tree)
find_project_claude() {
  local current_dir="$(pwd)"
  while [ "$current_dir" != "/" ]; do
    if [ -d "$current_dir/.claude" ]; then
      echo "$current_dir/.claude"
      return
    fi
    current_dir="$(dirname "$current_dir")"
  done
  echo ""
}

PROJECT_CLAUDE=$(find_project_claude)
GLOBAL_CLAUDE="$HOME/.claude"

# Set up discovery paths (following Claude Code's precedence)
if [ -n "$PROJECT_CLAUDE" ]; then
  PROJECT_AGENTS="$PROJECT_CLAUDE/agents"
  PROJECT_COMMANDS="$PROJECT_CLAUDE/commands"
  PROJECT_HOOKS="$PROJECT_CLAUDE/hooks"
else
  PROJECT_AGENTS=""
  PROJECT_COMMANDS=""
  PROJECT_HOOKS=""
fi

GLOBAL_AGENTS="$GLOBAL_CLAUDE/agents"
GLOBAL_COMMANDS="$GLOBAL_CLAUDE/commands"
GLOBAL_HOOKS="$GLOBAL_CLAUDE/hooks"
```

3. **Registered Items Analysis (Items that Point to Our Git Repo)**:
```bash
echo ""
echo "✅ Currently Registered Items (symlinked to repository):"

# Function to check if item is registered (points to our repo)
check_registration() {
  local item_path="$1"
  local item_type="$2"
  
  if [ -L "$item_path" ]; then
    local target=$(readlink "$item_path" 2>/dev/null)
    if echo "$target" | grep -q "^$REPO_PATH"; then
      local name=$(basename "$item_path" ${item_type})
      local location_desc=""
      if echo "$item_path" | grep -q "$PROJECT_CLAUDE"; then
        location_desc="project"
      else
        location_desc="global"
      fi
      echo "    ✅ $name ($location_desc)"
      return 0
    fi
  fi
  return 1
}

# Check agents
REGISTERED_AGENTS=0
echo "  🤖 Agents:"
for location in "$PROJECT_AGENTS" "$GLOBAL_AGENTS"; do
  [ -d "$location" ] || continue
  for item in "$location"/*; do
    [ -f "$item" ] || continue
    if check_registration "$item" ".md"; then
      REGISTERED_AGENTS=$((REGISTERED_AGENTS + 1))
    fi
  done 2>/dev/null
done
[ $REGISTERED_AGENTS -eq 0 ] && echo "    (none registered)"

# Check commands  
REGISTERED_COMMANDS=0
echo "  ⚡ Commands:"
for location in "$PROJECT_COMMANDS" "$GLOBAL_COMMANDS"; do
  [ -d "$location" ] || continue
  for item in "$location"/*; do
    [ -f "$item" ] || continue
    if check_registration "$item" ".md"; then
      REGISTERED_COMMANDS=$((REGISTERED_COMMANDS + 1))
    fi
  done 2>/dev/null
done
[ $REGISTERED_COMMANDS -eq 0 ] && echo "    (none registered)"

# Check hooks
REGISTERED_HOOKS=0  
echo "  🪝 Hooks:"
for location in "$PROJECT_HOOKS" "$GLOBAL_HOOKS"; do
  [ -d "$location" ] || continue
  for item in "$location"/*; do
    [ -f "$item" ] || continue
    if check_registration "$item" ".sh"; then
      REGISTERED_HOOKS=$((REGISTERED_HOOKS + 1))
    fi
  done 2>/dev/null
done
[ $REGISTERED_HOOKS -eq 0 ] && echo "    (none registered)"

echo ""
echo "📊 Registration Summary: $REGISTERED_AGENTS agents, $REGISTERED_COMMANDS commands, $REGISTERED_HOOKS hooks"
```

4. **Available to Publish (Local items that could be published to repository)**:
```bash
echo ""
echo "📤 Available to Publish:"

PUBLISH_AVAILABLE=()
PUBLISH_ITEM_NUM=1

# Function to check if local item exists and is not registered
check_local_item() {
  local location="$1"
  local item_type="$2" 
  local extension="$3"
  local category="$4"
  
  [ -d "$location" ] || return
  
  for item in "$location"/*; do
    [ -f "$item" ] || continue
    local name=$(basename "$item" $extension)
    
    # Skip if it's already registered (symlinked to repo)
    if [ -L "$item" ]; then
      local target=$(readlink "$item" 2>/dev/null)
      if echo "$target" | grep -q "^$REPO_PATH"; then
        continue  # Skip registered items
      fi
    fi
    
    # This is a local item that could be published
    local desc=""
    if [ "$extension" = ".md" ]; then
      desc=$(grep -m1 "^description:" "$item" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$item" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
    else
      desc=$(grep -m1 "^# description:" "$item" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -10 "$item" 2>/dev/null | grep -E "^# " | head -1 | sed 's/^# //' | sed 's/^[[:space:]]*//')
    fi
    [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
    
    local location_desc=$(echo "$item" | grep -q "$PROJECT_CLAUDE" && echo "project" || echo "global")
    printf "%2d. %s %s (%s, %s) - %s\n" "$PUBLISH_ITEM_NUM" "$item_type" "$name" "$category" "$location_desc" "$desc"
    PUBLISH_AVAILABLE+=("$category:$name:$item:publish")
    PUBLISH_ITEM_NUM=$((PUBLISH_ITEM_NUM + 1))
  done 2>/dev/null
}

# Check for local agents to publish
check_local_item "$PROJECT_AGENTS" "🤖" ".md" "agent"
check_local_item "$GLOBAL_AGENTS" "🤖" ".md" "agent"

# Check for local commands to publish  
check_local_item "$PROJECT_COMMANDS" "⚡" ".md" "command"
check_local_item "$GLOBAL_COMMANDS" "⚡" ".md" "command"

# Check for local hooks to publish
check_local_item "$PROJECT_HOOKS" "🪝" ".sh" "hook"
check_local_item "$GLOBAL_HOOKS" "🪝" ".sh" "hook"

[ $PUBLISH_ITEM_NUM -eq 1 ] && echo "    (no local items to publish)"
```

5. **Available to Add (Repository items not yet available to Claude Code)**:
```bash
echo ""
echo "📥 Available to Add:"

ADD_AVAILABLE=()
ADD_ITEM_NUM=$PUBLISH_ITEM_NUM

# Function to check if repository item is already registered or available locally
is_available_to_claude() {
  local repo_item_path="$1"
  local item_name="$2"  
  local item_extension="$3"
  
  # Check all Claude Code discovery locations
  for location in "$PROJECT_AGENTS" "$GLOBAL_AGENTS" "$PROJECT_COMMANDS" "$GLOBAL_COMMANDS" "$PROJECT_HOOKS" "$GLOBAL_HOOKS"; do
    [ -d "$location" ] || continue
    local potential_item="$location/$item_name$item_extension"
    if [ -f "$potential_item" ]; then
      return 0  # Already available (either as file or symlink)
    fi
  done 2>/dev/null
  return 1  # Not available to Claude Code
}

# Check agents in repository
if [ -d "$REPO_PATH/agents" ]; then
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name=$(basename "$agent_file" .md)
    
    if ! is_available_to_claude "$agent_file" "$agent_name" ".md"; then
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
      printf "%2d. 🤖 %s (agent) - %s\n" "$ADD_ITEM_NUM" "$agent_name" "$desc"
      ADD_AVAILABLE+=("agent:$agent_name:$agent_file:add")
      ADD_ITEM_NUM=$((ADD_ITEM_NUM + 1))
    fi
  done
fi

# Check commands in repository  
if [ -d "$REPO_PATH/commands" ]; then
  for cmd_file in "$REPO_PATH/commands"/*.md; do
    [ -f "$cmd_file" ] || continue
    cmd_name=$(basename "$cmd_file" .md)
    
    if ! is_available_to_claude "$cmd_file" "$cmd_name" ".md"; then
      desc=$(grep -m1 "^description:" "$cmd_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$cmd_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
      printf "%2d. ⚡ %s (command) - %s\n" "$ADD_ITEM_NUM" "$cmd_name" "$desc"
      ADD_AVAILABLE+=("command:$cmd_name:$cmd_file:add")
      ADD_ITEM_NUM=$((ADD_ITEM_NUM + 1))
    fi
  done
fi

# Check hooks in repository
if [ -d "$REPO_PATH/hooks/scripts" ]; then
  for hook_file in "$REPO_PATH/hooks/scripts"/*.sh; do
    [ -f "$hook_file" ] || continue
    hook_name=$(basename "$hook_file" .sh)
    
    if ! is_available_to_claude "$hook_file" "$hook_name" ".sh"; then
      desc=$(grep -m1 "^# description:" "$hook_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -10 "$hook_file" 2>/dev/null | grep -E "^# " | head -1 | sed 's/^# //' | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
      printf "%2d. 🪝 %s (hook) - %s\n" "$ADD_ITEM_NUM" "$hook_name" "$desc"
      ADD_AVAILABLE+=("hook:$hook_name:$hook_file:add")
      ADD_ITEM_NUM=$((ADD_ITEM_NUM + 1))
    fi
  done
fi

[ $ADD_ITEM_NUM -eq $PUBLISH_ITEM_NUM ] && echo "    (no repository items to add)"

# Show sync options
TOTAL_ITEMS=$((${#PUBLISH_AVAILABLE[@]} + ${#ADD_AVAILABLE[@]}))
if [ $TOTAL_ITEMS -gt 0 ]; then
  echo ""
  echo "📋 Sync Options:"
  echo "  a) 💫 Sync all: /prompt agent-sync"
  echo "  b) 🎯 Sync range: /prompt agent-sync sync 1-5"
  echo "  c) 🔢 Sync specific: /prompt agent-sync sync 1,3,7"
  echo "  d) 📊 View details: /prompt agent-sync publish"
else
  echo ""
  echo "✅ All items are in sync!"
fi
```

5. **Show Sync Options**:
```bash
echo ""
echo "📋 Sync Options:"
echo "  a) 💫 Sync all: /prompt agent-sync"  
echo "  b) 🎯 Sync range: /prompt agent-sync sync 1-5"
echo "  c) 🔢 Sync specific: /prompt agent-sync sync 1,3,7"
echo "  d) 📊 View details: /prompt agent-sync publish"
```

#### For SYNC_ALL Intent:
Execute symlink creation for all repository items:

```bash
echo "🔄 Syncing all agents, commands, and hooks..."
SYNCED_COUNT=0

create_symlink() {
  local source_file="$1"
  local target_dir="$2"
  local filename=$(basename "$source_file")
  local link_path="$target_dir/$filename"
  
  mkdir -p "$target_dir"
  [ -L "$link_path" ] && rm "$link_path"
  ln -s "$source_file" "$link_path"
  
  if [ -L "$link_path" ]; then
    echo "✅ Linked: $(basename "$source_file")"
    return 0
  else
    echo "❌ Failed to link: $(basename "$source_file")"
    return 1
  fi
}

# Sync all agents
if [ -d "$REPO_PATH/agents" ]; then
  echo "🤖 Syncing Agents..."
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    if create_symlink "$agent_file" "$HOME/.claude/agents"; then
      SYNCED_COUNT=$((SYNCED_COUNT + 1))
    fi
  done
fi

# Sync all commands
if [ -d "$REPO_PATH/commands" ]; then
  echo "⚡ Syncing Commands..."
  for cmd_file in "$REPO_PATH/commands"/*.md; do
    [ -f "$cmd_file" ] || continue  
    if create_symlink "$cmd_file" "$HOME/.claude/commands"; then
      SYNCED_COUNT=$((SYNCED_COUNT + 1))
    fi
  done
fi

# Sync all hooks
if [ -d "$REPO_PATH/hooks/scripts" ]; then
  echo "🪝 Syncing Hooks..."
  for hook_file in "$REPO_PATH/hooks/scripts"/*.sh; do
    [ -f "$hook_file" ] || continue
    if create_symlink "$hook_file" "$HOME/.claude/hooks"; then
      SYNCED_COUNT=$((SYNCED_COUNT + 1))
    fi
  done
fi

echo "🎉 Synchronization complete!"
echo "📊 Total synced: $SYNCED_COUNT items"
```

#### For SYNC_SPECIFIC Intent:
Extract item numbers from context and sync only those items:

```bash
NUMBERS=$(echo "<prompt-arguments>" | grep -o '[0-9]\+' | tr '\n' ' ')
echo "🎯 Selective Sync Mode - Numbers: $NUMBERS"

# Build indexed array of all unsynced items first, then process requested numbers
# Follow same scanning logic as STATUS but store results for indexed access
```

#### For PUBLISH Intent:
Scan local ~/.claude/ directories for files that could be published to repository

#### For AUTO_SYNC Intent:
Manage auto-sync hook file at ~/.claude/hooks/agent-sync-auto.sh

### 4. Output Format

Provide clear, detailed output with:
- Status indicators (✅ ❌ ⚠️ 🔄)  
- Counts and summaries
- Numbered lists for actionable items
- Clear next steps and command suggestions

### 5. Error Handling

If repository not found, provide clear guidance on setup or configuration.