#!/bin/bash
# SessionStart: inject project wiki context via systemMessage + additionalContext
# Cache-first: reads pre-computed display/context from wiki/.cache/
# Falls back to legacy computation on cache miss (first session after deploy)

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
{ [ -z "$CWD" ] || [[ "$CWD" != /* ]]; } && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

# Use wiki_find_root (pure directory walk, no git subprocess)
if ! wiki_find_root; then
  # No wiki found — check if this is a git repo and suggest initialization
  GIT_ROOT=""
  dir="$CWD"
  for i in 1 2 3 4; do
    if [ -d "$dir/.git" ]; then GIT_ROOT="$dir"; break; fi
    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && break
    dir="$parent"
  done
  if [ -n "$GIT_ROOT" ]; then
    # Only suggest once per repo (track in state file to avoid nagging)
    STATE_FILE="$HOME/.claude/wiki-prompted-repos.json"
    [ ! -f "$STATE_FILE" ] && echo '{}' > "$STATE_FILE"
    REPO_KEY=$(echo "$GIT_ROOT" | sed 's/[^a-zA-Z0-9]/_/g')
    if ! jq -e --arg k "$REPO_KEY" 'has($k)' "$STATE_FILE" >/dev/null 2>&1; then
      # Mark as prompted
      jq --arg k "$REPO_KEY" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.[$k] = $t' "$STATE_FILE" > "${STATE_FILE}.tmp" \
        && mv "${STATE_FILE}.tmp" "$STATE_FILE" 2>/dev/null
      REPO_NAME=$(basename "$GIT_ROOT")
      jq -n --arg display "📂 ${REPO_NAME} — no wiki. Run /wiki-init to set one up." \
        '{"systemMessage": $display}'
    fi
  fi
  exit 0
fi

# Session marker for change detection (consumed by wiki-stop.sh via find -newer)
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
touch "$MARKER" 2>/dev/null || true

wiki_log "SESSION_START" "opened in $(basename "$REPO_ROOT")"

# Read pre-computed display (cache hit: ~2ms, cache miss: legacy inline)
wiki_build_display

# Check for failed entries (moved from sync grep -rl to cached count)
QUEUE_DIR="$HOME/.claude/reflection-queue"
FAILED_COUNT=0
if [ -d "$QUEUE_DIR" ]; then
  # Escape WIKI_PATH for use in grep pattern (convert to literal string)
  WIKI_PATH_ESCAPED=$(printf '%s\n' "$WIKI_PATH" | sed 's/[]\.*^$()+?{|[]/\\&/g')
  # Count failed queue entries for this wiki (BSD xargs compatible)
  failed_files=$(grep -rl '"status".*"failed"' "$QUEUE_DIR/" 2>/dev/null | grep -E '\-(wiki|wikichange)\.json$' || true)
  if [ -n "$failed_files" ]; then
    FAILED_COUNT=$(echo "$failed_files" | xargs grep -l "\"wiki_path\":\"$WIKI_PATH_ESCAPED\"" 2>/dev/null | wc -l | tr -d ' ')
  fi
  FAILED_COUNT=${FAILED_COUNT:-0}
fi

if [ "$FAILED_COUNT" -gt 0 ]; then
  DISPLAY="${DISPLAY}"$'\n'"   ⚠️ ${FAILED_COUNT} wiki synthesis failed"
fi
DISPLAY="${DISPLAY}"$'\n'"   Switch repos? Run /wiki-load <topic> to refresh context."

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "additionalContext": $context}'
