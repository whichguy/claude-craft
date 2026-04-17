#!/bin/bash

set -euo pipefail

. "$(dirname "$0")/proxy-health-common.sh"

proxy_health_require_jq || exit 0

HOOK_INPUT="$(cat)"
AGENT_ID="$(printf '%s' "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)"
[[ -n "$AGENT_ID" ]] && exit 0

HEALTH_FILE="$(proxy_health_file)"
[[ -f "$HEALTH_FILE" ]] || exit 0

EVENT_ID="$(jq -r '.last_transition.event_id // 0' "$HEALTH_FILE" 2>/dev/null || echo 0)"
[[ "$EVENT_ID" =~ ^[0-9]+$ ]] || exit 0
(( EVENT_ID > 0 )) || exit 0

STATE_DIR="$(proxy_health_state_dir)"
SEEN_FILE="${STATE_DIR}/proxy-health-last-seen.json"
mkdir -p "$STATE_DIR"

LAST_SEEN=0
if [[ -f "$SEEN_FILE" ]]; then
  LAST_SEEN="$(jq -r '.last_seen_event_id // 0' "$SEEN_FILE" 2>/dev/null || echo 0)"
fi
[[ "$LAST_SEEN" =~ ^[0-9]+$ ]] || LAST_SEEN=0

if (( EVENT_ID <= LAST_SEEN )); then
  exit 0
fi

TRANSITION_TO="$(jq -r '.last_transition.to // empty' "$HEALTH_FILE" 2>/dev/null || true)"
BACKEND_ID="$(jq -r '.last_transition.backend_id // empty' "$HEALTH_FILE" 2>/dev/null || true)"
AT="$(jq -r '.last_transition.at // empty' "$HEALTH_FILE" 2>/dev/null || true)"

DISPLAY=""
CONTEXT=""
if proxy_health_is_unhealthy_transition "$TRANSITION_TO"; then
  DISPLAY="☁️ Proxy health changed: cloud backend unhealthy"
  CONTEXT="Proxy health note: cloud backend ${BACKEND_ID} is now ${TRANSITION_TO} as of ${AT}. Favor local-capable models and avoid suggesting cloud-only escalation unless necessary."
elif [[ "$TRANSITION_TO" == "healthy" ]]; then
  DISPLAY="☁️ Proxy health changed: cloud backend recovered"
  CONTEXT="Proxy health note: cloud backend ${BACKEND_ID} recovered at ${AT}. Cloud-capable models are available again."
else
  exit 0
fi

TMP_FILE="${SEEN_FILE}.tmp.$$"
jq -n --argjson event_id "$EVENT_ID" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{last_seen_event_id: $event_id, updated_at: $at}' > "$TMP_FILE"
mv "$TMP_FILE" "$SEEN_FILE"

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": $context}}'
