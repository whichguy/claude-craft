#!/bin/bash
# SessionEnd: Ctrl-C safety net — queues session when Stop doesn't fire
# Skips if wiki-stop.sh or wiki-precompact.sh already queued this session
# SAFETY: trap guarantees exit 0 — never interfere with session termination

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$SID" ] || [ "$SID" = "unknown" ] && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"

# Skip if another hook already queued this session
[ -f "$QUEUE_DIR/${SID}-wiki.json" ] && exit 0
[ -f "$QUEUE_DIR/${SID}-precompact.json" ] && exit 0
[ -f "$QUEUE_DIR/${SID}.json" ] && exit 0  # backward compat

[ -z "$TRANSCRIPT" ] && exit 0

# Derive wiki_path from CWD
wiki_find_root || true  # wiki_path may be empty for non-wiki projects — that's OK

QUEUE_SUFFIX="wiki" wiki_queue_entry "session_wiki" "session-end" "normal"

exit 0
