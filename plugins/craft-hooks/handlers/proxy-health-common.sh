#!/bin/bash

set -euo pipefail

proxy_health_require_jq() {
  command -v jq >/dev/null 2>&1
}

proxy_health_file() {
  printf '%s' "${HOME}/.claude/proxy-health.json"
}

proxy_health_state_dir() {
  printf '%s' "${HOME}/.claude/plugins/craft-hooks/state"
}

proxy_health_is_unhealthy_transition() {
  case "${1:-}" in
    degraded|disconnected|recovering) return 0 ;;
    *) return 1 ;;
  esac
}

proxy_health_unhealthy_summary() {
  local file="$1"
  jq -r '
    [
      (.backends // {}) | to_entries[] | .value |
      select(.managed == true and (.state == "degraded" or .state == "disconnected" or .state == "recovering")) |
      "\(.backend_id) (\(.state))"
    ] | .[:3] | join(", ")
  ' "$file" 2>/dev/null
}

proxy_health_recent_heal() {
  local file="$1"
  local max_age_ms="${2:-900000}"
  jq -r --argjson now_ms "$(date +%s000)" --argjson max_age_ms "$max_age_ms" '
    .last_transition as $lt |
    if ($lt.to // "") == "healthy" and (($lt.at_ms // 0) > 0) and (($now_ms - $lt.at_ms) <= $max_age_ms) then
      "\($lt.backend_id)@\($lt.at)"
    else
      ""
    end
  ' "$file" 2>/dev/null
}
