#!/bin/bash
# PreCompact: queue current context for wiki extraction before Claude Code compresses it
# High-priority queue entry — processed before session entries at next SessionStart

set -euo pipefail
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$CWD" ] && exit 0

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$REPO_ROOT" ] || [ ! -f "$REPO_ROOT/wiki/index.md" ] && exit 0

SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
QUEUE="$HOME/.claude/reflection-queue/${SID}-precompact.json"

[ -f "$QUEUE" ] && exit 0  # Already queued this session

# Guard: don't queue if transcript_path is empty — Sonnet would have nothing to read
# PreCompact without a transcript path is a no-op for wiki extraction
[ -z "$TRANSCRIPT" ] && exit 0

jq -n \
  --arg sid "$SID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg transcript "$TRANSCRIPT" \
  --arg wiki_path "$REPO_ROOT/wiki/" \
  --arg cwd "$CWD" \
  '{
    type: "precompact_extract",
    session_id: $sid,
    queued_at: $ts,
    source: "precompact",
    priority: "high",
    transcript_path: $transcript,
    wiki_path: $wiki_path,
    cwd: $cwd,
    status: "pending"
  }' > "$QUEUE" || true

jq -n '{"systemMessage": "📝 Extracting key concepts to wiki before compaction..."}'
