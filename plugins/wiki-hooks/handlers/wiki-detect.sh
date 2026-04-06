#!/bin/bash
# SessionStart: inject project wiki context via systemMessage + additionalContext
# Pattern: fast check → build display → output JSON

trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0
. "$(dirname "$0")/wiki-common.sh"

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
{ [ -z "$CWD" ] || [[ "$CWD" != /* ]]; } && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$REPO_ROOT" ] && exit 0
[ ! -f "$REPO_ROOT/wiki/index.md" ] && exit 0

WIKI_PATH="$REPO_ROOT/wiki/"
LOG_PATH="$REPO_ROOT/wiki/log.md"

# Session marker for change detection (consumed by wiki-stop.sh via find -newer)
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
touch "$MARKER" 2>/dev/null || true

wiki_log "SESSION_START" "opened in $(basename "$REPO_ROOT")"

# Expire old queue entries (housekeeping)
QUEUE_DIR="$HOME/.claude/reflection-queue"
if [ -d "$QUEUE_DIR" ]; then
  find "$QUEUE_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
fi

# Check for failed entries (user-actionable alert)
FAILED_COUNT=$(grep -rl '"status".*"failed"' "$HOME/.claude/reflection-queue/" 2>/dev/null | grep -c -E '\-(wiki|wikichange)\.json$' || true)
FAILED_COUNT=${FAILED_COUNT:-0}

wiki_build_display
if [ "$FAILED_COUNT" -gt 0 ]; then
  DISPLAY="${DISPLAY}"$'\n'"   ⚠️ ${FAILED_COUNT} wiki synthesis failed"
fi
DISPLAY="${DISPLAY}"$'\n'"   Switch repos? Run /wiki-load <topic> to refresh context."

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "additionalContext": $context}'
