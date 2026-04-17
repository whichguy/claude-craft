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
        if [ -f "$REPO_DIR/tools/sync-status.sh" ]; then
            echo -e "${RED}❌ sync-status.sh exists but is not executable${NC}"
            echo -e "${YELLOW}Try: chmod +x $REPO_DIR/tools/sync-status.sh${NC}"
        else
            echo -e "${RED}❌ sync-status.sh not found at: $REPO_DIR/tools/sync-status.sh${NC}"
            echo -e "${YELLOW}Repository may be incomplete. Try re-cloning.${NC}"
        fi
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
        if git_output=$(git -C "$REPO_DIR" pull --ff-only origin main 2>&1); then
            echo -e "${GREEN}✅ Updated to latest version${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not fast-forward: ${git_output}${NC}"
            echo -e "${YELLOW}   Continuing with existing version.${NC}"
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

    # Router/proxy and model-map tooling moved to c-thru: https://github.com/whichguy/c-thru

    # Remove legacy PATH shim: keep the vendor `claude` binary from PATH untouched.
    if [ -f "$CLAUDE_DIR/bin/claude" ]; then
        rm -f "$CLAUDE_DIR/bin/claude"
        echo -e "${GREEN}✅ Removed legacy PATH shim: ~/.claude/bin/claude${NC}"
    fi

    # Remove old PATH injection marker block if present.
    # Uses ~/.zshenv (all zsh invocations incl. non-interactive) and ~/.bashrc (bash users).
    remove_path_block() {
        local rcfile="$1"
        local marker_start="# BEGIN claude-craft proxy shim (managed by install.sh)"
        local marker_end="# END claude-craft proxy shim"
        [ -f "$rcfile" ] || return 0
        python3 - "$rcfile" "$marker_start" "$marker_end" <<'PY'
import pathlib
import sys

rcfile = pathlib.Path(sys.argv[1])
start = sys.argv[2]
end = sys.argv[3]
text = rcfile.read_text()
block = f"\n{start}\ncase \":$PATH:\" in\n  *\":$HOME/.claude/bin:\"*) ;;\n  *) export PATH=\"$HOME/.claude/bin:$PATH\" ;;\nesac\n{end}\n"
updated = text.replace(block, "")
if updated == text:
    updated = text.replace(f"{start}\ncase \":$PATH:\" in\n  *\":$HOME/.claude/bin:\"*) ;;\n  *) export PATH=\"$HOME/.claude/bin:$PATH\" ;;\nesac\n{end}\n", "")
if updated != text:
    rcfile.write_text(updated)
PY
        echo -e "${GREEN}✅ Removed old ~/.claude/bin PATH shim block from $rcfile${NC}"
    }
    remove_path_block "$HOME/.zshenv"
    remove_path_block "$HOME/.bashrc"

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

    # Merge plugin hooks into settings.json so hook changes converge on rerun.
    echo -e "${YELLOW}🔌 Merging plugin hooks (model-router uses PreToolUse only)...${NC}"
    merge_plugin_hooks

    # MCP registration and model-map bootstrap moved to c-thru:
    # https://github.com/whichguy/c-thru

    # Install git hooks for security
    echo -e "${YELLOW}🔒 Installing security hooks...${NC}"
    if [ -f "$REPO_DIR/tools/install-git-hooks.sh" ]; then
        "$REPO_DIR/tools/install-git-hooks.sh" "$REPO_DIR" >/dev/null 2>&1 && \
            echo -e "${GREEN}✅ Git security hooks installed${NC}" || \
            echo -e "${YELLOW}⚠️  Could not install git hooks (non-critical)${NC}"
    fi

    # Count installed items per type
    # Split local + assignment to avoid local masking subshell exit under set -e
    local agent_count command_count prompt_count skill_count reference_count plugin_count
    agent_count=$(find "$CLAUDE_DIR/agents" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    command_count=$(find "$CLAUDE_DIR/commands" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    prompt_count=$(find "$CLAUDE_DIR/prompts" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    skill_count=$(find "$CLAUDE_DIR/skills" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    reference_count=$(find "$CLAUDE_DIR/references" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
    plugin_count=$(find "$CLAUDE_DIR/plugins" -maxdepth 1 -type l -exec readlink {} \; 2>/dev/null | grep -c "claude-craft" || echo "0")
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
    echo -e "${YELLOW}Model routing (transparent proxy):${NC}"
    echo "  • claude                             — uses the vendor Claude binary already on your PATH"
    echo "  • claude-router + claude-proxy extracted to https://github.com/whichguy/c-thru"
    echo "  • hooks/plugins live in ~/.claude (profile-level) so they apply consistently across sessions"
    echo "  • ~/.claude.json is managed in local MCP scope for this repo, so tools load from nested dirs too"
    echo "  • use project .mcp.json only if you want to share this MCP server with the whole team"
    echo "  • restart Claude Code or reload MCP/plugins after install to pick up newly registered tools"
    echo ""
    echo -e "${YELLOW}💡 Uninstall anytime with:${NC} $REPO_DIR/uninstall.sh --dry-run"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Restart Claude Code now!${NC}"
}

# Run main installation
main
