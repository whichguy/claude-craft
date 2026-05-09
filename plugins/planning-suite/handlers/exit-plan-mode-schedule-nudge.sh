#!/usr/bin/env bash
# PostToolUse hook for ExitPlanMode: emit an advisory nudge prompting the
# assistant to invoke /schedule-plan-tasks once the plan has been approved.
# Stays silent (exit 0) when no plan file is found so we don't block.
set -eo pipefail
trap 'exit 0' ERR

plan_file=$(ls -t "$HOME/.claude/plans"/*.md 2>/dev/null | head -1 || true)

if [ -z "$plan_file" ] || [ ! -f "$plan_file" ]; then
  exit 0
fi

ctx="The plan at \`$plan_file\` was just approved via ExitPlanMode. If the user wants to execute it, invoke the \`/schedule-plan-tasks\` skill (Branch A). Do not invoke automatically if the user signals they're not ready to execute."

jq -n \
  --arg msg "Plan approved — /schedule-plan-tasks is available to decompose it." \
  --arg ctx "$ctx" \
  '{"systemMessage": $msg, "hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": $ctx}}'

exit 0
