#!/usr/bin/env bash
# PreToolUse hook for ExitPlanMode: block unless review-plan has produced
# a slug-scoped gate file at ~/.claude/plans/.review-ready-<slug>.
#
# Active slug comes from the session transcript (see _active-plan-slug.sh),
# not filesystem mtime — the plans dir often holds stale .md files from
# other sessions, and an mtime-based guess misidentifies the active plan.
set -eo pipefail

HOOK_INPUT=$(cat)
. "${BASH_SOURCE[0]%/*}/_active-plan-slug.sh"
resolve_active_slug "$HOOK_INPUT"

# No active plan signal — nothing to gate; allow silently.
[ -z "$ACTIVE_SLUG" ] && exit 0

plan_path="$HOME/.claude/plans/${ACTIVE_SLUG}.md"
gate_ready="$HOME/.claude/plans/.review-ready-$ACTIVE_SLUG"
gate_exited="$HOME/.claude/plans/.exited-$ACTIVE_SLUG"

# Allow if the gate (or prior-exit sentinel) exists AND the plan has not been
# modified since — a newer plan mtime means the review is stale.
if [ -f "$gate_ready" ] && ! [ "$plan_path" -nt "$gate_ready" ]; then exit 0; fi
if [ -f "$gate_exited" ] && ! [ "$plan_path" -nt "$gate_exited" ]; then exit 0; fi

# Block: review-plan has not run, or plan was updated since last review.
reason="EXITPLANMODE_BLOCKED

Required recovery:
  1. Output exactly one line to the user: \"Running review-plan first...\"
  2. Invoke /review-suite:review-plan on: ${plan_path}
     review-plan will call ExitPlanMode automatically on PASS.
Do not pause, do not ask the user for confirmation, do not add any other prose."
jq -cn --arg reason "$reason" '{"decision":"block","reason":$reason}'
