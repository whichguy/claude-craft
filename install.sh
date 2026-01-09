#!/bin/bash
set -e

echo "🚀 Installing Claude Craft..."

REPO_DIR="$HOME/claude-craft"
CLAUDE_DIR="$HOME/.claude"
GITHUB_REPO="https://github.com/whichguy/claude-craft.git"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Error handling
cleanup_on_error() {
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Installation failed. Cleaning up...${NC}"
        if [ -d "$REPO_DIR.backup" ]; then
            rm -rf "$REPO_DIR" 2>/dev/null || true
            mv "$REPO_DIR.backup" "$REPO_DIR" 2>/dev/null || true
            echo -e "${YELLOW}⚠️  Restored previous repository state${NC}"
        fi
    fi
}

trap cleanup_on_error EXIT

check_dependencies() {
    local missing_deps=()
    
    command -v git >/dev/null 2>&1 || missing_deps+=("git")
    command -v tar >/dev/null 2>&1 || missing_deps+=("tar")
    command -v find >/dev/null 2>&1 || missing_deps+=("find")
    command -v ln >/dev/null 2>&1 || missing_deps+=("ln")
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required dependencies: ${missing_deps[*]}${NC}"
        echo -e "${YELLOW}Please install these tools and try again${NC}"
        exit 1
    fi
}

test_github_connectivity() {
    if ! curl -s --connect-timeout 10 https://github.com >/dev/null; then
        echo -e "${RED}❌ Cannot connect to GitHub. Please check your internet connection${NC}"
        exit 1
    fi
}

sync_directory() {
    local repo_subdir="$1"
    local claude_subdir="$2" 
    local file_pattern="$3"
    
    local repo_path="$REPO_DIR/$repo_subdir"
    local claude_path="$CLAUDE_DIR/$claude_subdir"
    
    mkdir -p "$claude_path"
    
    # Remove existing claude-craft symlinks
    find "$claude_path" -type l -lname "$repo_path/*" -delete 2>/dev/null || true
    
    # Create symlinks for current files (skip global commands)
    if [ -d "$repo_path" ]; then
        find "$repo_path" -name "$file_pattern" -type f | while read -r file; do
            local basename=$(basename "$file")
            
            # Skip global commands that were copied separately
            if [[ "$basename" == "alias.md" ]] || [[ "$basename" == "unalias.md" ]] || [[ "$basename" == "agent-sync.md" ]]; then
                continue
            fi
            
            ln -sf "$file" "$claude_path/$basename"
        done
    fi
}

install_plugins() {
    if [ -d "$REPO_DIR/plugins" ]; then
        echo -e "${YELLOW}🔌 Installing plugins...${NC}"
        mkdir -p "$CLAUDE_DIR/plugins"
        for plugin in "$REPO_DIR/plugins"/*; do
            if [ -d "$plugin" ]; then
                plugin_name=$(basename "$plugin")
                # Remove existing plugin symlink
                rm -f "$CLAUDE_DIR/plugins/$plugin_name"
                # Create symlink to plugin directory
                ln -sf "$plugin" "$CLAUDE_DIR/plugins/$plugin_name"
                echo -e "${GREEN}✅ Installed plugin: $plugin_name${NC}"
            fi
        done
    fi
}

safe_merge_configs() {
    echo -e "${YELLOW}🔧 Safely merging configurations...${NC}"
    
    # Create backup first
    if [ -x "$REPO_DIR/tools/backup.sh" ]; then
        "$REPO_DIR/tools/backup.sh" backup
    fi
    
    # Merge settings if fragments exist
    if [ -d "$REPO_DIR/settings/fragments" ] && [ "$(ls -A "$REPO_DIR/settings/fragments" 2>/dev/null)" ]; then
        echo -e "${YELLOW}⚙️  Merging settings...${NC}"
        if [ -x "$REPO_DIR/tools/merge-settings.sh" ]; then
            "$REPO_DIR/tools/merge-settings.sh"
        fi
    fi
    
    # Add memory includes if they exist  
    if [ -d "$REPO_DIR/memory" ] && { [ -d "$REPO_DIR/memory/fragments" ] || [ -d "$REPO_DIR/memory/includes" ]; }; then
        if [ "$(ls -A "$REPO_DIR/memory/fragments" "$REPO_DIR/memory/includes" 2>/dev/null)" ]; then
            echo -e "${YELLOW}🧠 Adding memory extensions...${NC}"
            if [ -x "$REPO_DIR/tools/add-memory.sh" ]; then
                "$REPO_DIR/tools/add-memory.sh"
            fi
        fi
    fi
    
    # Create symlink for hook scripts
    if [ -d "$REPO_DIR/hooks/scripts" ] && [ "$(ls -A "$REPO_DIR/hooks/scripts" 2>/dev/null)" ]; then
        echo -e "${YELLOW}🪝 Linking hook scripts...${NC}"
        mkdir -p "$CLAUDE_DIR/hooks"
        find "$REPO_DIR/hooks/scripts" -name "*.sh" -type f | while read -r hook; do
            local basename=$(basename "$hook")
            ln -sf "$hook" "$CLAUDE_DIR/hooks/$basename"
        done
    fi
}

# Main installation
main() {
    echo -e "${YELLOW}🔍 Checking system requirements...${NC}"
    check_dependencies
    test_github_connectivity
    
    # Backup existing repository if it exists
    if [ -d "$REPO_DIR" ]; then
        echo -e "${YELLOW}📦 Backing up existing repository...${NC}"
        mv "$REPO_DIR" "$REPO_DIR.backup"
    fi
    
    # Clone repository
    echo -e "${YELLOW}📥 Cloning claude-craft repository...${NC}"
    if ! git clone "$GITHUB_REPO" "$REPO_DIR"; then
        echo -e "${RED}❌ Failed to clone repository${NC}"
        exit 1
    fi
    
    # Make tools and scripts executable
    if [ -d "$REPO_DIR/tools" ]; then
        chmod +x "$REPO_DIR/tools"/*.sh 2>/dev/null || true
    fi
    
    # Make uninstall script executable
    if [ -f "$REPO_DIR/uninstall.sh" ]; then
        chmod +x "$REPO_DIR/uninstall.sh"
    fi
    
    # Remove backup on success
    if [ -d "$REPO_DIR.backup" ]; then
        rm -rf "$REPO_DIR.backup"
    fi

    # Create symlinks for most commands, but copy core commands globally
    echo -e "${YELLOW}🔗 Creating symlinks...${NC}"
    
    # Create directory first
    mkdir -p "$CLAUDE_DIR/commands"
    
    # Copy core commands as global (not symlinked)
    echo -e "${YELLOW}📋 Installing core global commands...${NC}"
    if [ -f "$REPO_DIR/commands/alias.md" ]; then
        cp "$REPO_DIR/commands/alias.md" "$CLAUDE_DIR/commands/alias.md"
        echo -e "${GREEN}✅ Installed global command: /alias${NC}"
    fi
    
    if [ -f "$REPO_DIR/commands/unalias.md" ]; then
        cp "$REPO_DIR/commands/unalias.md" "$CLAUDE_DIR/commands/unalias.md"
        echo -e "${GREEN}✅ Installed global command: /unalias${NC}"
    fi
    
    # Create symlinks for other commands and agents
    echo -e "${YELLOW}🔗 Linking repository commands...${NC}"
    sync_directory "commands" "commands" "*.md"
    sync_directory "agents" "agents" "*.md"  

    # Safe merge of single-file configurations
    safe_merge_configs

    # Install plugins
    install_plugins

    # Install git hooks for security
    echo -e "${YELLOW}🔒 Installing security hooks...${NC}"
    if [ -f "$REPO_DIR/tools/install-git-hooks.sh" ]; then
        "$REPO_DIR/tools/install-git-hooks.sh" "$REPO_DIR" >/dev/null 2>&1 && \
            echo -e "${GREEN}✅ Git security hooks installed${NC}" || \
            echo -e "${YELLOW}⚠️  Could not install git hooks (non-critical)${NC}"
    fi

    # Create agent-sync global alias
    echo -e "${YELLOW}🚀 Creating agent-sync alias...${NC}"
    if [ -f "$CLAUDE_DIR/commands/alias.md" ]; then
        # Create global agent-sync alias pointing to the agent-sync prompt
        local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        cat > "$CLAUDE_DIR/commands/agent-sync.md" << EOF
---
argument-hint: "[additional-args...]"
description: "Alias: /prompt agent-sync"
allowed-tools: "all"
alias-generated: true
alias-type: "global"
alias-created: "$timestamp"
alias-command: "/prompt agent-sync"
---

# Alias: agent-sync

**This is an auto-generated alias**
**Type**: global
**Executes**: /prompt agent-sync \$@

## Execute Command

Execute: /prompt agent-sync \$@

## Output Requirements
- Direct execution result only
- No preamble about executing the alias
- No meta-commentary about what happened
- Just the actual output from running the command
EOF
        echo -e "${GREEN}✅ Created global alias: /agent-sync${NC}"
    fi

    echo ""
    echo -e "${GREEN}✅ Claude Craft installation complete!${NC}"
    echo ""
    echo -e "${YELLOW}📁 Repository location:${NC} $REPO_DIR"
    echo -e "${YELLOW}🔗 Claude Config:${NC} $CLAUDE_DIR"
    echo ""
    echo -e "${YELLOW}Global Commands Installed:${NC}"
    echo "  • /alias - Create command shortcuts"
    echo "  • /unalias - Remove command shortcuts"  
    echo "  • /agent-sync - Repository sync and management"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Restart Claude Code to load new extensions"
    echo "  2. Try /agent-sync to test installation"
    echo "  3. Use /alias --list to see available aliases"
    echo "  4. Use /prompts to access templates"
    echo "  5. Check ~/.claude/backups/ if you need to restore anything"
    echo ""
    echo -e "${YELLOW}💡 Uninstall anytime with:${NC} $REPO_DIR/uninstall.sh --dry-run"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Restart Claude Code now!${NC}"
}

# Run main installation
main