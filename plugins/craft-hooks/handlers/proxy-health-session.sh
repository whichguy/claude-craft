#!/bin/bash

set -euo pipefail

. "$(dirname "$0")/proxy-health-common.sh"

proxy_health_require_jq || exit 0

HOOK_INPUT="$(cat)"
AGENT_ID="$(printf '%s' "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)"
[[ -n "$AGENT_ID" ]] && exit 0

HEALTH_FILE="$(proxy_health_file)"
[[ -f "$HEALTH_FILE" ]] || exit 0

UNHEALTHY="$(proxy_health_unhealthy_summary "$HEALTH_FILE")"
RECOVERING="$(proxy_health_recovering_summary "$HEALTH_FILE")"
RECENT_HEAL="$(proxy_health_recent_heal "$HEALTH_FILE")"

if [[ -n "$UNHEALTHY" ]]; then
  DISPLAY="☁️  Proxy health: cloud backend unhealthy"
  CONTEXT="Proxy health note: the preferred cloud backend is currently degraded or disconnected (${UNHEALTHY}). Favor local-capable models and avoid suggesting cloud-only escalation unless necessary."
elif [[ -n "$RECOVERING" ]]; then
  DISPLAY="☁️  Proxy health: cloud backend recovering"
  CONTEXT="Proxy health note: cloud backend recovering from recent issues (${RECOVERING}). Cloud models should be available but may be intermittent — prefer local if latency matters."
elif [[ -n "$RECENT_HEAL" ]]; then
  DISPLAY="☁️ Proxy health: cloud backend recovered"
  BACKEND_ID="${RECENT_HEAL%@*}"
  HEALED_AT="${RECENT_HEAL#*@}"
  CONTEXT="Proxy health note: cloud backend ${BACKEND_ID} recovered at ${HEALED_AT}. Cloud-capable models are available again."
else
  exit 0
fi

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": $context}}'
