#!/usr/bin/env bash
# PostToolUse hook for ExitPlanMode: rename the slug-scoped gate file to an
# `.exited-<slug>` sentinel so future ExitPlanMode calls on the same plan
# pass silently (idempotent re-exit) instead of tripping the gate's block
# message. A fresh plan (new slug) still requires review-plan to run.
set -eo pipefail

plan_file=$(ls -t "$HOME/.claude/plans"/*.md 2>/dev/null | head -1 || true)

if [ -z "$plan_file" ] || [ ! -f "$plan_file" ]; then
  exit 0
fi

slug=$(basename "$plan_file" .md)
gate="$HOME/.claude/plans/.review-ready-$slug"
exited="$HOME/.claude/plans/.exited-$slug"

if [ -f "$gate" ]; then
  mv -f "$gate" "$exited"
fi
exit 0
