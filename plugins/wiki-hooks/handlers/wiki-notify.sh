#!/bin/bash
# UserPromptSubmit: inject newly-created wiki pages into Claude's context
# Fast synchronous check — no sleep, no CLI spawning

trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0
. "$(dirname "$0")/wiki-common.sh"

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0

# Find the session marker (created by wiki-detect.sh at session start)
MARKER=$(find "$REPO_ROOT/wiki" -maxdepth 1 -name '.session-*-start' 2>/dev/null | head -1)
[ -z "$MARKER" ] && exit 0

# Notified marker — tracks what we've already injected (touch after notification)
NOTIFIED="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-notified"

# Find entity files newer than the notified marker (or session marker if first check)
REF_MARKER="$NOTIFIED"
[ ! -f "$REF_MARKER" ] && REF_MARKER="$MARKER"

NEW_PAGES=$(find "$REPO_ROOT/wiki/entities" -newer "$REF_MARKER" -name '*.md' 2>/dev/null)
[ -z "$NEW_PAGES" ] && exit 0

# Read new page contents (cap at 5 pages, 200 lines each to stay under 10K char limit)
CONTENT=""
COUNT=0
while IFS= read -r page; do
  [ "$COUNT" -ge 5 ] && break
  NAME=$(basename "$page" .md)
  PAGE_CONTENT=$(head -200 "$page" 2>/dev/null)
  CONTENT="${CONTENT}--- ${NAME} ---"$'\n'"${PAGE_CONTENT}"$'\n\n'
  COUNT=$((COUNT + 1))
done <<< "$NEW_PAGES"

# Touch notified marker so we don't re-inject these pages
touch "$NOTIFIED" 2>/dev/null || true

# Build page name list for display
PAGE_NAMES=$(echo "$NEW_PAGES" | sed 's|.*/||;s|\.md$||' | head -5 | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')

jq -n --arg context "New wiki pages extracted from recent sessions: ${PAGE_NAMES}. Content below."$'\n\n'"${CONTENT}" \
  --arg display "📖 ${COUNT} new wiki page(s): ${PAGE_NAMES}" \
  '{"systemMessage": $display, "additionalContext": $context}'
