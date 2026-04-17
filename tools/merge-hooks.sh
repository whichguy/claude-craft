#!/bin/bash
# merge-hooks.sh — Merge plugin hooks into ~/.claude/settings.json
#
# Reads hooks/hooks.json (or hooks.json) from each symlinked plugin in
# ~/.claude/plugins/, resolves ${CLAUDE_PLUGIN_ROOT} to ~/.claude/plugins/<name>,
# and merges into settings.json. Plugin hooks are identified by their command
# path containing ~/.claude/plugins/ — no extra JSON fields are added.
#
# Usage:
#   merge-hooks.sh                  # Merge all plugin hooks
#   merge-hooks.sh --unmerge        # Remove all plugin-contributed hooks
#   merge-hooks.sh --dry-run        # Show what would change
#   merge-hooks.sh --status         # Show current merge state

set -eo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
PLUGIN_PATH_PREFIX="~/.claude/plugins/"
DRY_RUN=false
UNMERGE=false
STATUS=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

usage() {
    echo "Usage: merge-hooks.sh [--unmerge] [--dry-run] [--status]"
    echo "  --unmerge   Remove all plugin-contributed hooks from settings.json"
    echo "  --dry-run   Show what would change without modifying settings.json"
    echo "  --status    Show current merge state (which plugins are merged)"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --unmerge)   UNMERGE=true; shift ;;
        --dry-run)   DRY_RUN=true; shift ;;
        --status)    STATUS=true; shift ;;
        --help|-h)   usage ;;
        *)           echo "Unknown option: $1"; usage ;;
    esac
done

if ! command -v jq >/dev/null 2>&1; then
    echo -e "${RED}jq required but not found${NC}"
    exit 1
fi
[ ! -f "$SETTINGS_FILE" ] && echo '{}' > "$SETTINGS_FILE"

# A matcher-group is "plugin-contributed" if ANY hook command starts with the plugin path prefix
is_plugin_hook='(.hooks // [] | any(.command // "" | startswith("~/.claude/plugins/")))'

# --- Status ---
if [ "$STATUS" = true ]; then
    merged=$(jq -r --arg pfx "$PLUGIN_PATH_PREFIX" '
      [.hooks[]?[]? | select(.hooks // [] | any(.command // "" | startswith($pfx)))
       | .hooks[].command // "" | capture("~/.claude/plugins/(?<name>[^/]+)/") | .name]
      | unique | .[]
    ' "$SETTINGS_FILE" 2>/dev/null)
    if [ -z "$merged" ]; then
        echo "No plugin hooks currently merged into settings.json"
    else
        echo "Merged plugins:"
        echo "$merged" | while read -r p; do
            count=$(jq --arg p "$p" '
              [.hooks[]?[]? | select(.hooks // [] | any(.command // "" | contains("/.claude/plugins/" + $p + "/")))] | length
            ' "$SETTINGS_FILE")
            echo "  $p ($count matcher-group(s))"
        done
    fi
    exit 0
fi

# --- Backup ---
backup() {
    local backup_dir="$CLAUDE_DIR/backups"
    mkdir -p "$backup_dir"
    local ts
    ts=$(date +%Y%m%d-%H%M%S)
    cp "$SETTINGS_FILE" "$backup_dir/settings.json.pre-merge-hooks.$ts"
    local old_backups=()
    while IFS= read -r old_backup; do
        [ -n "$old_backup" ] && old_backups+=("$old_backup")
    done < <(ls -t -- "$backup_dir"/settings.json.pre-merge-hooks.* 2>/dev/null | tail -n +6 || true)
    if [ "${#old_backups[@]}" -gt 0 ]; then
        rm -f -- "${old_backups[@]}" 2>/dev/null || true
    fi
}

# --- Strip all plugin-contributed matcher-groups ---
strip_plugin_hooks() {
    jq --arg pfx "$PLUGIN_PATH_PREFIX" '
      .hooks |= (
        (. // {}) | to_entries | map(
          .value |= map(
            select((.hooks // [] | any(.command // "" | startswith($pfx))) | not)
          )
        ) | from_entries
      ) |
      .hooks |= with_entries(select(.value | length > 0))
    ' "$SETTINGS_FILE"
}

# --- Unmerge ---
if [ "$UNMERGE" = true ]; then
    if [ "$DRY_RUN" = true ]; then
        count=$(jq --arg pfx "$PLUGIN_PATH_PREFIX" '
          [.hooks[]?[]? | select(.hooks // [] | any(.command // "" | startswith($pfx)))] | length
        ' "$SETTINGS_FILE")
        echo "Would remove $count plugin matcher-group(s)"
        exit 0
    fi
    backup
    result=$(strip_plugin_hooks)
    echo "$result" > "$SETTINGS_FILE"
    echo -e "${GREEN}Removed all plugin hooks from settings.json${NC}"
    exit 0
fi

# --- Discover plugin hooks ---
discover_plugins() {
    for plugin_dir in "$CLAUDE_DIR/plugins"/*/; do
        [ -d "$plugin_dir" ] || continue
        local pname
        pname=$(basename "$plugin_dir")
        [[ "$pname" == .* || "$pname" == "cache" || "$pname" == "data" ]] && continue
        [ -L "${plugin_dir%/}" ] || continue

        local hooks_file=""
        if [ -f "$plugin_dir/hooks/hooks.json" ]; then
            hooks_file="$plugin_dir/hooks/hooks.json"
        elif [ -f "$plugin_dir/hooks.json" ]; then
            hooks_file="$plugin_dir/hooks.json"
        fi
        [ -n "$hooks_file" ] && echo "$pname|$hooks_file"
    done
}

# --- Build merged plugin hooks JSON (no extra fields) ---
build_plugin_hooks() {
    local combined='{}'
    while IFS='|' read -r pname hooks_file; do
        [ -z "$pname" ] && continue
        local plugin_path="~/.claude/plugins/$pname"

        # Read hooks, resolve ${CLAUDE_PLUGIN_ROOT}, default missing matcher to "*"
        local resolved
        resolved=$(jq --arg ppath "$plugin_path" '
          (.hooks // {}) | to_entries | map(
            {
              key: .key,
              value: (.value | map(
                .hooks |= map(
                  if .command then
                    .command |= gsub("\\$\\{CLAUDE_PLUGIN_ROOT\\}"; $ppath)
                  else . end
                ) |
                if .matcher == null then .matcher = "*" else . end
              ))
            }
          ) | from_entries
        ' "$hooks_file" 2>/dev/null)

        if [ -z "$resolved" ] || [ "$resolved" = "null" ]; then
            echo -e "  ${YELLOW}⚠️  $pname: failed to parse hooks.json — skipping${NC}" >&2
            continue
        fi

        combined=$(echo "$combined" | jq --argjson new "$resolved" '
          reduce ($new | to_entries[]) as $entry (.;
            .[$entry.key] = ((.[$entry.key] // []) + $entry.value)
          )
        ')
    done < <(discover_plugins)

    echo "$combined"
}

# --- Main merge ---
plugins_found=$(discover_plugins)
if [ -z "$plugins_found" ]; then
    echo "No plugin hooks found to merge"
    exit 0
fi

echo "Discovered plugins with hooks:"
echo "$plugins_found" | while IFS='|' read -r pname hooks_file; do
    events=$(jq -r '.hooks // {} | keys | join(", ")' "$hooks_file" 2>/dev/null)
    echo "  $pname: $events"
done

plugin_hooks=$(build_plugin_hooks)

if [ "$DRY_RUN" = true ]; then
    count=$(echo "$plugin_hooks" | jq '[.[]?[]] | length')
    echo "Would merge $count matcher-group(s) into settings.json"
    exit 0
fi

backup

# Strip existing plugin hooks (clean slate), then merge new ones
result=$(strip_plugin_hooks | jq --argjson plugin_hooks "$plugin_hooks" '
  .hooks |= (
    . as $current |
    ($plugin_hooks | to_entries) | reduce .[] as $entry (
      $current;
      .[$entry.key] = ((.[$entry.key] // []) + $entry.value)
    )
  )
')

echo "$result" | jq '.' > "$SETTINGS_FILE"

# Summary
merged_count=$(jq --arg pfx "$PLUGIN_PATH_PREFIX" '
  [.hooks[]?[]? | select(.hooks // [] | any(.command // "" | startswith($pfx)))] | length
' "$SETTINGS_FILE")
plugin_count=$(jq -r --arg pfx "$PLUGIN_PATH_PREFIX" '
  [.hooks[]?[]? | select(.hooks // [] | any(.command // "" | startswith($pfx)))
   | .hooks[].command // "" | capture("~/.claude/plugins/(?<name>[^/]+)/") | .name]
  | unique | length
' "$SETTINGS_FILE")
echo -e "${GREEN}Merged $merged_count matcher-group(s) from $plugin_count plugin(s)${NC}"
