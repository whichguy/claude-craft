#!/bin/bash
# SessionStart: inject project wiki context + surface raw/ files + global cross-refs
# Pattern: fast check → build rich hint → output systemMessage

set -euo pipefail
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

# Check for failed queue entries (actionable alert — keep in discovery)
# Use grep instead of jq+xargs — avoids pipefail issues with set -eo pipefail
FAILED_COUNT=$(grep -rl '"status".*"failed"' "$HOME/.claude/reflection-queue/" 2>/dev/null | grep -c -E '\-(wiki|wikichange)\.json$' || true)
FAILED_COUNT=${FAILED_COUNT:-0}
FAILED_HINT=""
if [ "$FAILED_COUNT" -gt 0 ]; then FAILED_HINT=$'\n'"⚠️ ${FAILED_COUNT} wiki synthesis failed — check ~/.claude/reflection-queue/"; fi

# Build discovery message (~50-80 tokens)
if [ -n "$TOPICS" ]; then
  MSG="📂 Wiki: $(basename "$REPO_ROOT") (${PAGE_COUNT} pages: ${TOPICS}${OVERFLOW}) · /wiki-load <topic> · /wiki-query <question>${FAILED_HINT}"
else
  MSG="📂 Wiki: $(basename "$REPO_ROOT") (${PAGE_COUNT} pages) · /wiki-load <topic> · /wiki-query <question>${FAILED_HINT}"
fi

jq -n --arg msg "$MSG" '{"systemMessage": $msg}'
