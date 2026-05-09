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
  # `|| true` on both pipelines: under `set -eo pipefail` (inherited from the
  # caller when sourced), jq's exit-5 on bad input and grep's exit-1 on no-match
  # would otherwise propagate out of $(...) and abort the script before the
  # mtime fallback runs — defeating the whole point of having a fallback.
  transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""' 2>/dev/null || true)
  if [ -n "$transcript" ] && [ -r "$transcript" ]; then
    # Slug regex assumes lowercase-alphanumeric-with-dashes (current generator output).
    # If that ever changes, transcript matches will silently miss and the mtime
    # fallback will (incorrectly) take over — re-introducing the original bug.
    slug=$(grep -oE '\.claude/plans/[a-z0-9-]+\.md' "$transcript" 2>/dev/null \
            | tail -1 | sed -E 's|.*/([^/]+)\.md|\1|' || true)
  fi
  if [ -z "$slug" ]; then
    local f
    f=$(ls -t "$HOME/.claude/plans"/*.md 2>/dev/null | head -1 || true)
    [ -n "$f" ] && slug=$(basename "$f" .md)
  fi
  ACTIVE_SLUG="$slug"
}
