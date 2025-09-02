---
argument-hint: "[action] [context...]"
description: "Manage Claude Code agents, commands, and hooks through natural language"
allowed-tools: "all"
---

# Claude Craft Agent Sync

**Context**: <prompt-context>

## Direct Execution

Execute the bash script below with the provided context to manage Claude Code synchronization:

```bash
# First, get the repository path from settings
if [ -f "$HOME/.claude/settings.json" ]; then
  REPO_PATH=$(grep -o '"claude-craft"[^}]*"path"[^"]*"[^"]*"' "$HOME/.claude/settings.json" 2>/dev/null | grep -o '"[^"]*"$' | tr -d '"')
  [ -z "$REPO_PATH" ] && REPO_PATH="$HOME/repos/claude-craft"
else
  REPO_PATH="$HOME/repos/claude-craft"
fi

# Verify repository exists
if [ ! -d "$REPO_PATH" ]; then
  echo "❌ Repository not found at: $REPO_PATH"
  echo "Please check your settings or clone the repository."
  exit 1
fi

INTENT_CONTEXT="<prompt-context>"

### INTENT CLASSIFICATION ###
# Map natural language requests to functions using keywords and context

case "$INTENT_CONTEXT" in
  *"status"*|*"ready"*|*"sync"*|*"what"*|*"available"*|*"check"*|*"current"*)
    ACTION="STATUS"
    ;;
  *"publish"*|*"list"*|*"show"*|*"detail"*)
    ACTION="PUBLISH"
    ;;
  *"sync all"*|*"sync everything"*|"sync"|"all")
    ACTION="SYNC_ALL"
    ;;
  *"sync "*[0-9]*|*"item"*|*"number"*)
    ACTION="SYNC_SPECIFIC" 
    ;;
  *"auto"*|*"automatic"*|*"schedule"*|*"hook"*)
    ACTION="AUTO_SYNC"
    ;;
  *)
    ACTION="STATUS"  # Default to status
    ;;
esac

### 1. STATUS FUNCTION ###
if [ "$ACTION" = "STATUS" ]; then

echo "📊 Claude Craft Status"
echo "📁 Repository: $REPO_PATH"

# Update repository first
echo "🔄 Updating repository..."
if command -v timeout >/dev/null 2>&1; then
  timeout 30 git -C "$REPO_PATH" pull origin main 2>/dev/null
elif command -v gtimeout >/dev/null 2>&1; then
  gtimeout 30 git -C "$REPO_PATH" pull origin main 2>/dev/null  
else
  git -C "$REPO_PATH" pull origin main 2>/dev/null
fi || {
  echo "⚠️ Could not pull latest changes (network issue?). Using local cache."
}

# Check repository status
REPO_STATUS=$(git -C "$REPO_PATH" status --porcelain 2>/dev/null)
if [ -z "$REPO_STATUS" ]; then
  echo "✅ Repository: clean (no uncommitted changes)"
else
  CHANGES=$(echo "$REPO_STATUS" | grep -c "^")
  echo "⚠️ Repository: $CHANGES uncommitted changes"
fi

echo ""

# Optimized counting function
count_repo_links() {
  local dir="$1" 
  local count=0
  [ -d "$dir" ] || { echo "0"; return; }
  
  for link in "$dir"/*; do
    [ -L "$link" ] || continue
    if readlink "$link" 2>/dev/null | grep -q "$REPO_PATH"; then
      count=$((count + 1))
    fi
  done
  echo "$count"
}

# Get current counts with optimized function
CMD_COUNT=$(count_repo_links "$HOME/.claude/commands")
AGENT_COUNT=$(count_repo_links "$HOME/.claude/agents")
HOOK_COUNT=$(count_repo_links "$HOME/.claude/hooks")

echo "🔗 Currently Linked:"
echo "  ⚡ Commands ($CMD_COUNT):"
[ "$CMD_COUNT" -gt 0 ] && {
  for link in "$HOME/.claude/commands"/*; do
    [ -L "$link" ] && readlink "$link" 2>/dev/null | grep -q "$REPO_PATH" && {
      echo "    - $(basename "$link" .md)"
    }
  done
}

echo "  🤖 Agents ($AGENT_COUNT):"
[ "$AGENT_COUNT" -gt 0 ] && {
  for link in "$HOME/.claude/agents"/*; do
    [ -L "$link" ] && readlink "$link" 2>/dev/null | grep -q "$REPO_PATH" && {
      echo "    - $(basename "$link" .md)"
    }
  done
}

echo "  🪝 Hooks ($HOOK_COUNT):"
[ "$HOOK_COUNT" -gt 0 ] && {
  for link in "$HOME/.claude/hooks"/*; do
    [ -L "$link" ] && readlink "$link" 2>/dev/null | grep -q "$REPO_PATH" && {
      echo "    - $(basename "$link" .sh)"
    }
  done
}

echo ""

# Count files that could be published (not just local ones)
TOTAL_AGENTS=0; [ -d "$REPO_PATH/agents" ] && TOTAL_AGENTS=$(find "$REPO_PATH/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL_COMMANDS=0; [ -d "$REPO_PATH/commands" ] && TOTAL_COMMANDS=$(find "$REPO_PATH/commands" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL_HOOKS=0; [ -d "$REPO_PATH/hooks/scripts" ] && TOTAL_HOOKS=$(find "$REPO_PATH/hooks/scripts" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')

TOTAL_PUBLISHABLE=$((TOTAL_AGENTS + TOTAL_COMMANDS + TOTAL_HOOKS))

echo "📝 Unpublished Items:"
echo "    Found: $TOTAL_PUBLISHABLE files that could be published"
echo "    Run '/prompt agent-sync publish' to see details"

echo ""

# Check what's available to sync (items in repo but not linked)
UNSYNCED_ITEMS=()
ITEM_NUM=1

echo "⏱️ Available to Sync:"

# Check agents that need syncing
if [ -d "$REPO_PATH/agents" ]; then
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name=$(basename "$agent_file" .md)
    link_path="$HOME/.claude/agents/$agent_name.md"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      # Extract description for unpublished agent
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
      printf "%2d. 🤖 %s (agent) - %s\n" "$ITEM_NUM" "$agent_name" "$desc"
      UNSYNCED_ITEMS+=("agent:$agent_name")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Check commands that need syncing
if [ -d "$REPO_PATH/commands" ]; then
  for cmd_file in "$REPO_PATH/commands"/*.md; do
    [ -f "$cmd_file" ] || continue
    cmd_name=$(basename "$cmd_file" .md)
    link_path="$HOME/.claude/commands/$cmd_name.md"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      # Extract description for unpublished command
      desc=$(grep -m1 "^description:" "$cmd_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$cmd_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
      printf "%2d. ⚡ %s (command) - %s\n" "$ITEM_NUM" "$cmd_name" "$desc"
      UNSYNCED_ITEMS+=("command:$cmd_name")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Check hooks that need syncing
if [ -d "$REPO_PATH/hooks/scripts" ]; then
  for hook_file in "$REPO_PATH/hooks/scripts"/*.sh; do
    [ -f "$hook_file" ] || continue
    hook_name=$(basename "$hook_file" .sh)
    link_path="$HOME/.claude/hooks/$hook_name.sh"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      # Extract description for unpublished hook
      desc=$(grep -m1 "^# description:" "$hook_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -10 "$hook_file" 2>/dev/null | grep -E "^# " | head -1 | sed 's/^# //' | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
      printf "%2d. 🪝 %s (hook) - %s\n" "$ITEM_NUM" "$hook_name" "$desc"
      UNSYNCED_ITEMS+=("hook:$hook_name")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Show sync options if there are unsynced items
if [ ${#UNSYNCED_ITEMS[@]} -gt 0 ]; then
  echo ""
  echo "📋 Sync Options:"
  echo "  a) 💫 Sync all: /prompt agent-sync"
  echo "  b) 🎯 Sync range: /prompt agent-sync sync 1-5"
  echo "  c) 🔢 Sync specific: /prompt agent-sync sync 1,3,7"
  echo "  d) 📊 View details: /prompt agent-sync publish"
else
  echo ""
  echo "✅ All repository agents, commands, and hooks are already synced!"
fi

### 2. PUBLISH FUNCTION ###
elif [ "$ACTION" = "PUBLISH" ]; then

echo "📊 Claude Craft Publishing Status"
echo "📁 Repository: $REPO_PATH"
echo ""

PUBLISHED_COUNT=0
ITEM_NUM=1

echo "🔍 Scanning for local files to publish..."
echo ""

# Check local agents directory
if [ -d "$HOME/.claude/agents" ]; then
  echo "🤖 Local Agents:"
  for agent_file in "$HOME/.claude/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    
    agent_name=$(basename "$agent_file" .md)
    repo_file="$REPO_PATH/agents/$agent_name.md"
    
    if [ ! -f "$repo_file" ] || [ "$agent_file" -nt "$repo_file" ]; then
      echo "📍 Local Project:"
      name=$(basename "$agent_file")
      size=$(ls -lh "$agent_file" 2>/dev/null | awk '{print $5}')
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1)
      
      echo "[$ITEM_NUM] $name ($size)"
      [ -n "$desc" ] && echo "    $desc"
      echo "    📍 Publish to: agents/"
      echo ""
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Check global profile agents
if [ -d "$HOME/.claude/global/agents" ]; then
  echo "🌐 Global Profile:"
  for agent_file in "$HOME/.claude/global/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    
    agent_name=$(basename "$agent_file" .md)
    repo_file="$REPO_PATH/agents/$agent_name.md"
    
    if [ ! -f "$repo_file" ] || [ "$agent_file" -nt "$repo_file" ]; then
      name=$(basename "$agent_file")
      size=$(ls -lh "$agent_file" 2>/dev/null | awk '{print $5}')
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1)
      
      echo "[$ITEM_NUM] $name ($size)"
      [ -n "$desc" ] && echo "    $desc"
      echo "    🌐 Publish to: agents/"
      echo ""
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

if [ $ITEM_NUM -eq 1 ]; then
  echo "✅ No local files found that need publishing"
  echo ""
  echo "💡 To create new agents, commands, or hooks:"
  echo "  - Edit files in ~/.claude/agents/, ~/.claude/commands/, or ~/.claude/hooks/"
  echo "  - Then run '/prompt agent-sync publish' to add them to the repository"
else
  echo "📋 Publishing Options:"
  echo "  a) 📤 Publish all: /prompt agent-sync publish all"
  echo "  b) 🎯 Publish range: /prompt agent-sync publish 1-3"
  echo "  c) 🔢 Publish specific: /prompt agent-sync publish 1,4,7"
fi

### 3. SYNC_ALL FUNCTION ###
elif [ "$ACTION" = "SYNC_ALL" ]; then

echo "🔄 Syncing all agents, commands, and hooks..."
echo "📁 Repository: $REPO_PATH"
echo ""

SYNCED_COUNT=0

# Function to create symlinks
create_symlink() {
  local source_file="$1"
  local target_dir="$2"
  local filename=$(basename "$source_file")
  local link_path="$target_dir/$filename"
  
  # Create target directory if it doesn't exist
  mkdir -p "$target_dir"
  
  # Remove existing link if it exists
  [ -L "$link_path" ] && rm "$link_path"
  
  # Create new symlink
  ln -s "$source_file" "$link_path"
  
  if [ -L "$link_path" ]; then
    echo "✅ Linked: $(basename "$source_file")"
    return 0
  else
    echo "❌ Failed to link: $(basename "$source_file")"
    return 1
  fi
}

# Sync agents
if [ -d "$REPO_PATH/agents" ]; then
  echo "🤖 Syncing Agents..."
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    if create_symlink "$agent_file" "$HOME/.claude/agents"; then
      SYNCED_COUNT=$((SYNCED_COUNT + 1))
    fi
  done
  echo ""
fi

# Sync commands
if [ -d "$REPO_PATH/commands" ]; then
  echo "⚡ Syncing Commands..."
  for cmd_file in "$REPO_PATH/commands"/*.md; do
    [ -f "$cmd_file" ] || continue
    if create_symlink "$cmd_file" "$HOME/.claude/commands"; then
      SYNCED_COUNT=$((SYNCED_COUNT + 1))
    fi
  done
  echo ""
fi

# Sync hooks
if [ -d "$REPO_PATH/hooks/scripts" ]; then
  echo "🪝 Syncing Hooks..."
  for hook_file in "$REPO_PATH/hooks/scripts"/*.sh; do
    [ -f "$hook_file" ] || continue
    if create_symlink "$hook_file" "$HOME/.claude/hooks"; then
      SYNCED_COUNT=$((SYNCED_COUNT + 1))
    fi
  done
  echo ""
fi

echo "🎉 Synchronization complete!"
echo "📊 Total synced: $SYNCED_COUNT items"
echo ""
echo "💡 Run '/prompt agent-sync status' to verify the changes"

### 4. SYNC_SPECIFIC FUNCTION ###
elif [ "$ACTION" = "SYNC_SPECIFIC" ]; then

echo "🎯 Selective Sync Mode"
echo "📁 Repository: $REPO_PATH"
echo ""

# Extract numbers from the context
NUMBERS=$(echo "$INTENT_CONTEXT" | grep -o '[0-9]\+' | tr '\n' ' ')

if [ -z "$NUMBERS" ]; then
  echo "❌ No item numbers specified"
  echo "Example: '/prompt agent-sync sync 1,3,5' or '/prompt agent-sync sync 2-4'"
  exit 1
fi

# Build available items list (same as STATUS section)
UNSYNCED_ITEMS=()
ITEM_NUM=1

# Check agents that need syncing
if [ -d "$REPO_PATH/agents" ]; then
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name=$(basename "$agent_file" .md)
    link_path="$HOME/.claude/agents/$agent_name.md"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      UNSYNCED_ITEMS+=("agent:$agent_name:$agent_file")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Check commands that need syncing
if [ -d "$REPO_PATH/commands" ]; then
  for cmd_file in "$REPO_PATH/commands"/*.md; do
    [ -f "$cmd_file" ] || continue
    cmd_name=$(basename "$cmd_file" .md)
    link_path="$HOME/.claude/commands/$cmd_name.md"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      UNSYNCED_ITEMS+=("command:$cmd_name:$cmd_file")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Check hooks that need syncing
if [ -d "$REPO_PATH/hooks/scripts" ]; then
  for hook_file in "$REPO_PATH/hooks/scripts"/*.sh; do
    [ -f "$hook_file" ] || continue
    hook_name=$(basename "$hook_file" .sh)
    link_path="$HOME/.claude/hooks/$hook_name.sh"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      UNSYNCED_ITEMS+=("hook:$hook_name:$hook_file")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Process each requested number
SYNCED_COUNT=0
for num in $NUMBERS; do
  if [ "$num" -ge 1 ] && [ "$num" -le ${#UNSYNCED_ITEMS[@]} ]; then
    # Array is 0-indexed, so subtract 1
    index=$((num - 1))
    item_info="${UNSYNCED_ITEMS[$index]}"
    
    # Parse item info (type:name:file)
    item_type=$(echo "$item_info" | cut -d: -f1)
    item_name=$(echo "$item_info" | cut -d: -f2)
    item_file=$(echo "$item_info" | cut -d: -f3-)
    
    # Create appropriate symlink
    case "$item_type" in
      "agent")
        mkdir -p "$HOME/.claude/agents"
        ln -sf "$item_file" "$HOME/.claude/agents/$item_name.md"
        echo "✅ Synced agent: $item_name"
        ;;
      "command")
        mkdir -p "$HOME/.claude/commands"
        ln -sf "$item_file" "$HOME/.claude/commands/$item_name.md"
        echo "✅ Synced command: $item_name"
        ;;
      "hook")
        mkdir -p "$HOME/.claude/hooks"
        ln -sf "$item_file" "$HOME/.claude/hooks/$item_name.sh"
        echo "✅ Synced hook: $item_name"
        ;;
    esac
    
    SYNCED_COUNT=$((SYNCED_COUNT + 1))
  else
    echo "⚠️ Invalid item number: $num (valid range: 1-${#UNSYNCED_ITEMS[@]})"
  fi
done

echo ""
echo "🎉 Selective sync complete!"
echo "📊 Items synced: $SYNCED_COUNT"

### 5. AUTO_SYNC FUNCTION ###
elif [ "$ACTION" = "AUTO_SYNC" ]; then

echo "🤖 Auto-Sync Configuration"
echo "📁 Repository: $REPO_PATH"
echo ""

# Check if auto-sync hook exists
HOOK_FILE="$HOME/.claude/hooks/agent-sync-auto.sh"

if echo "$INTENT_CONTEXT" | grep -q -E "(enable|on|start|activate)"; then
  echo "🔄 Enabling auto-sync..."
  
  # Create auto-sync hook
  mkdir -p "$HOME/.claude/hooks"
  cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Auto-sync hook for Claude Craft
# Runs agent-sync status check before each Claude session

echo "🔄 Auto-syncing Claude Craft..."
/prompt agent-sync status >/dev/null 2>&1 || echo "⚠️ Auto-sync failed"
EOF
  
  chmod +x "$HOOK_FILE"
  echo "✅ Auto-sync enabled"
  echo "📍 Hook created: ~/.claude/hooks/agent-sync-auto.sh"
  
elif echo "$INTENT_CONTEXT" | grep -q -E "(disable|off|stop|deactivate)"; then
  echo "🛑 Disabling auto-sync..."
  
  if [ -f "$HOOK_FILE" ]; then
    rm "$HOOK_FILE"
    echo "✅ Auto-sync disabled"
    echo "🗑️ Hook removed: ~/.claude/hooks/agent-sync-auto.sh"
  else
    echo "ℹ️ Auto-sync was not enabled"
  fi
  
else
  # Check status
  echo "📊 Auto-Sync Status:"
  if [ -f "$HOOK_FILE" ]; then
    echo "✅ Auto-sync is ENABLED"
    echo "📍 Hook file: ~/.claude/hooks/agent-sync-auto.sh"
    echo ""
    echo "🛑 To disable: /prompt agent-sync auto disable"
  else
    echo "❌ Auto-sync is DISABLED"
    echo ""
    echo "🔄 To enable: /prompt agent-sync auto enable"
  fi
fi

fi
```