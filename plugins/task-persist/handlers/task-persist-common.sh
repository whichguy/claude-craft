#!/bin/bash
# Shared functions for task-persist hook handlers
shopt -s nullglob

# Reads hook JSON from stdin, sets: HOOK_INPUT, SID, AGENT_ID, SESSION_SHORT
tp_parse_input() {
  HOOK_INPUT=$(cat)
  {
    read -r SID
    read -r AGENT_ID
  } < <(echo "$HOOK_INPUT" | jq -r '(.session_id // ""), (.agent_id // "")' 2>/dev/null || printf '\n\n')
  SESSION_SHORT="${SID:0:8}"
}
