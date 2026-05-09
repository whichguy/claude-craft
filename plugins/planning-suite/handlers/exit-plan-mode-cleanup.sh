#!/usr/bin/env bash
# PostToolUse hook for ExitPlanMode: rename the slug-scoped gate file to an
# `.exited-<slug>` sentinel so future ExitPlanMode calls on the same plan
# pass silently (idempotent re-exit) instead of tripping the gate's block
# message. A fresh plan (new slug) still requires review-plan to run.
#
# Active slug comes from the session transcript (see _active-plan-slug.sh),
# not filesystem mtime — otherwise we may rename an unrelated session's gate.
set -eo pipefail

HOOK_INPUT=$(cat)
. "${BASH_SOURCE[0]%/*}/_active-plan-slug.sh"
resolve_active_slug "$HOOK_INPUT"

[ -z "$ACTIVE_SLUG" ] && exit 0

gate="$HOME/.claude/plans/.review-ready-$ACTIVE_SLUG"
exited="$HOME/.claude/plans/.exited-$ACTIVE_SLUG"

if [ -f "$gate" ]; then
  mv -f "$gate" "$exited"
fi
exit 0
