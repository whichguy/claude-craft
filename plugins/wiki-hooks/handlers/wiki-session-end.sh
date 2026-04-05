#!/bin/bash
# SessionEnd: Ctrl-C safety net — queues session when Stop doesn't fire
# Fires on user interrupt (Ctrl-C, process kill, etc.)
# Skips if wiki-stop.sh or wiki-precompact.sh already queued this session
# SAFETY: trap guarantees exit 0 — never interfere with session termination

trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)
[ -z "$SID" ] && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"

# Skip if wiki-stop.sh or wiki-precompact.sh already queued this session
[ -f "$QUEUE_DIR/${SID}-wiki.json" ] && exit 0
[ -f "$QUEUE_DIR/${SID}-precompact.json" ] && exit 0

# Also skip if reflect's stop-hook already queued (backward compat during migration)
[ -f "$QUEUE_DIR/${SID}.json" ] && exit 0

mkdir -p "$QUEUE_DIR"
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)

# Guard: no transcript → nothing to process
[ -z "$TRANSCRIPT" ] && exit 0

# Queue as session_wiki type (wiki-format entry, not legacy reflect format)
jq -n --arg sid "$SID" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg transcript "$TRANSCRIPT" --arg cwd "$CWD" \
  '{type:"session_wiki",session_id:$sid,queued_at:$ts,source:"session-end",
    priority:"normal",transcript_path:$transcript,cwd:$cwd,status:"pending"}' \
  > "$QUEUE_DIR/${SID}-wiki.json" 2>/dev/null || true

exit 0
