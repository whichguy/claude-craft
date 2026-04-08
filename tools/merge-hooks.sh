#!/bin/bash
# merge-hooks.sh — Merge plugin hooks into ~/.claude/settings.json
#
# Reads hooks/hooks.json from each symlinked plugin in ~/.claude/plugins/,
# resolves ${CLAUDE_PLUGIN_ROOT} to ~/.claude/plugins/<name>, tags each
# matcher-group with "_plugin" for idempotent re-merge and clean unmerge.
#
# Usage:
#   merge-hooks.sh                  # Merge all plugin hooks
#   merge-hooks.sh --unmerge        # Remove all plugin-contributed hooks
#   merge-hooks.sh --dry-run        # Show what would change
#   merge-hooks.sh --status         # Show current merge state

set -eo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
DRY_RUN=false
UNMERGE=false
STATUS=false

# Colors
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

# Preflight
if ! command -v jq >/dev/null 2>&1; then
    echo -e "${RED}jq required but not found${NC}"
    exit 1
fi
[ ! -f "$SETTINGS_FILE" ] && echo '{}' > "$SETTINGS_FILE"

# --- Status ---
if [ "$STATUS" = true ]; then
    merged=$(jq -r '[.hooks[]?[]? | select(._plugin) | ._plugin] | unique | .[]' "$SETTINGS_FILE" 2>/dev/null)
    if [ -z "$merged" ]; then
        echo "No plugin hooks currently merged into settings.json"
    else
        echo "Merged plugins:"
        echo "$merged" | while read -r p; do
            count=$(jq --arg p "$p" '[.hooks[]?[]? | select(._plugin == $p)] | length' "$SETTINGS_FILE")
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
    # Keep only last 5 merge-hooks backups
    ls -t "$backup_dir"/settings.json.pre-merge-hooks.* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
}

# --- Strip all plugin-contributed entries ---
strip_plugin_hooks() {
    jq '
      .hooks |= (
        (. // {}) | to_entries | map(
          .value |= map(select(has("_plugin") | not))
        ) | from_entries
      ) |
      .hooks |= with_entries(select(.value | length > 0))
    ' "$SETTINGS_FILE"
}

# --- Unmerge ---
if [ "$UNMERGE" = true ]; then
    if [ "$DRY_RUN" = true ]; then
        count=$(jq '[.hooks[]?[]? | select(._plugin)] | length' "$SETTINGS_FILE")
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
        # Only process symlinked plugins (not marketplace cache dirs)
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

# --- Build merged plugin hooks JSON ---
build_plugin_hooks() {
    local combined='{}' 
    while IFS='|' read -r pname hooks_file; do
        [ -z "$pname" ] && continue
        local plugin_path="~/.claude/plugins/$pname"

        # Read hooks, tag with _plugin, resolve ${CLAUDE_PLUGIN_ROOT}
        local tagged
        tagged=$(jq --arg pname "$pname" --arg ppath "$plugin_path" '
          (.hooks // {}) | to_entries | map(
            {
              key: .key,
              value: (.value | map(
                . + {"_plugin": $pname} |
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

        if [ -z "$tagged" ] || [ "$tagged" = "null" ]; then
            echo -e "  ${YELLOW}⚠️  $pname: failed to parse hooks.json — skipping${NC}" >&2
            continue
        fi

        # Merge into combined
        combined=$(echo "$combined" | jq --argjson new "$tagged" '
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
    count=$(echo "$plugin_hooks" | jq '[.[]?[] | select(._plugin)] | length')
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
merged_count=$(jq '[.hooks[]?[]? | select(._plugin)] | length' "$SETTINGS_FILE")
plugin_count=$(jq -r '[.hooks[]?[]? | select(._plugin) | ._plugin] | unique | length' "$SETTINGS_FILE")
echo -e "${GREEN}Merged $merged_count matcher-group(s) from $plugin_count plugin(s)${NC}"
