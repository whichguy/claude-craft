#!/bin/bash
# SessionStart hook: restore pending tasks from prior session via additionalContext
# Fires on "clear" and "startup" matchers.

set -eo pipefail
shopt -s nullglob
trap 'exit 0' ERR

. "$(dirname "$0")/task-persist-common.sh"
tp_parse_input

# Agent sub-sessions don't need task restore
[ -n "$AGENT_ID" ] && exit 0

# Guard: empty session_id means unrecognizable hook input — skip silently
[ -z "$SID" ] && exit 0

TASKS_DIR="$HOME/.claude/tasks"
SNAPSHOTS_DIR="$HOME/.claude/tasks-snapshots"

# No tasks directory yet (first-ever use)
[ ! -d "$TASKS_DIR" ] && exit 0

# Disabled flag
[ -f "$SNAPSHOTS_DIR/.disabled" ] && exit 0

mkdir -p "$SNAPSHOTS_DIR"

# Idempotency sentinel: hook may fire twice for the same session
SENTINEL="$SNAPSHOTS_DIR/.restored-$SID"
[ -f "$SENTINEL" ] && exit 0

# Find most recent prior session dir that contains *.json files.
# Guard: with nullglob, if no dirs exist the glob expands to nothing and
# unguarded ls -dt would fall back to listing CWD.
PRIOR_DIR=""
task_dirs=("$TASKS_DIR"/*/)
if [ ${#task_dirs[@]} -gt 0 ]; then
  for dir in $(ls -dt "${task_dirs[@]}" 2>/dev/null); do
    dir="${dir%/}"
    [ "$(basename "$dir")" = "$SID" ] && continue
    json_files=("$dir"/*.json)
    if [ ${#json_files[@]} -gt 0 ] && [ -f "${json_files[0]}" ]; then
      PRIOR_DIR="$dir"
      break
    fi
  done
fi

# No prior session with tasks
[ -z "$PRIOR_DIR" ] && exit 0

# Read all tasks from the prior session dir
ALL_TASKS="[]"
for f in "$PRIOR_DIR"/*.json; do
  task=$(jq -c '.' "$f" 2>/dev/null) || continue
  ALL_TASKS=$(printf '%s' "$ALL_TASKS" | jq --argjson t "$task" '. + [$t]' 2>/dev/null) || continue
done

# Allowlist active statuses — any other status (completed, abandoned, cancelled, etc.)
# is treated as terminal and excluded from restore. Future terminal statuses are
# automatically excluded without code changes.
ACTIVE_STATUSES='["pending","in_progress","blocked"]'

# Collect IDs of terminal tasks so we can prune dangling blockedBy edges
DONE_IDS=$(printf '%s' "$ALL_TASKS" | jq \
  --argjson active "$ACTIVE_STATUSES" \
  '[.[] | select(.status as $s | $active | index($s) == null) | .id]')

# Filter to active tasks; drop blockedBy refs pointing at terminal task IDs
LIVE_TASKS=$(printf '%s' "$ALL_TASKS" | jq \
  --argjson active "$ACTIVE_STATUSES" \
  --argjson done "$DONE_IDS" \
  '[.[] | select(.status as $s | $active | index($s) != null) | .blockedBy = [(.blockedBy // [])[] | select(. as $id | ($done | index($id)) == null)]]')

TASK_COUNT=$(printf '%s' "$LIVE_TASKS" | jq 'length')

# Nothing to restore
[ "$TASK_COUNT" -eq 0 ] && exit 0

# Write sentinel before delete+emit (idempotency lock)
touch "$SENTINEL"

# Delete *.json files from prior session dir (consumed); preserve .lock and other non-json files
rm -f "$PRIOR_DIR"/*.json

TASK_JSON=$(printf '%s' "$LIVE_TASKS" | jq -c '.')

CONTEXT="The previous session ended with ${TASK_COUNT} active task(s). For each entry in the JSON array below, call TaskCreate({subject, description, activeForm}) to recreate it. Then call TaskUpdate for any in_progress or blocked task to restore status and blockedBy (map old ids to the new ids returned by TaskCreate). Terminal tasks (completed, abandoned, cancelled) are excluded — do not recreate them.

${TASK_JSON}"

jq -n \
  --arg msg "Resuming ${TASK_COUNT} pending task(s) from last session" \
  --arg ctx "$CONTEXT" \
  '{"systemMessage": $msg, "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": $ctx}}'
