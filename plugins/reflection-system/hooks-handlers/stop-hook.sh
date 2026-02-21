#!/bin/bash
# Stop capture hook - queues session for deferred reflection
# Runs SYNCHRONOUSLY (must complete before process exits)
# Skips if PreCompact already queued this session
set -euo pipefail

HOOK_INPUT=$(cat)
[[ -f "$HOME/.claude/REFLECT_OFF" ]] && exit 0

# Skip subagent events (defensive — Stop shouldn't fire for subagents, but guard anyway)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[[ -n "$AGENT_ID" ]] && exit 0

SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)
[[ -z "$SID" ]] && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"
QUEUE_FILE="$QUEUE_DIR/${SID}.json"
[[ -f "$QUEUE_FILE" ]] && exit 0

mkdir -p "$QUEUE_DIR"
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)

jq -n --arg sid "$SID" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg src "stop" --arg tp "${TRANSCRIPT:-}" --arg cwd "${CWD:-}" \
  '{session_id:$sid, queued_at:$ts, source:$src, transcript_path:$tp, cwd:$cwd, status:"pending"}' \
  > "$QUEUE_FILE"

exit 0
