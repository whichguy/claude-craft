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

# Allow if review-plan wrote the gate, OR if a previous ExitPlanMode for this
# slug already succeeded (cleanup leaves an `.exited-<slug>` sentinel) — makes
# repeat ExitPlanMode calls on the same plan idempotent silent no-ops.
if [ -f "$HOME/.claude/plans/.review-ready-$ACTIVE_SLUG" ] \
   || [ -f "$HOME/.claude/plans/.exited-$ACTIVE_SLUG" ]; then
  exit 0
fi

# Block: review-plan not yet run, or gate already cleaned up after a prior
# successful ExitPlanMode (do not retry).
printf '%s' '{"decision":"block","reason":"Gate file not found. Either review-plan has not been run yet (run it first), or ExitPlanMode already succeeded and the gate was cleaned up (do not retry)."}'
