#!/bin/bash
# Claude Craft Sync Status & Operations
# Shared logic for install.sh and agent-sync.md
#
# Usage:
#   sync-status.sh status [--repo PATH]     Show registration status for all 7 types
#   sync-status.sh sync [--repo PATH]       Create symlinks for all repo items
#   sync-status.sh publish                  List local items not in repo
#   sync-status.sh add                      List repo items not in ~/.claude
#
# Exit codes: 0 = success, 1 = repo not found, 2 = usage error

set -eo pipefail
shopt -s nullglob

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
REPO_PATH=""
ACTION=""

# --- Argument Parsing ---

usage() {
    echo "Usage: $0 <action> [options]"
    echo ""
    echo "Actions:"
    echo "  status    Show sync status for all extension types"
    echo "  sync      Sync all repo items to ~/.claude"
    echo "  publish   List local items that could be published to repo"
    echo "  add       List repo items not yet in ~/.claude"
    echo ""
    echo "Options:"
    echo "  --repo PATH   Path to claude-craft repository"
    exit 2
}

while [[ $# -gt 0 ]]; do
    case $1 in
        status|sync|publish|add)
            ACTION="$1"; shift ;;
        --repo)
            [[ -n "${2:-}" ]] || { echo "Error: --repo requires a PATH argument" >&2; usage; }
            REPO_PATH="$2"; shift 2 ;;
        --help|-h)
            usage ;;
        *)
            echo "Unknown: $1"; usage ;;
    esac
done

[ -z "$ACTION" ] && ACTION="status"

# --- Repository Discovery ---

discover_repo() {
    # 1. Explicit --repo flag
    if [ -n "$REPO_PATH" ] && [ -d "$REPO_PATH/.git" ]; then
        echo "$REPO_PATH"
        return
    fi

    # 2. REPO_DIR env var
    if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
        echo "$REPO_DIR"
        return
    fi

    # 3. Common locations
    for candidate in "$HOME/claude-craft" "$HOME/repos/claude-craft"; do
        if [ -d "$candidate/.git" ] && [ -d "$candidate/agents" ]; then
            echo "$candidate"
            return
        fi
    done

    # 4. Walk up from cwd
    local dir="$(pwd)"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/claude-craft/.git" ]; then
            echo "$dir/claude-craft"
            return
        fi
        dir="$(dirname "$dir")"
    done

    return 1
}

REPO_PATH=$(discover_repo) || {
    echo -e "${RED}Repository not found. Use --repo PATH or set REPO_DIR.${NC}" >&2
    exit 1
}

# --- Extension Type Definitions ---
# Shared TYPES array sourced from tools/shared-types.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/shared-types.sh"

# --- Core Functions ---

# Check if a symlink in claude_dir points to our repo
is_repo_symlink() {
    local item="$1"
    [ -L "$item" ] || return 1
    local target
    target=$(readlink "$item" 2>/dev/null || true)
    # Resolve relative symlinks to absolute
    if [[ "$target" != /* ]]; then
        target="$(cd "$(dirname "$item")" && cd "$(dirname "$target")" && pwd)/$(basename "$target")"
    fi
    [[ "$target" == "$REPO_PATH"* ]]
}

# Should this file be skipped?
should_skip() {
    local basename="$1"
    local skip_patterns="$2"

    [ -z "$skip_patterns" ] && return 1

    IFS=',' read -ra patterns <<< "$skip_patterns"
    for pattern in "${patterns[@]}"; do
        # shellcheck disable=SC2254
        case "$basename" in
            $pattern) return 0 ;;
        esac
    done
    return 1
}

# Get description from a .md file (first description: line or first non-header line)
get_desc() {
    local file="$1"
    local desc=""
    if [ -f "$file" ]; then
        desc=$(grep -m1 "^description:" "$file" 2>/dev/null | cut -d: -f2- | sed 's/^ *//; s/"//g' || true)
        [ -z "$desc" ] && desc=$(head -5 "$file" 2>/dev/null | grep -v "^#" | grep -v "^---" | grep -v "^$" | head -1 | sed 's/^[[:space:]]*//' || true)
    fi
    [ ${#desc} -gt 60 ] && desc="${desc:0:60}..."
    echo "$desc"
}

# --- Actions ---

do_status() {
    echo -e "${BLUE}📊 Claude Craft Sync Status${NC}"
    echo -e "${BLUE}Repository: $REPO_PATH${NC}"
    echo ""

    local total_registered=0
    local total_local=0
    local total_available=0

    for type_def in "${TYPES[@]}"; do
        IFS='|' read -r name emoji claude_sub repo_sub kind pattern skip <<< "$type_def"

        local claude_path="$CLAUDE_DIR/$claude_sub"
        local repo_path="$REPO_PATH/$repo_sub"
        local registered=0
        local local_only=0
        local repo_only=0
        local items=()

        # Collect installed items (registered + local-only)
        if [ -d "$claude_path" ]; then
            if [ "$kind" = "file" ]; then
                for item in "$claude_path"/*; do
                    [ -e "$item" ] || continue
                    local bn=$(basename "$item")
                    local desc=$(get_desc "$item")
                    if is_repo_symlink "$item"; then
                        items+=("  ${GREEN}✓${NC} ${bn}  ${desc}")
                        registered=$((registered + 1))
                    else
                        items+=("  ${YELLOW}●${NC} ${bn}  ${desc}  ${YELLOW}(local)${NC}")
                        local_only=$((local_only + 1))
                    fi
                done
            else
                for item in "$claude_path"/*/; do
                    [ -d "$item" ] || continue
                    item="${item%/}"
                    local dn=$(basename "$item")
                    [[ "$dn" == .* ]] && continue
                    local desc=""
                    [ -f "$item/SKILL.md" ] && desc=$(get_desc "$item/SKILL.md")
                    [ -z "$desc" ] && desc="(directory)"
                    if is_repo_symlink "$item"; then
                        items+=("  ${GREEN}✓${NC} ${dn}  ${desc}")
                        registered=$((registered + 1))
                    else
                        items+=("  ${YELLOW}●${NC} ${dn}  ${desc}  ${YELLOW}(local)${NC}")
                        local_only=$((local_only + 1))
                    fi
                done
            fi
        fi

        # Collect available (in repo, not installed)
        if [ -d "$repo_path" ]; then
            if [ "$kind" = "file" ]; then
                for item in "$repo_path"/$pattern; do
                    [ -f "$item" ] || continue
                    local bn=$(basename "$item")
                    should_skip "$bn" "$skip" && continue
                    if [ ! -e "$claude_path/$bn" ]; then
                        local desc=$(get_desc "$item")
                        items+=("  ${RED}○${NC} ${bn}  ${desc}  ${RED}(available)${NC}")
                        repo_only=$((repo_only + 1))
                    fi
                done
            else
                for item in "$repo_path"/*/; do
                    [ -d "$item" ] || continue
                    local dn=$(basename "$item")
                    [[ "$dn" == .* ]] && continue
                    if [ ! -e "$claude_path/$dn" ] && [ ! -L "$claude_path/$dn" ]; then
                        local desc=""
                        [ -f "$item/SKILL.md" ] && desc=$(get_desc "$item/SKILL.md")
                        [ -z "$desc" ] && desc="(directory)"
                        items+=("  ${RED}○${NC} ${dn}  ${desc}  ${RED}(available)${NC}")
                        repo_only=$((repo_only + 1))
                    fi
                done
            fi
        fi

        total_registered=$((total_registered + registered))
        total_local=$((total_local + local_only))
        total_available=$((total_available + repo_only))

        # Print type header + items
        local count=$((registered + local_only + repo_only))
        echo -e "${emoji} ${name} (${count})"
        for line in "${items[@]}"; do
            echo -e "$line"
        done
        # Per-type summary line (test-compatible format)
        printf "  %s %-12s %s registered" "$emoji" "$name" "$registered"
        [ $local_only -gt 0 ] && printf ", %s local-only" "$local_only"
        [ $repo_only -gt 0 ] && printf ", ${YELLOW}%s available${NC}" "$repo_only"
        echo ""
        echo ""
    done

    # Summary footer
    echo -e "${BLUE}📊 Summary${NC}"
    printf "  %-14s %s\n" "Registered:" "$total_registered (synced from repo)"
    printf "  %-14s %s\n" "Local-only:" "$total_local (not in repo)"
    printf "  %-14s %s\n" "Available:" "$total_available (in repo, not installed)"
    printf "  %-14s %s\n" "Total:" "$((total_registered + total_local + total_available))"

    # Plugin health checks
    local plugin_warnings=0
    local settings_file="$CLAUDE_DIR/settings.json"
    for plugin_dir in "$CLAUDE_DIR/plugins"/*/; do
        [ -d "$plugin_dir" ] || continue
        local pname=$(basename "$plugin_dir")
        [[ "$pname" == .* || "$pname" == "cache" || "$pname" == "data" ]] && continue
        # Skip non-symlink directories (marketplace plugins managed separately)
        [ -L "${plugin_dir%/}" ] || continue

        # Check enabledPlugins and installed_plugins.json
        if command -v jq >/dev/null 2>&1 && [ -f "$settings_file" ]; then
            if ! jq -e --arg p "$pname" '.enabledPlugins | has($p)' "$settings_file" > /dev/null 2>&1; then
                echo -e "  ${YELLOW}⚠️  $pname: missing from enabledPlugins (run install.sh to register)${NC}"
                plugin_warnings=$((plugin_warnings + 1))
            fi
            local installed_file="$CLAUDE_DIR/plugins/installed_plugins.json"
            if [ -f "$installed_file" ] && ! jq -e --arg p "$pname" '.plugins | has($p)' "$installed_file" > /dev/null 2>&1; then
                echo -e "  ${YELLOW}⚠️  $pname: missing from installed_plugins.json (run install.sh to register)${NC}"
                plugin_warnings=$((plugin_warnings + 1))
            fi
        fi

        # Check hooks.json location
        if [ -f "$plugin_dir/hooks.json" ] && [ ! -f "$plugin_dir/hooks/hooks.json" ]; then
            echo -e "  ${YELLOW}⚠️  $pname: hooks.json at root (should be hooks/hooks.json)${NC}"
            plugin_warnings=$((plugin_warnings + 1))
        fi

        # Check manifest (advisory)
        if [ ! -f "$plugin_dir/.claude-plugin/plugin.json" ]; then
            echo -e "  ${YELLOW}⚠️  $pname: missing .claude-plugin/plugin.json (recommended)${NC}"
            plugin_warnings=$((plugin_warnings + 1))
        fi
    done
    if [ $plugin_warnings -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}  $plugin_warnings plugin warning(s) — run install.sh or check settings.json to fix${NC}"
    fi

    if [ $total_available -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Run '/craft sync' to install available items${NC}"
    else
        echo ""
        echo -e "${GREEN}All items are in sync.${NC}"
    fi
}

do_sync() {
    echo -e "${BLUE}🔄 Syncing all extension types from $REPO_PATH${NC}"
    echo ""

    local synced=0

    for type_def in "${TYPES[@]}"; do
        IFS='|' read -r name emoji claude_sub repo_sub kind pattern skip <<< "$type_def"

        local claude_path="$CLAUDE_DIR/$claude_sub"
        local repo_path="$REPO_PATH/$repo_sub"

        [ -d "$repo_path" ] || continue
        mkdir -p "$claude_path"

        echo -e "$emoji Syncing $name..."

        if [ "$kind" = "file" ]; then
            # Remove stale repo symlinks and broken symlinks
            for item in "$claude_path"/*; do
                [ -L "$item" ] || continue
                local target
                target=$(readlink "$item" 2>/dev/null || true)
                if [[ "$target" == "$repo_path/"* ]] || ! [ -e "$item" ]; then
                    rm -f "$item"
                fi
            done

            # Create new symlinks (skip local-only files)
            for item in "$repo_path"/$pattern; do
                [ -f "$item" ] || continue
                local bn=$(basename "$item")
                should_skip "$bn" "$skip" && continue
                # Preserve local-only files (not symlinks)
                if [ -f "$claude_path/$bn" ] && ! [ -L "$claude_path/$bn" ]; then
                    continue
                fi
                ln -sfn "$item" "$claude_path/$bn"
                synced=$((synced + 1))
            done
        else
            # Directory-based: remove stale and broken symlinks, create new
            for item in "$claude_path"/*; do
                [ -L "$item" ] || continue
                local target
                target=$(readlink "$item" 2>/dev/null || true)
                if [[ "$target" == "$repo_path/"* ]] || ! [ -e "$item" ]; then
                    rm -f "$item"
                fi
            done

            for item in "$repo_path"/*/; do
                [ -d "$item" ] || continue
                local dn=$(basename "$item")
                [[ "$dn" == .* ]] && continue
                # Preserve local-only directories (not symlinks)
                if [ -d "$claude_path/$dn" ] && ! [ -L "$claude_path/$dn" ]; then
                    continue
                fi
                ln -sfn "${item%/}" "$claude_path/$dn"
                synced=$((synced + 1))
            done
        fi
    done

    echo ""
    echo -e "${GREEN}Synced $synced items across all extension types.${NC}"
}

do_publish() {
    echo -e "${BLUE}📤 Local items not in repository (publishable)${NC}"
    echo ""

    local num=1

    for type_def in "${TYPES[@]}"; do
        IFS='|' read -r name emoji claude_sub repo_sub kind pattern skip <<< "$type_def"

        local claude_path="$CLAUDE_DIR/$claude_sub"
        local repo_path="$REPO_PATH/$repo_sub"

        [ -d "$claude_path" ] || continue

        if [ "$kind" = "file" ]; then
            for item in "$claude_path"/*; do
                [ -f "$item" ] || continue
                is_repo_symlink "$item" && continue
                local bn=$(basename "$item")
                local desc=$(get_desc "$item")
                printf "%2d. %s %s (%s) - %s\n" "$num" "$emoji" "$bn" "$name" "$desc"
                num=$((num + 1))
            done
        else
            for item in "$claude_path"/*/; do
                [ -d "$item" ] || continue
                item="${item%/}"
                is_repo_symlink "$item" && continue
                local dn=$(basename "$item")
                [[ "$dn" == .* ]] && continue
                local desc=""
                [ -f "$item/SKILL.md" ] && desc=$(get_desc "$item/SKILL.md")
                [ -z "$desc" ] && desc="(directory)"
                printf "%2d. %s %s (%s) - %s\n" "$num" "$emoji" "$dn" "$name" "$desc"
                num=$((num + 1))
            done
        fi
    done

    if [ $num -eq 1 ]; then
        echo "  (no local-only items found)"
    fi
}

do_add() {
    echo -e "${BLUE}📥 Repository items not yet in ~/.claude (addable)${NC}"
    echo ""

    local num=1

    for type_def in "${TYPES[@]}"; do
        IFS='|' read -r name emoji claude_sub repo_sub kind pattern skip <<< "$type_def"

        local claude_path="$CLAUDE_DIR/$claude_sub"
        local repo_path="$REPO_PATH/$repo_sub"

        [ -d "$repo_path" ] || continue

        if [ "$kind" = "file" ]; then
            for item in "$repo_path"/$pattern; do
                [ -f "$item" ] || continue
                local bn=$(basename "$item")
                should_skip "$bn" "$skip" && continue
                [ -e "$claude_path/$bn" ] && continue
                local desc=$(get_desc "$item")
                printf "%2d. %s %s (%s) - %s\n" "$num" "$emoji" "$bn" "$name" "$desc"
                num=$((num + 1))
            done
        else
            for item in "$repo_path"/*/; do
                [ -d "$item" ] || continue
                local dn=$(basename "$item")
                [[ "$dn" == .* ]] && continue
                { [ -e "$claude_path/$dn" ] || [ -L "$claude_path/$dn" ]; } && continue
                local desc=""
                [ -f "$item/SKILL.md" ] && desc=$(get_desc "$item/SKILL.md")
                [ -z "$desc" ] && desc="(directory)"
                printf "%2d. %s %s (%s) - %s\n" "$num" "$emoji" "$dn" "$name" "$desc"
                num=$((num + 1))
            done
        fi
    done

    if [ $num -eq 1 ]; then
        echo "  (all repo items are installed)"
    fi
}

# --- Main ---

case "$ACTION" in
    status)  do_status ;;
    sync)    do_sync ;;
    publish) do_publish ;;
    add)     do_add ;;
    *)       usage ;;
esac
