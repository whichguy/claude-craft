#!/bin/bash

# Claude Craft Configuration Manager
# Manages the ~/.claude/claude-craft.json configuration file

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
CONFIG_FILE="$CLAUDE_DIR/claude-craft.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Initialize configuration file if it doesn't exist
init_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        # Try to detect repository location
        local repo_path=""
        
        # Check common locations
        for path in \
            "$HOME/src5/subagent-sync/claude-craft" \
            "$HOME/claude-craft" \
            "$HOME/projects/claude-craft" \
            "$HOME/src/claude-craft" \
            "$HOME/dev/claude-craft" \
            "$(pwd)"
        do
            if [ -d "$path/.git" ] && [ -f "$path/commands/craft.md" ]; then
                repo_path="$path"
                break
            fi
        done
        
        if [ -z "$repo_path" ]; then
            echo -e "${YELLOW}⚠️  Claude Craft repository not found${NC}"
            echo "Please run: /craft setup"
            return 1
        fi
        
        cat > "$CONFIG_FILE" <<EOF
{
  "repository": {
    "path": "$repo_path",
    "remote": "origin",
    "branch": "main"
  },
  "autoSync": {
    "enabled": false,
    "lastSync": null
  },
  "installation": {
    "date": "$(date -Iseconds)",
    "version": "1.0.0"
  }
}
EOF
        echo -e "${GREEN}✅ Created claude-craft configuration${NC}"
        echo "Repository: $repo_path"
    fi
}

# Get repository path
get_repo_path() {
    init_config
    
    if [ -f "$CONFIG_FILE" ]; then
        jq -r '.repository.path // ""' "$CONFIG_FILE" 2>/dev/null
    else
        echo ""
    fi
}

# Set repository path
set_repo_path() {
    local new_path="$1"
    
    # Validate path
    if [ ! -d "$new_path/.git" ] || [ ! -f "$new_path/commands/craft.md" ]; then
        echo -e "${RED}❌ Invalid claude-craft repository path${NC}" >&2
        return 1
    fi
    
    # Ensure config exists
    init_config
    
    # Update path
    local temp_file=$(mktemp)
    jq ".repository.path = \"$new_path\"" "$CONFIG_FILE" > "$temp_file" && \
        mv "$temp_file" "$CONFIG_FILE"
    
    echo -e "${GREEN}✅ Updated repository path${NC}"
    echo "New path: $new_path"
}

# Get configuration value
get_config() {
    local path="$1"
    local default="${2:-}"
    
    if [ -f "$CONFIG_FILE" ]; then
        jq -r "$path // \"$default\"" "$CONFIG_FILE" 2>/dev/null || echo "$default"
    else
        echo "$default"
    fi
}

# Set configuration value
set_config() {
    local path="$1"
    local value="$2"
    
    init_config
    
    local temp_file=$(mktemp)
    jq "$path = $value" "$CONFIG_FILE" > "$temp_file" && \
        mv "$temp_file" "$CONFIG_FILE"
}

# Show configuration
show_config() {
    echo -e "${BLUE}📋 Claude Craft Configuration${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ ! -f "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}⚠️  No configuration found${NC}"
        echo "Run: /craft setup"
        return 1
    fi
    
    echo "Configuration file: $CONFIG_FILE"
    echo ""
    
    local repo_path=$(get_config '.repository.path' 'not set')
    echo "Repository: $repo_path"
    
    if [ -d "$repo_path/.git" ]; then
        echo -e "  Status: ${GREEN}✓ Valid${NC}"
        
        # Show git status
        cd "$repo_path" 2>/dev/null && {
            local branch=$(git branch --show-current 2>/dev/null)
            echo "  Branch: $branch"
            
            local changes=$(git status --porcelain 2>/dev/null | wc -l)
            if [ "$changes" -gt 0 ]; then
                echo -e "  Changes: ${YELLOW}$changes uncommitted${NC}"
            else
                echo -e "  Changes: ${GREEN}Clean${NC}"
            fi
        }
    else
        echo -e "  Status: ${RED}✗ Invalid${NC}"
    fi
    
    echo ""
    echo "Auto-sync:"
    local auto_sync=$(get_config '.autoSync.enabled' 'false')
    if [ "$auto_sync" = "true" ]; then
        echo -e "  Enabled: ${GREEN}Yes${NC}"
    else
        echo -e "  Enabled: ${RED}No${NC}"
    fi
    
    local last_sync=$(get_config '.autoSync.lastSync' 'never')
    echo "  Last sync: $last_sync"
    
    echo ""
    echo "Installation:"
    echo "  Date: $(get_config '.installation.date' 'unknown')"
    echo "  Version: $(get_config '.installation.version' 'unknown')"
}

# Main command handler
main() {
    case "${1:-show}" in
        "init")
            init_config
            ;;
        "get-repo")
            get_repo_path
            ;;
        "set-repo")
            set_repo_path "$2"
            ;;
        "get")
            get_config "$2" "$3"
            ;;
        "set")
            set_config "$2" "$3"
            ;;
        "show")
            show_config
            ;;
        *)
            echo "Usage: $0 [init|get-repo|set-repo PATH|get PATH|set PATH VALUE|show]"
            echo ""
            echo "Commands:"
            echo "  init          - Initialize configuration"
            echo "  get-repo      - Get repository path"
            echo "  set-repo PATH - Set repository path"
            echo "  get PATH      - Get configuration value"
            echo "  set PATH VAL  - Set configuration value"
            echo "  show          - Show configuration"
            exit 1
            ;;
    esac
}

main "$@"