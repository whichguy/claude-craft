#!/bin/bash
# Stop: detect wiki changes via find-newer, queue for synthesis, log SESSION_END
# Async — no session-close latency
# Uses mkdir-based lock to serialize concurrent session-end scripts (macOS flock unavailable)

command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$CWD" ] && exit 0

# Walk up to find wiki
DIR="$CWD"; LOG_PATH=""; WIKI_PATH=""; REPO_ROOT=""
for i in 1 2 3 4; do
  if [ -f "$DIR/wiki/log.md" ]; then
    LOG_PATH="$DIR/wiki/log.md"; WIKI_PATH="$DIR/wiki/"; REPO_ROOT="$DIR"; break
  fi
  PARENT=$(dirname "$DIR"); [ "$PARENT" = "$DIR" ] && break; DIR="$PARENT"
done
[ -z "$WIKI_PATH" ] && exit 0

SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
SESSION_SHORT="${SID:0:8}"

# Session marker: created by wiki-detect.sh at session start
# find -newer gives us all wiki files modified during this session
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
CHANGED_FILES=""
if [ -f "$MARKER" ]; then
  CHANGED_FILES=$(find "$REPO_ROOT/wiki" -newer "$MARKER" -name '*.md' \
    ! -name 'index.md' ! -name 'log.md' ! -name 'SCHEMA.md' \
    2>/dev/null | head -20 | sed "s|$REPO_ROOT/wiki/||")
  rm -f "$MARKER"  # Clean up marker
fi

# Acquire lock — serialize concurrent Stop hooks from multiple sessions
# Uses mkdir (atomic on POSIX) since flock is not available on macOS without brew
LOCK_DIR="$HOME/.claude/.wiki-stop-lock"
LOCK_ACQUIRED=0
for attempt in 1 2 3 4 5; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_ACQUIRED=1
    break
  fi
  # Check if stale lock (> 30s old) and remove it
  LOCK_AGE=$(( $(date +%s) - $(stat -f %m "$LOCK_DIR" 2>/dev/null || echo 0) ))
  [ "$LOCK_AGE" -gt 30 ] && rmdir "$LOCK_DIR" 2>/dev/null || true
  sleep 0.5
done

# Cleanup function — always remove lock on exit
cleanup() { rmdir "$LOCK_DIR" 2>/dev/null || true; }
trap cleanup EXIT

[ "$LOCK_ACQUIRED" -eq 0 ] && exit 0  # Could not acquire lock — skip to avoid concurrent writes

# Queue session → project wiki synthesis
QUEUE="$HOME/.claude/reflection-queue/${SID}-wiki.json"
if [ ! -f "$QUEUE" ] && [ -n "$TRANSCRIPT" ]; then
  jq -n \
    --arg sid "$SID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg transcript "$TRANSCRIPT" \
    --arg wiki_path "$WIKI_PATH" \
    --arg cwd "$CWD" \
    '{type:"session_wiki",session_id:$sid,queued_at:$ts,source:"stop",
      priority:"normal",transcript_path:$transcript,wiki_path:$wiki_path,
      cwd:$cwd,status:"pending"}' > "$QUEUE" 2>/dev/null || true
fi

# Queue wiki_change entry if files were modified this session
if [ -n "$CHANGED_FILES" ]; then
  CHANGED_JSON=$(echo "$CHANGED_FILES" | jq -R . | jq -s .)
  CHANGE_QUEUE="$HOME/.claude/reflection-queue/${SID}-wikichange.json"
  if [ ! -f "$CHANGE_QUEUE" ]; then
    jq -n \
      --arg sid "$SID" \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg wiki_path "$WIKI_PATH" \
      --arg cwd "$CWD" \
      --argjson files "$CHANGED_JSON" \
      '{type:"wiki_change",session_id:$sid,queued_at:$ts,source:"wiki_change",
        priority:"normal",wiki_path:$wiki_path,changed_files:$files,
        cwd:$cwd,status:"pending"}' > "$CHANGE_QUEUE" 2>/dev/null || true
  fi
fi

# Append SESSION_END to log (single-line append is POSIX-atomic, lock is extra safety)
echo "[$TIMESTAMP] SESSION_END session:${SESSION_SHORT}: closed in $(basename "$REPO_ROOT")" \
  >> "$LOG_PATH" 2>/dev/null || true
