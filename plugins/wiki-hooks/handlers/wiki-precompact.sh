#!/bin/bash
# PreCompact: treat compaction as a wiki session boundary
# Queues precompact_extract (high) + session_wiki + wiki_change, re-injects display

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0
QUEUE_DIR="$HOME/.claude/reflection-queue"

# Skip if already queued this session (idempotency)
[ -f "$QUEUE_DIR/${SID}-precompact.json" ] && exit 0
[ -z "$TRANSCRIPT" ] && exit 0

QUEUED=0

# 1. Queue precompact_extract (high priority)
QUEUE_SUFFIX="precompact" wiki_queue_entry "precompact_extract" "precompact" "high"
QUEUED=$((QUEUED + 1))

# 2. Queue session_wiki
QUEUE_SUFFIX="wiki" wiki_queue_entry "session_wiki" "precompact" "normal"
QUEUED=$((QUEUED + 1))

# 3. Detect and queue wiki_change
MARKER="$REPO_ROOT/.wiki/.session-${SESSION_SHORT}-start"
wiki_detect_changes "$MARKER"
# Do NOT delete marker — session continues, Stop hook still needs it
QUEUE_SUFFIX_CHANGE="wikichange" wiki_queue_changes "precompact"
[ -n "$CHANGED_FILES" ] && QUEUED=$((QUEUED + 1))

wiki_log "EXTRACT" "compaction — ${QUEUED} queue entries written"

# Re-inject display (SessionStart context is gone after compaction)
wiki_build_display "(post-compaction)"

jq -n --arg display "$DISPLAY" \
  '{"systemMessage": $display}'
