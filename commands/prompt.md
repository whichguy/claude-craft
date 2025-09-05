---
argument-hint: "[template] [context...]"
description: "Load and execute a prompt template"
allowed-tools: "all"
---

# Prompt Template Executor

**Template**: $1  
**Context**: $2 $3 $4 $5 $6 $7 $8 $9

## Execution Flow

Execute this bash script to find and load the template:

```bash
#!/bin/bash
set -euo pipefail

TEMPLATE="$1"
shift || true
CONTEXT="$*"

# Handle --list option with sync management
if [ "$TEMPLATE" = "--list" ]; then
    echo "## Claude Craft Sync Status & Available Items"
    
    # Helper functions
    is_synced() {
        local item_type="$1"
        local item_name="$2"
        case "$item_type" in
            commands|agents|prompts)
                ! [ ! -L "$HOME/.claude/$item_type/$item_name" ]
                ;;
            hooks)
                local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
                ! [ ! -L "$git_root/.git/hooks/${item_name%.sh}" ]
                ;;
        esac
    }
    
    # Helper function to detect sync level (project vs profile)
    detect_sync_level() {
        local item_type="$1"
        local item_name="$2"
        
        case "$item_type" in
            commands|agents|prompts)
                if [ -L "$HOME/.claude/$item_type/$item_name" ]; then
                    local target=$(readlink "$HOME/.claude/$item_type/$item_name")
                    # Check if target contains project path vs profile path patterns
                    if [[ "$target" == *"/pub/"* ]] || [[ "$target" == *"/src/"* ]] || [[ "$target" == *"/workspace/"* ]]; then
                        echo "project"
                    else
                        echo "profile"
                    fi
                fi
                ;;
            hooks)
                local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
                if [ -n "$git_root" ] && [ -L "$git_root/.git/hooks/${item_name%.sh}" ]; then
                    echo "project"  # Git hooks are always project-level
                fi
                ;;
        esac
    }
    
    collect_items() {
        local item_type="$1"
        local repo_dir="$2"
        
        ! [ ! -d "$repo_dir" ] || return 0
        
        # Get emoji for item type
        local emoji=""
        case "$item_type" in
            commands) emoji="⚡" ;;
            agents) emoji="🤖" ;;
            prompts) emoji="📝" ;;
            hooks) emoji="🪝" ;;
        esac
        
        # Check items in repo - process files without subshell
        if [ -d "$repo_dir" ]; then
            # Determine file pattern based on item type
            local file_pattern="*.md"
            [ "$item_type" = "hooks" ] && file_pattern="*.sh"
            
            # Create temporary file for this item type
            local temp_files="/tmp/claude_${item_type}_files.tmp"
            rg --files --glob "$file_pattern" "$repo_dir" 2>/dev/null | sort > "$temp_files"
            
            # Process each file without subshell to preserve GLOBAL_COUNT
            while IFS= read -r file; do
                [ -n "$file" ] || continue
                local item_name=$(basename "$file")
                GLOBAL_COUNT=$((GLOBAL_COUNT + 1))
                
                if is_synced "$item_type" "$item_name"; then
                    local sync_level=$(detect_sync_level "$item_type" "$item_name")
                    printf "%d:%s:%s:%s:synced:%s\n" "$GLOBAL_COUNT" "$item_name" "$item_type" "$emoji" "$sync_level" >> /tmp/claude_synced_items.tmp
                else
                    printf "%d:%s:%s:%s:available:\n" "$GLOBAL_COUNT" "$item_name" "$item_type" "$emoji" >> /tmp/claude_available_items.tmp
                fi
            done < "$temp_files"
            
            rm -f "$temp_files"
        fi
    }"
    
    # Initialize temp files and global counter
    rm -f /tmp/claude_available_items.tmp /tmp/claude_synced_items.tmp
    touch /tmp/claude_available_items.tmp /tmp/claude_synced_items.tmp
    GLOBAL_COUNT=0
    
    # Get repository location from single claude-craft.json configuration
    get_repo_path() {
        local repo_path=""
        local config_file=""
        
        # 1. Try project config first (git parent/.claude/claude-craft.json)
        # Git is run from CWD, then we look in the parent of whatever git root is found
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
        if [ -n "$git_root" ]; then
            config_file="$(dirname "$git_root")/.claude/claude-craft.json"
            if [ -f "$config_file" ]; then
                repo_path=$(jq -r '.repository.path // empty' "$config_file" 2>/dev/null)
            fi
        fi
        
        # 2. Try profile config (fallback)
        if [ -z "$repo_path" ] && [ -f "$HOME/.claude/claude-craft.json" ]; then
            repo_path=$(jq -r '.repository.path // empty' "$HOME/.claude/claude-craft.json" 2>/dev/null)
        fi
        
        # 3. Expand environment variables and validate path
        if [ -n "$repo_path" ]; then
            # Handle $HOME expansion
            repo_path=$(echo "$repo_path" | sed "s|\$HOME|$HOME|g")
            # Verify path exists and has expected structure
            if [ -d "$repo_path/commands" ] && [ -d "$repo_path/agents" ]; then
                echo "$repo_path"
                return
            fi
        fi
        
        # 4. Final fallback - current directory if it looks like claude-craft
        local current_dir="$(pwd)"
        if [ -d "$current_dir/commands" ] && [ -d "$current_dir/agents" ]; then
            echo "$current_dir"
        fi
    }
    
    REPO_DIR=$(get_repo_path)
    
    # Collect all items
    collect_items "commands" "$REPO_DIR/commands"
    collect_items "agents" "$REPO_DIR/agents" 
    collect_items "prompts" "$REPO_DIR/prompts"
    collect_items "hooks" "$REPO_DIR/hooks/scripts"
    
    # Renumber all items contiguously
    rm -f /tmp/claude_synced_display.tmp /tmp/claude_available_display.tmp
    touch /tmp/claude_synced_display.tmp /tmp/claude_available_display.tmp
    
    # Renumber synced items
    if [ -s /tmp/claude_synced_items.tmp ]; then
        local display_counter=1
        sort -t: -k1,1n /tmp/claude_synced_items.tmp > /tmp/claude_synced_sorted.tmp
        
        while IFS=':' read -r num name type emoji sync_status level; do
            echo "$display_counter:$name:$type:$emoji:$sync_status:$level" >> /tmp/claude_synced_display.tmp
            display_counter=$((display_counter + 1))
        done < /tmp/claude_synced_sorted.tmp
        
        rm -f /tmp/claude_synced_sorted.tmp
    fi
    
    # Continue numbering for available items
    if [ -s /tmp/claude_available_items.tmp ]; then
        local synced_count=$(wc -l < /tmp/claude_synced_items.tmp 2>/dev/null || echo 0)
        local display_counter=$((synced_count + 1))
        
        sort -t: -k1,1n /tmp/claude_available_items.tmp > /tmp/claude_available_sorted.tmp
        
        while IFS=':' read -r num name type emoji sync_status; do
            echo "$display_counter:$name:$type:$emoji:$sync_status" >> /tmp/claude_available_display.tmp
            display_counter=$((display_counter + 1))
        done < /tmp/claude_available_sorted.tmp
        
        rm -f /tmp/claude_available_sorted.tmp
    fi
    
    # Show Already Synced section
    if [ -s /tmp/claude_synced_display.tmp ]; then
        echo -e "\n\n## ✓ Already Synced"
        
        # Group by type: commands, agents, prompts, hooks
        for item_type in commands agents prompts hooks; do
            local emoji=""
            local capitalized=""
            case "$item_type" in
                commands) emoji="⚡" capitalized="Commands" ;;
                agents) emoji="🤖" capitalized="Agents" ;;
                prompts) emoji="📝" capitalized="Prompts" ;;
                hooks) emoji="🪝" capitalized="Hooks" ;;
            esac
            
            local type_items=$(grep ":$item_type:.*:synced:" /tmp/claude_synced_display.tmp)
            if [ -n "$type_items" ]; then
                echo -e "\n### $emoji **$capitalized:**"
                echo
                echo "$type_items" | while IFS=':' read -r num name type emoji_unused sync_status level; do
                    local level_indicator=""
                    case "$level" in
                        project) level_indicator="📁" ;;
                        profile) level_indicator="👤" ;;
                        *) level_indicator="❓" ;;
                    esac
                    echo "  [$num] **$name** $level_indicator"
                    
                    # Get description and wrap it
                    local desc=""
                    case "$item_type" in
                        commands|agents)
                            desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { gsub(/^description: *"?/, ""); gsub(/"$/, ""); print; exit } }' "$REPO_DIR/$item_type/$name" 2>/dev/null || echo "")
                            ;;
                    esac
                    
                    if [ -n "$desc" ]; then
                        echo "      $desc" | fold -w 80 -s | sed 's/^/      /'
                    fi
                    echo
                done
            fi
        done
        
        echo -e "\n📁 = Project level   👤 = Profile level"
    fi
    
    # Show Available to Sync section
    if [ -s /tmp/claude_available_display.tmp ]; then
        echo -e "\n\n## 📋 Available to Sync"
        
        # Group by type: commands, agents, prompts, hooks
        for item_type in commands agents prompts hooks; do
            local emoji=""
            local capitalized=""
            case "$item_type" in
                commands) emoji="⚡" capitalized="Commands" ;;
                agents) emoji="🤖" capitalized="Agents" ;;
                prompts) emoji="📝" capitalized="Prompts" ;;
                hooks) emoji="🪝" capitalized="Hooks" ;;
            esac
            
            local type_items=$(grep ":$item_type:.*:available:" /tmp/claude_available_display.tmp | head -10)
            if [ -n "$type_items" ]; then
                echo -e "\n### $emoji **$capitalized:**"
                echo
                echo "$type_items" | while IFS=':' read -r num name type emoji_unused sync_status; do
                    echo "  [$num] **$name**"
                    
                    # Get description and wrap it
                    local desc=""
                    case "$item_type" in
                        commands|agents)
                            desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { gsub(/^description: *"?/, ""); gsub(/"$/, ""); print; exit } }' "$REPO_DIR/$item_type/$name" 2>/dev/null || echo "")
                            ;;
                    esac
                    
                    if [ -n "$desc" ]; then
                        echo "      $desc" | fold -w 80 -s | sed 's/^/      /'
                    fi
                    echo
                done
            fi
        done
        
        echo -e "\n\nTo sync items:"
        echo "  1. Choose item numbers: /prompt --sync 3,7,12"
        echo "  2. Sync all available: /prompt --sync-all"
        echo "  3. Items will be linked at appropriate level (project/profile)"
    else
        if [ ! -s /tmp/claude_synced_display.tmp ]; then
            echo -e "\n📋 No items found to sync."
        fi
    fi
    
    # Cleanup
    rm -f /tmp/claude_available_items.tmp /tmp/claude_synced_items.tmp /tmp/claude_synced_display.tmp /tmp/claude_available_display.tmp
    exit 0
fi

# Find git parent prompts directory
# Git is run from CWD, then we look in the parent of whatever git root is found
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
GIT_PARENT_PROMPTS=""
if [ -n "$GIT_ROOT" ]; then
    GIT_PARENT_PROMPTS="$(dirname "$GIT_ROOT")/prompts"
fi

# Template discovery with ripgrep
TEMPLATE_FILE=""

# 1. Check if explicit path provided (highest priority)
if [[ "$TEMPLATE" == *"/"* ]] || [[ "$TEMPLATE" == *".md" ]]; then
    # Remove .md extension if provided
    TEMPLATE_PATH="${TEMPLATE%.md}"
    # Check with and without .md
    if [ -f "$TEMPLATE_PATH" ]; then
        TEMPLATE_FILE="$TEMPLATE_PATH"
    elif [ -f "${TEMPLATE_PATH}.md" ]; then
        TEMPLATE_FILE="${TEMPLATE_PATH}.md"
    fi
else
    # 2. Search in precedence order: current dir -> ~/.claude/prompts -> git parent
    SEARCH_DIRS=(
        "$(pwd)"
        "$HOME/.claude/prompts"
    )
    [ -d "$GIT_PARENT_PROMPTS" ] && SEARCH_DIRS+=("$GIT_PARENT_PROMPTS")
    
    # Try exact match first (case-insensitive)
    for dir in "${SEARCH_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            # Use rg with null-separated output for safety
            FOUND=$(rg --files-with-matches --null --glob "*.md" "^" "$dir" 2>/dev/null | \
                    xargs -0 basename -a 2>/dev/null | \
                    rg -ix "${TEMPLATE}\.md" | head -1 || true)
            if [ -n "$FOUND" ]; then
                TEMPLATE_FILE="$dir/${FOUND}"
                break
            fi
        fi
    done
    
    # 3. If no exact match, try fuzzy matching
    if [ -z "$TEMPLATE_FILE" ]; then
        # Collect all potential matches
        MATCHES=""
        for dir in "${SEARCH_DIRS[@]}"; do
            if [ -d "$dir" ]; then
                DIR_MATCHES=$(rg --files --glob "*.md" "$dir" 2>/dev/null | \
                              rg -i "$TEMPLATE" || true)
                [ -n "$DIR_MATCHES" ] && MATCHES="${MATCHES}${DIR_MATCHES}"$'\n'
            fi
        done
        
        # Remove empty lines and count
        MATCHES=$(echo "$MATCHES" | grep -v '^$' || true)
        MATCH_COUNT=$(echo "$MATCHES" | grep -c . 2>/dev/null || echo 0)
        
        if [ "$MATCH_COUNT" -eq 1 ]; then
            TEMPLATE_FILE=$(echo "$MATCHES" | head -1)
        elif [ "$MATCH_COUNT" -gt 1 ]; then
            echo "Multiple possible matches found for '$TEMPLATE':"
            echo "$MATCHES" | while read -r f; do
                [ -n "$f" ] && echo "  - $(basename "$f" .md) ($(dirname "$f"))"
            done
            echo -e "\nPlease be more specific or use exact template name."
            exit 1
        fi
    fi
fi

# Check if template was found
if [ -z "$TEMPLATE_FILE" ] || [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Template '$TEMPLATE' not found."
    echo -e "\nSearched in:"
    echo "  - Current directory (./*.md)"
    echo "  - User Claude prompts (~/.claude/prompts/*.md)"
    [ -n "$GIT_PARENT_PROMPTS" ] && echo "  - Git parent prompts ($GIT_PARENT_PROMPTS/*.md)"
    echo -e "\nUse '--list' to see available templates."
    
    # Suggest similar templates
    echo -e "\nSimilar templates:"
    for dir in "${SEARCH_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            rg --files --glob "*.md" "$dir" 2>/dev/null | while read -r f; do
                basename "$f" .md
            done
        fi
    done | rg -i "$TEMPLATE" | head -5 | sed 's/^/  - /' || echo "  (none found)"
    exit 1
fi

# Load and process template
TEMPLATE_CONTENT=$(cat "$TEMPLATE_FILE")

# Replace <prompt-context> with provided context
if [ -n "$CONTEXT" ]; then
    TEMPLATE_CONTENT="${TEMPLATE_CONTENT//<prompt-context>/$CONTEXT}"
fi

# Output the processed template for execution
echo "$TEMPLATE_CONTENT"
```

## After Template Discovery

Once the bash script above finds and outputs the template content:

1. **Read the template file content** that was output by the script
2. **Replace `<prompt-context>`** placeholders with the provided context arguments
3. **Execute the template as prompt instructions** - interpret the template content as natural language instructions to follow
4. **Return ONLY the execution result** - no meta-commentary about loading or executing

## Output Requirements
- Direct execution result only
- No preamble like "The template was executed..."
- No meta-commentary about what happened
- Just the actual output from running the template