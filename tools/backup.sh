#!/bin/bash
set -e

# Claude Craft Backup Tool
# Creates backups of all Claude Code configuration files

# Use environment variable if set, otherwise default to ~/.claude
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
BACKUP_DIR="$CLAUDE_DIR/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

create_backup() {
    mkdir -p "$BACKUP_DIR"
    
    echo -e "${YELLOW}📦 Creating Claude Code configuration backup...${NC}"
    
    local backup_count=0
    
    # Backup settings.json
    if [ -f "$CLAUDE_DIR/settings.json" ]; then
        cp "$CLAUDE_DIR/settings.json" "$BACKUP_DIR/settings-$TIMESTAMP.json"
        echo -e "${GREEN}✅ Backed up settings.json${NC}"
        ((backup_count++))
    fi
    
    # Backup CLAUDE.md
    if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
        cp "$CLAUDE_DIR/CLAUDE.md" "$BACKUP_DIR/CLAUDE-$TIMESTAMP.md"
        echo -e "${GREEN}✅ Backed up CLAUDE.md${NC}"
        ((backup_count++))
    fi
    
    # Backup commands directory (create archive)
    if [ -d "$CLAUDE_DIR/commands" ]; then
        tar -czf "$BACKUP_DIR/commands-$TIMESTAMP.tar.gz" -C "$CLAUDE_DIR" commands/
        echo -e "${GREEN}✅ Backed up commands directory${NC}"
        ((backup_count++))
    fi
    
    # Backup any other important files
    for file in "$CLAUDE_DIR"/*.json "$CLAUDE_DIR"/*.md; do
        if [ -f "$file" ] && [[ "$file" != *"/settings.json" ]] && [[ "$file" != *"/CLAUDE.md" ]]; then
            local basename=$(basename "$file")
            cp "$file" "$BACKUP_DIR/${basename%.*}-$TIMESTAMP.${basename##*.}"
            echo -e "${GREEN}✅ Backed up $basename${NC}"
            ((backup_count++))
        fi
    done
    
    if [ $backup_count -gt 0 ]; then
        echo -e "${GREEN}✅ Backup complete! ($backup_count files)${NC}"
        echo -e "${YELLOW}📁 Backup location: $BACKUP_DIR${NC}"
        echo -e "${YELLOW}🕐 Timestamp: $TIMESTAMP${NC}"
    else
        echo -e "${YELLOW}⚠️  No Claude Code configuration files found to backup${NC}"
    fi
}

list_backups() {
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR")" ]; then
        echo -e "${YELLOW}📋 Available backups:${NC}"
        ls -la "$BACKUP_DIR" | grep -E "\.(json|md|tar\.gz)$" | awk '{print "  " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}'
    else
        echo -e "${YELLOW}📭 No backups found${NC}"
    fi
}

validate_timestamp() {
    local timestamp="$1"
    # Validate timestamp format: YYYYMMDD-HHMMSS
    if ! [[ "$timestamp" =~ ^[0-9]{8}-[0-9]{6}$ ]]; then
        echo -e "${RED}❌ Invalid timestamp format. Expected: YYYYMMDD-HHMMSS${NC}"
        return 1
    fi
    return 0
}

confirm_restore() {
    local timestamp="$1"
    echo -e "${YELLOW}⚠️  This will overwrite your current Claude Code configuration!${NC}"
    echo -e "${YELLOW}   Restoring backup from: $timestamp${NC}"
    echo ""
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Restore cancelled${NC}"
        return 1
    fi
    return 0
}

restore_backup() {
    local timestamp="$1"
    
    if [ -z "$timestamp" ]; then
        echo -e "${RED}❌ Please specify a timestamp to restore${NC}"
        echo -e "${YELLOW}Usage: $0 restore YYYYMMDD-HHMMSS${NC}"
        echo ""
        list_backups
        exit 1
    fi
    
    if ! validate_timestamp "$timestamp"; then
        echo -e "${YELLOW}Example: 20231201-143022${NC}"
        exit 1
    fi
    
    # Check if backup files exist
    local backup_files=()
    [ -f "$BACKUP_DIR/settings-$timestamp.json" ] && backup_files+=("settings.json")
    [ -f "$BACKUP_DIR/CLAUDE-$timestamp.md" ] && backup_files+=("CLAUDE.md")
    [ -f "$BACKUP_DIR/commands-$timestamp.tar.gz" ] && backup_files+=("commands/")
    
    if [ ${#backup_files[@]} -eq 0 ]; then
        echo -e "${RED}❌ No backup files found for timestamp: $timestamp${NC}"
        echo ""
        list_backups
        exit 1
    fi
    
    echo -e "${YELLOW}📦 Found backup files: ${backup_files[*]}${NC}"
    
    if ! confirm_restore "$timestamp"; then
        exit 0
    fi
    
    # Create backup of current state before restoring
    echo -e "${YELLOW}📥 Creating backup of current state...${NC}"
    create_backup
    
    echo -e "${YELLOW}🔄 Restoring backup from $timestamp...${NC}"
    
    local restored_count=0
    
    # Restore settings.json
    if [ -f "$BACKUP_DIR/settings-$timestamp.json" ]; then
        if cp "$BACKUP_DIR/settings-$timestamp.json" "$CLAUDE_DIR/settings.json"; then
            echo -e "${GREEN}✅ Restored settings.json${NC}"
            ((restored_count++))
        else
            echo -e "${RED}❌ Failed to restore settings.json${NC}"
        fi
    fi
    
    # Restore CLAUDE.md
    if [ -f "$BACKUP_DIR/CLAUDE-$timestamp.md" ]; then
        if cp "$BACKUP_DIR/CLAUDE-$timestamp.md" "$CLAUDE_DIR/CLAUDE.md"; then
            echo -e "${GREEN}✅ Restored CLAUDE.md${NC}"
            ((restored_count++))
        else
            echo -e "${RED}❌ Failed to restore CLAUDE.md${NC}"
        fi
    fi
    
    # Restore commands directory
    if [ -f "$BACKUP_DIR/commands-$timestamp.tar.gz" ]; then
        if [ -d "$CLAUDE_DIR/commands" ]; then
            rm -rf "$CLAUDE_DIR/commands"
        fi
        if tar -xzf "$BACKUP_DIR/commands-$timestamp.tar.gz" -C "$CLAUDE_DIR" 2>/dev/null; then
            echo -e "${GREEN}✅ Restored commands directory${NC}"
            ((restored_count++))
        else
            echo -e "${RED}❌ Failed to restore commands directory${NC}"
        fi
    fi
    
    if [ $restored_count -gt 0 ]; then
        echo -e "${GREEN}✅ Restore complete! ($restored_count items)${NC}"
        echo -e "${YELLOW}⚠️  Remember to restart Claude Code${NC}"
    else
        echo -e "${RED}❌ Restore failed - no files were restored${NC}"
        exit 1
    fi
}

cleanup_old_backups() {
    echo -e "${YELLOW}🧹 Cleaning up old backups (older than 2 months)...${NC}"
    
    local removed_count=0
    local current_timestamp=$(date +%s)
    local two_months_seconds=$((60 * 24 * 60 * 60))  # 60 days in seconds
    
    if [ -d "$BACKUP_DIR" ]; then
        for backup_file in "$BACKUP_DIR"/*; do
            if [ -f "$backup_file" ]; then
                # Extract timestamp from filename (format: YYYYMMDD-HHMMSS)
                local filename=$(basename "$backup_file")
                if [[ "$filename" =~ ([0-9]{8})-([0-9]{6}) ]]; then
                    local file_date="${BASH_REMATCH[1]}"
                    local file_time="${BASH_REMATCH[2]}"
                    
                    # Convert to comparable format
                    local year="${file_date:0:4}"
                    local month="${file_date:4:2}"
                    local day="${file_date:6:2}"
                    
                    # Get file timestamp in seconds since epoch
                    local file_timestamp=$(date -j -f "%Y%m%d" "$file_date" "+%s" 2>/dev/null || date -d "$year-$month-$day" "+%s" 2>/dev/null)
                    
                    if [ -n "$file_timestamp" ]; then
                        local age_seconds=$((current_timestamp - file_timestamp))
                        
                        if [ $age_seconds -gt $two_months_seconds ]; then
                            rm -f "$backup_file"
                            echo -e "${GREEN}  ✅ Removed old backup: $filename${NC}"
                            ((removed_count++))
                        fi
                    fi
                fi
            fi
        done
    fi
    
    if [ $removed_count -gt 0 ]; then
        echo -e "${GREEN}✅ Cleaned up $removed_count old backup(s)${NC}"
    else
        echo -e "${GREEN}✅ No old backups to remove${NC}"
    fi
}

main() {
    case "${1:-backup}" in
        "backup")
            create_backup
            cleanup_old_backups
            ;;
        "list")
            list_backups
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 [backup|list|restore TIMESTAMP|cleanup]"
            echo ""
            echo "Commands:"
            echo "  backup   - Create backup of all Claude Code configs (default) and cleanup old backups"
            echo "  list     - List available backups"
            echo "  restore  - Restore from specific backup timestamp"
            echo "  cleanup  - Remove backups older than 2 months"
            exit 1
            ;;
    esac
}

main "$@"