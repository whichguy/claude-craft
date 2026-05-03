#!/bin/bash
# PreToolUse:Read — inject wiki-entity hint when the file being Read is
# documented by one or more wiki pages. Consumes wiki/.cache/file-refs.tsv
# built by wiki-cache-rebuild.sh (PR1). Fail-open: any error → silent exit 0.
#
# Mode A (this handler): file-ref hint. Always allows the Read.
# Mode B (observation timeline): deferred to PR6; lives behind WIKI_READ_GATE_OBS=1.
#
# Canonical output shape (pinned by Spike0, 2026-04-19):
#   {"hookSpecificOutput": {
#      "hookEventName": "PreToolUse",
#      "permissionDecision": "allow",
#      "additionalContext": "<hint string, ≤200 chars>"
#   }}
#
# Kill switch: WIKI_READ_GATE=0
#
# Performance: pure bash, NO jq — follows wiki-raw-guard.sh blueprint. Plan target
# is p50<15ms / p99<40ms per Read; jq alone is ~16ms/call on a warm sandbox, so we
# parse HOOK_INPUT with bash regex and emit JSON via printf instead.

trap 'exit 0' ERR
set +e

# --- Kill switch ---
[ "${WIKI_READ_GATE:-1}" = "0" ] && exit 0

# --- Timing (bash 5+ EPOCHREALTIME; 0 fallback disables logging timing) ---
START_T="${EPOCHREALTIME:-0}"

# --- Read stdin once ---
HOOK_INPUT=$(cat 2>/dev/null || true)
[ -z "$HOOK_INPUT" ] && exit 0

# --- Pure-bash field extraction (no jq, no sed -r).
# JSON injection-safe within the Read tool's constrained schema: file_path is
# always a filesystem string, agent_id is empty-or-UUID. Any regex miss → exit 0.
extract_field() {
  # extract_field <key> <input>  →  value (or empty)
  local key="$1" input="$2" rest val
  # Locate "KEY": then capture up to the next unescaped quote.
  # Pattern: "<key>"\s*:\s*"<captured>"
  case "$input" in
    *"\"$key\""*)
      rest="${input#*\"$key\"}"       # strip up to the key
      rest="${rest#*:}"                # strip past the colon
      # Trim leading whitespace
      rest="${rest#"${rest%%[! 	]*}"}"
      case "$rest" in
        \"*) ;; *) return 0 ;;         # not a string value → empty
      esac
      rest="${rest#\"}"                # drop opening quote
      val="${rest%%\"*}"               # up to closing quote (no escape handling)
      printf '%s' "$val"
      ;;
  esac
}

AGENT_ID=$(extract_field agent_id "$HOOK_INPUT")
[ -n "$AGENT_ID" ] && exit 0

CWD=$(extract_field cwd "$HOOK_INPUT")
[ -z "$CWD" ] && exit 0

FILE_PATH=$(extract_field file_path "$HOOK_INPUT")
[ -z "$FILE_PATH" ] && exit 0

SID=$(extract_field session_id "$HOOK_INPUT")
SESSION_SHORT="${SID:0:8}"

# --- Resolve ~ + relative → absolute ---
case "$FILE_PATH" in
  "~"/*) FILE_PATH="$HOME/${FILE_PATH#~/}" ;;
  "~")   FILE_PATH="$HOME" ;;
esac
case "$FILE_PATH" in
  /*) ABS_PATH="$FILE_PATH" ;;
  *)  ABS_PATH="$CWD/$FILE_PATH" ;;
esac

# Canonicalize ABS_PATH to match git rev-parse's realpath behavior so the
# REPO_ROOT prefix match below works on macOS where /var → /private/var.
# Audit (2026-04-25): only this handler does input-path-vs-REPO_ROOT prefix matching;
# wiki-common.sh and wiki-detect.sh use git rev-parse purely to locate .wiki/, so the
# canonicalization is not needed there. New handlers doing path comparison should adopt this pattern.
if [ -e "$ABS_PATH" ]; then
  ABS_DIR=$(cd "$(dirname "$ABS_PATH")" 2>/dev/null && pwd -P)
  [ -n "$ABS_DIR" ] && ABS_PATH="$ABS_DIR/$(basename "$ABS_PATH")"
fi

# --- Find wiki root (git-anchored, mirrors wiki_find_root in wiki-common.sh) ---
# Inline to avoid sourcing wiki-common.sh (keeps hot path lean).
REPO_ROOT=""
GIT_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
if [ -n "$GIT_ROOT" ] && [ -f "$GIT_ROOT/.wiki/log.md" ]; then
  REPO_ROOT="$GIT_ROOT"
fi
[ -z "$REPO_ROOT" ] && exit 0

# --- Compute REL_PATH; bail if file is outside REPO_ROOT ---
case "$ABS_PATH" in
  "$REPO_ROOT"/*) REL_PATH="${ABS_PATH#$REPO_ROOT/}" ;;
  *) exit 0 ;;
esac

# --- Noise filter (fast-path exit before touching cache) ---
case "$REL_PATH" in
  .wiki/*|.git/*|node_modules/*|raw/*|.cache/*|*.lock|*.log|*.tmp) exit 0 ;;
esac

# --- Load cache; fail-open if missing or unreadable ---
REFS_FILE="$REPO_ROOT/.wiki/.cache/file-refs.tsv"
[ -f "$REFS_FILE" ] || exit 0
[ -r "$REFS_FILE" ] || exit 0

# --- Lookup: grep -F exact-match on <path>\t. head -1 since cache is dedup'd.
# Tab-suffix anchors the match to the path column (prevents prefix collisions).
HIT=$(grep -F -- "$REL_PATH"$'\t' "$REFS_FILE" 2>/dev/null | head -1 || true)
[ -z "$HIT" ] && exit 0

SLUGS="${HIT#*$'\t'}"
[ -z "$SLUGS" ] && exit 0

# --- Compose hint (≤200 chars) ---
# First slug pulled out so the /wiki-load suggestion is concrete. If the first
# slug carries an overflow marker (a5...+3), strip it for the /wiki-load arg —
# the full list (including overflow) still lives in the hint body.
FIRST_SLUG="${SLUGS%%,*}"
FIRST_SLUG="${FIRST_SLUG%...*}"

HINT="wiki hint: ${REL_PATH} — documented at: ${SLUGS}. Use /wiki-load ${FIRST_SLUG} to retrieve."

if [ "${#HINT}" -gt 200 ]; then
  HINT="${HINT:0:197}…"
fi

# --- Duration (ms) for observability ---
DUR_MS=0
END_T="${EPOCHREALTIME:-0}"
if [ "$START_T" != "0" ] && [ "$END_T" != "0" ]; then
  DUR_MS=$(awk "BEGIN{printf \"%d\", ($END_T - $START_T) * 1000}" 2>/dev/null || echo 0)
fi

# --- Log line to wiki/log.md (best-effort) ---
LOG_PATH="$REPO_ROOT/.wiki/log.md"
if [ -f "$LOG_PATH" ] && [ -w "$LOG_PATH" ]; then
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  echo "[$TIMESTAMP] READ_GATE session:${SESSION_SHORT} path:$REL_PATH slugs:$SLUGS dur:${DUR_MS}ms" >> "$LOG_PATH" 2>/dev/null || true
fi

# --- JSON-escape the hint and emit canonical PreToolUse shape via printf ---
# Escape only the characters that can occur in REL_PATH / SLUGS: backslash, quote,
# control chars (defensive). HINT is our own construction so newlines are absent,
# but we escape anyway to make the emitter robust if inputs shift.
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"         # \   → \\
  s="${s//\"/\\\"}"         # "   → \"
  s="${s//$'\n'/\\n}"       # LF  → \n
  s="${s//$'\t'/\\t}"       # TAB → \t
  s="${s//$'\r'/\\r}"       # CR  → \r
  printf '%s' "$s"
}

ESC_HINT=$(json_escape "$HINT")

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","additionalContext":"%s"}}\n' "$ESC_HINT"

exit 0
