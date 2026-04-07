#!/bin/bash
# Stop: detect wiki changes via find-newer, queue for synthesis, log SESSION_END
# Async — no session-close latency

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0

# Clean up orphans from wiki-clear.sh crashes
wiki_cleanup_orphans "$REPO_ROOT/wiki" ".session-*-clearing-*"

# Detect wiki changes since session start
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
wiki_detect_changes "$MARKER"
rm -f "$MARKER"
rm -f "$REPO_ROOT/wiki/.session-${SESSION_SHORT}-notified"

# Queue session_wiki
if [ -n "$TRANSCRIPT" ]; then
  QUEUE_SUFFIX="wiki" wiki_queue_entry "session_wiki" "stop" "normal"
fi

# Queue wiki_change if files modified
QUEUE_SUFFIX_CHANGE="wikichange" wiki_queue_changes "wiki_change"

wiki_log "SESSION_END" "closed in $(basename "$REPO_ROOT")"
