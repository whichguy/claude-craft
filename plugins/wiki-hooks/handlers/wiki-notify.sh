#!/bin/bash
# UserPromptSubmit: notify when new wiki pages exist since session start.
# Date-based only — no fuzzy matching, no topic names leaked into context.
# The session-start directive already forces /wiki-load; this nudges on new content.

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0

# Skip injection for wiki commands — they handle their own access
case "$PROMPT" in
  /wiki-load*|/wiki-query*|/wiki-ingest*|/wiki-process*|/wiki-lint*) exit 0 ;;
esac

ENTITIES_DIR="$REPO_ROOT/wiki/entities"
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
[ -f "$MARKER" ] || exit 0

NOTIFIED="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-notified"
REF_MARKER="$NOTIFIED"
[ ! -f "$REF_MARKER" ] && REF_MARKER="$MARKER"

NEW_COUNT=$(find "$ENTITIES_DIR" -newer "$REF_MARKER" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
[ "$NEW_COUNT" -eq 0 ] && exit 0

touch "$NOTIFIED" 2>/dev/null || true

DISPLAY="📖 ${NEW_COUNT} new wiki page(s) available — use /wiki-load to review"
CONTEXT="WIKI_UPDATE: ${NEW_COUNT} new wiki page(s) extracted since last check. Invoke /wiki-load <topic> to read. Do NOT answer domain questions from memory — wiki pages are authoritative."

jq -n --arg context "$CONTEXT" --arg display "$DISPLAY" \
  '{"systemMessage": $display, "additionalContext": $context}'
