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

cleanup_legacy_mcp_config() {
    local claude_json="$HOME/.claude.json"
    local repo_mcp="$REPO_DIR/.mcp.json"
    local tool_path="$CLAUDE_DIR/tools/llm-capabilities-mcp"
    local repo_tool_path="$REPO_DIR/tools/llm-capabilities-mcp.js"

    python3 - "$claude_json" "$repo_mcp" "$tool_path" "$repo_tool_path" "$REPO_DIR" <<'PY'
import json
import os
import pathlib
import sys

claude_json = pathlib.Path(sys.argv[1])
repo_mcp = pathlib.Path(sys.argv[2])
tool_path = os.path.realpath(sys.argv[3])
repo_tool = os.path.realpath(sys.argv[4])
repo_dir = os.path.realpath(sys.argv[5])

def is_installer_owned(command):
    if not isinstance(command, str) or not command:
        return False
    real = os.path.realpath(command) if command.startswith("/") else command
    base = os.path.basename(real)
    if real.startswith(repo_dir + os.sep):
        return False
    if (real.startswith("/tmp/") or real.startswith("/private/tmp/")) and base.startswith("llm-capabilities"):
        return True
    return False

if repo_mcp.exists():
    try:
        data = json.loads(repo_mcp.read_text())
    except Exception:
        data = None
    if isinstance(data, dict):
        servers = data.get("mcpServers")
        if isinstance(servers, dict) and set(servers.keys()) == {"llm-capabilities"}:
            entry = servers.get("llm-capabilities")
            if isinstance(entry, dict) and is_installer_owned(entry.get("command")):
                repo_mcp.unlink()
                print(f"removed_repo_mcp={repo_mcp}")

if claude_json.exists():
    try:
        data = json.loads(claude_json.read_text())
    except Exception:
        data = None
    if isinstance(data, dict):
        projects = data.get("projects")
        if isinstance(projects, dict):
            project = projects.get(repo_dir)
            if isinstance(project, dict):
                servers = project.get("mcpServers")
                if isinstance(servers, dict):
                    entry = servers.get("llm-capabilities")
                    if isinstance(entry, dict) and is_installer_owned(entry.get("command")):
                        # Leave actual convergence to install_local_mcp_config; this just records cleanup eligibility.
                        print("local_mcp_entry_owned=true")
PY
}

install_local_mcp_config() {
    local claude_json="$HOME/.claude.json"
    local tool_path="$CLAUDE_DIR/tools/llm-capabilities-mcp"
    local repo_tool_path="$REPO_DIR/tools/llm-capabilities-mcp.js"
    local node_path=""

    if command -v node >/dev/null 2>&1; then
        node_path="$(command -v node)"
    fi

    if [ ! -e "$tool_path" ]; then
        echo -e "${YELLOW}⚠️  llm-capabilities-mcp not installed — skipping local MCP registration${NC}"
        return
    fi

    if [ -z "$node_path" ]; then
        echo -e "${YELLOW}⚠️  node not found — skipping local MCP registration for llm-capabilities${NC}"
        return
    fi

    local result=""
    result="$(python3 - "$claude_json" "$tool_path" "$repo_tool_path" "$REPO_DIR" "$node_path" <<'PY'
import json
import os
import pathlib
import sys

config_path = pathlib.Path(sys.argv[1])
tool_path = sys.argv[2]
repo_tool_path = os.path.realpath(sys.argv[3])
repo_dir = os.path.realpath(sys.argv[4])
node_path = os.path.realpath(sys.argv[5])

def is_installer_owned(entry):
    if not isinstance(entry, dict):
        return False
    command = entry.get("command")
    args = entry.get("args")
    if not isinstance(command, str) or not command:
        return False
    real = os.path.realpath(command) if command.startswith("/") else command
    if real in {os.path.realpath(tool_path), repo_tool_path}:
        return True
    if real == node_path and isinstance(args, list) and args:
        first = args[0]
        if isinstance(first, str) and first:
            first_real = os.path.realpath(first) if first.startswith("/") else first
            if first_real in {os.path.realpath(tool_path), repo_tool_path}:
                return True
    base = os.path.basename(real)
    if (real.startswith("/tmp/") or real.startswith("/private/tmp/")) and base.startswith("llm-capabilities"):
        return True
    return False

if config_path.exists():
    data = json.loads(config_path.read_text())
    if not isinstance(data, dict):
        raise SystemExit("~/.claude.json must be a JSON object")
else:
    data = {}

projects = data.get("projects")
if not isinstance(projects, dict):
    projects = {}

project_entry = projects.get(repo_dir)
if not isinstance(project_entry, dict):
    project_entry = {}

mcp_servers = project_entry.get("mcpServers")
if not isinstance(mcp_servers, dict):
    mcp_servers = {}

existing = mcp_servers.get("llm-capabilities")
if isinstance(existing, dict) and existing.get("command") and not is_installer_owned(existing):
    print("preserved-custom")
    raise SystemExit(0)

mcp_servers["llm-capabilities"] = {
    "type": "stdio",
    "command": node_path,
    "args": [repo_tool_path],
    "env": {
        "CLAUDE_PROJECT_DIR": repo_dir,
        "CLAUDE_MODEL_MAP_LAUNCH_CWD": repo_dir,
    },
}

project_entry["mcpServers"] = mcp_servers
projects[repo_dir] = project_entry
data["projects"] = projects
config_path.write_text(json.dumps(data, indent=2) + "\n")
print("updated")
PY
)"

    if [ "$result" = "preserved-custom" ]; then
        echo -e "${YELLOW}⚠️  Preserved existing custom llm-capabilities entry in $claude_json${NC}"
    else
        echo -e "${GREEN}✅ Local MCP config converged: $claude_json${NC}"
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

converge_model_map_defaults() {
    local model_map="$1"
    [ -f "$model_map" ] || return 0
    if ! command -v python3 >/dev/null 2>&1; then
        return 0
    fi

    local result=""
    result="$(python3 - "$model_map" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception:
    sys.exit(0)

backends = data.get("backends")
if not isinstance(backends, dict):
    sys.exit(0)

ollama_cloud = backends.get("ollama_cloud")
if not isinstance(ollama_cloud, dict):
    sys.exit(0)

if ollama_cloud.get("prep_policy") == "skip":
    print("unchanged")
    sys.exit(0)

ollama_cloud["prep_policy"] = "skip"
path.write_text(json.dumps(data, indent=2) + "\n")
print("updated")
PY
)"

    if [ "$result" = "updated" ]; then
        chmod 600 "$model_map" 2>/dev/null || true
        echo -e "${GREEN}✅ Converged model-map defaults: marked ollama_cloud as skip-prep${NC}"
    fi
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
        chmod +x "$REPO_DIR/tools/claude-router" 2>/dev/null || true
        chmod +x "$REPO_DIR/tools/claude-proxy" 2>/dev/null || true
        chmod +x "$REPO_DIR/tools/llm-capabilities-mcp.js" 2>/dev/null || true
        chmod +x "$REPO_DIR/tools/model-map-sync.js" 2>/dev/null || true
        chmod +x "$REPO_DIR/tools/model-map-edit.js" 2>/dev/null || true
        chmod +x "$REPO_DIR/tools/model-map-validate.js" 2>/dev/null || true
        chmod +x "$REPO_DIR/tools/verify-llm-capabilities-mcp.sh" 2>/dev/null || true
    fi

    # Symlink claude-router (used for Bedrock/Vertex — needs pre-launch env vars)
    if [ -x "$REPO_DIR/tools/claude-router" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/claude-router" "$CLAUDE_DIR/tools/claude-router"
        echo -e "${GREEN}✅ Installed tool: claude-router${NC}"
    fi

    # Symlink claude-proxy (long-running HTTP proxy; auto-spawned by claude-router for Ollama backends)
    if [ -x "$REPO_DIR/tools/claude-proxy" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/claude-proxy" "$CLAUDE_DIR/tools/claude-proxy"
        echo -e "${GREEN}✅ Installed tool: claude-proxy${NC}"
    fi

    if [ -x "$REPO_DIR/tools/llm-capabilities-mcp.js" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/llm-capabilities-mcp.js" "$CLAUDE_DIR/tools/llm-capabilities-mcp"
        echo -e "${GREEN}✅ Installed tool: llm-capabilities-mcp${NC}"
    fi

    if [ -x "$REPO_DIR/tools/model-map-validate.js" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/model-map-validate.js" "$CLAUDE_DIR/tools/model-map-validate"
        echo -e "${GREEN}✅ Installed tool: model-map-validate${NC}"
    fi

    if [ -x "$REPO_DIR/tools/model-map-sync.js" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/model-map-sync.js" "$CLAUDE_DIR/tools/model-map-sync"
        echo -e "${GREEN}✅ Installed tool: model-map-sync${NC}"
    fi

    if [ -x "$REPO_DIR/tools/model-map-edit.js" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/model-map-edit.js" "$CLAUDE_DIR/tools/model-map-edit"
        echo -e "${GREEN}✅ Installed tool: model-map-edit${NC}"
    fi

    if [ -x "$REPO_DIR/tools/verify-llm-capabilities-mcp.sh" ]; then
        mkdir -p "$CLAUDE_DIR/tools"
        ln -sfn "$REPO_DIR/tools/verify-llm-capabilities-mcp.sh" "$CLAUDE_DIR/tools/verify-llm-capabilities-mcp"
        echo -e "${GREEN}✅ Installed tool: verify-llm-capabilities-mcp${NC}"
    fi

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

    echo -e "${YELLOW}🧹 Cleaning up legacy installer-owned MCP config...${NC}"
    cleanup_legacy_mcp_config

    echo -e "${YELLOW}🧩 Registering local MCP tools for this repo...${NC}"
    install_local_mcp_config

    # Bootstrap / migrate layered model-map config.
    # Source of truth defaults live in the repo (config/model-map.json).
    # User customizations live in ~/.claude/model-map.overrides.json.
    # Effective merged config is rendered to ~/.claude/model-map.json.
    local model_map="$CLAUDE_DIR/model-map.json"
    local overrides_map="$CLAUDE_DIR/model-map.overrides.json"
    local default_map="$REPO_DIR/config/model-map.json"
    local bootstrap_effective="$model_map"
    if [ -f "$model_map" ] && [ ! -f "$overrides_map" ] && command -v jq >/dev/null 2>&1; then
        if jq -e 'has("providers") or has("model_mappings") or ((has("backends") or has("model_routes") or has("routes")) | not)' "$model_map" >/dev/null 2>&1; then
            local bak="$model_map.bak.$(date +%Y%m%d%H%M%S)"
            cp "$model_map" "$bak"
            bootstrap_effective=""
            echo -e "${YELLOW}⚠️  Old-schema model-map.json detected and backed up to:${NC}"
            echo -e "   $bak"
            echo -e "${YELLOW}   Switched to layered defaults + overrides. Reapply legacy custom routes by hand if needed.${NC}"
        fi
    fi
    if [ -f "$overrides_map" ]; then
        echo -e "${GREEN}✅ model-map overrides file already exists — skipping${NC}"
    elif [ -n "$bootstrap_effective" ] && [ -f "$bootstrap_effective" ]; then
        echo -e "${GREEN}✅ Bootstrapping model-map overrides from existing effective config${NC}"
    else
        printf '{}\n' > "$overrides_map"
        chmod 600 "$overrides_map"
        echo -e "${GREEN}✅ Created model-map overrides file${NC}"
    fi
    if [ -x "$REPO_DIR/tools/model-map-sync.js" ] && [ -f "$default_map" ]; then
        if node "$REPO_DIR/tools/model-map-sync.js" "$default_map" "$overrides_map" "$model_map" "${bootstrap_effective:-}" >/dev/null 2>&1; then
            chmod 600 "$model_map" "$overrides_map" 2>/dev/null || true
            echo -e "${GREEN}✅ Built effective layered model-map.json from repo defaults + user overrides${NC}"
        else
            echo -e "${RED}❌ Failed to build layered model-map.json${NC}"
            exit 1
        fi
    elif [ ! -f "$model_map" ]; then
        cp "$default_map" "$model_map"
        chmod 600 "$model_map"
        echo -e "${GREEN}✅ Created fallback model-map.json from repo defaults${NC}"
    fi
    converge_model_map_defaults "$model_map"

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
    echo "  • ~/.claude/tools/claude-router      — optional wrapper for routed/proxied runs"
    echo "  • ~/.claude/tools/model-map-validate — validate profile/project model-map configs"
    echo "  • ~/.claude/tools/llm-capabilities-mcp — local MCP server for direct logical LLM tools"
    echo "  • ~/.claude/tools/verify-llm-capabilities-mcp — shell-level handshake + tools/list verifier"
    echo "  • hooks/plugins live in ~/.claude (profile-level) so they apply consistently across sessions"
    echo "  • ~/.claude.json is managed in local MCP scope for this repo, so tools load from nested dirs too"
    echo "  • use project .mcp.json only if you want to share this MCP server with the whole team"
    echo "  • restart Claude Code or reload MCP/plugins after install to pick up newly registered tools"
    echo "  • ~/.claude/tools/verify-llm-capabilities-mcp --call — verify tools/list and a classify_intent smoke call"
    echo "  • /map-model                         — manage model routing and fallback strategies"
    echo "  • tail ~/.claude/proxy.*.log         — troubleshoot proxy startup or routing issues"
    echo "  • pkill -f claude-proxy              — restart proxy after config edits"
    echo "  • CLAUDE_PROXY_BYPASS=1 claude ...   — bypass proxy for direct Anthropic access"
    echo "  • ~/.claude/tools/claude-router --list — list routes / local models (router)"
    echo ""
    echo -e "${YELLOW}💡 Uninstall anytime with:${NC} $REPO_DIR/uninstall.sh --dry-run"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Restart Claude Code now!${NC}"
}

# Run main installation
main
