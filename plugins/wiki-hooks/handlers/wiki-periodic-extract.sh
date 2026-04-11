#!/bin/bash
# UserPromptSubmit: probabilistic mid-session wiki extraction trigger
# Fires at ~1/MOD rate (default 17). Writes a queue entry; wiki-worker.sh drains it.
# Fully async — this hook is a pure queue producer, never spawns extraction itself.

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0            # subagent guard
[ -z "$CWD" ] && exit 0
[ -z "$TRANSCRIPT" ] && exit 0          # no transcript, nothing to extract
wiki_find_root || exit 0                # not in a wiki-enabled repo

MOD=${WIKI_PERIODIC_MOD:-17}
[ "$MOD" -lt 1 ] && exit 0              # guard against MOD=0 division
[ $((RANDOM % MOD)) -ne 0 ] && exit 0   # probabilistic trigger

QUEUE_SUFFIX="periodic-$(date +%s)" \
  wiki_queue_entry "periodic_extract" "userpromptsubmit" "normal"

wiki_log "PERIODIC" "probabilistic trigger fired (mod=${MOD})"
exit 0
