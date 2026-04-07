#!/bin/bash
# SessionStart (async): clean up accumulated wiki state.
# Expires stale markers, recovers stuck .processing files, purges dead queue entries.
# Runs every session start as a background janitor.

set -eo pipefail
shopt -s nullglob
command -v jq >/dev/null 2>&1 || exit 0
. "$(dirname "$0")/wiki-common.sh"

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

# Use wiki_find_root for consistent root detection (log.md marker, same as all handlers)
wiki_find_root || exit 0

# WIKI_PATH from wiki_find_root has trailing slash; strip for glob patterns below
WIKI_DIR="$REPO_ROOT/wiki"
QUEUE_DIR="$HOME/.claude/reflection-queue"

# --- 1. Expire stale session markers (>24h) ---
# Exclude markers whose session ID matches a currently running claude process.
# Get active PIDs from running claude processes (best-effort).
ACTIVE_PIDS=""
if command -v pgrep >/dev/null 2>&1; then
  ACTIVE_PIDS=$(pgrep -f 'claude' 2>/dev/null || true)
fi

for marker in "$WIKI_DIR"/.session-*-start "$WIKI_DIR"/.session-*-notified; do
  [ -f "$marker" ] || continue
  # Check if marker is older than 24h
  if [ "$(uname)" = "Darwin" ]; then
    marker_age=$(( $(date +%s) - $(stat -f %m "$marker" 2>/dev/null || echo 0) ))
  else
    marker_age=$(( $(date +%s) - $(stat -c %Y "$marker" 2>/dev/null || echo 0) ))
  fi
  [ "$marker_age" -lt 86400 ] && continue

  # Extract session short ID from marker filename
  marker_name=$(basename "$marker")
  marker_sid=$(echo "$marker_name" | sed 's/^\.session-//;s/-start$//;s/-notified$//')

  # Check if any running claude process might own this session
  # (conservative: if we can't determine, expire it anyway after 24h)
  skip=false
  if [ -n "$ACTIVE_PIDS" ]; then
    for pid in $ACTIVE_PIDS; do
      # Check if the process's environment or args contain this session ID
      if ps -p "$pid" -o args= 2>/dev/null | grep -q "$marker_sid" 2>/dev/null; then
        skip=true
        break
      fi
    done
  fi

  if [ "$skip" = "false" ]; then
    rm -f "$marker"
  fi
done

# --- 2. Recover .processing-* files from dead or stale PIDs ---
if [ -d "$QUEUE_DIR" ]; then
  for f in "$QUEUE_DIR"/*.processing-*; do
    [ -f "$f" ] || continue
    STALE_PID="${f##*.processing-}"
    ORIG="${f%.processing-*}.json"

    # Check a: Dead PID — process no longer running
    if ! kill -0 "$STALE_PID" 2>/dev/null; then
      mv "$f" "$ORIG" 2>/dev/null || rm -f "$f"
      continue
    fi

    # Check b: Stale claim — file older than 24h regardless of PID status
    if [ "$(uname)" = "Darwin" ]; then
      file_age=$(( $(date +%s) - $(stat -f %m "$f" 2>/dev/null || echo 0) ))
    else
      file_age=$(( $(date +%s) - $(stat -c %Y "$f" 2>/dev/null || echo 0) ))
    fi
    if [ "$file_age" -gt 86400 ]; then
      mv "$f" "$ORIG" 2>/dev/null || rm -f "$f"
    fi
  done
fi

# --- 3. Delete queue entries with missing transcripts ---
if [ -d "$QUEUE_DIR" ]; then
  for f in "$QUEUE_DIR"/*.json; do
    [ -f "$f" ] || continue
    tp=$(jq -r '.transcript_path // empty' "$f" 2>/dev/null)
    # Skip entries that don't have transcript_path (e.g., wiki_change entries)
    [ -z "$tp" ] && continue
    [ "$tp" = "null" ] && continue
    # Delete if transcript file no longer exists
    [ ! -f "$tp" ] && rm -f "$f"
  done
fi

# --- 4. Delete failed/skipped entries older than 7 days ---
if [ -d "$QUEUE_DIR" ]; then
  find "$QUEUE_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
fi

# --- 5. Ensure cache exists (trigger rebuild if missing) ---
if [ ! -f "$WIKI_DIR/.cache/display.txt" ]; then
  HANDLER_DIR="$(dirname "$0")"
  if [ -x "$HANDLER_DIR/wiki-cache-rebuild.sh" ]; then
    echo "$HOOK_INPUT" | "$HANDLER_DIR/wiki-cache-rebuild.sh" 2>/dev/null || true
  fi
fi
