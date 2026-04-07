#!/bin/bash
# SessionStart(clear): treat /clear as a session boundary for wiki
# Atomic rename of session marker prevents race with wiki-detect.sh
# PID in clearing filename identifies owner for orphan cleanup

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
{ [ -z "$CWD" ] || [[ "$CWD" != /* ]]; } && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

wiki_find_root || exit 0

CLEAR_TS=$(date '+%s')
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
CLEARING="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-clearing-$$"

# Atomic grab — mv is POSIX-atomic. PID in filename identifies owner for orphan cleanup.
mv "$MARKER" "$CLEARING" 2>/dev/null || exit 0

# Detect wiki changes since session start (using original marker mtime via rename)
wiki_detect_changes "$CLEARING"

# Queue session_wiki (timestamp-suffixed for multiple clears per session)
if [ -n "$TRANSCRIPT" ]; then
  QUEUE_SUFFIX="clear-${CLEAR_TS}" wiki_queue_entry "session_wiki" "clear" "normal"
fi

# Queue wiki_change if files modified
QUEUE_SUFFIX_CHANGE="clearchange-${CLEAR_TS}" wiki_queue_changes "clear"

wiki_log "SESSION_CLEAR" "/clear boundary in $(basename "$REPO_ROOT")"
rm -f "$CLEARING"
