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

### INTENT CLASSIFICATION (Prompt-as-Code Pattern) ###
# Using declarative intent mapping for natural language understanding
# Each intent is defined by its purpose and matching patterns

# Transform intent to lowercase for consistent matching
INTENT_NORMALIZED=$(echo "$INTENT_CONTEXT" | tr '[:upper:]' '[:lower:]' | tr -d '[:punct:]')

# Intent Resolution Function
# "Given user intent, determine the appropriate action through pattern recognition"
determine_action() {
  local intent="$1"
  
  # Intent: View Current State
  # Purpose: User wants to see what's linked, unpublished, and available
  # Patterns: status, what's ready, check, show me, current state, available
  if echo "$intent" | grep -qE "(status|ready|what|available|check|current|show)"; then
    echo "STATUS"
    return
  fi
  
  # Intent: Publish Local Changes
  # Purpose: User wants to push local modifications to the repository
  # Patterns: publish, push changes, commit
  if echo "$intent" | grep -qE "(publish|push|commit)"; then
    echo "PUBLISH"
    return
  fi
  
  # Intent: Add All Available Items
  # Purpose: User wants to link all unlinked repository items to profile
  # Patterns: add all, sync all, add everything, or standalone add/sync/all
  if echo "$intent" | grep -qE "(add all|sync all|add everything|sync everything)" || \
     [[ "$intent" =~ ^(add|sync|all)$ ]]; then
    echo "SYNC_ALL"
    return
  fi
  
  # Intent: Add Specific Items
  # Purpose: User wants to selectively link numbered items
  # Patterns: add 1 2 3, sync items 1-3, item 5, or just numbers
  if echo "$intent" | grep -qE "(add|sync|item).*[0-9]" || \
     echo "$intent" | grep -qE "^[0-9 ,]+$"; then
    echo "SYNC_SPECIFIC"
    return
  fi
  
  # Intent: Configure Automatic Synchronization
  # Purpose: User wants to enable/disable/check auto-sync hooks
  # Patterns: auto, automatic, schedule, hook
  if echo "$intent" | grep -qE "(auto|automatic|schedule|hook)"; then
    echo "AUTO_SYNC"
    return
  fi
  
  # Default Intent: Show Status
  # When intent is unclear, provide informational overview
  echo "STATUS"
}

# Execute intent determination
ACTION=$(determine_action "$INTENT_NORMALIZED")

# Extract item numbers for selective operations
if [ "$ACTION" = "SYNC_SPECIFIC" ]; then
  NUMBERS=$(echo "$INTENT_NORMALIZED" | grep -o '[0-9]\+' | tr '\n' ' ')
fi

### 1. STATUS FUNCTION ###
if [ "$ACTION" = "STATUS" ]; then

echo "📊 Claude Craft Status"
echo "📁 Repository: $REPO_PATH"
echo ""

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
echo "---"

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
PROMPT_COUNT=$(count_repo_links "$HOME/.claude/prompts")

echo "🔗 Currently Linked (by type and location):"
echo ""

# Function to group and display by type then location
display_linked_by_type() {
  local type="$1"
  local emoji="$2"
  local extension="$3"
  local dir="$4"
  
  # Count profile vs local linked items
  local profile_count=0
  local local_count=0
  local profile_items=()
  local local_items=()
  
  [ -d "$dir" ] && {
    for link in "$dir"/*; do
      [ -L "$link" ] || continue
      if readlink "$link" 2>/dev/null | grep -q "$REPO_PATH"; then
        local name=$(basename "$link" .$extension)
        local target=$(readlink "$link" 2>/dev/null)
        if echo "$target" | grep -q "\.claude/"; then
          profile_items+=("$name")
          profile_count=$((profile_count + 1))
        else
          local_items+=("$name")
          local_count=$((local_count + 1))
        fi
      fi
    done
  }
  
  local total_count=$((profile_count + local_count))
  if [ "$total_count" -gt 0 ]; then
    echo "  $emoji $type ($total_count):"
    echo ""
    
    if [ "$profile_count" -gt 0 ]; then
      echo "    📍 Profile ($profile_count):"
      for item in "${profile_items[@]}"; do
        echo "      - $item"
      done
    fi
    
    if [ "$local_count" -gt 0 ]; then
      echo "    📂 Local ($local_count):"
      for item in "${local_items[@]}"; do
        echo "      - $item"
      done
    fi
    echo ""
  fi
}

# Display each type grouped by location
display_linked_by_type "Commands" "⚡" "md" "$HOME/.claude/commands"
display_linked_by_type "Agents" "🤖" "md" "$HOME/.claude/agents"
display_linked_by_type "Hooks" "🪝" "sh" "$HOME/.claude/hooks"
display_linked_by_type "Prompts" "📝" "md" "$HOME/.claude/prompts"

echo ""
echo "---"

# Get list of files with uncommitted changes from git status
MODIFIED_FILES=($(git -C "$REPO_PATH" status --porcelain 2>/dev/null | grep -E "^[MAD?]" | awk '{print $2}'))

# Collect unpublished items (either modified in git or missing symlinks)
UNPUBLISHED_AGENTS=()
UNPUBLISHED_COMMANDS=()
UNPUBLISHED_HOOKS=()
UNPUBLISHED_PROMPTS=()

echo "📝 Unpublished Items:"
echo ""

# Function to check if file is unpublished (modified in git or missing symlink)
is_unpublished() {
  local file="$1"
  local link_path="$2"
  
  # Check if file is in git modified list
  for mod_file in "${MODIFIED_FILES[@]}"; do
    if echo "$file" | grep -q "$mod_file"; then
      return 0  # File is modified in git
    fi
  done
  
  # Check if symlink is missing or points elsewhere
  if [ ! -L "$link_path" ] || ! readlink "$link_path" 2>/dev/null | grep -q "$REPO_PATH"; then
    return 0  # Missing or incorrect symlink
  fi
  
  return 1  # File is published (committed and linked)
}

# Check agents for unpublished status
if [ -d "$REPO_PATH/agents" ]; then
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    name=$(basename "$agent_file" .md)
    link_path="$HOME/.claude/agents/$name.md"
    
    if is_unpublished "$agent_file" "$link_path"; then
      size=$(ls -lh "$agent_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$agent_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      UNPUBLISHED_AGENTS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Check commands for unpublished status
if [ -d "$REPO_PATH/commands" ]; then
  for cmd_file in "$REPO_PATH/commands"/*.md; do
    [ -f "$cmd_file" ] || continue
    name=$(basename "$cmd_file" .md)
    link_path="$HOME/.claude/commands/$name.md"
    
    if is_unpublished "$cmd_file" "$link_path"; then
      size=$(ls -lh "$cmd_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$cmd_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^description:" "$cmd_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$cmd_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      UNPUBLISHED_COMMANDS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Check hooks for unpublished status
if [ -d "$REPO_PATH/hooks/scripts" ]; then
  for hook_file in "$REPO_PATH/hooks/scripts"/*.sh; do
    [ -f "$hook_file" ] || continue
    name=$(basename "$hook_file" .sh)
    link_path="$HOME/.claude/hooks/$name.sh"
    
    if is_unpublished "$hook_file" "$link_path"; then
      size=$(ls -lh "$hook_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$hook_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^# description:" "$hook_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -10 "$hook_file" 2>/dev/null | grep -E "^# " | head -1 | sed 's/^# //' | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      UNPUBLISHED_HOOKS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Check prompts for unpublished status
if [ -d "$REPO_PATH/prompts" ]; then
  for prompt_file in "$REPO_PATH/prompts"/*.md; do
    [ -f "$prompt_file" ] || continue
    name=$(basename "$prompt_file" .md)
    link_path="$HOME/.claude/prompts/$name.md"
    
    if is_unpublished "$prompt_file" "$link_path"; then
      size=$(ls -lh "$prompt_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$prompt_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^description:" "$prompt_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$prompt_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      UNPUBLISHED_PROMPTS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Display unpublished items grouped by type
TOTAL_UNPUBLISHED=$((${#UNPUBLISHED_AGENTS[@]} + ${#UNPUBLISHED_COMMANDS[@]} + ${#UNPUBLISHED_HOOKS[@]} + ${#UNPUBLISHED_PROMPTS[@]}))

if [ "$TOTAL_UNPUBLISHED" -gt 0 ]; then
  if [ ${#UNPUBLISHED_AGENTS[@]} -gt 0 ]; then
    echo "  🤖 Agents (${#UNPUBLISHED_AGENTS[@]}):"
    echo ""
    for item in "${UNPUBLISHED_AGENTS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi

  if [ ${#UNPUBLISHED_COMMANDS[@]} -gt 0 ]; then
    echo "  ⚡ Commands (${#UNPUBLISHED_COMMANDS[@]}):"
    echo ""
    for item in "${UNPUBLISHED_COMMANDS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi

  if [ ${#UNPUBLISHED_HOOKS[@]} -gt 0 ]; then
    echo "  🪝 Hooks (${#UNPUBLISHED_HOOKS[@]}):"
    echo ""
    for item in "${UNPUBLISHED_HOOKS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi

  if [ ${#UNPUBLISHED_PROMPTS[@]} -gt 0 ]; then
    echo "  📝 Prompts (${#UNPUBLISHED_PROMPTS[@]}):"
    echo ""
    for item in "${UNPUBLISHED_PROMPTS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi
  
  echo "    💡 Use '/prompt agent-sync publish' to commit and push these changes"
else
  echo "✅ All repository items are published (committed and linked)"
fi

echo ""
echo "---"

# Check for items available to publish (exist in profile but not in repo)
PUBLISHABLE_AGENTS=()
PUBLISHABLE_COMMANDS=()
PUBLISHABLE_HOOKS=()
PUBLISHABLE_PROMPTS=()

echo "⬆️ Available to Publish (Profile → Repository):"
echo ""

# Check profile agents not in repo
if [ -d "$HOME/.claude/agents" ]; then
  for agent_file in "$HOME/.claude/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    name=$(basename "$agent_file" .md)
    repo_file="$REPO_PATH/agents/$name.md"
    
    if [ ! -f "$repo_file" ] || [ "$agent_file" -nt "$repo_file" ] || ! cmp -s "$agent_file" "$repo_file" 2>/dev/null; then
      size=$(ls -lh "$agent_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$agent_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      PUBLISHABLE_AGENTS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Check profile commands not in repo
if [ -d "$HOME/.claude/commands" ]; then
  for cmd_file in "$HOME/.claude/commands"/*.md; do
    [ -f "$cmd_file" ] || continue
    name=$(basename "$cmd_file" .md)
    repo_file="$REPO_PATH/commands/$name.md"
    
    if [ ! -f "$repo_file" ] || [ "$agent_file" -nt "$repo_file" ] || ! cmp -s "$agent_file" "$repo_file" 2>/dev/null; then
      size=$(ls -lh "$cmd_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$cmd_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^description:" "$cmd_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$cmd_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      PUBLISHABLE_COMMANDS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Check profile hooks not in repo
if [ -d "$HOME/.claude/hooks" ]; then
  for hook_file in "$HOME/.claude/hooks"/*.sh; do
    [ -f "$hook_file" ] || continue
    name=$(basename "$hook_file" .sh)
    repo_file="$REPO_PATH/hooks/scripts/$name.sh"
    
    if [ ! -f "$repo_file" ] || [ "$agent_file" -nt "$repo_file" ] || ! cmp -s "$agent_file" "$repo_file" 2>/dev/null; then
      size=$(ls -lh "$hook_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$hook_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^# description:" "$hook_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -10 "$hook_file" 2>/dev/null | grep -E "^# " | head -1 | sed 's/^# //' | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      PUBLISHABLE_HOOKS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Check profile prompts not in repo
if [ -d "$HOME/.claude/prompts" ]; then
  for prompt_file in "$HOME/.claude/prompts"/*.md; do
    [ -f "$prompt_file" ] || continue
    name=$(basename "$prompt_file" .md)
    repo_file="$REPO_PATH/prompts/$name.md"
    
    if [ ! -f "$repo_file" ] || [ "$agent_file" -nt "$repo_file" ] || ! cmp -s "$agent_file" "$repo_file" 2>/dev/null; then
      size=$(ls -lh "$prompt_file" 2>/dev/null | awk '{print $5}')
      date=$(ls -l "$prompt_file" 2>/dev/null | awk '{print $6, $7}')
      desc=$(grep -m1 "^description:" "$prompt_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$prompt_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      [ ${#desc} -gt 50 ] && desc="${desc:0:50}..."
      PUBLISHABLE_PROMPTS+=("$name:$size:$date:$desc")
    fi
  done
fi

# Display publishable items grouped by type
TOTAL_PUBLISHABLE=$((${#PUBLISHABLE_AGENTS[@]} + ${#PUBLISHABLE_COMMANDS[@]} + ${#PUBLISHABLE_HOOKS[@]} + ${#PUBLISHABLE_PROMPTS[@]}))

if [ "$TOTAL_PUBLISHABLE" -gt 0 ]; then
  if [ ${#PUBLISHABLE_AGENTS[@]} -gt 0 ]; then
    echo "  🤖 Agents (${#PUBLISHABLE_AGENTS[@]}):"
    echo ""
    for item in "${PUBLISHABLE_AGENTS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi

  if [ ${#PUBLISHABLE_COMMANDS[@]} -gt 0 ]; then
    echo "  ⚡ Commands (${#PUBLISHABLE_COMMANDS[@]}):"
    echo ""
    for item in "${PUBLISHABLE_COMMANDS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi

  if [ ${#PUBLISHABLE_HOOKS[@]} -gt 0 ]; then
    echo "  🪝 Hooks (${#PUBLISHABLE_HOOKS[@]}):"
    echo ""
    for item in "${PUBLISHABLE_HOOKS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi

  if [ ${#PUBLISHABLE_PROMPTS[@]} -gt 0 ]; then
    echo "  📝 Prompts (${#PUBLISHABLE_PROMPTS[@]}):"
    echo ""
    for item in "${PUBLISHABLE_PROMPTS[@]}"; do
      IFS=':' read -r name size date desc <<< "$item"
      printf "    • %s (%s, %s) - %s\n" "$name" "$size" "$date" "$desc"
    done
    echo ""
  fi
  
  echo "    💡 Use '/prompt agent-sync publish' to copy these to the repository"
else
  echo "✅ No profile items need publishing"
fi

echo ""
echo "---"

# Check what's available to add (items in repo but not linked to profile)
UNSYNCED_ITEMS=()
ITEM_NUM=1

echo "🔗 Available to Add (Repository → Profile):"
echo ""

# Function to calculate time since modification
time_since_modified() {
  local file="$1"
  local mod_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
  local now=$(date +%s)
  local diff=$((now - mod_time))
  
  if [ "$diff" -lt 60 ]; then
    echo "just now"
  elif [ "$diff" -lt 3600 ]; then
    local mins=$((diff / 60))
    echo "${mins}m ago"
  elif [ "$diff" -lt 86400 ]; then
    local hours=$((diff / 3600))
    echo "${hours}h ago"
  elif [ "$diff" -lt 604800 ]; then
    local days=$((diff / 86400))
    echo "${days}d ago"
  else
    local weeks=$((diff / 604800))
    echo "${weeks}w ago"
  fi
}

# Collect unsynced items by type
UNSYNCED_AGENTS=()
UNSYNCED_COMMANDS=()
UNSYNCED_HOOKS=()
UNSYNCED_PROMPTS=()

# Check agents that need syncing
if [ -d "$REPO_PATH/agents" ]; then
  for agent_file in "$REPO_PATH/agents"/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name=$(basename "$agent_file" .md)
    link_path="$HOME/.claude/agents/$agent_name.md"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      desc=$(grep -m1 "^description:" "$agent_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$agent_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      duration=$(time_since_modified "$agent_file")
      UNSYNCED_AGENTS+=("$ITEM_NUM:$agent_name:$duration:$desc")
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
      desc=$(grep -m1 "^description:" "$cmd_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$cmd_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      duration=$(time_since_modified "$cmd_file")
      UNSYNCED_COMMANDS+=("$ITEM_NUM:$cmd_name:$duration:$desc")
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
      desc=$(grep -m1 "^# description:" "$hook_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -10 "$hook_file" 2>/dev/null | grep -E "^# " | head -1 | sed 's/^# //' | sed 's/^[[:space:]]*//')
      duration=$(time_since_modified "$hook_file")
      UNSYNCED_HOOKS+=("$ITEM_NUM:$hook_name:$duration:$desc")
      UNSYNCED_ITEMS+=("hook:$hook_name")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Check prompts that need syncing
if [ -d "$REPO_PATH/prompts" ]; then
  for prompt_file in "$REPO_PATH/prompts"/*.md; do
    [ -f "$prompt_file" ] || continue
    prompt_name=$(basename "$prompt_file" .md)
    link_path="$HOME/.claude/prompts/$prompt_name.md"
    if [ ! -L "$link_path" ] || ! readlink "$link_path" | grep -q "$REPO_PATH"; then
      desc=$(grep -m1 "^description:" "$prompt_file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
      [ -z "$desc" ] && desc=$(head -5 "$prompt_file" 2>/dev/null | grep -v "^#" | head -1 | sed 's/^[[:space:]]*//')
      duration=$(time_since_modified "$prompt_file")
      UNSYNCED_PROMPTS+=("$ITEM_NUM:$prompt_name:$duration:$desc")
      UNSYNCED_ITEMS+=("prompt:$prompt_name")
      ITEM_NUM=$((ITEM_NUM + 1))
    fi
  done
fi

# Display grouped by type
if [ ${#UNSYNCED_AGENTS[@]} -gt 0 ]; then
  echo "🤖 Agents (${#UNSYNCED_AGENTS[@]}):"
  echo ""
  for item in "${UNSYNCED_AGENTS[@]}"; do
    IFS=':' read -r num name duration desc <<< "$item"
    printf "%2d. %s (%s)\n" "$num" "$name" "$duration"
    [ -n "$desc" ] && printf "      %s\n" "$desc"
    echo ""
  done
  echo ""
fi

if [ ${#UNSYNCED_COMMANDS[@]} -gt 0 ]; then
  echo "⚡ Commands (${#UNSYNCED_COMMANDS[@]}):"
  echo ""
  for item in "${UNSYNCED_COMMANDS[@]}"; do
    IFS=':' read -r num name duration desc <<< "$item"
    printf "%2d. %s (%s)\n" "$num" "$name" "$duration"
    [ -n "$desc" ] && printf "      %s\n" "$desc"
    echo ""
  done
  echo ""
fi

if [ ${#UNSYNCED_HOOKS[@]} -gt 0 ]; then
  echo "🪝 Hooks (${#UNSYNCED_HOOKS[@]}):"
  echo ""
  for item in "${UNSYNCED_HOOKS[@]}"; do
    IFS=':' read -r num name duration desc <<< "$item"
    printf "%2d. %s (%s)\n" "$num" "$name" "$duration"
    [ -n "$desc" ] && printf "      %s\n" "$desc"
    echo ""
  done
  echo ""
fi

if [ ${#UNSYNCED_PROMPTS[@]} -gt 0 ]; then
  echo "📝 Prompts (${#UNSYNCED_PROMPTS[@]}):"
  echo ""
  for item in "${UNSYNCED_PROMPTS[@]}"; do
    IFS=':' read -r num name duration desc <<< "$item"
    printf "%2d. %s (%s)\n" "$num" "$name" "$duration"
    [ -n "$desc" ] && printf "      %s\n" "$desc"
    echo ""
  done
  echo ""
fi

# Show add options if there are unsynced items
if [ ${#UNSYNCED_ITEMS[@]} -gt 0 ]; then
  echo "📋 Quick Actions:"
  echo "  a) 🔗 Add all to profile: /prompt agent-sync add all"
  echo "  b) 🎯 Add specific items: /prompt agent-sync add 1-5 or add 1,3,7"  
  echo "  c) 📤 Publish local changes: /prompt agent-sync publish"
  echo "  d) 🔄 Refresh status: /prompt agent-sync status"
else
  echo "✅ All repository items are already added to your Claude profile!"
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
  echo "  b) 🎯 Publish range/specific: /prompt agent-sync publish 1-3 or 1,4,7"
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