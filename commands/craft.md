---
description: Manage claude-craft repository and Claude Code configuration with smart local/global mode detection, extension publishing, and automatic synchronization
allowed-tools: Bash, Read, Write
argument-hint: [sync|setup|publish|push|status|clean|scan|auto-sync] [--local|--global]
---

# Craft Command

Comprehensive Claude Code configuration management with smart local/global detection, extension discovery and publishing, and seamless synchronization workflows.

## Usage

```
/craft [action] [flags]
```

**Smart Mode Detection**: Automatically detects local vs global mode based on current directory structure.
**Extension Publishing**: Discover and publish unpublished Claude Code extensions to repository.
**Flexible Workflows**: Support both project-specific (local) and centralized (global) configurations.

## Actions

- `/craft` or `/craft sync` - Smart sync: auto-detects local/global mode (default action)
- `/craft sync --local` - Force local-only sync (no git operations, current directory)
- `/craft sync --global` - Force global sync (from ~/claude-craft repository)
- `/craft setup` - Smart setup: auto-detects local/global mode
- `/craft setup --local` - Force local setup: create symlinks from current directory (no clone)
- `/craft setup --global` - Force global setup: clone repository and create symlinks
- `/craft push` - Add, commit, and push local changes to repository (includes security scan)
- `/craft publish` - Discover and publish unpublished Claude Code extensions
- `/craft status` - Show git status and symlink health
- `/craft clean` - Remove broken symlinks and recreate them
- `/craft scan` - Run security scan on memory files without pushing
- `/craft auto-sync [enable|disable|status]` - Manage automatic synchronization

## Examples

```bash
# Smart sync - auto-detects local/global mode
/craft

# Explicit smart sync command
/craft sync

# Force local-only sync (no git operations)
/craft sync --local

# Force global sync from ~/claude-craft
/craft sync --global

# Smart setup - auto-detects local/global mode
/craft setup

# Force local setup from current directory (no clone)
/craft setup --local

# Force global setup (clone repository)
/craft setup --global

# Commit and push your changes
/craft push "Added new security prompts"

# Discover and publish unpublished extensions
/craft publish

# Check sync status
/craft status
```

## Implementation

```bash
#!/bin/bash
set -e

# Parse arguments
ACTION="${1:-sync}"
LOCAL_FLAG=false

# Check for --local or --global flags in sync or setup command
if [ "$2" = "--local" ]; then
    LOCAL_FLAG=true
elif [ "$2" = "--global" ]; then
    LOCAL_FLAG=false
    echo -e "${YELLOW}🌐 Forcing global mode as requested${NC}"
fi

# Auto-detect local vs global mode if not explicitly specified
if [ "$LOCAL_FLAG" = false ] && [ "$2" != "--global" ]; then
    # Check for local claude-craft settings/structure
    if [ -d "$(pwd)/commands" ] || [ -d "$(pwd)/agents" ] || [ -d "$(pwd)/memory" ] || [ -d "$(pwd)/settings" ]; then
        LOCAL_FLAG=true
        echo -e "${YELLOW}🔍 Detected local claude-craft structure - using local mode${NC}"
    fi
fi

# Set repository directory based on local flag
if [ "$LOCAL_FLAG" = true ]; then
    REPO_DIR="$(pwd)"
    echo -e "${YELLOW}🏠 Using local directory: $REPO_DIR${NC}"
else
    REPO_DIR="$HOME/claude-craft"
    echo -e "${YELLOW}🌐 Using global directory: $REPO_DIR${NC}"
fi

CLAUDE_DIR="$HOME/.claude"
CHANGES_DETECTED=false

# Colors for output  
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Error handling
check_repo_exists() {
    if [ ! -d "$REPO_DIR" ]; then
        if [ "$LOCAL_FLAG" = true ]; then
            echo -e "${RED}❌ Error: Local directory $REPO_DIR not found${NC}"
            echo -e "${YELLOW}💡 Run from a directory containing claude-craft files${NC}"
        else
            echo -e "${RED}❌ Error: claude-craft repository not found at $REPO_DIR${NC}"
            echo -e "${YELLOW}💡 Run: curl -sSL https://raw.githubusercontent.com/whichguy/claude-craft/main/install.sh | bash${NC}"
        fi
        exit 1
    fi
    
    # Only check for git repo in global mode
    if [ "$LOCAL_FLAG" = false ] && [ ! -d "$REPO_DIR/.git" ]; then
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

discover_unpublished() {
    local unpublished_files=()
    local file_types=("commands" "agents" "hooks")
    
    echo -e "${YELLOW}🔍 Discovering unpublished Claude Code extensions...${NC}"
    
    for type in "${file_types[@]}"; do
        local claude_dir="$CLAUDE_DIR/$type"
        local repo_dir="$REPO_DIR/$type"
        
        if [ ! -d "$claude_dir" ]; then
            continue
        fi
        
        echo -e "${YELLOW}Checking $type...${NC}"
        
        # Find files that are not symlinks (locally created) or symlinks not pointing to our repo
        while IFS= read -r -d '' file; do
            local basename=$(basename "$file")
            local repo_file="$repo_dir/$basename"
            
            # Skip if it's a symlink pointing to our repo
            if [ -L "$file" ] && readlink "$file" | grep -q "^$REPO_DIR"; then
                continue
            fi
            
            # Check if file exists in repo with same content
            if [ -f "$repo_file" ] && cmp -s "$file" "$repo_file"; then
                continue
            fi
            
            unpublished_files+=("$type:$file")
            echo -e "  📄 Found: ${GREEN}$basename${NC} (in $type/)"
        done < <(find "$claude_dir" -maxdepth 1 -type f -name "*.md" -o -name "*.json" -o -name "*.sh" -print0 2>/dev/null)
    done
    
    # Check settings and memory for unpublished changes
    echo -e "${YELLOW}Checking settings and memory...${NC}"
    
    # Check for modified settings.json
    if [ -f "$CLAUDE_DIR/settings.json" ] && [ -f "$REPO_DIR/settings/settings.base.json" ]; then
        if ! cmp -s "$CLAUDE_DIR/settings.json" "$REPO_DIR/settings/settings.base.json"; then
            unpublished_files+=("settings:$CLAUDE_DIR/settings.json")
            echo -e "  ⚙️  Found: ${GREEN}settings.json${NC} (modified)"
        fi
    fi
    
    # Check CLAUDE.md
    if [ -f "$CLAUDE_DIR/CLAUDE.md" ] && [ -f "$REPO_DIR/memory/CLAUDE.base.md" ]; then
        if ! cmp -s "$CLAUDE_DIR/CLAUDE.md" "$REPO_DIR/memory/CLAUDE.base.md"; then
            unpublished_files+=("memory:$CLAUDE_DIR/CLAUDE.md")
            echo -e "  📝 Found: ${GREEN}CLAUDE.md${NC} (modified)"
        fi
    fi
    
    # Return the array (using a global for simplicity in bash)
    UNPUBLISHED_FILES=("${unpublished_files[@]}")
    
    if [ ${#unpublished_files[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ No unpublished extensions found${NC}"
        return 1
    else
        echo -e "${YELLOW}Found ${#unpublished_files[@]} unpublished extension(s)${NC}"
        return 0
    fi
}

publish_selected_files() {
    local selected_files=("$@")
    local published_count=0
    
    echo -e "${YELLOW}📤 Publishing selected files...${NC}"
    
    for item in "${selected_files[@]}"; do
        local type=$(echo "$item" | cut -d: -f1)
        local file_path=$(echo "$item" | cut -d: -f2-)
        local basename=$(basename "$file_path")
        
        case "$type" in
            "commands"|"agents"|"hooks")
                local target_dir="$REPO_DIR/$type"
                mkdir -p "$target_dir"
                cp "$file_path" "$target_dir/$basename"
                echo -e "  ✅ Published ${GREEN}$basename${NC} to $type/"
                ;;
            "settings")
                mkdir -p "$REPO_DIR/settings/fragments"
                cp "$file_path" "$REPO_DIR/settings/fragments/published-$(date +%Y%m%d).json"
                echo -e "  ✅ Published ${GREEN}settings.json${NC} to settings/fragments/"
                ;;
            "memory")
                mkdir -p "$REPO_DIR/memory/fragments"
                cp "$file_path" "$REPO_DIR/memory/fragments/published-CLAUDE-$(date +%Y%m%d).md"
                echo -e "  ✅ Published ${GREEN}CLAUDE.md${NC} to memory/fragments/"
                ;;
        esac
        
        ((published_count++))
    done
    
    if [ $published_count -gt 0 ]; then
        echo -e "${GREEN}✅ Published $published_count file(s) to repository${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  No files were published${NC}"
        return 1
    fi
}

case "$ACTION" in
    "setup")
        if [ "$LOCAL_FLAG" = true ]; then
            echo -e "${YELLOW}🚀 Setting up local claude-craft from current directory...${NC}"
            check_repo_exists
        else
            echo -e "${YELLOW}🚀 Setting up global claude-craft...${NC}"
            
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
        fi
        
        # Sync standalone directories
        sync_directory "commands" "commands" "*.md"
        sync_directory "agents" "agents" "*.json"
        
        # Safe merge of single-file configurations
        safe_merge_configs
        
        if [ "$LOCAL_FLAG" = true ]; then
            echo -e "${GREEN}✅ Local setup complete!${NC}"
        else
            echo -e "${GREEN}✅ Global setup complete!${NC}"
        fi
        echo -e "${YELLOW}⚠️  IMPORTANT: Restart Claude Code to load new commands/agents/hooks${NC}"
        ;;
        
    "sync")
        check_repo_exists
        
        if [ "$LOCAL_FLAG" = true ]; then
            echo -e "${YELLOW}📥 Syncing local claude-craft...${NC}"
        else
            echo -e "${YELLOW}📥 Syncing global claude-craft...${NC}"
            
            # Use secure git if available (only for global sync)
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
        
    "publish")
        check_repo_exists
        
        # Discover unpublished files
        if ! discover_unpublished; then
            exit 0
        fi
        
        echo ""
        echo -e "${YELLOW}📋 Select files to publish:${NC}"
        
        # Interactive selection
        selected_files=()
        for i in "${!UNPUBLISHED_FILES[@]}"; do
            item="${UNPUBLISHED_FILES[$i]}"
            type=$(echo "$item" | cut -d: -f1)
            file_path=$(echo "$item" | cut -d: -f2-)
            basename=$(basename "$file_path")
            
            echo -e "${YELLOW}Publish ${GREEN}$basename${NC} (from $type/)? [Y/n]${NC}"
            read -r response
            
            # Default to yes if empty response
            if [[ "$response" =~ ^[Yy]$ ]] || [[ -z "$response" ]]; then
                selected_files+=("$item")
            fi
        done
        
        if [ ${#selected_files[@]} -eq 0 ]; then
            echo -e "${YELLOW}⚠️  No files selected for publishing${NC}"
            exit 0
        fi
        
        # Publish selected files
        if publish_selected_files "${selected_files[@]}"; then
            echo ""
            echo -e "${YELLOW}📝 Commit message (or press Enter for default):${NC}"
            read -r commit_msg
            
            # Default commit message
            if [ -z "$commit_msg" ]; then
                commit_msg="Publish ${#selected_files[@]} Claude Code extension(s)"
            fi
            
            # Git add, commit, and push
            echo -e "${YELLOW}📤 Committing and pushing changes...${NC}"
            cd "$REPO_DIR"
            
            if ! git add -A; then
                echo -e "${RED}❌ Failed to stage changes${NC}"
                exit 1
            fi
            
            if ! git commit -m "$commit_msg"; then
                echo -e "${RED}❌ Failed to commit changes${NC}"
                exit 1
            fi
            
            if ! git push; then
                echo -e "${RED}❌ Failed to push changes${NC}"
                echo -e "${YELLOW}💡 Check your GitHub permissions and network connection${NC}"
                exit 1
            fi
            
            echo -e "${GREEN}✅ Successfully published and pushed ${#selected_files[@]} extension(s)!${NC}"
            echo -e "${YELLOW}💡 Run /craft sync to update your local symlinks${NC}"
        fi
        ;;
        
    *)
        echo -e "${RED}❌ Unknown action: $ACTION${NC}"
        echo -e "${YELLOW}Usage: /craft [setup|sync|push|status|clean|scan|publish|auto-sync]${NC}"
        echo ""
        echo -e "${YELLOW}Available commands:${NC}"
        echo -e "  ${GREEN}/craft${NC} or ${GREEN}/craft sync${NC}  - Sync latest changes (default)"
        echo -e "  ${GREEN}/craft setup${NC}             - Initial setup and clone"
        echo -e "  ${GREEN}/craft push \"message\"${NC}    - Commit and push changes (with security scan)"
        echo -e "  ${GREEN}/craft publish${NC}           - Discover and publish unpublished extensions"
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