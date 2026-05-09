#!/usr/bin/env bash
# PostToolUse hook for ExitPlanMode: delete the slug-scoped gate file after
# successful plan exit so the next plan-mode session starts fresh.
set -eo pipefail

plan_file=$(ls -t "$HOME/.claude/plans"/*.md 2>/dev/null | head -1 || true)
slug=$(basename "$plan_file" .md 2>/dev/null || true)

if [ -n "$slug" ]; then
  rm -f "$HOME/.claude/plans/.review-ready-$slug"
fi
exit 0
