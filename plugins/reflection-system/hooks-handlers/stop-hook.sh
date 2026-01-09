#!/bin/bash
# Reflection System Stop Hook
# Based on ralph-wiggum pattern: blocks exit and feeds reflection prompt
#
# State machine: audit → analyze → reconcile → complete
# Each phase invokes its command, then advances to next phase on next exit attempt
#
# Safety mechanisms (per Red Team review):
# - Atomic writes: write-to-temp-then-rename pattern
# - File locking: flock-based advisory locking
# - Escape hatch: Hard timeout (5 minutes) and max iterations
# - Startup validation: Verify state file integrity on load

set -euo pipefail

# Configuration
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/reflection-system}"
STATE_FILE="$PLUGIN_ROOT/state/loop.json"
LOCK_FILE="$PLUGIN_ROOT/state/loop.lock"
REFLECT_OFF="$HOME/.claude/REFLECT_OFF"
SESSIONS_DIR="$HOME/.claude/sessions"

# Safety limits
MAX_ITERATIONS=6       # 3 phases × 2 attempts = 6 max iterations
TIMEOUT_SECONDS=300    # 5 minute hard timeout

# Kill switch - allow normal exit if disabled
if [[ -f "$REFLECT_OFF" ]]; then
  exit 0
fi

# Ensure state directory exists
mkdir -p "$PLUGIN_ROOT/state"

# Create lock file if missing
touch "$LOCK_FILE"

# ============================================
# HELPER FUNCTIONS
# ============================================

# Atomic write: write to temp then rename
atomic_write() {
  local file="$1"
  local content="$2"
  local tmp_file="${file}.tmp.$$"

  echo "$content" > "$tmp_file"
  mv "$tmp_file" "$file"
}

# Validate state file JSON structure
validate_state() {
  local state="$1"

  # Check it's valid JSON with required fields
  if ! echo "$state" | jq -e '.i and .phase and .started_at' >/dev/null 2>&1; then
    return 1
  fi

  # Check i is a positive number
  local i=$(echo "$state" | jq -r '.i')
  if [[ ! "$i" =~ ^[0-9]+$ ]] || [[ "$i" -lt 1 ]]; then
    return 1
  fi

  # Check phase is valid
  local phase=$(echo "$state" | jq -r '.phase')
  case "$phase" in
    audit|analyze|reconcile) return 0 ;;
    *) return 1 ;;
  esac
}

# Check if timeout exceeded
check_timeout() {
  local state="$1"
  local started_at=$(echo "$state" | jq -r '.started_at // 0')
  local now=$(date +%s)
  local elapsed=$((now - started_at))

  if [[ $elapsed -gt $TIMEOUT_SECONDS ]]; then
    return 0  # Timeout exceeded
  fi
  return 1  # Within timeout
}

# Clean up and exit normally
cleanup_and_exit() {
  local reason="$1"
  rm -f "$STATE_FILE"
  echo "$reason" >&2
  exit 0
}

# ============================================
# MAIN LOGIC (under flock)
# ============================================

exec 200>"$LOCK_FILE"
flock -n 200 || {
  # Another process holds the lock - allow exit to prevent deadlock
  exit 0
}

# ============================================
# STARTUP STATE VALIDATION
# ============================================

if [[ -f "$STATE_FILE" ]]; then
  STATE=$(cat "$STATE_FILE" 2>/dev/null || echo '{}')

  # Validate state file structure
  if ! validate_state "$STATE"; then
    cleanup_and_exit "Corrupted state file detected, cleaned up"
  fi

  # Check hard timeout
  if check_timeout "$STATE"; then
    cleanup_and_exit "Reflection timeout exceeded (${TIMEOUT_SECONDS}s), cleaned up"
  fi

  # Check max iterations
  I=$(echo "$STATE" | jq -r '.i')
  if [[ "$I" -ge "$MAX_ITERATIONS" ]]; then
    cleanup_and_exit "Max iterations ($MAX_ITERATIONS) reached, cleaned up"
  fi
fi

# ============================================
# NO STATE = START NEW REFLECTION
# ============================================

if [[ ! -f "$STATE_FILE" ]]; then
  # Check if sessions exist before starting
  if [[ ! -d "$SESSIONS_DIR" ]]; then
    exit 0  # No sessions directory - allow exit
  fi

  # Check if any JSONL files exist
  if ! find "$SESSIONS_DIR" -name "*.jsonl" -type f 2>/dev/null | head -1 | grep -q .; then
    exit 0  # No session files - allow exit
  fi

  # Start reflection loop with atomic write
  STARTED_AT=$(date +%s)
  atomic_write "$STATE_FILE" "{\"i\":1,\"phase\":\"audit\",\"started_at\":$STARTED_AT}"

  # Block exit and start Phase 1
  jq -n '{
    "decision": "block",
    "reason": "/reflect mode:auto",
    "systemMessage": "Reflection 1/3: audit"
  }'
  exit 0
fi

# ============================================
# ACTIVE LOOP - PHASE STATE MACHINE
# ============================================

STATE=$(cat "$STATE_FILE")
PHASE=$(echo "$STATE" | jq -r '.phase')
I=$(echo "$STATE" | jq -r '.i')
STARTED_AT=$(echo "$STATE" | jq -r '.started_at')
NEXT_I=$((I + 1))

case "$PHASE" in
  audit)
    # Phase 1 complete, advance to Phase 2
    atomic_write "$STATE_FILE" "{\"i\":$NEXT_I,\"phase\":\"analyze\",\"started_at\":$STARTED_AT}"
    jq -n '{
      "decision": "block",
      "reason": "/analyze-sessions",
      "systemMessage": "Reflection 2/3: analyze"
    }'
    ;;

  analyze)
    # Phase 2 complete, advance to Phase 3
    atomic_write "$STATE_FILE" "{\"i\":$NEXT_I,\"phase\":\"reconcile\",\"started_at\":$STARTED_AT}"
    jq -n '{
      "decision": "block",
      "reason": "/reconcile-skills mode:auto",
      "systemMessage": "Reflection 3/3: reconcile"
    }'
    ;;

  reconcile)
    # Phase 3 complete - reflection loop done
    rm -f "$STATE_FILE"
    echo "Reflection complete" >&2
    exit 0
    ;;

  *)
    # Unknown phase - clean up and allow exit (should not happen due to validation)
    cleanup_and_exit "Unknown reflection phase: $PHASE"
    ;;
esac

exit 0
