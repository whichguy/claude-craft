#!/bin/bash
set -e

# Claude Craft Settings Merger
# Safely merges claude-craft settings into existing ~/.claude/settings.json

# Use environment variable if set, otherwise default to ~/.claude
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
CRAFT_SETTINGS_DIR="$HOME/claude-craft/settings"
BACKUP_DIR="$CLAUDE_DIR/backups"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Error handling
cleanup_temp_files() {
    rm -f /tmp/claude-craft-merge.* 2>/dev/null || true
}

trap cleanup_temp_files EXIT

check_dependencies() {
    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: jq is required but not installed${NC}"
        echo "Please install jq: brew install jq (macOS) or apt-get install jq (Linux)"
        exit 1
    fi
}

create_backup() {
    if [ -f "$SETTINGS_FILE" ]; then
        echo -e "${YELLOW}📦 Creating backup of existing settings...${NC}"
        mkdir -p "$BACKUP_DIR"
        local backup_name="settings-$(date +%Y%m%d-%H%M%S).json"
        cp "$SETTINGS_FILE" "$BACKUP_DIR/$backup_name"
        echo -e "${GREEN}✅ Backed up existing settings to: backup-$backup_name${NC}"
    fi
}

validate_fragment() {
    local fragment="$1"
    if ! jq empty "$fragment" 2>/dev/null; then
        echo -e "${RED}❌ Error: Invalid JSON in fragment: $(basename "$fragment")${NC}"
        return 1
    fi
    return 0
}

merge_json_fragments() {
    local temp_file=$(mktemp /tmp/claude-craft-merge.XXXXXX)
    local existing_settings="{}"
    
    # Load existing settings if they exist and validate
    if [ -f "$SETTINGS_FILE" ]; then
        if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
            echo -e "${RED}❌ Error: Existing settings.json is invalid JSON${NC}"
            exit 1
        fi
        existing_settings=$(cat "$SETTINGS_FILE")
    fi
    
    # Start with existing settings
    echo "$existing_settings" > "$temp_file"
    
    # Check if fragments directory exists
    if [ ! -d "$CRAFT_SETTINGS_DIR/fragments" ]; then
        echo -e "${YELLOW}⚠️  No settings fragments directory found: $CRAFT_SETTINGS_DIR/fragments${NC}"
        return 0
    fi
    
    # Check if any fragments exist
    if ! ls "$CRAFT_SETTINGS_DIR/fragments"/*.json >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  No JSON fragments found in: $CRAFT_SETTINGS_DIR/fragments${NC}"
        return 0
    fi
    
    # Merge each fragment from settings/fragments/
    for fragment in "$CRAFT_SETTINGS_DIR/fragments"/*.json; do
        if [ -f "$fragment" ]; then
            echo -e "${YELLOW}📦 Validating: $(basename "$fragment")${NC}"
            if ! validate_fragment "$fragment"; then
                echo -e "${RED}❌ Skipping invalid fragment: $(basename "$fragment")${NC}"
                continue
            fi
            
            echo -e "${YELLOW}📦 Merging: $(basename "$fragment")${NC}"
            # Use jq to deep merge, with craft fragments taking precedence for conflicts
            if ! jq -s '.[0] * .[1]' "$temp_file" "$fragment" > "${temp_file}.new"; then
                echo -e "${RED}❌ Error merging fragment: $(basename "$fragment")${NC}"
                exit 1
            fi
            mv "${temp_file}.new" "$temp_file"
        fi
    done
    
    # Ensure ~/.claude directory exists
    mkdir -p "$CLAUDE_DIR"
    
    # Write final merged settings
    if ! mv "$temp_file" "$SETTINGS_FILE"; then
        echo -e "${RED}❌ Error: Failed to write merged settings${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Settings merged successfully${NC}"
}

validate_json() {
    if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
        echo -e "${RED}❌ Invalid JSON in settings file! Restoring backup...${NC}"
        
        # Find most recent backup
        if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR"/settings-*.json 2>/dev/null)" ]; then
            local latest_backup=$(ls -1t "$BACKUP_DIR"/settings-*.json 2>/dev/null | head -1)
            if [ -f "$latest_backup" ]; then
                cp "$latest_backup" "$SETTINGS_FILE"
                echo -e "${YELLOW}⚠️  Restored from: $(basename "$latest_backup")${NC}"
            else
                echo -e "${RED}❌ No valid backup found${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ No backups available for restoration${NC}"
            exit 1
        fi
        exit 1
    fi
}

main() {
    echo -e "${YELLOW}🔧 Merging Claude Craft settings...${NC}"
    
    # Check dependencies first
    check_dependencies
    
    # Validate input paths
    if [ ! -d "$HOME/claude-craft" ]; then
        echo -e "${RED}❌ Error: claude-craft repository not found at $HOME/claude-craft${NC}"
        echo "Please run 'curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash' first"
        exit 1
    fi
    
    # Create backup before any changes
    create_backup
    
    # Merge JSON fragments
    merge_json_fragments
    
    # Validate the result
    validate_json
    
    echo -e "${GREEN}✅ Settings merge complete!${NC}"
    echo -e "${YELLOW}📁 Settings file: $SETTINGS_FILE${NC}"
    
    if [ -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}💾 Backups available in: $BACKUP_DIR${NC}"
    fi
}

main "$@"