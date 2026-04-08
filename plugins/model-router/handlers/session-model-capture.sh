#!/bin/bash
# Captures the session model at startup and resolves the target child model
# from config. Writes to a per-session file so PreToolUse can read it.
if ! command -v jq >/dev/null 2>&1; then
  echo "model-router: jq not found — session model capture disabled (install: brew install jq)" >&2
  exit 0
fi
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
CONFIG="$HOME/.claude/model-map.json"

[[ -z "$SESSION_ID" ]] && exit 0

# Get model: from stdin (startup) or transcript (resume)
MODEL=$(echo "$INPUT" | jq -r '.model // empty' 2>/dev/null)
if [[ -z "$MODEL" ]]; then
  TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
  [[ -n "$TRANSCRIPT" && -f "$TRANSCRIPT" ]] && \
    MODEL=$(head -20 "$TRANSCRIPT" | grep -o '"model":"[^"]*"' | head -1 | sed 's/"model":"//;s/"//')
fi

[[ -z "$MODEL" ]] && exit 0

# Look up forced child model from config
CHILD=""
if [[ -f "$CONFIG" ]]; then
  CHILD=$(jq -r --arg m "$MODEL" '.session_rules[$m] // empty' "$CONFIG" 2>/dev/null)
fi

# Write to per-session file (empty string = no session rule, PreToolUse will use model_mappings fallback)
SESSION_DIR="$HOME/.claude/session-env/$SESSION_ID"
mkdir -p "$SESSION_DIR"
# Atomic write — prevents race if PreToolUse fires before write completes
printf '%s' "$CHILD" > "$SESSION_DIR/session-model.tmp" && mv "$SESSION_DIR/session-model.tmp" "$SESSION_DIR/session-model"

exit 0
