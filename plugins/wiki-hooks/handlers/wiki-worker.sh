#!/bin/bash
# Async: parallel wiki queue processor.
# Replaces wiki-queue-nudge.sh with:
#   Phase 0: Validate entries (skip missing transcripts/wiki_path)
#   Phase 1: Parallel Sonnet extraction (3 concurrent workers)
# Includes retry cap (max 3 attempts per entry).

set -o pipefail
shopt -s nullglob
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps true || exit 0
wiki_resolve_claude_cmd

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"
LOCK_FILE="$HOME/.claude/.wiki-processor.lock"
MAX_WORKERS=3

# Quick pre-check: any pending entries? Exit early if not
[ ! -d "$QUEUE_DIR" ] && exit 0
PENDING=$(grep -rl '"status".*"pending"' "$QUEUE_DIR/" 2>/dev/null | head -1)
[ -z "$PENDING" ] && exit 0

# Concurrency guard: atomic lock via ln -s (POSIX-atomic on APFS/ext4)
if ! ln -s $$ "$LOCK_FILE" 2>/dev/null; then
  # Lock exists — check if owner is alive
  EXISTING_PID=$(readlink "$LOCK_FILE" 2>/dev/null || true)
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    exit 0
  fi
  # Stale lock — remove and retry
  rm -f "$LOCK_FILE"
  ln -s $$ "$LOCK_FILE" 2>/dev/null || exit 0  # lost the retry race
fi
trap 'rm -f "$LOCK_FILE"; exit 0' EXIT ERR

# Quiescence: wait until no new .json files appear for 5s (reduced from 10s)
PREV_COUNT=0
STABLE=0
for tick in $(seq 1 6); do
  CURR_COUNT=$(find "$QUEUE_DIR" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CURR_COUNT" -eq "$PREV_COUNT" ]; then
    STABLE=$((STABLE + 1))
    [ "$STABLE" -ge 2 ] && break  # stable for 2 checks (5s × 2 = 10s quiescence window, checked every 5s)
  else
    STABLE=0
  fi
  PREV_COUNT=$CURR_COUNT
  sleep 5
done

# --- Phase 0: Validation — skip invalid entries ---
VALID_ENTRIES=()
for entry in "$QUEUE_DIR"/*.json; do
  [ -f "$entry" ] || continue

  STATUS=$(jq -r '.status // empty' "$entry" 2>/dev/null)
  [ "$STATUS" != "pending" ] && continue

  # Validate transcript exists
  TRANSCRIPT=$(jq -r '.transcript_path // empty' "$entry" 2>/dev/null)
  if [ -n "$TRANSCRIPT" ] && [ "$TRANSCRIPT" != "null" ] && [ ! -f "$TRANSCRIPT" ]; then
    # Missing transcript — mark failed (cleanup.sh will delete later)
    jq '.status = "failed" | .error = "transcript missing" | .failed_at = (now | todate)' "$entry" > "${entry}.tmp" 2>/dev/null \
      && mv "${entry}.tmp" "$entry" 2>/dev/null
    continue
  fi

  # Validate wiki path exists
  WIKI_PATH=$(jq -r '.wiki_path // empty' "$entry" 2>/dev/null)
  if [ -z "$WIKI_PATH" ] || [ "$WIKI_PATH" = "null" ] || [ ! -d "$WIKI_PATH" ]; then
    jq '.status = "failed" | .error = "wiki_path missing or invalid" | .failed_at = (now | todate)' "$entry" > "${entry}.tmp" 2>/dev/null \
      && mv "${entry}.tmp" "$entry" 2>/dev/null
    continue
  fi

  VALID_ENTRIES+=("$entry")
done

[ "${#VALID_ENTRIES[@]}" -eq 0 ] && exit 0

# --- Phase 1: Parallel Sonnet extraction ---
active_workers=0

for entry in "${VALID_ENTRIES[@]}"; do
  # Atomic claim via mv
  CLAIMED="${entry%.json}.processing-$$"
  mv "$entry" "$CLAIMED" 2>/dev/null || continue

  # Stamp in_progress_at for stale detection
  jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.in_progress_at = $ts' "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
    && mv "${CLAIMED}.tmp" "$CLAIMED" 2>/dev/null

  # Read entry details
  TRANSCRIPT=$(jq -r '.transcript_path // empty' "$CLAIMED" 2>/dev/null)
  WIKI_PATH=$(jq -r '.wiki_path // empty' "$CLAIMED" 2>/dev/null)
  SID=$(jq -r '.session_id // empty' "$CLAIMED" 2>/dev/null)
  RETRY_COUNT=$(jq -r '.retry_count // 0' "$CLAIMED" 2>/dev/null)
  RETRY_COUNT=${RETRY_COUNT:-0}

  # Spawn extraction in background subshell
  (
    EXTRACT_PROMPT="Extract and synthesize wiki knowledge from this session transcript.

Transcript: $TRANSCRIPT (read last 2000 lines with the Read tool)
Wiki path: $WIKI_PATH

Step 1: Read ${WIKI_PATH%/}/index.md and ${WIKI_PATH%/}/SCHEMA.md to understand existing pages and required formats.

Step 2: For each significant entity, decision, or concept discussed:
- If entity page exists in wiki/entities/: add a '- **From Session ${SID:0:8}:**' bullet (NOT a ## header). Check for idempotency — skip if session ID already present.
- If new entity: create wiki/entities/SLUG.md following the Entity format in SCHEMA.md:
  Overview (2-3 sentences). Bullet list of sources. Cross-links (→ See also:).

Extraction criteria — write a page only if the concept meets 2+ of:
  (a) Named 3+ times in the session
  (b) A non-obvious decision was made about it
  (c) It caused confusion or correction
  (d) It's a named architectural component or design pattern

Step 3: Synthesize (don't just extract):
- Add cross-links (→ See also:) between related entities — update BOTH sides
- If new information contradicts an older bullet, note the evolution explicitly
- If multiple older bullets are now subsumed by deeper understanding, consolidate them
- Index summaries must be retrieval-friendly: start with what the page IS, then add key search terms in parentheses

Step 4: Update ${WIKI_PATH%/}/index.md with any new or updated pages.
Append log entries to ${WIKI_PATH%/}/log.md in format: [YYYY-MM-DD HH:MM] EXTRACT session:${SID:0:8}: <pages created/updated>"

    CLAUDE_STDERR=$(mktemp "${TMPDIR:-/tmp}/wiki-claude-XXXXXX")
    # Run with timeout: prefer gtimeout (Homebrew), fall back to timeout (Linux), then no-timeout
    TIMEOUT_CMD=""
    if command -v gtimeout >/dev/null 2>&1; then TIMEOUT_CMD="gtimeout 120"
    elif command -v timeout >/dev/null 2>&1; then TIMEOUT_CMD="timeout 120"
    fi
    if $TIMEOUT_CMD "$CLAUDE_CMD" -p --model sonnet \
      --dangerously-skip-permissions --no-session-persistence \
      "$EXTRACT_PROMPT" < /dev/null >/dev/null 2>"$CLAUDE_STDERR"; then
      # Success — delete claimed file
      rm -f "$CLAIMED" "$CLAUDE_STDERR"
    else
      # Failed — capture stderr for diagnostics
      NEW_RETRY=$((RETRY_COUNT + 1))
      ORIG_ENTRY="${CLAIMED%.processing-*}.json"
      CLAUDE_ERR=$(head -1 "$CLAUDE_STDERR" 2>/dev/null | cut -c1-200)
      rm -f "$CLAUDE_STDERR"
      if [ "$NEW_RETRY" -ge 3 ]; then
        # Max retries reached — mark as permanently failed with actual error
        jq --argjson rc "$NEW_RETRY" --arg err "${CLAUDE_ERR:-unknown error}" \
          '.status = "failed" | .error = $err | .retry_count = $rc | .failed_at = (now | todate)' \
          "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
          && mv "${CLAIMED}.tmp" "$ORIG_ENTRY" 2>/dev/null \
          || mv "$CLAIMED" "$ORIG_ENTRY" 2>/dev/null
      else
        # Increment retry count, record error, restore to pending
        jq --argjson rc "$NEW_RETRY" --arg err "${CLAUDE_ERR:-unknown error}" \
          '.status = "pending" | .retry_count = $rc | .last_error = $err' \
          "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
          && mv "${CLAIMED}.tmp" "$ORIG_ENTRY" 2>/dev/null \
          || mv "$CLAIMED" "$ORIG_ENTRY" 2>/dev/null
      fi
    fi
  ) &

  active_workers=$((active_workers + 1))

  # Wait for a slot if at capacity (portable — wait -n requires bash 4.3+, macOS ships 3.2)
  if [ "$active_workers" -ge "$MAX_WORKERS" ]; then
    wait %% 2>/dev/null || wait 2>/dev/null || true
    active_workers=$((active_workers - 1))
  fi
done

# Wait for all remaining workers
wait 2>/dev/null || true
