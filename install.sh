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

install_settings_hooks() {
    local settings_file="$CLAUDE_DIR/settings.json"

    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  jq not found — skipping settings hook install${NC}"
        return
    fi

    [ ! -f "$settings_file" ] && echo '{}' > "$settings_file"

    # Idempotency: skip if ExitPlanMode hook already present
    if jq -e '.hooks.PreToolUse[]? | select(.matcher == "ExitPlanMode")' "$settings_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ExitPlanMode review-plan hook already installed${NC}"
        return
    fi

    local pre_hook_cmd='plan_file=$(ls -t ~/.claude/plans/*.md 2>/dev/null | head -1); slug=$(basename "$plan_file" .md 2>/dev/null); if [ -n "$slug" ] && [ -f ~/.claude/plans/.review-ready-"$slug" ]; then printf '"'"'{}'"'"'; else printf '"'"'%s'"'"' '"'"'{"decision":"block","reason":"Gate file not found. Either review-plan has not been run yet (run it first), or ExitPlanMode already succeeded and the gate was cleaned up (do not retry)."}'"'"'; fi'

    local tmp="$settings_file.tmp"
    jq --arg pre_cmd "$pre_hook_cmd" \
       '.hooks.PreToolUse = ((.hooks.PreToolUse // []) + [{"matcher":"ExitPlanMode","hooks":[{"type":"command","command":$pre_cmd,"statusMessage":"Checking review-plan was run..."}]}])' \
       "$settings_file" > "$tmp" && mv "$tmp" "$settings_file"

    echo -e "${GREEN}✅ Installed ExitPlanMode review-plan hook (PreToolUse)${NC}"
}

merge_plugin_hooks() {
    # Merge plugin hooks into settings.json via merge-hooks.sh
    # Reads plugin hooks.json, resolves ${CLAUDE_PLUGIN_ROOT} paths,
    # merges into settings.json hooks section (idempotent — safe to re-run)
    if [ -x "$REPO_DIR/tools/merge-hooks.sh" ]; then
        "$REPO_DIR/tools/merge-hooks.sh"
    else
        echo -e "${YELLOW}⚠️  merge-hooks.sh not found — skipping hook merge${NC}"
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
        chmod +x "$REPO_DIR/tools/claude-router" 2>/dev/null || true
    fi

    # Symlink claude-router (used by wiki-worker.sh for Bedrock/OpenRouter/Ollama support)
    if [ -x "$REPO_DIR/tools/claude-router" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/claude-router" "$CLAUDE_DIR/tools/claude-router"
        echo -e "${GREEN}✅ Installed tool: claude-router${NC}"
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

    # Install settings hooks (e.g. ExitPlanMode review-plan gate)
    echo -e "${YELLOW}🔧 Installing settings hooks...${NC}"
    install_settings_hooks

    # Bootstrap default model-map.json if not present
    local model_map="$CLAUDE_DIR/model-map.json"
    if [ ! -f "$model_map" ]; then
        cat > "$model_map" <<'MODELMAP'
{
  "model_mappings": {
    "sonnet": "us.anthropic.claude-sonnet-4-6-v1",
    "claude-sonnet-4-6": "us.anthropic.claude-sonnet-4-6-v1",
    "opus": "us.anthropic.claude-opus-4-6-v1",
    "claude-opus-4-6": "us.anthropic.claude-opus-4-6-v1",
    "haiku": "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-haiku-4-5-20251001": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  }
}
MODELMAP
        echo -e "${GREEN}✅ Created default model-map.json (Bedrock model mappings)${NC}"
    else
        echo -e "${GREEN}✅ model-map.json already exists — skipping${NC}"
    fi

    # Merge plugin hooks into settings.json
    echo -e "${YELLOW}🔌 Merging plugin hooks...${NC}"
    merge_plugin_hooks

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