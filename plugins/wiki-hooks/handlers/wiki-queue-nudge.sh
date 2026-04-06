#!/bin/bash
# UserPromptSubmit: background wiki queue processor
# Sleeps 20s (quiescence), claims entries via atomic mv, spawns claude CLI to process
# Multiple concurrent spawns safe — atomic mv ensures exclusive ownership per entry

set -o pipefail
trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0
command -v claude >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
echo "$HOOK_INPUT" | jq -e '.agent_id // empty' >/dev/null 2>&1 && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"

# Quick pre-check: any pending entries? Exit early if not
[ ! -d "$QUEUE_DIR" ] && exit 0
PENDING=$(grep -rl '"status".*"pending"' "$QUEUE_DIR/" 2>/dev/null | head -1)
[ -z "$PENDING" ] && exit 0

# Quiescence
sleep 20

# Clean up stale .processing-PID files from crashed prior runs
# If the owning PID is no longer alive, rename back to .json for retry
for stale in "$QUEUE_DIR"/*.processing-*; do
  [ -f "$stale" ] || continue
  STALE_PID="${stale##*.processing-}"
  if ! kill -0 "$STALE_PID" 2>/dev/null; then
    ORIG="${stale%.processing-*}.json"
    mv "$stale" "$ORIG" 2>/dev/null || rm -f "$stale"
  fi
done

# Claim and process entries (max 3 per invocation to bound cost/time)
PROCESSED=0
MAX_PER_RUN=3

for entry in "$QUEUE_DIR"/*.json; do
  [ -f "$entry" ] || continue
  [ "$PROCESSED" -ge "$MAX_PER_RUN" ] && break

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

  # Validate wiki exists
  if [ ! -d "$WIKI_PATH" ]; then
    jq '.status = "failed" | .error = "wiki_path missing" | .failed_at = (now | todate)' "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
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

  # Spawn claude CLI — sonnet, budget cap, non-interactive (no --bare: needs OAuth from keychain)
  if claude -p --model sonnet --max-budget-usd 0.50 \
    --dangerously-skip-permissions --no-session-persistence \
    "$PROMPT" < /dev/null >/dev/null 2>&1; then
    # Success — delete the claimed file
    rm -f "$CLAIMED"
    PROCESSED=$((PROCESSED + 1))
  else
    # Failed — rename back to .json for retry
    jq '.status = "pending"' "$CLAIMED" > "${CLAIMED}.tmp" 2>/dev/null \
      && mv "${CLAIMED}.tmp" "$entry" 2>/dev/null \
      || mv "$CLAIMED" "$entry" 2>/dev/null
  fi
done
