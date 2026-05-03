#!/bin/bash
# UserPromptSubmit: filter + fork-detach the proactive-research driver.
# ≤50ms target — no LLM, no IO beyond filtering and a backgrounded spawn.
# All real work (wiki-query → Haiku classify → wiki-ingest dispatch) runs
# in proactive-research-driver.sh, detached.

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

# --- Recursion guard (MANDATORY — first thing) ---
# Driver runs with WIKI_DRIVER=1 in its env; without this guard, the driver's
# own claude -p children would re-fire UserPromptSubmit and fork-bomb us.
[ -n "${WIKI_DRIVER:-}" ] && exit 0

# Global disable
[ "${PROACTIVE_RESEARCH_DISABLED:-0}" = "1" ] && exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0            # subagent guard
[ -z "$CWD" ] && exit 0
wiki_find_root || exit 0                # not in a wiki-enabled repo

# --- Cheap shape filters (no LLM) ---
# Skip slash commands — user is invoking a known skill/command.
case "$PROMPT" in
  /*) exit 0 ;;
esac

# Skip very short prompts. Token-count gate.
# Default 7 tokens — small prompts are almost never research-worthy and they
# cost a downstream /wiki-query call if they squeak through.
# Token estimation (fast → fallback): tiktoken if importable, else char/4.
MIN_TOKENS="${PROACTIVE_RESEARCH_MIN_TOKENS:-7}"
prompt_chars=$(printf '%s' "$PROMPT" | wc -c | tr -d ' ')
token_count=""
PY_TIMEOUT_CMD=""
if command -v gtimeout >/dev/null 2>&1; then PY_TIMEOUT_CMD="gtimeout 0.4"
elif command -v timeout >/dev/null 2>&1; then PY_TIMEOUT_CMD="timeout 0.4"
fi
if [ -n "$PY_TIMEOUT_CMD" ] && command -v python3 >/dev/null 2>&1; then
  token_count=$(printf '%s' "$PROMPT" | $PY_TIMEOUT_CMD python3 -c '
import sys
try:
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    print(len(enc.encode(sys.stdin.read())))
except Exception:
    sys.exit(1)
' 2>/dev/null || true)
fi
if [ -z "$token_count" ]; then
  token_count=$(( (prompt_chars + 3) / 4 ))
fi
[ "${token_count:-0}" -lt "$MIN_TOKENS" ] && exit 0

# --- Rate limit (per-hour counter file) ---
RATE_LIMIT="${PROACTIVE_RESEARCH_RATE_LIMIT_PER_HR:-20}"
QUEUE_DIR="$HOME/.claude/reflection-queue"
mkdir -p "$QUEUE_DIR"
HOUR_KEY=$(date -u +%Y%m%d%H)
COUNTER_FILE="$QUEUE_DIR/.proactive-rate-${HOUR_KEY}"
find "$QUEUE_DIR" -maxdepth 1 -name '.proactive-rate-*' ! -name ".proactive-rate-${HOUR_KEY}" -mtime +0 -delete 2>/dev/null || true

# Atomic-ish: append a line, then count. POSIX guarantees small O_APPEND writes are atomic.
echo 1 >> "$COUNTER_FILE"
current=$(wc -l < "$COUNTER_FILE" 2>/dev/null | tr -d ' ' || echo 0)
if [ "${current:-0}" -gt "$RATE_LIMIT" ]; then
  wiki_log "PROACTIVE-RATELIMIT" "skipped (count=$current limit=$RATE_LIMIT hour=$HOUR_KEY)"
  exit 0
fi

# --- Spawn driver, detached ---
DRIVER="$(dirname "$0")/proactive-research-driver.sh"
[ -x "$DRIVER" ] || exit 0

LOG_DIR="$HOME/.claude/proactive-research"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/log"

(
  WIKI_DRIVER=1 \
  CLAUDE_PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)" \
  "$DRIVER" "$PROMPT" "$WIKI_PATH" "$SID" "$REPO_ROOT"
) </dev/null >>"$LOG_FILE" 2>&1 & disown

wiki_log "PROACTIVE" "driver spawned (tokens=${token_count})"
exit 0
