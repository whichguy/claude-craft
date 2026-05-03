#!/usr/bin/env bash
# PreToolUse hook for ExitPlanMode: block unless review-plan has produced
# a slug-scoped gate file at ~/.claude/plans/.review-ready-<slug>.
# Reads {tool_input, ...} JSON from stdin per Claude Code hook protocol.
set -eo pipefail

plan_file=$(ls -t "$HOME/.claude/plans"/*.md 2>/dev/null | head -1)
slug=$(basename "$plan_file" .md 2>/dev/null)

if [ -n "$slug" ] && [ -f "$HOME/.claude/plans/.review-ready-$slug" ]; then
  printf '{}'
  exit 0
fi

# Block: review-plan not yet run, or gate already cleaned up after a prior
# successful ExitPlanMode (do not retry).
printf '%s' '{"decision":"block","reason":"Gate file not found. Either review-plan has not been run yet (run it first), or ExitPlanMode already succeeded and the gate was cleaned up (do not retry)."}'
