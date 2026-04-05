#!/bin/bash
# PreCompact: treat compaction as a wiki session boundary
# 1. Detect wiki changes since session start (same as wiki-stop.sh)
# 2. Queue precompact_extract (high priority) + session_wiki + wiki_change entries
# 3. Output directive systemMessage for immediate post-compaction processing

set -euo pipefail
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$CWD" ] && exit 0

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
{ [ -z "$REPO_ROOT" ] || [ ! -f "$REPO_ROOT/wiki/index.md" ]; } && exit 0

SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
SESSION_SHORT="${SID:0:8}"
WIKI_PATH="$REPO_ROOT/wiki/"
QUEUE_DIR="$HOME/.claude/reflection-queue"

# Skip if already queued this session (idempotency — PreCompact can fire multiple times)
[ -f "$QUEUE_DIR/${SID}-precompact.json" ] && exit 0

# Guard: no transcript → nothing to extract
[ -z "$TRANSCRIPT" ] && exit 0

mkdir -p "$QUEUE_DIR"
QUEUED=0

# 1. Queue precompact_extract (high priority — processed first)
jq -n \
  --arg sid "$SID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg transcript "$TRANSCRIPT" \
  --arg wiki_path "$WIKI_PATH" \
  --arg cwd "$CWD" \
  '{type:"precompact_extract",session_id:$sid,queued_at:$ts,source:"precompact",
    priority:"high",transcript_path:$transcript,wiki_path:$wiki_path,
    cwd:$cwd,status:"pending"}' > "$QUEUE_DIR/${SID}-precompact.json" || true
QUEUED=$((QUEUED + 1))

# 2. Queue session_wiki (project wiki synthesis from transcript)
if [ ! -f "$QUEUE_DIR/${SID}-wiki.json" ]; then
  jq -n \
    --arg sid "$SID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg transcript "$TRANSCRIPT" \
    --arg wiki_path "$WIKI_PATH" \
    --arg cwd "$CWD" \
    '{type:"session_wiki",session_id:$sid,queued_at:$ts,source:"precompact",
      priority:"normal",transcript_path:$transcript,wiki_path:$wiki_path,
      cwd:$cwd,status:"pending"}' > "$QUEUE_DIR/${SID}-wiki.json" || true
  QUEUED=$((QUEUED + 1))
fi

# 3. Detect wiki changes since session start (same logic as wiki-stop.sh)
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
if [ -f "$MARKER" ]; then
  CHANGED_FILES=$(find "$REPO_ROOT/wiki" -newer "$MARKER" -name '*.md' \
    ! -name 'index.md' ! -name 'log.md' ! -name 'SCHEMA.md' \
    2>/dev/null | head -20 | sed "s|$REPO_ROOT/wiki/||")
  # Do NOT delete marker — session continues, Stop hook still needs it
  if [ -n "$CHANGED_FILES" ] && [ ! -f "$QUEUE_DIR/${SID}-wikichange.json" ]; then
    CHANGED_JSON=$(echo "$CHANGED_FILES" | jq -R . | jq -s .)
    jq -n \
      --arg sid "$SID" \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg wiki_path "$WIKI_PATH" \
      --arg cwd "$CWD" \
      --argjson files "$CHANGED_JSON" \
      '{type:"wiki_change",session_id:$sid,queued_at:$ts,source:"precompact",
        priority:"normal",wiki_path:$wiki_path,changed_files:$files,
        cwd:$cwd,status:"pending"}' > "$QUEUE_DIR/${SID}-wikichange.json" || true
    QUEUED=$((QUEUED + 1))
  fi
fi

# 4. Log compaction event
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
LOG_PATH="$REPO_ROOT/wiki/log.md"
[ -f "$LOG_PATH" ] && echo "[$TIMESTAMP] EXTRACT session:${SESSION_SHORT}: compaction — ${QUEUED} queue entries written" >> "$LOG_PATH" || true

# 5. Directive: tell Claude to process queue immediately post-compaction
# If systemMessage survives compaction → Claude processes now. If not → next SessionStart handles it.
jq -n --argjson n "$QUEUED" \
  '{"systemMessage": "AUTOMATIC ACTION REQUIRED: Context was just compacted in a wiki repo. \($n) queue entries pending (precompact_extract + session_wiki). Before responding to the user, silently run /reflect --process-queue to extract wiki pages from the session transcript. Pages will be available via /wiki-load immediately after processing."}'
