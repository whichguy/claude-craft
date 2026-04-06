#!/bin/bash
# SessionStart(clear): treat /clear as a session boundary for wiki
# Atomic rename of session marker prevents race with wiki-detect.sh
# PID in clearing filename identifies owner for orphan cleanup

trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$CWD" ] && exit 0

# Walk up to find wiki (same as wiki-stop.sh)
DIR="$CWD"; WIKI_PATH=""; REPO_ROOT=""
for i in 1 2 3 4; do
  if [ -f "$DIR/wiki/log.md" ]; then
    WIKI_PATH="$DIR/wiki/"; REPO_ROOT="$DIR"; break
  fi
  PARENT=$(dirname "$DIR"); [ "$PARENT" = "$DIR" ] && break; DIR="$PARENT"
done
[ -z "$WIKI_PATH" ] && exit 0

SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
SESSION_SHORT="${SID:0:8}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
CLEAR_TS=$(date '+%s')

MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
CLEARING="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-clearing-$$"

# Atomic grab — mv is POSIX-atomic. PID in filename identifies owner for orphan cleanup.
mv "$MARKER" "$CLEARING" 2>/dev/null || exit 0

# Detect wiki changes since session start (using original marker mtime via rename)
CHANGED_FILES=$(find "$REPO_ROOT/wiki" -newer "$CLEARING" -name '*.md' \
  ! -name 'index.md' ! -name 'log.md' ! -name 'SCHEMA.md' \
  2>/dev/null | head -20 | sed "s|$REPO_ROOT/wiki/||")

QUEUE_DIR="$HOME/.claude/reflection-queue"
mkdir -p "$QUEUE_DIR"

# Queue session_wiki — only if transcript available (timestamp-suffixed for multiple clears)
if [ -n "$TRANSCRIPT" ]; then
  QUEUE="$QUEUE_DIR/${SID}-clear-${CLEAR_TS}.json"
  jq -n \
    --arg sid "$SID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg transcript "$TRANSCRIPT" \
    --arg wiki_path "$WIKI_PATH" \
    --arg cwd "$CWD" \
    '{type:"session_wiki",session_id:$sid,queued_at:$ts,source:"clear",
      priority:"normal",transcript_path:$transcript,wiki_path:$wiki_path,
      cwd:$cwd,status:"pending"}' > "$QUEUE" 2>/dev/null || true
fi

# Queue wiki_change if files were modified (independent of transcript — matches wiki-stop.sh)
if [ -n "$CHANGED_FILES" ]; then
  CHANGED_JSON=$(echo "$CHANGED_FILES" | jq -R . | jq -s .)
  CHANGE_QUEUE="$QUEUE_DIR/${SID}-clearchange-${CLEAR_TS}.json"
  jq -n \
    --arg sid "$SID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg wiki_path "$WIKI_PATH" \
    --arg cwd "$CWD" \
    --argjson files "$CHANGED_JSON" \
    '{type:"wiki_change",session_id:$sid,queued_at:$ts,source:"clear",
      priority:"normal",wiki_path:$wiki_path,changed_files:$files,
      cwd:$cwd,status:"pending"}' > "$CHANGE_QUEUE" 2>/dev/null || true
fi

# Log and cleanup
echo "[$TIMESTAMP] SESSION_CLEAR session:${SESSION_SHORT}: /clear boundary in $(basename "$REPO_ROOT")" \
  >> "$REPO_ROOT/wiki/log.md" 2>/dev/null || true
rm -f "$CLEARING"
