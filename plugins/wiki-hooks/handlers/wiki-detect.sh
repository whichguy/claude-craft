#!/bin/bash
# SessionStart: inject project wiki context + surface raw/ files + global cross-refs
# Pattern: fast check → build rich hint → output systemMessage + additionalContext

# SAFETY: Never exit non-zero — a failing SessionStart hook should not block session init.
# No set -e. Use || true on individual commands. Trap guarantees exit 0.
trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0  # Subagents inherit parent context

CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
{ [ -z "$CWD" ] || [[ "$CWD" != /* ]]; } && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$REPO_ROOT" ] && exit 0

INDEX_PATH="$REPO_ROOT/wiki/index.md"
[ ! -f "$INDEX_PATH" ] && exit 0  # No wiki — silent exit

SESSION_SHORT=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null | cut -c1-8 || echo "unknown")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Session marker: created NOW, consumed by wiki-stop.sh via `find -newer` to detect wiki changes
# Named with session short ID so concurrent sessions have independent markers (no interference)
# Note: SESSION_SHORT is 8 chars of UUID — collision probability is negligible (1 in 4 billion
# for any two concurrent sessions). In the unlikely event of collision, both sessions write to
# the same marker; the later Stop hook may see an empty change set. Acceptable for developer-local use.
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
touch "$MARKER" 2>/dev/null || true

# Log session start (safe write — || true ensures we never crash before systemMessage output)
LOG_PATH="$REPO_ROOT/wiki/log.md"
[ -f "$LOG_PATH" ] && echo "[$TIMESTAMP] SESSION_START session:${SESSION_SHORT}: opened in $(basename "$REPO_ROOT")" >> "$LOG_PATH" || true

# --- Progressive disclosure Tier 1: discovery line with topic names only ---
# Full index, stale detection, raw/ counts, global cross-refs → deferred to /wiki-load and /wiki-lint (Tier 2+3).
# This outputs ~50-80 tokens vs ~370-1200 for the full index. Avoids context rot from irrelevant info.

PAGE_COUNT=$(grep -c '^|' "$INDEX_PATH" 2>/dev/null || true)
PAGE_COUNT=${PAGE_COUNT:-2}
PAGE_COUNT=$((PAGE_COUNT > 2 ? PAGE_COUNT - 2 : 0))

# Extract entity topic names (first 10, filenames without extension)
# These let Claude match user questions against available wiki topics
TOPICS=$(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | sed 's/\.md$//' | head -10 | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
TOPIC_COUNT=$(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | wc -l | tr -d ' ')
OVERFLOW=""
# Note: use if/then/fi instead of [ ] && ... — set -e kills the script on false [ ] in && chains
if [ "$TOPIC_COUNT" -gt 10 ]; then OVERFLOW=", +$((TOPIC_COUNT - 10)) more"; fi

# Check for failed queue entries (actionable alert — keep in display)
FAILED_COUNT=$(grep -rl '"status".*"failed"' "$HOME/.claude/reflection-queue/" 2>/dev/null | grep -c -E '\-(wiki|wikichange)\.json$' || true)
FAILED_COUNT=${FAILED_COUNT:-0}

# Expire old queue entries on session start (housekeeping)
QUEUE_DIR="$HOME/.claude/reflection-queue"
if [ -d "$QUEUE_DIR" ]; then
  find "$QUEUE_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
fi

# Build user-facing display (systemMessage — terminal only, multi-line with separators)
REPO_NAME=$(basename "$REPO_ROOT")
SEP="   ─────────────────────────────────────"

if [ -n "$TOPICS" ]; then
  TOPIC_DISPLAY=$(echo "$TOPICS" | sed 's/, / · /g')
  DISPLAY="📂 ${REPO_NAME} wiki · ${PAGE_COUNT} pages · ${TOPIC_COUNT} topics"
  DISPLAY="${DISPLAY}"$'\n'"${SEP}"
  DISPLAY="${DISPLAY}"$'\n'"   ${TOPIC_DISPLAY}${OVERFLOW}"
  DISPLAY="${DISPLAY}"$'\n'"${SEP}"
  DISPLAY="${DISPLAY}"$'\n'"   /wiki-load <topic>  ·  /wiki-query <question>"
else
  DISPLAY="📂 ${REPO_NAME} wiki · ${PAGE_COUNT} pages"
  DISPLAY="${DISPLAY}"$'\n'"   /wiki-load <topic>  ·  /wiki-query <question>"
fi
if [ "$FAILED_COUNT" -gt 0 ]; then
  DISPLAY="${DISPLAY}"$'\n'"   ⚠️ ${FAILED_COUNT} wiki synthesis failed"
fi

# Build Claude context (additionalContext — context injection only, no emoji)
if [ -n "$TOPICS" ]; then
  CONTEXT="Wiki available: ${REPO_NAME} (${PAGE_COUNT} pages). Topics: ${TOPICS}${OVERFLOW}. Use /wiki-load <topic> to load context. Use /wiki-query <question> to synthesize answers."
else
  CONTEXT="Wiki available: ${REPO_NAME} (${PAGE_COUNT} pages). Use /wiki-load <topic> to load context. Use /wiki-query <question> to synthesize answers."
fi

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "additionalContext": $context}'
