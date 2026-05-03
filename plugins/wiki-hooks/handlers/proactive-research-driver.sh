#!/bin/bash
# Proactive-research driver — fire-and-forget subprocess spawned by
# proactive-research-extract.sh. Runs the 3-stage pipeline:
#   1. /wiki-query → wiki-context with Gaps section
#   2. Haiku curl → JSON {worthy, reason, sources:[{topic,url}, ...]}
#   3. dispatch /wiki-ingest <url> per source (detached)
#
# Inputs ($1..$4): PROMPT, WIKI_PATH, SID, REPO_ROOT
# Required env: WIKI_DRIVER=1 (set by producer; recursion guard for /wiki-query/ingest)

set -o pipefail
shopt -s nullglob

PROMPT="${1:-}"
WIKI_PATH="${2:-}"
SID="${3:-}"
REPO_ROOT="${4:-}"
export REPO_ROOT

[ -z "$PROMPT" ] && exit 0
[ -z "$WIKI_PATH" ] && exit 0

. "$(dirname "$0")/wiki-common.sh"
wiki_resolve_claude_cmd

LOG_PREFIX() {
  printf '[%s] driver session:%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${SID:0:8}" "$*"
}

MAX_SOURCES="${PROACTIVE_RESEARCH_MAX_SOURCES:-4}"
PRIVACY_STRICT="${PROACTIVE_RESEARCH_PRIVACY_STRICT:-0}"

# --- Sanitize prompt before any external call ---
SANITIZED=$(wiki_sanitize_for_external "$PROMPT")
if [ "$PRIVACY_STRICT" = "1" ] && printf '%s' "$SANITIZED" | grep -q '<repo-local>'; then
  LOG_PREFIX "PROACTIVE-SKIP privacy_strict (repo-local identifier present after sanitization)"
  exit 0
fi

# --- Step 1: get wiki context via /wiki-query ---
LOG_PREFIX "step1 /wiki-query: $(printf '%.80s' "$SANITIZED")"
TIMEOUT_CMD=""
if command -v gtimeout >/dev/null 2>&1; then TIMEOUT_CMD="gtimeout 300"
elif command -v timeout >/dev/null 2>&1; then TIMEOUT_CMD="timeout 300"
fi

CTX=$(WIKI_DRIVER=1 $TIMEOUT_CMD "$CLAUDE_CMD" -p \
  --dangerously-skip-permissions --no-session-persistence \
  "/wiki-query $SANITIZED" </dev/null 2>/dev/null || true)

if [ -z "$CTX" ]; then
  LOG_PREFIX "step1 wiki-query returned empty — aborting"
  exit 0
fi

# --- Step 2: classify + extract URLs (Haiku via curl) ---
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  LOG_PREFIX "step2 ANTHROPIC_API_KEY not set — skipping classifier"
  exit 0
fi

CLASSIFIER_TPL="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/templates/classifier.md"
if [ ! -f "$CLASSIFIER_TPL" ]; then
  LOG_PREFIX "step2 classifier template missing: $CLASSIFIER_TPL"
  exit 0
fi
SYS_PROMPT=$(cat "$CLASSIFIER_TPL")

USER_MSG=$(printf '=== WIKI CONTEXT ===\n%s\n\n=== USER PROMPT ===\n%s\n' "$CTX" "$SANITIZED")

REQ_BODY=$(jq -n \
  --arg sys "$SYS_PROMPT" \
  --arg user "$USER_MSG" \
  --argjson maxsrc "$MAX_SOURCES" \
  '{
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: $sys,
    messages: [{role:"user", content:$user}]
  }')

LOG_PREFIX "step2 classify (Haiku)"
RESP=$($TIMEOUT_CMD curl -sS https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "$REQ_BODY" 2>/dev/null || true)

if [ -z "$RESP" ]; then
  LOG_PREFIX "step2 curl failed (empty response)"
  exit 0
fi

# Extract assistant text from messages API response
TEXT=$(printf '%s' "$RESP" | jq -r '.content[0].text // empty' 2>/dev/null || true)
if [ -z "$TEXT" ]; then
  LOG_PREFIX "step2 no content in response: $(printf '%.200s' "$RESP")"
  exit 0
fi

# Strip optional markdown fences from the text
JSON_BODY=$(printf '%s' "$TEXT" | sed -E 's/^```json//; s/^```//; s/```$//' | sed -e '/^[[:space:]]*$/d')

WORTHY=$(printf '%s' "$JSON_BODY" | jq -r '.worthy // false' 2>/dev/null || echo false)
REASON=$(printf '%s' "$JSON_BODY" | jq -r '.reason // ""' 2>/dev/null || echo "")

if [ "$WORTHY" != "true" ]; then
  LOG_PREFIX "WORTHY=false reason=\"$REASON\""
  exit 0
fi

# --- Step 3: dispatch /wiki-ingest per source ---
SRC_COUNT=$(printf '%s' "$JSON_BODY" | jq -r '.sources // [] | length' 2>/dev/null || echo 0)
if [ "${SRC_COUNT:-0}" -eq 0 ]; then
  LOG_PREFIX "WORTHY=true but no sources returned — nothing to dispatch"
  exit 0
fi

LOG_PREFIX "WORTHY=true reason=\"$REASON\" sources=$SRC_COUNT"

count=0
while IFS= read -r url; do
  [ -z "$url" ] && continue
  case "$url" in
    http://*|https://*) ;;
    *) LOG_PREFIX "skip non-http url: $url"; continue ;;
  esac
  count=$((count + 1))
  [ "$count" -gt "$MAX_SOURCES" ] && { LOG_PREFIX "max sources cap reached ($MAX_SOURCES)"; break; }
  LOG_PREFIX "dispatch /wiki-ingest $url"
  (
    WIKI_DRIVER=1 "$CLAUDE_CMD" -p \
      --dangerously-skip-permissions --no-session-persistence \
      "/wiki-ingest $url" </dev/null >/dev/null 2>&1
  ) & disown
done < <(printf '%s' "$JSON_BODY" | jq -r '.sources[]?.url // empty' 2>/dev/null)

exit 0
