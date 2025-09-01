#!/bin/bash
set -e

# Claude Craft Memory Manager
# Safely adds claude-craft memory fragments to ~/.claude/CLAUDE.md

# Use environment variable if set, otherwise default to ~/.claude
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
MEMORY_FILE="$CLAUDE_DIR/CLAUDE.md"
CRAFT_MEMORY_DIR="$HOME/claude-craft/memory"
BACKUP_DIR="$CLAUDE_DIR/backups"
CRAFT_MARKER="# === Claude Craft Extensions ==="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Error handling
cleanup_temp_files() {
    rm -f /tmp/claude-craft-memory.* 2>/dev/null || true
}

trap cleanup_temp_files EXIT

create_backup() {
    if [ -f "$MEMORY_FILE" ]; then
        mkdir -p "$BACKUP_DIR"
        local backup_name="CLAUDE-$(date +%Y%m%d-%H%M%S).md"
        cp "$MEMORY_FILE" "$BACKUP_DIR/$backup_name"
        echo -e "${GREEN}✅ Backed up existing memory to: $backup_name${NC}"
    fi
}

validate_memory_file() {
    local file="$1"
    if [ ! -f "$file" ]; then
        return 0  # Empty/missing files are OK
    fi
    
    # Basic markdown validation - check if file is readable
    if ! head -1 "$file" >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: Cannot read memory file: $file${NC}"
        return 1
    fi
    return 0
}

count_memory_fragments() {
    local count=0
    
    # Count includes
    if [ -d "$CRAFT_MEMORY_DIR/includes" ] && ls "$CRAFT_MEMORY_DIR/includes"/*.md >/dev/null 2>&1; then
        count=$((count + $(ls -1 "$CRAFT_MEMORY_DIR/includes"/*.md 2>/dev/null | wc -l)))
    fi
    
    # Count fragments  
    if [ -d "$CRAFT_MEMORY_DIR/fragments" ] && ls "$CRAFT_MEMORY_DIR/fragments"/*.md >/dev/null 2>&1; then
        count=$((count + $(ls -1 "$CRAFT_MEMORY_DIR/fragments"/*.md 2>/dev/null | wc -l)))
    fi
    
    echo $count
}

add_craft_imports() {
    local temp_file=$(mktemp /tmp/claude-craft-memory.XXXXXX)
    
    # Check if we have any fragments to add
    local fragment_count=$(count_memory_fragments)
    if [ "$fragment_count" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No memory fragments found to import${NC}"
        return 0
    fi
    
    # Ensure ~/.claude directory exists
    mkdir -p "$CLAUDE_DIR"
    
    # Start with existing content if it exists
    if [ -f "$MEMORY_FILE" ]; then
        if ! validate_memory_file "$MEMORY_FILE"; then
            exit 1
        fi
        
        # Check if craft marker already exists
        if grep -q "$CRAFT_MARKER" "$MEMORY_FILE"; then
            echo -e "${YELLOW}📝 Claude Craft section already exists, updating...${NC}"
            # Remove existing craft section (everything after marker)
            if ! sed "/$CRAFT_MARKER/,\$d" "$MEMORY_FILE" > "$temp_file"; then
                echo -e "${RED}❌ Error: Failed to process existing memory file${NC}"
                exit 1
            fi
        else
            if ! cp "$MEMORY_FILE" "$temp_file"; then
                echo -e "${RED}❌ Error: Failed to copy existing memory file${NC}"
                exit 1
            fi
        fi
    fi
    
    # Add craft section
    echo "" >> "$temp_file"
    echo "$CRAFT_MARKER" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Add imports for includes
    if [ -d "$CRAFT_MEMORY_DIR/includes" ]; then
        for include in "$CRAFT_MEMORY_DIR/includes"/*.md; do
            if [ -f "$include" ]; then
                if validate_memory_file "$include"; then
                    local rel_path="@claude-craft/memory/includes/$(basename "$include")"
                    echo "$rel_path" >> "$temp_file"
                    echo -e "${YELLOW}📦 Added include: $(basename "$include")${NC}"
                else
                    echo -e "${RED}❌ Skipping invalid include: $(basename "$include")${NC}"
                fi
            fi
        done
    fi
    
    # Add imports for fragments
    if [ -d "$CRAFT_MEMORY_DIR/fragments" ]; then
        for fragment in "$CRAFT_MEMORY_DIR/fragments"/*.md; do
            if [ -f "$fragment" ]; then
                if validate_memory_file "$fragment"; then
                    local rel_path="@claude-craft/memory/fragments/$(basename "$fragment")"
                    echo "$rel_path" >> "$temp_file"
                    echo -e "${YELLOW}📦 Added fragment: $(basename "$fragment")${NC}"
                else
                    echo -e "${RED}❌ Skipping invalid fragment: $(basename "$fragment")${NC}"
                fi
            fi
        done
    fi
    
    # Move temp file to final location
    if ! mv "$temp_file" "$MEMORY_FILE"; then
        echo -e "${RED}❌ Error: Failed to write memory file${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Memory imports added successfully${NC}"
}

create_symlink_structure() {
    # Create claude-craft symlink in ~/.claude for relative imports
    local claude_craft_link="$CLAUDE_DIR/claude-craft"
    
    if [ ! -L "$claude_craft_link" ]; then
        ln -sf "$HOME/claude-craft" "$claude_craft_link"
        echo -e "${GREEN}🔗 Created claude-craft symlink for imports${NC}"
    fi
}

main() {
    echo -e "${YELLOW}🧠 Adding Claude Craft memory extensions...${NC}"
    
    # Validate input paths
    if [ ! -d "$HOME/claude-craft" ]; then
        echo -e "${RED}❌ Error: claude-craft repository not found at $HOME/claude-craft${NC}"
        echo "Please run 'curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash' first"
        exit 1
    fi
    
    if [ ! -d "$CRAFT_MEMORY_DIR" ]; then
        echo -e "${YELLOW}⚠️  No memory directory found: $CRAFT_MEMORY_DIR${NC}"
        echo -e "${YELLOW}💡 Create memory fragments in: $CRAFT_MEMORY_DIR/fragments/ or $CRAFT_MEMORY_DIR/includes/${NC}"
        exit 0
    fi
    
    # Create backup before any changes
    create_backup
    
    # Create symlink structure for imports
    create_symlink_structure
    
    # Add craft imports to memory
    add_craft_imports
    
    echo -e "${GREEN}✅ Memory extensions added!${NC}"
    echo -e "${YELLOW}📁 Memory file: $MEMORY_FILE${NC}"
    
    if [ -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}💾 Backups available in: $BACKUP_DIR${NC}"
    fi
}

main "$@"