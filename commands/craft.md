---
description: Manage claude-craft repository and Claude Code configuration
allowed-tools: Bash, Read, Write
argument-hint: [action]
---

# Craft Command

Manage your claude-craft repository and Claude Code configuration.

## Usage

```
/craft [action]
```

## Actions

- `/craft` or `/craft sync` - Sync latest changes from repository (default action)
- `/craft setup` - Initial setup: clone repository and create all symlinks  
- `/craft push` - Add, commit, and push local changes to repository (includes security scan)
- `/craft status` - Show git status and symlink health
- `/craft clean` - Remove broken symlinks and recreate them
- `/craft scan` - Run security scan on memory files without pushing
- `/craft auto-sync [enable|disable|status]` - Manage automatic synchronization

## Examples

```bash
# Default sync - pull latest changes
/craft

# Explicit sync command
/craft sync

# Initial setup on new machine
/craft setup

# Commit and push your changes
/craft push "Added new security prompts"

# Check sync status
/craft status
```

## Implementation

```bash
#!/bin/bash
set -e

REPO_DIR="$HOME/claude-craft"
CLAUDE_DIR="$HOME/.claude"
ACTION="${1:-sync}"
CHANGES_DETECTED=false

# Colors for output  
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Error handling
check_repo_exists() {
    if [ ! -d "$REPO_DIR" ]; then
        echo -e "${RED}❌ Error: claude-craft repository not found at $REPO_DIR${NC}"
        echo -e "${YELLOW}💡 Run: curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash${NC}"
        exit 1
    fi
    
    if [ ! -d "$REPO_DIR/.git" ]; then
        echo -e "${RED}❌ Error: $REPO_DIR exists but is not a git repository${NC}"
        echo -e "${YELLOW}💡 Delete $REPO_DIR and run the install command${NC}"
        exit 1
    fi
}

sync_directory() {
    local repo_subdir="$1"
    local claude_subdir="$2" 
    local file_pattern="$3"
    
    local repo_path="$REPO_DIR/$repo_subdir"
    local claude_path="$CLAUDE_DIR/$claude_subdir"
    
    # Create target directory
    mkdir -p "$claude_path"
    
    # Count existing symlinks before changes
    local before_count=$(find "$claude_path" -type l -lname "$repo_path/*" 2>/dev/null | wc -l)
    
    # Remove all existing claude-craft symlinks for this type
    find "$claude_path" -type l -lname "$repo_path/*" -delete 2>/dev/null || true
    
    # Create symlinks for all current files
    local after_count=0
    if [ -d "$repo_path" ]; then
        find "$repo_path" -name "$file_pattern" -type f | while read -r file; do
            local basename=$(basename "$file")
            ln -sf "$file" "$claude_path/$basename"
        done
        after_count=$(find "$repo_path" -name "$file_pattern" -type f 2>/dev/null | wc -l)
    fi
    
    # Track if changes occurred
    if [ "$before_count" -ne "$after_count" ]; then
        CHANGES_DETECTED=true
    fi
}

safe_merge_configs() {
    local config_changes=false
    
    # Create backup before changes
    if [ -x "$REPO_DIR/tools/backup.sh" ]; then
        "$REPO_DIR/tools/backup.sh" backup >/dev/null 2>&1
    fi
    
    # Merge settings if fragments exist and have changes
    if [ -d "$REPO_DIR/settings/fragments" ] && [ "$(ls -A "$REPO_DIR/settings/fragments" 2>/dev/null)" ]; then
        if [ -x "$REPO_DIR/tools/merge-settings.sh" ]; then
            "$REPO_DIR/tools/merge-settings.sh"
            config_changes=true
        fi
    fi
    
    # Add memory includes if they exist and have changes
    if [ -d "$REPO_DIR/memory" ] && { [ -d "$REPO_DIR/memory/fragments" ] || [ -d "$REPO_DIR/memory/includes" ]; }; then
        if [ "$(ls -A "$REPO_DIR/memory/fragments" "$REPO_DIR/memory/includes" 2>/dev/null)" ]; then
            if [ -x "$REPO_DIR/tools/add-memory.sh" ]; then
                "$REPO_DIR/tools/add-memory.sh"
                config_changes=true
            fi
        fi
    fi
    
    # Create symlink for hook scripts
    if [ -d "$REPO_DIR/hooks/scripts" ] && [ "$(ls -A "$REPO_DIR/hooks/scripts" 2>/dev/null)" ]; then
        mkdir -p "$CLAUDE_DIR/hooks"
        local hooks_before=$(find "$CLAUDE_DIR/hooks" -name "*.sh" -type l 2>/dev/null | wc -l)
        find "$REPO_DIR/hooks/scripts" -name "*.sh" -type f | while read -r hook; do
            local basename=$(basename "$hook")
            ln -sf "$hook" "$CLAUDE_DIR/hooks/$basename"
        done
        local hooks_after=$(find "$CLAUDE_DIR/hooks" -name "*.sh" -type l 2>/dev/null | wc -l)
        if [ "$hooks_before" -ne "$hooks_after" ]; then
            config_changes=true
        fi
    fi
    
    # Track config changes for restart reminder
    if [ "$config_changes" = true ]; then
        CHANGES_DETECTED=true
    fi
}

case "$ACTION" in
    "setup")
        echo -e "${YELLOW}🚀 Setting up claude-craft...${NC}"
        
        # Clone if needed
        if [ ! -d "$REPO_DIR" ]; then
            echo -e "${YELLOW}📥 Cloning repository...${NC}"
            if ! git clone https://github.com/whichguy/claude-craft.git "$REPO_DIR"; then
                echo -e "${RED}❌ Failed to clone repository${NC}"
                exit 1
            fi
            
            # Make tools executable
            if [ -d "$REPO_DIR/tools" ]; then
                chmod +x "$REPO_DIR/tools"/*.sh 2>/dev/null || true
            fi
            
            # Install git hooks for security
            if [ -x "$REPO_DIR/tools/install-git-hooks.sh" ]; then
                echo -e "${BLUE}🪝 Installing security git hooks...${NC}"
                (cd "$REPO_DIR" && "$REPO_DIR/tools/install-git-hooks.sh")
            fi
        fi
        
        # Sync standalone directories
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        
        # Safe merge of single-file configurations
        safe_merge_configs
        
        echo -e "${GREEN}✅ Setup complete!${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Restart Claude Code to load new commands/agents/hooks${NC}"
        ;;
        
    "sync")
        check_repo_exists
        
        echo -e "${YELLOW}📥 Syncing claude-craft...${NC}"
        
        # Use secure git if available
        if [ -f "$REPO_DIR/tools/secure-git.sh" ]; then
            echo -e "${BLUE}🔒 Using secure git pull with threat analysis...${NC}"
            if ! (cd "$REPO_DIR" && "$REPO_DIR/tools/secure-git.sh" pull origin main); then
                echo -e "${RED}❌ Failed to sync repository${NC}"
                echo -e "${YELLOW}💡 Security threats may have been detected, check ~/.git-security.log${NC}"
                exit 1
            fi
        else
            if ! (cd "$REPO_DIR" && git pull); then
                echo -e "${RED}❌ Failed to sync repository${NC}"
                echo -e "${YELLOW}💡 Check your internet connection or run: /craft clean${NC}"
                exit 1
            fi
        fi
        
        # Re-sync standalone directories to handle file lifecycle changes
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        
        # Safe merge configurations
        safe_merge_configs
        
        echo -e "${GREEN}✅ Sync complete!${NC}"
        
        if [ "$CHANGES_DETECTED" = true ]; then
            echo -e "${YELLOW}⚠️  IMPORTANT: Changes detected - restart Claude Code to reload components${NC}"
        fi
        ;;
        
    "push")
        check_repo_exists
        
        echo -e "${YELLOW}🛡️  Running security scan before push...${NC}"
        cd "$REPO_DIR"
        
        # Run security scan on memory files
        if [ -d "memory/fragments" ]; then
            if ! ./tools/security-scan.sh memory/fragments full true; then
                echo -e "${RED}❌ Security scan failed! Cannot push with security issues.${NC}"
                echo -e "${YELLOW}💡 Fix the issues above and try again${NC}"
                exit 1
            fi
        fi
        
        echo -e "${YELLOW}📤 Pushing changes...${NC}"
        
        # Check if there are changes to commit
        if git diff --quiet && git diff --cached --quiet; then
            echo -e "${YELLOW}⚠️  No changes to push${NC}"
            exit 0
        fi
        
        if ! git add -A; then
            echo -e "${RED}❌ Failed to stage changes${NC}"
            exit 1
        fi
        
        if ! git commit -m "${2:-Update claude-craft components}"; then
            echo -e "${RED}❌ Failed to commit changes${NC}"
            exit 1
        fi
        
        if ! git push; then
            echo -e "${RED}❌ Failed to push changes${NC}"
            echo -e "${YELLOW}💡 Check your GitHub permissions and network connection${NC}"
            exit 1
        fi
        
        # Re-sync after push in case of any changes
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        
        # Safe merge configurations
        safe_merge_configs
        
        echo -e "${GREEN}✅ Changes pushed!${NC}"
        
        if [ "$CHANGES_DETECTED" = true ]; then
            echo -e "${YELLOW}⚠️  IMPORTANT: Changes detected - restart Claude Code to reload components${NC}"
        fi
        ;;
        
    "status")
        check_repo_exists
        
        echo -e "${YELLOW}📊 Claude Craft Status${NC}"
        echo -e "${YELLOW}Repository: $REPO_DIR${NC}"
        
        if ! (cd "$REPO_DIR" && git status --short); then
            echo -e "${RED}❌ Failed to get git status${NC}"
        fi
        
        echo ""
        echo "Active symlinks:"
        for dir in commands agents hooks; do
            if [ -d "$CLAUDE_DIR/$dir" ]; then
                echo "  $dir/:"
                find "$CLAUDE_DIR/$dir" -type l -lname "$REPO_DIR/$dir/*" 2>/dev/null | sed 's|.*/||' | sort | sed 's/^/    /' || true
            fi
        done
        
        echo ""
        echo -e "${YELLOW}Configuration files:${NC}"
        [ -f "$CLAUDE_DIR/settings.json" ] && echo -e "  settings.json: ${GREEN}✅${NC}" || echo -e "  settings.json: ${RED}❌${NC}"
        [ -f "$CLAUDE_DIR/CLAUDE.md" ] && echo -e "  CLAUDE.md: ${GREEN}✅${NC}" || echo -e "  CLAUDE.md: ${RED}❌${NC}"
        
        if [ -d "$CLAUDE_DIR/backups" ]; then
            local backup_count=$(ls -1 "$CLAUDE_DIR/backups" 2>/dev/null | wc -l)
            echo -e "  backups: ${GREEN}$backup_count files${NC}"
        else
            echo -e "  backups: ${YELLOW}no backup directory${NC}"
        fi
        ;;
        
    "clean")
        check_repo_exists
        
        echo -e "${YELLOW}🧹 Full symlink refresh...${NC}"
        
        # Remove ALL broken symlinks from Claude directories
        if [ -d "$CLAUDE_DIR" ]; then
            find "$CLAUDE_DIR" -type l ! -exec test -e {} \; -delete 2>/dev/null || true
            echo -e "${GREEN}✅ Removed broken symlinks${NC}"
        fi
        
        # Re-sync all directories from scratch
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        
        # Safe merge configurations
        safe_merge_configs
        
        echo -e "${GREEN}✅ Cleanup complete!${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Restart Claude Code to reload all components${NC}"
        ;;
        
    "scan")
        check_repo_exists
        
        echo -e "${YELLOW}🛡️  Running security scan...${NC}"
        cd "$REPO_DIR"
        
        if [ -d "memory/fragments" ]; then
            ./tools/security-scan.sh memory/fragments full false
            echo -e "${GREEN}✅ Security scan complete${NC}"
        else
            echo -e "${YELLOW}⚠️  No memory/fragments directory found${NC}"
        fi
        ;;
        
    "auto-sync")
        check_repo_exists
        
        # Handle auto-sync subcommands
        SYNC_ACTION="${2:-status}"
        
        # Initialize configuration if needed
        if [ -x "$REPO_DIR/tools/claude-craft-config.sh" ]; then
            "$REPO_DIR/tools/claude-craft-config.sh" init >/dev/null 2>&1
            "$REPO_DIR/tools/claude-craft-config.sh" set-repo "$REPO_DIR" >/dev/null 2>&1
        fi
        
        # Execute auto-sync command
        if [ -x "$REPO_DIR/tools/auto-sync.sh" ]; then
            case "$SYNC_ACTION" in
                "enable")
                    "$REPO_DIR/tools/auto-sync.sh" enable
                    # Reminder is now shown by auto-sync.sh itself
                    ;;
                "disable")
                    "$REPO_DIR/tools/auto-sync.sh" disable
                    # Reminder is now shown by auto-sync.sh itself
                    ;;
                "status")
                    "$REPO_DIR/tools/auto-sync.sh" status
                    ;;
                "force")
                    "$REPO_DIR/tools/auto-sync.sh" force
                    ;;
                *)
                    echo -e "${RED}❌ Unknown auto-sync action: $SYNC_ACTION${NC}"
                    echo -e "${YELLOW}Usage: /craft auto-sync [enable|disable|status|force]${NC}"
                    ;;
            esac
        else
            echo -e "${RED}❌ Auto-sync tool not found${NC}"
            echo -e "${YELLOW}💡 Pull latest changes: /craft sync${NC}"
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Unknown action: $ACTION${NC}"
        echo -e "${YELLOW}Usage: /craft [setup|sync|push|status|clean|scan|auto-sync]${NC}"
        echo ""
        echo -e "${YELLOW}Available commands:${NC}"
        echo -e "  ${GREEN}/craft${NC} or ${GREEN}/craft sync${NC}  - Sync latest changes (default)"
        echo -e "  ${GREEN}/craft setup${NC}             - Initial setup and clone"
        echo -e "  ${GREEN}/craft push \"message\"${NC}    - Commit and push changes (with security scan)"
        echo -e "  ${GREEN}/craft auto-sync${NC}         - Manage automatic synchronization" 
        echo -e "  ${GREEN}/craft status${NC}            - Show repository and config status"
        echo -e "  ${GREEN}/craft clean${NC}             - Clean and refresh all symlinks"
        echo -e "  ${GREEN}/craft scan${NC}              - Run security scan on memory files"
        exit 1
        ;;
esac
```

## Workflow

1. **Initial Setup**: `/craft setup` - Clone repo and create symlinks
2. **Daily Use**: `/craft` - Sync latest changes (default action)
3. **Add Content**: Edit files in `~/claude-craft/`, then `/craft push`
4. **Troubleshoot**: `/craft status` and `/craft clean` as needed