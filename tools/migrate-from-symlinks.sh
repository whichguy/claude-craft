#!/usr/bin/env bash
# tools/migrate-from-symlinks.sh — one-shot, idempotent.
#
# For users who previously ran ./install.sh (the symlink-based installer):
#   1. Removes hook entries from ~/.claude/settings.json that match the
#      patterns the old install.sh used to inject (ExitPlanMode review-plan
#      gate). Keeps a .bak.
#   2. Walks ~/.claude/{agents,skills,commands,prompts,references}/ and
#      removes symlinks whose target is inside the claude-craft repo.
#   3. Prints the marketplace install commands as next steps.
#
# Idempotent: safe to re-run. Detects already-migrated state and exits clean.
set -eo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

# ----------------------------------------------------------------------------
# 1) Strip the ExitPlanMode hook injection from ~/.claude/settings.json
# ----------------------------------------------------------------------------
strip_settings_hook() {
  if [ ! -f "$SETTINGS" ]; then
    yellow "→ no $SETTINGS — skipping hook strip"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    red "ERROR: jq required to safely edit $SETTINGS"; exit 1
  fi

  # Match: any PreToolUse[*] entry whose matcher == "ExitPlanMode"
  local has_hook
  has_hook=$(jq -r '.hooks.PreToolUse[]? | select(.matcher == "ExitPlanMode") | .matcher' "$SETTINGS" 2>/dev/null | head -1)

  if [ -z "$has_hook" ]; then
    green "✅ no legacy ExitPlanMode hook in settings.json"
    return
  fi

  cp "$SETTINGS" "$SETTINGS.bak"
  jq '.hooks.PreToolUse = [.hooks.PreToolUse[]? | select(.matcher != "ExitPlanMode")]
      | .hooks.PostToolUse = [.hooks.PostToolUse[]? | select(.matcher != "ExitPlanMode")]' \
      "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
  green "✅ removed legacy ExitPlanMode hook from settings.json (backup: $SETTINGS.bak)"
}

# ----------------------------------------------------------------------------
# 1b) Strip merged-in plugin hook entries that point at absorbed/old plugin
#     dirs (~/.claude/plugins/{wiki-hooks,craft-hooks,task-persist,
#     feedback-collector,async-workflow}/...). These were injected by the old
#     tools/merge-hooks.sh machinery; in the marketplace world the plugin
#     hooks ship via plugins/<bundle>/hooks/hooks.json and load automatically.
# ----------------------------------------------------------------------------
strip_absorbed_plugin_hooks() {
  [ -f "$SETTINGS" ] || return
  command -v jq >/dev/null 2>&1 || return

  local pattern='wiki-hooks|craft-hooks|task-persist|feedback-collector|async-workflow'
  local hits
  hits=$(jq -r --arg pat "$pattern" '
    [.. | objects | select(.command? // "" | test("\\.claude/plugins/(\($pat))/"))]
    | length' "$SETTINGS" 2>/dev/null)

  if [ "${hits:-0}" -eq 0 ]; then
    green "✅ no stale absorbed-plugin hook entries in settings.json"
    return
  fi

  [ -f "$SETTINGS.bak" ] || cp "$SETTINGS" "$SETTINGS.bak"

  jq --arg pat "$pattern" '
    def prune:
      walk(
        if type == "array" then
          map(select(
            (.. | objects | select(.command? // "" | test("\\.claude/plugins/(\($pat))/")) ) | not
          ))
        else . end
      );
    .hooks |= prune
    # also strip empty hooks-array entries left behind
    | .hooks |= with_entries(.value |= map(
        if .hooks then .hooks |= map(select(.command? != null)) else . end
      ))
    | .hooks |= with_entries(.value |= map(select(.hooks == null or (.hooks | length) > 0)))
    | .hooks |= with_entries(select(.value | length > 0))
  ' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"

  green "✅ stripped $hits absorbed-plugin hook entries from settings.json"
}

# ----------------------------------------------------------------------------
# 2) Walk extension dirs and remove symlinks pointing into claude-craft
# ----------------------------------------------------------------------------
unlink_claude_craft_symlinks() {
  local count=0
  for sub in agents skills commands prompts references; do
    local dir="$CLAUDE_DIR/$sub"
    [ -d "$dir" ] || continue
    while IFS= read -r link; do
      [ -L "$link" ] || continue
      local target
      target=$(readlink "$link")
      case "$target" in
        */claude-craft/*)
          rm -f "$link"
          count=$((count+1))
          echo "  removed: $link -> $target"
          ;;
      esac
    done < <(find "$dir" -maxdepth 1 -type l 2>/dev/null)
  done
  if [ "$count" -gt 0 ]; then
    green "✅ removed $count claude-craft symlink(s) from $CLAUDE_DIR/"
  else
    green "✅ no claude-craft symlinks remaining"
  fi
}

# ----------------------------------------------------------------------------
# 3) Print marketplace install instructions
# ----------------------------------------------------------------------------
print_next_steps() {
  cat <<EOF

----------------------------------------------------------------------
✅ Cleanup complete.

Next: install via the marketplace.

  1) Add the marketplace:
       /plugin marketplace add whichguy/claude-craft

  2) Install the bundles you want (each is independent):

       /plugin install gas-suite@claude-craft         # Apps Script tooling
       /plugin install wiki-suite@claude-craft        # project LLM wiki
       /plugin install review-suite@claude-craft      # plan + code review
       /plugin install review-bench@claude-craft      # prompt research bench
       /plugin install planning-suite@claude-craft    # architect/refactor/test
       /plugin install async-suite@claude-craft       # background workflow
       /plugin install slides-suite@claude-craft      # reveal.js / Google Slides
       /plugin install comms@claude-craft             # Slack tagging
       /plugin install form990@claude-craft           # IRS Form 990
       /plugin install plan-red-team@claude-craft     # red-team plan review
       /plugin install local-classifier@claude-craft  # Ollama prompt classifier

  3) Verify:
       /plugin list

----------------------------------------------------------------------
EOF
}

# ----------------------------------------------------------------------------
main() {
  echo "Migrating from symlink-based install to marketplace..."
  echo "  CLAUDE_DIR: $CLAUDE_DIR"
  echo "  REPO_DIR:   $REPO_DIR"
  echo
  strip_settings_hook
  strip_absorbed_plugin_hooks
  unlink_claude_craft_symlinks
  print_next_steps
}

main "$@"
