#!/usr/bin/env bash
# PostToolUse ExitPlanMode: EXECUTE NOW via companion Python (payload-only path).
# Opt out: CLAUDE_PLAN_AUTO_EXECUTE=0. Fail-open (exit 0) on any error.
set -eo pipefail
trap 'exit 0' ERR

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${DIR}/exit-plan-mode-schedule-nudge.py"

# Pass-through stdin (hook payload) to the Python handler.
if [[ -x "$PY" ]] || [[ -f "$PY" ]]; then
  python3 "$PY" || true
else
  # Missing companion: stay silent rather than block.
  true
fi
exit 0
