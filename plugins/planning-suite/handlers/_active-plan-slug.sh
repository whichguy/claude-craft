#!/usr/bin/env bash
# Shared helper: identify the active plan's slug for the current session.
#
# Sourced by exit-plan-mode-gate.sh and exit-plan-mode-cleanup.sh. Call
# `resolve_active_slug "$HOOK_INPUT"` where $HOOK_INPUT is the raw JSON the
# PreToolUse / PostToolUse hook received on stdin. Sets ACTIVE_SLUG to the
# slug, or "" if undeterminable.
#
# Strategy: read the session's transcript (path comes from the hook payload)
# and pick the most recent `.claude/plans/<slug>.md` reference. The plan file
# is mentioned repeatedly in transcript JSONL (Plan File Info system reminder,
# tool_use events for plan Write/Edit), so the latest such mention reliably
# names the active plan even when the plans dir is full of stale files from
# other sessions. Falls back to the legacy mtime heuristic only if the
# transcript is missing/unreadable.

resolve_active_slug() {
  local input="$1"
  local transcript slug=""
  transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""' 2>/dev/null)
  if [ -n "$transcript" ] && [ -r "$transcript" ]; then
    slug=$(grep -oE '\.claude/plans/[a-z0-9-]+\.md' "$transcript" 2>/dev/null \
            | tail -1 | sed -E 's|.*/([^/]+)\.md|\1|')
  fi
  if [ -z "$slug" ]; then
    local f
    f=$(ls -t "$HOME/.claude/plans"/*.md 2>/dev/null | head -1 || true)
    [ -n "$f" ] && slug=$(basename "$f" .md)
  fi
  ACTIVE_SLUG="$slug"
}
