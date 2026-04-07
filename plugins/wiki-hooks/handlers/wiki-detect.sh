#!/bin/bash
# SessionStart: inject project wiki context via systemMessage + additionalContext
# Cache-first: reads pre-computed display/context from wiki/.cache/
# Falls back to legacy computation on cache miss (first session after deploy)

trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0
. "$(dirname "$0")/wiki-common.sh"

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
{ [ -z "$CWD" ] || [[ "$CWD" != /* ]]; } && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

# Use wiki_find_root (pure directory walk, no git subprocess)
wiki_find_root || exit 0

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
  FAILED_COUNT=$(grep -rl '"status".*"failed"' "$QUEUE_DIR/" 2>/dev/null | grep -c -E '\-(wiki|wikichange)\.json$' || true)
  FAILED_COUNT=${FAILED_COUNT:-0}
fi

if [ "$FAILED_COUNT" -gt 0 ]; then
  DISPLAY="${DISPLAY}"$'\n'"   ⚠️ ${FAILED_COUNT} wiki synthesis failed"
fi
DISPLAY="${DISPLAY}"$'\n'"   Switch repos? Run /wiki-load <topic> to refresh context."

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "additionalContext": $context}'
