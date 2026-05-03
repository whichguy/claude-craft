---
name: task-persist
description: Manage task persistence across /clear sessions — disable/enable auto-restore, list prior sessions, inspect tasks from a specific session
argument-hint: "[disable|enable|list|show] [session-id]"
allowed-tools: Read, Bash
---

# /task-persist

Manage the task-persist plugin, which auto-restores pending tasks from the prior session when `/clear` creates a new session.

## How it works

When `/clear` fires, a `SessionStart` hook reads pending tasks from the most recent prior session and emits `additionalContext` instructing Claude to recreate them via `TaskCreate`/`TaskUpdate`. Because `TaskCreate` and `TaskUpdate` are pre-allowed in `permissions.allow`, restore happens with no user prompt.

## Subcommands

### disable
```
/task-persist disable
```
Touches `~/.claude/tasks-snapshots/.disabled`. The next `/clear` will **not** restore tasks. `list`/`show` still work while disabled.

### enable
```
/task-persist enable
```
Removes the `.disabled` flag to resume auto-restore.

### list
```
/task-persist list
```
Lists recent session directories from `~/.claude/tasks/` with pending-task counts and timestamps.

### show [session-id]
```
/task-persist show
/task-persist show <session-id>
```
Pretty-prints tasks from a specific prior session (default: most recent session with tasks).

---

## Implementation

<SCRATCHPAD>
Parse argument from user input. If no argument or unrecognized, show usage.

For **disable**:
```bash
mkdir -p ~/.claude/tasks-snapshots
touch ~/.claude/tasks-snapshots/.disabled
echo "Task-persist disabled. Next /clear will not restore tasks."
```

For **enable**:
```bash
rm -f ~/.claude/tasks-snapshots/.disabled
echo "Task-persist enabled."
```

For **list**:
```bash
TASKS_DIR="$HOME/.claude/tasks"
if [ ! -d "$TASKS_DIR" ]; then
  echo "No task sessions found."
  exit 0
fi
echo "Recent sessions (newest first):"
echo ""
for dir in $(ls -td "$TASKS_DIR"/*/ 2>/dev/null | head -20); do
  dir="${dir%/}"
  sid=$(basename "$dir")
  json_count=$(ls "$dir"/*.json 2>/dev/null | wc -l | tr -d ' ')
  pending=0
  for f in "$dir"/*.json; do
    status=$(jq -r '.status // ""' "$f" 2>/dev/null)
    [ "$status" != "completed" ] && pending=$((pending + 1))
  done
  mtime=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$dir" 2>/dev/null || stat -c "%y" "$dir" 2>/dev/null | cut -d. -f1)
  echo "  $sid  |  $json_count tasks ($pending pending)  |  $mtime"
done
```

For **show [session-id]**:
```bash
TASKS_DIR="$HOME/.claude/tasks"
TARGET_SID="${ARG}"

if [ -z "$TARGET_SID" ]; then
  # Default: most recent session with *.json files
  for dir in $(ls -td "$TASKS_DIR"/*/ 2>/dev/null); do
    dir="${dir%/}"
    json_files=("$dir"/*.json)
    if [ ${#json_files[@]} -gt 0 ] && [ -f "${json_files[0]}" ]; then
      TARGET_SID=$(basename "$dir")
      break
    fi
  done
fi

TARGET_DIR="$TASKS_DIR/$TARGET_SID"
if [ ! -d "$TARGET_DIR" ]; then
  echo "Session not found: $TARGET_SID"
  exit 1
fi

echo "Tasks for session: $TARGET_SID"
echo ""
for f in "$TARGET_DIR"/*.json; do
  jq '.' "$f" 2>/dev/null
  echo ""
done
```
</SCRATCHPAD>

> **Note on uninstall**: Removing this plugin does not revert the `TaskCreate` and `TaskUpdate` entries added to `permissions.allow` in `~/.claude/settings.json`. To remove them manually, edit that file and delete the two entries from `permissions.allow`.
