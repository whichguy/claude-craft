#!/bin/bash
set -e

echo "🗑️  Claude Craft Uninstaller"

REPO_DIR="$HOME/claude-craft"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/backups"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
DRY_RUN=false
FORCE_YES=false
REMOVE_REPO=true
REMOVE_COMMANDS=true
REMOVE_SYMLINKS=true
REMOVE_HOOKS=false
RESTORE_BACKUP=false
CLEAN_BACKUPS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --yes|-y)
            FORCE_YES=true
            shift
            ;;
        --keep-repo)
            REMOVE_REPO=false
            shift
            ;;
        --keep-commands)
            REMOVE_COMMANDS=false
            shift
            ;;
        --remove-hooks)
            REMOVE_HOOKS=true
            shift
            ;;
        --restore-backup)
            RESTORE_BACKUP=true
            shift
            ;;
        --clean-backups)
            CLEAN_BACKUPS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run           Show what would be removed without actually removing"
            echo "  --yes, -y           Skip confirmation prompts"
            echo "  --keep-repo         Don't remove ~/claude-craft repository"
            echo "  --keep-commands     Don't remove global commands"
            echo "  --remove-hooks      Also remove git security hooks"
            echo "  --restore-backup    Restore from latest backup before uninstalling"
            echo "  --clean-backups     Remove claude-craft backup files"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --dry-run                    # Preview what would be removed"
            echo "  $0 --yes --remove-hooks         # Full removal without prompts"
            echo "  $0 --restore-backup --yes       # Restore backup then uninstall"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Logging function
log_action() {
    local action="$1"
    local target="$2"
    local status="$3"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN]${NC} Would $action: $target"
    else
        case "$status" in
            "success")
                echo -e "${GREEN}✅ $action: $target${NC}"
                ;;
            "skipped")
                echo -e "${YELLOW}⏭️  Skipped $action: $target${NC}"
                ;;
            "failed")
                echo -e "${RED}❌ Failed to $action: $target${NC}"
                ;;
            *)
                echo -e "${YELLOW}🔄 $action: $target${NC}"
                ;;
        esac
    fi
}

# Check if claude-craft is installed
check_installation() {
    local found_items=0
    
    echo -e "${YELLOW}🔍 Checking Claude Craft installation...${NC}"
    
    if [ -d "$REPO_DIR" ]; then
        echo "  📁 Repository found: $REPO_DIR"
        found_items=$((found_items + 1))
    fi
    
    if [ -f "$CLAUDE_DIR/commands/alias.md" ] || [ -f "$CLAUDE_DIR/commands/unalias.md" ] || [ -f "$CLAUDE_DIR/commands/agent-sync.md" ]; then
        echo "  📋 Global commands found in ~/.claude/commands/"
        found_items=$((found_items + 1))
    fi
    
    # Find claude-craft symlinks (flexible path matching)
    local symlink_count=0
    if [ -d "$CLAUDE_DIR" ]; then
        symlink_count=$(find "$CLAUDE_DIR" -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || true)
    fi
    if [ "$symlink_count" -gt 0 ]; then
        echo "  🔗 Found $symlink_count claude-craft symlinks"
        found_items=$((found_items + 1))
    fi
    
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR" 2>/dev/null | wc -l)" -gt 0 ]; then
        echo "  💾 Backups found in ~/.claude/backups/"
        found_items=$((found_items + 1))
    fi
    
    if [ "$found_items" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No Claude Craft installation found${NC}"
        exit 0
    fi
    
    echo -e "${GREEN}Found Claude Craft installation with $found_items components${NC}"
    echo ""
}

# Show what will be removed
show_removal_plan() {
    echo -e "${YELLOW}📋 Removal Plan:${NC}"
    echo ""
    
    if [ "$RESTORE_BACKUP" = true ]; then
        echo -e "${BLUE}🔄 Restore from backup:${NC}"
        if [ -d "$BACKUP_DIR" ]; then
            local latest_backup=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -n1)
            if [ -n "$latest_backup" ]; then
                echo "  • Latest backup: $latest_backup"
            else
                echo "  • No backups found"
            fi
        else
            echo "  • No backup directory found"
        fi
        echo ""
    fi
    
    if [ "$REMOVE_REPO" = true ]; then
        echo -e "${RED}🗑️  Repository removal:${NC}"
        echo "  • Remove ~/claude-craft directory"
        echo ""
    fi
    
    if [ "$REMOVE_COMMANDS" = true ]; then
        echo -e "${RED}📋 Global command removal:${NC}"
        [ -f "$CLAUDE_DIR/commands/alias.md" ] && echo "  • Remove /alias command"
        [ -f "$CLAUDE_DIR/commands/unalias.md" ] && echo "  • Remove /unalias command"  
        [ -f "$CLAUDE_DIR/commands/agent-sync.md" ] && echo "  • Remove /agent-sync command"
        echo ""
    fi
    
    if [ "$REMOVE_SYMLINKS" = true ]; then
        echo -e "${RED}🔗 Symlink removal:${NC}"
        local symlink_count=0
        if [ -d "$CLAUDE_DIR" ]; then
            symlink_count=$(find "$CLAUDE_DIR" -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
        fi
        echo "  • Remove $symlink_count claude-craft symlinks from ~/.claude/"
        echo ""
    fi
    
    if [ "$REMOVE_HOOKS" = true ]; then
        echo -e "${RED}🪝 Git hooks removal:${NC}"
        echo "  • Remove git security hooks from ~/claude-craft/.git/hooks/"
        echo ""
    fi
    
    if [ "$CLEAN_BACKUPS" = true ]; then
        echo -e "${RED}💾 Backup cleanup:${NC}"
        echo "  • Remove claude-craft backup files"
        echo ""
    fi
    
    echo -e "${YELLOW}📝 Note: This will NOT remove:${NC}"
    echo "  • Your original ~/.claude/settings.json (will remain unchanged)"
    echo "  • Your original ~/.claude/CLAUDE.md (will remain unchanged)"
    echo "  • Manually created commands or configurations"
    echo ""
}

# Confirmation prompt
confirm_removal() {
    if [ "$FORCE_YES" = true ]; then
        return 0
    fi
    
    echo -e "${RED}⚠️  WARNING: This will remove Claude Craft from your system${NC}"
    echo ""
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}This is a dry run - nothing will actually be removed${NC}"
        return 0
    fi
    
    while true; do
        echo -n "Are you sure you want to continue? (y/N): "
        read -r response
        case "$response" in
            [Yy]|[Yy][Ee][Ss])
                return 0
                ;;
            [Nn]|[Nn][Oo]|"")
                echo "Uninstallation cancelled"
                exit 0
                ;;
            *)
                echo "Please answer yes or no"
                ;;
        esac
    done
}

# Restore from backup
restore_from_backup() {
    if [ "$RESTORE_BACKUP" != true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}🔄 Restoring from backup...${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_action "restore backup" "no backup directory found" "skipped"
        return 0
    fi
    
    local latest_backup=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -n1)
    if [ -z "$latest_backup" ]; then
        log_action "restore backup" "no backups found" "skipped"
        return 0
    fi
    
    local backup_path="$BACKUP_DIR/$latest_backup"
    
    if [ "$DRY_RUN" = false ]; then
        if [ -x "$REPO_DIR/tools/backup.sh" ]; then
            "$REPO_DIR/tools/backup.sh" restore "$latest_backup" || {
                log_action "restore backup" "$latest_backup" "failed"
                return 1
            }
        fi
    fi
    
    log_action "restore backup" "$latest_backup" "success"
}

# Remove repository
remove_repository() {
    if [ "$REMOVE_REPO" != true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}🗑️  Removing repository...${NC}"
    
    if [ ! -d "$REPO_DIR" ]; then
        log_action "remove repository" "$REPO_DIR" "skipped"
        return 0
    fi
    
    if [ "$DRY_RUN" = false ]; then
        rm -rf "$REPO_DIR" || {
            log_action "remove repository" "$REPO_DIR" "failed"
            return 1
        }
    fi
    
    log_action "remove repository" "$REPO_DIR" "success"
}

# Remove global commands
remove_global_commands() {
    if [ "$REMOVE_COMMANDS" != true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}📋 Removing global commands...${NC}"
    
    local commands=("alias.md" "unalias.md" "agent-sync.md")
    local removed_count=0
    
    for cmd in "${commands[@]}"; do
        local cmd_path="$CLAUDE_DIR/commands/$cmd"
        if [ -f "$cmd_path" ]; then
            # Check if it's a claude-craft generated file
            if grep -q "alias-generated: true" "$cmd_path" 2>/dev/null || 
               grep -q "Claude Craft" "$cmd_path" 2>/dev/null ||
               [ "$cmd" = "agent-sync.md" ]; then
                
                if [ "$DRY_RUN" = false ]; then
                    rm -f "$cmd_path" || {
                        log_action "remove command" "/$cmd" "failed"
                        continue
                    }
                fi
                
                log_action "remove command" "/${cmd%.md}" "success"
                removed_count=$((removed_count + 1))
            else
                log_action "remove command" "/${cmd%.md} (not claude-craft generated)" "skipped"
            fi
        else
            log_action "remove command" "/${cmd%.md} (not found)" "skipped"
        fi
    done
    
    if [ "$removed_count" -eq 0 ]; then
        echo -e "${YELLOW}  No claude-craft global commands found to remove${NC}"
    fi
}

# Remove symlinks
remove_symlinks() {
    if [ "$REMOVE_SYMLINKS" != true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}🔗 Removing symlinks...${NC}"
    
    local removed_count=0
    
    # Find and remove claude-craft symlinks (flexible path matching)
    if [ -d "$CLAUDE_DIR" ]; then
        while IFS= read -r symlink; do
            # Check if symlink target contains "claude-craft"
            local target
            target=$(readlink "$symlink" 2>/dev/null || true)
            if [[ "$target" == *"claude-craft"* ]]; then
                if [ "$DRY_RUN" = false ]; then
                    rm -f "$symlink" || {
                        log_action "remove symlink" "$(basename "$symlink")" "failed"
                        continue
                    }
                fi
                
                log_action "remove symlink" "$(basename "$symlink")" "success"
                removed_count=$((removed_count + 1))
            fi
        done < <(find "$CLAUDE_DIR" -type l 2>/dev/null || true)
    fi
    
    if [ "$removed_count" -eq 0 ]; then
        echo -e "${YELLOW}  No claude-craft symlinks found to remove${NC}"
    fi
}

# Remove git hooks
remove_git_hooks() {
    if [ "$REMOVE_HOOKS" != true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}🪝 Removing git hooks...${NC}"
    
    local hooks_dir="$REPO_DIR/.git/hooks"
    local hooks=("pre-commit" "post-merge")
    local removed_count=0
    
    if [ ! -d "$hooks_dir" ]; then
        log_action "remove git hooks" "no .git/hooks directory" "skipped"
        return 0
    fi
    
    for hook in "${hooks[@]}"; do
        local hook_path="$hooks_dir/$hook"
        if [ -f "$hook_path" ]; then
            # Check if it's a claude-craft hook
            if grep -q "claude-craft" "$hook_path" 2>/dev/null; then
                if [ "$DRY_RUN" = false ]; then
                    rm -f "$hook_path" || {
                        log_action "remove git hook" "$hook" "failed"
                        continue
                    }
                fi
                
                log_action "remove git hook" "$hook" "success"
                removed_count=$((removed_count + 1))
            else
                log_action "remove git hook" "$hook (not claude-craft)" "skipped"
            fi
        else
            log_action "remove git hook" "$hook (not found)" "skipped"
        fi
    done
    
    if [ "$removed_count" -eq 0 ]; then
        echo -e "${YELLOW}  No claude-craft git hooks found to remove${NC}"
    fi
}

# Clean backups
clean_backups() {
    if [ "$CLEAN_BACKUPS" != true ]; then
        return 0
    fi
    
    echo -e "${YELLOW}💾 Cleaning backup files...${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_action "clean backups" "no backup directory" "skipped"
        return 0
    fi
    
    local backup_count=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)
    if [ "$backup_count" -eq 0 ]; then
        log_action "clean backups" "no backup files found" "skipped"
        return 0
    fi
    
    if [ "$DRY_RUN" = false ]; then
        rm -rf "$BACKUP_DIR" || {
            log_action "clean backups" "$BACKUP_DIR" "failed"
            return 1
        }
    fi
    
    log_action "clean backups" "$backup_count backup files" "success"
}

# Main execution
main() {
    echo ""
    
    # Check installation
    check_installation
    
    # Show removal plan
    show_removal_plan
    
    # Get confirmation
    confirm_removal
    
    echo ""
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}🧪 DRY RUN MODE - No actual changes will be made${NC}"
    else
        echo -e "${YELLOW}🔄 Starting Claude Craft uninstallation...${NC}"
    fi
    echo ""
    
    # Execute removal steps
    restore_from_backup
    remove_symlinks
    remove_global_commands
    remove_git_hooks
    remove_repository
    clean_backups
    
    echo ""
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}✅ Dry run completed - showed what would be removed${NC}"
        echo -e "${YELLOW}Run without --dry-run to actually remove Claude Craft${NC}"
    else
        echo -e "${GREEN}✅ Claude Craft uninstallation complete!${NC}"
        echo ""
        echo -e "${YELLOW}📝 Next steps:${NC}"
        echo "  1. Restart Claude Code to apply changes"
        echo "  2. Your original settings and configurations remain untouched"
        if [ "$CLEAN_BACKUPS" != true ]; then
            echo "  3. Backups are preserved in ~/.claude/backups/ if you need to restore"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}Thank you for trying Claude Craft! 🚀${NC}"
}

# Run main function
main