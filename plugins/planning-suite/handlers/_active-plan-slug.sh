#!/usr/bin/env bash
# Shared helper: identify the active plan's slug for the current session.
#
# Sourced by exit-plan-mode-gate.sh and exit-plan-mode-cleanup.sh. Call
# `resolve_active_slug "$HOOK_INPUT"` where $HOOK_INPUT is the raw JSON the
# PreToolUse / PostToolUse hook received on stdin. Sets ACTIVE_SLUG to the
# slug, or "" if undeterminable.
#
# Strategy: read the canonical `.slug` field that the harness stamps onto every
# transcript JSONL event. It is set when the plan file is created and stays
# constant for the session — immune to bash command strings, tool descriptions,
# and Read results that mention other plan paths.

resolve_active_slug() {
  local input="$1"
  local transcript slug=""
  transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""' 2>/dev/null || true)
  if [ -n "$transcript" ] && [ -r "$transcript" ]; then
    # Reverse the file (BSD `tail -r` on macOS, `tac` on Linux) and pick the
    # most recent line with a non-empty `.slug` — early lines may omit it.
    slug=$( ( tail -r "$transcript" 2>/dev/null || tac "$transcript" 2>/dev/null ) \
            | jq -r 'select(.slug // "" != "") | .slug' 2>/dev/null \
            | head -1 || true)
  fi
  # Match Python plan_slug() for the shared .review-ready-<slug>,
  # .needs-investigation-<slug>, etc. sentinel families: close the
  # special-char and length divergence classes, but do not unify the slug
  # source. Transcript `.slug` and plan-file basename can still differ if the
  # plan is renamed or a second plan starts mid-session; that is accepted here.
  slug=$(printf '%s' "$slug" | sed 's/[^A-Za-z0-9._-]/-/g' | cut -c1-64)
  ACTIVE_SLUG="$slug"
}
