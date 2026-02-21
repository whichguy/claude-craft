#!/bin/bash
set -eo pipefail

echo "🚀 Installing Claude Craft..."

REPO_DIR="$HOME/claude-craft"
CLAUDE_DIR="$HOME/.claude"
GITHUB_REPO="https://github.com/whichguy/claude-craft.git"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

sync_extensions() {
    # Use shared sync script for all 6 extension types
    if [ -x "$REPO_DIR/tools/sync-status.sh" ]; then
        REPO_DIR="$REPO_DIR" CLAUDE_DIR="$CLAUDE_DIR" "$REPO_DIR/tools/sync-status.sh" sync
    else
        echo -e "${RED}❌ sync-status.sh not found or not executable${NC}"
        echo -e "${YELLOW}Try: chmod +x $REPO_DIR/tools/sync-status.sh${NC}"
        exit 1
    fi
}

# Verify sync-status.sh exists before doing anything destructive
verify_sync_script() {
    if [ ! -f "$REPO_DIR/tools/sync-status.sh" ]; then
        echo -e "${RED}❌ Required file missing: tools/sync-status.sh${NC}"
        echo -e "${YELLOW}The repository may be incomplete. Try re-cloning.${NC}"
        exit 1
    fi
}

# Main installation
main() {
    echo -e "${YELLOW}🔍 Checking system requirements...${NC}"
    check_dependencies

    if [ -d "$REPO_DIR/.git" ]; then
        # Existing install: update in place
        echo -e "${YELLOW}📦 Existing installation found. Updating...${NC}"

        # Warn if working tree is dirty
        if ! git -C "$REPO_DIR" diff-index --quiet HEAD -- 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Working tree has uncommitted changes. Pull may fail if they conflict with upstream.${NC}"
        fi

        test_github_connectivity
        if git -C "$REPO_DIR" pull --ff-only origin main 2>&1; then
            echo -e "${GREEN}✅ Updated to latest version${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not fast-forward. Continuing with existing version.${NC}"
        fi
    else
        # Fresh install: clone
        test_github_connectivity
        echo -e "${YELLOW}📥 Cloning claude-craft repository...${NC}"
        if ! git clone "$GITHUB_REPO" "$REPO_DIR"; then
            echo -e "${RED}❌ Failed to clone repository${NC}"
            exit 1
        fi
    fi

    # Make tools and scripts executable
    if [ -d "$REPO_DIR/tools" ]; then
        chmod +x "$REPO_DIR/tools"/*.sh 2>/dev/null || true
    fi

    # Make uninstall script executable
    if [ -f "$REPO_DIR/uninstall.sh" ]; then
        chmod +x "$REPO_DIR/uninstall.sh"
    fi

    # Verify sync script exists before proceeding
    verify_sync_script

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
    
    # Sync all extension types (agents, commands, skills, prompts, references, plugins)
    sync_extensions

    # Install git hooks for security
    echo -e "${YELLOW}🔒 Installing security hooks...${NC}"
    if [ -f "$REPO_DIR/tools/install-git-hooks.sh" ]; then
        "$REPO_DIR/tools/install-git-hooks.sh" "$REPO_DIR" >/dev/null 2>&1 && \
            echo -e "${GREEN}✅ Git security hooks installed${NC}" || \
            echo -e "${YELLOW}⚠️  Could not install git hooks (non-critical)${NC}"
    fi

    # Count installed items per type
    local agent_count=$(find "$CLAUDE_DIR/agents" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    local command_count=$(find "$CLAUDE_DIR/commands" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    local prompt_count=$(find "$CLAUDE_DIR/prompts" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    local skill_count=$(find "$CLAUDE_DIR/skills" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    local reference_count=$(find "$CLAUDE_DIR/references" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    local plugin_count=$(find "$CLAUDE_DIR/plugins" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    echo ""
    echo -e "${GREEN}✅ Claude Craft installation complete!${NC}"
    echo ""
    echo -e "${YELLOW}📁 Repository location:${NC} $REPO_DIR"
    echo -e "${YELLOW}🔗 Claude Config:${NC} $CLAUDE_DIR"
    echo ""
    echo -e "${YELLOW}Extensions Installed:${NC}"
    echo "  • $agent_count agents"
    local global_count=0
    [ -f "$CLAUDE_DIR/commands/alias.md" ] && global_count=$((global_count + 1))
    [ -f "$CLAUDE_DIR/commands/unalias.md" ] && global_count=$((global_count + 1))
    echo "  • $command_count commands (+ $global_count global)"
    echo "  • $prompt_count prompts"
    echo "  • $skill_count skills"
    echo "  • $reference_count references"
    echo "  • $plugin_count plugins"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Restart Claude Code to load new extensions"
    echo "  2. Try /agent-sync to check sync status"
    echo "  3. Use /alias --list to see available aliases"
    echo "  4. Check ~/.claude/backups/ if you need to restore anything"
    echo ""
    echo -e "${YELLOW}💡 Uninstall anytime with:${NC} $REPO_DIR/uninstall.sh --dry-run"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Restart Claude Code now!${NC}"
}

# Run main installation
main