#!/bin/bash
# Routes agent model selection based on session rules (forced) or model mappings (fallback).
# Priority: session_rules > model_mappings > passthrough (no change).
set -o pipefail
if ! command -v jq >/dev/null 2>&1; then
  echo "model-router: jq not found — model routing disabled (install: brew install jq)" >&2
  exit 0
fi
LOG="$HOME/.claude/model-router.log"
INPUT=$(cat)
TOOL_INPUT=$(echo "$INPUT" | jq '.tool_input' 2>/dev/null) || { echo "$(date -u +%H:%M:%S) jq parse failed — passthrough" >> "$LOG"; echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'; exit 0; }

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
CURRENT_MODEL=$(echo "$TOOL_INPUT" | jq -r '.model // empty' 2>/dev/null)
CONFIG="$HOME/.claude/model-map.json"

[[ ! -f "$CONFIG" ]] && exit 0

NEW_MODEL=""

# --- Priority 1: session_rules (FORCE — overrides agent's declared model) ---
# Reads the child model written by session-model-capture.sh at session start.
if [[ -n "$SESSION_ID" ]]; then
  SESSION_MODEL_FILE="$HOME/.claude/session-env/$SESSION_ID/session-model"
  if [[ -f "$SESSION_MODEL_FILE" ]]; then
    FORCED=$(cat "$SESSION_MODEL_FILE")
    [[ -n "$FORCED" ]] && NEW_MODEL="$FORCED"
  fi
fi

# --- Priority 2: model_mappings (fallback — only if no session rule matched) ---
# Remaps individual model names. "inherit" removes the model field.
if [[ -z "$NEW_MODEL" && -n "$CURRENT_MODEL" ]]; then
  MAPPED=$(jq -r --arg m "$CURRENT_MODEL" '.model_mappings[$m] // empty' "$CONFIG" 2>/dev/null)
  if [[ -n "$MAPPED" ]]; then
    if [[ "$MAPPED" == "inherit" ]]; then
      PATCHED=$(echo "$TOOL_INPUT" | jq 'del(.model)' 2>/dev/null)
      if [[ -n "$PATCHED" ]]; then
        echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":$PATCHED}}"
      fi
      exit 0
    fi
    NEW_MODEL="$MAPPED"
  fi
fi

# --- Apply patch if we have a new model ---
if [[ -n "$NEW_MODEL" ]]; then
  PATCHED=$(echo "$TOOL_INPUT" | jq --arg m "$NEW_MODEL" '.model = $m' 2>/dev/null)
  # If jq failed, pass through unchanged rather than emitting malformed JSON
  if [[ -n "$PATCHED" ]]; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":$PATCHED}}"
  else
    echo "$(date -u +%H:%M:%S) jq patch failed model=$CURRENT_MODEL→$NEW_MODEL — passthrough" >> "$LOG"
  fi
  exit 0
fi

# No rule matched — pass through unchanged
exit 0
