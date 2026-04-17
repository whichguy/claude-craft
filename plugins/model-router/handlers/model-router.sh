#!/bin/bash
# Rewrites tool_input.model through canonical routes aliases only for actionable hook events.
set -eo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "model-router: jq not found — model routing disabled (install: brew install jq)" >&2
  exit 0
fi

LOG="$HOME/.claude/model-router.log"
INPUT=$(cat)
HOOK_EVENT_NAME=$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty' 2>/dev/null)

passthrough_json() {
  jq -cn '{}'
}

updated_input_json() {
  local event_name="$1"
  local updated_input="$2"
  # PreToolUse and PermissionRequest share rewrite logic, but Claude expects different output schemas.
  case "$event_name" in
    PreToolUse)
      jq -cn \
        --argjson updated_input "$updated_input" \
        '{
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput: $updated_input
          }
        }'
      ;;
    PermissionRequest)
      jq -cn \
        --argjson updated_input "$updated_input" \
        '{
          hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: {
              behavior: "allow",
              updatedInput: $updated_input
            }
          }
        }'
      ;;
    *)
      passthrough_json
      ;;
  esac
}

log_route() {
  local event_name="$1"
  local tool_name="$2"
  local from_model="$3"
  local to_model="$4"
  local rewritten="$5"
  printf '%s tool=%s model_in=%s model_out=%s rewritten=%s\n' \
    "$(date -u +%H:%M:%S)" \
    "${event_name:-unknown}/${tool_name:-unknown}" \
    "${from_model:-<unset>}" \
    "${to_model:-<unset>}" \
    "$rewritten" >> "$LOG"
}

canonicalize_dir() {
  local dir="$1"
  [[ -n "$dir" && "$dir" == /* && -d "$dir" ]] || return 1
  (cd "$dir" 2>/dev/null && pwd -P)
}

canonicalize_file() {
  local file="$1"
  [[ -n "$file" && "$file" == /* && -f "$file" ]] || return 1
  local real_dir
  real_dir="$(canonicalize_dir "$(dirname "$file")")" || return 1
  printf '%s/%s' "$real_dir" "$(basename "$file")"
}

find_parent_model_map() {
  local dir="$1"
  dir="$(canonicalize_dir "$dir")" || return 1
  while :; do
    local candidate="$dir/.claude/model-map.json"
    if [[ -f "$candidate" ]]; then
      canonicalize_file "$candidate"
      return 0
    fi
    [[ "$dir" == "/" ]] && break
    dir="$(dirname "$dir")"
  done
  return 1
}

resolve_config_path() {
  local pinned="${CLAUDE_MODEL_MAP_PATH:-}"
  local profile_real
  profile_real="$(canonicalize_file "$HOME/.claude/model-map.json" 2>/dev/null || true)"
  local pinned_real
  pinned_real="$(canonicalize_file "$pinned" 2>/dev/null || true)"
  if [[ -n "$pinned_real" ]]; then
    printf '%s' "$pinned_real"
    return 0
  fi

  local project_dir project_real
  project_dir="${CLAUDE_PROJECT_DIR:-}"
  if [[ -n "$project_dir" && "$project_dir" == /* && ${#project_dir} -lt 4096 ]]; then
    project_real="$(canonicalize_file "$project_dir/.claude/model-map.json" 2>/dev/null || true)"
    if [[ -n "$project_real" ]]; then
      printf '%s' "$project_real"
      return 0
    fi
  fi

  local hook_cwd walked
  hook_cwd=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
  if [[ -n "$hook_cwd" && "$hook_cwd" == /* && ${#hook_cwd} -lt 4096 ]]; then
    walked="$(find_parent_model_map "$hook_cwd" 2>/dev/null || true)"
    if [[ -n "$walked" && "$walked" != "$profile_real" ]]; then
      printf '%s' "$walked"
      return 0
    fi
  fi

  if [[ -n "$profile_real" ]]; then
    printf '%s' "$profile_real"
    return 0
  fi

  return 1
}

resolve_route_model() {
  local current="$1"
  local seen=""
  local next=""
  local steps=0

  while :; do
    if [[ ":$seen:" == *":$current:"* ]]; then
      echo "$(date -u +%H:%M:%S) route cycle detected starting at $1" >> "$LOG"
      printf '%s' "$1"
      return 0
    fi

    seen="${seen}:$current"
    next=$(jq -r --arg m "$current" '.routes[$m] // empty' "$CONFIG" 2>/dev/null)
    if [[ -z "$next" ]]; then
      printf '%s' "$current"
      return 0
    fi

    current="$next"
    steps=$((steps + 1))
    if [[ $steps -ge 32 ]]; then
      echo "$(date -u +%H:%M:%S) route resolution limit hit starting at $1" >> "$LOG"
      printf '%s' "$current"
      return 0
    fi
  done
}

case "$HOOK_EVENT_NAME" in
  PreToolUse|PermissionRequest) ;;
  *)
    passthrough_json
    exit 0
    ;;
esac

TOOL_INPUT=$(printf '%s' "$INPUT" | jq '.tool_input' 2>/dev/null) || {
  echo "$(date -u +%H:%M:%S) jq parse failed — passthrough" >> "$LOG"
  passthrough_json
  exit 0
}

TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // .tool // .tool_input.tool // empty' 2>/dev/null)
CURRENT_MODEL=$(printf '%s' "$TOOL_INPUT" | jq -r '.model // empty' 2>/dev/null)

# Wildcard registration is safe because non-model requests always stay inert here.
if [[ -z "$CURRENT_MODEL" ]]; then
  passthrough_json
  exit 0
fi

CONFIG="$(resolve_config_path || true)"
if [[ -z "$CONFIG" ]]; then
  log_route "$HOOK_EVENT_NAME" "$TOOL_NAME" "$CURRENT_MODEL" "$CURRENT_MODEL" 0
  passthrough_json
  exit 0
fi

RESOLVED_MODEL="$(resolve_route_model "$CURRENT_MODEL")"
if [[ "$RESOLVED_MODEL" == "$CURRENT_MODEL" ]]; then
  log_route "$HOOK_EVENT_NAME" "$TOOL_NAME" "$CURRENT_MODEL" "$RESOLVED_MODEL" 0
  passthrough_json
  exit 0
fi

PATCHED=$(printf '%s' "$TOOL_INPUT" | jq --arg m "$RESOLVED_MODEL" '.model = $m' 2>/dev/null)
if [[ -n "$PATCHED" ]]; then
  log_route "$HOOK_EVENT_NAME" "$TOOL_NAME" "$CURRENT_MODEL" "$RESOLVED_MODEL" 1
  updated_input_json "$HOOK_EVENT_NAME" "$PATCHED"
else
  echo "$(date -u +%H:%M:%S) jq patch failed model=$CURRENT_MODEL→$RESOLVED_MODEL — passthrough" >> "$LOG"
  passthrough_json
fi
