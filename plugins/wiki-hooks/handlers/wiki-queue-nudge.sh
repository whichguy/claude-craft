#!/bin/bash
# UserPromptSubmit: background wiki queue processor
# Waits for queue directory to quiesce (no new files for 10s), then processes ALL pending entries
# Claims each entry via atomic mv before processing — multiple concurrent spawns safe
# PID file prevents unbounded parallel claude -p processes

set -o pipefail
trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0
command -v claude >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
echo "$HOOK_INPUT" | jq -e '.agent_id // empty' >/dev/null 2>&1 && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"
PID_FILE="$HOME/.claude/.wiki-processor-pid"

# Quick pre-check: any pending entries? Exit early if not
[ ! -d "$QUEUE_DIR" ] && exit 0
PENDING=$(grep -rl '"status".*"pending"' "$QUEUE_DIR/" 2>/dev/null | head -1)
[ -z "$PENDING" ] && exit 0

# Concurrency guard: only one processor at a time
if [ -f "$PID_FILE" ]; then
  EXISTING_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    exit 0  # another processor is running
  fi
  rm -f "$PID_FILE"  # stale PID file
fi
echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"; exit 0' EXIT ERR

# Quiescence: wait until no new .json files appear for 10s (session hooks have finished writing)
PREV_COUNT=0
STABLE=0
for tick in $(seq 1 12); do
  CURR_COUNT=$(find "$QUEUE_DIR" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CURR_COUNT" -eq "$PREV_COUNT" ]; then
    STABLE=$((STABLE + 1))
    [ "$STABLE" -ge 2 ] && break  # stable for 2 checks (10s) — quiesced
  else
    STABLE=0
  fi
  PREV_COUNT=$CURR_COUNT
  sleep 5
done

# Clean up stale .processing-PID files from crashed prior runs
for stale in "$QUEUE_DIR"/*.processing-*; do
  [ -f "$stale" ] || continue
  STALE_PID="${stale##*.processing-}"
  if ! kill -0 "$STALE_PID" 2>/dev/null; then
    ORIG="${stale%.processing-*}.json"
    mv "$stale" "$ORIG" 2>/dev/null || rm -f "$stale"
  fi
done

# Process ALL pending entries — claim one at a time, process, then next
for entry in "$QUEUE_DIR"/*.json; do
  [ -f "$entry" ] || continue

  # Only process pending entries
  STATUS=$(jq -r '.status // empty' "$entry" 2>/dev/null)
  [ "$STATUS" != "pending" ] && continue

  # Atomic claim — mv to .processing-PID
  CLAIMED="${entry%.json}.processing-$$"
  mv "$entry" "$CLAIMED" 2>/dev/null || continue

  # Read entry details
  TRANSCRIPT=$(jq -r '.transcript_path // empty' "$CLAIMED" 2>/dev/null)
  WIKI_PATH=$(jq -r '.wiki_path // empty' "$CLAIMED" 2>/dev/null)
  SID=$(jq -r '.session_id // empty' "$CLAIMED" 2>/dev/null)

  # Validate transcript exists
  if [ ! -f "$TRANSCRIPT" ]; then
    jq '.status = "failed" | .error = "transcript missing" | .failed_at = (now | todate)' "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
      && mv "${CLAIMED}.tmp" "${entry}" 2>/dev/null \
      || mv "$CLAIMED" "$entry" 2>/dev/null
    continue
  fi

  # Validate wiki path exists
  if [ -z "$WIKI_PATH" ] || [ "$WIKI_PATH" = "null" ] || [ ! -d "$WIKI_PATH" ]; then
    jq '.status = "failed" | .error = "wiki_path missing or invalid" | .failed_at = (now | todate)' "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
      && mv "${CLAIMED}.tmp" "${entry}" 2>/dev/null \
      || mv "$CLAIMED" "$entry" 2>/dev/null
    continue
  fi

  # Build extraction prompt
  PROMPT="Extract wiki knowledge from this session transcript.

Transcript: $TRANSCRIPT (read last 2000 lines with the Read tool)
Wiki path: $WIKI_PATH
Read the existing index at ${WIKI_PATH%/}/index.md first.

For each significant entity, decision, or concept discussed:
- If entity page exists in wiki/entities/: append a '## From Session' subsection (check for idempotency — skip if already present)
- If new entity: create wiki/entities/SLUG.md

Extraction criteria — write a page only if the concept meets 2+ of:
  (a) Named 3+ times in the session
  (b) A non-obvious decision was made about it
  (c) It caused confusion or correction
  (d) It's a named architectural component or design pattern

Update ${WIKI_PATH%/}/index.md with any new pages.
Append log entries to ${WIKI_PATH%/}/log.md in format: [YYYY-MM-DD HH:MM] EXTRACT session:${SID:0:8}: <pages created/updated>"

  # Spawn claude CLI — sonnet, non-interactive (no --bare: needs OAuth from keychain)
  if claude -p --model sonnet \
    --dangerously-skip-permissions --no-session-persistence \
    "$PROMPT" < /dev/null >/dev/null 2>&1; then
    # Success — delete the claimed file
    rm -f "$CLAIMED"
  else
    # Failed — rename back to .json for retry
    jq '.status = "pending"' "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
      && mv "${CLAIMED}.tmp" "$entry" 2>/dev/null \
      || mv "$CLAIMED" "$entry" 2>/dev/null
  fi
done
