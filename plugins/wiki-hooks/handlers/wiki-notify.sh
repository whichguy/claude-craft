#!/bin/bash
# UserPromptSubmit: inject wiki context via two paths:
#   1. Prompt-aware: keyword-match user prompt against entity slugs → inject summaries
#   2. New-page: inject newly-created entity pages since last check
# Fast synchronous check — no sleep, no CLI spawning

trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0
. "$(dirname "$0")/wiki-common.sh"

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0

ENTITIES_DIR="$REPO_ROOT/wiki/entities"
CONTENT=""
DISPLAY=""

# --- Path 1: Prompt-aware entity matching ---
PROMPT=$(echo "$HOOK_INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)
if [ -n "$PROMPT" ] && [ -d "$ENTITIES_DIR" ]; then
  # Lowercase prompt words for matching
  PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
  MATCH_COUNT=0
  MATCHED_NAMES=""
  for file in "$ENTITIES_DIR"/*.md; do
    [ -f "$file" ] || continue
    [ "$MATCH_COUNT" -ge 3 ] && break
    name=$(basename "$file" .md)
    # Split slug on hyphens into words, check if any 3+ char word appears in prompt
    hits=0
    eligible=0
    for word in $(echo "$name" | tr '-' ' '); do
      [ "${#word}" -lt 3 ] && continue
      eligible=$((eligible + 1))
      if echo "$PROMPT_LOWER" | grep -qiw "${word}" 2>/dev/null; then
        hits=$((hits + 1))
      fi
    done
    # Skip slugs with no eligible words (all words < 3 chars)
    [ "$eligible" -eq 0 ] && continue
    # Require at least 2 eligible-word hits (or 1 if only 1 eligible word)
    if [ "$eligible" -le 1 ] && [ "$hits" -ge 1 ]; then
      :
    elif [ "$hits" -lt 2 ]; then
      continue
    fi
    # Read first 10 lines (extended summary)
    summary=$(head -10 "$file" 2>/dev/null)
    CONTENT="${CONTENT}--- ${name} ---"$'\n'"${summary}"$'\n\n'
    MATCHED_NAMES="${MATCHED_NAMES:+${MATCHED_NAMES}, }${name}"
    MATCH_COUNT=$((MATCH_COUNT + 1))
  done
  if [ "$MATCH_COUNT" -gt 0 ]; then
    DISPLAY="🔍 ${MATCH_COUNT} wiki match(es): ${MATCHED_NAMES}"
    CONTENT="Wiki pages matching your prompt (auto-loaded). Use /wiki-load for full content."$'\n\n'"${CONTENT}"
  fi
fi

# --- Path 2: New page detection (existing behavior) ---
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
if [ -f "$MARKER" ]; then
  NOTIFIED="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-notified"
  REF_MARKER="$NOTIFIED"
  [ ! -f "$REF_MARKER" ] && REF_MARKER="$MARKER"

  NEW_PAGES=$(find "$ENTITIES_DIR" -newer "$REF_MARKER" -name '*.md' 2>/dev/null)
  if [ -n "$NEW_PAGES" ]; then
    NEW_COUNT=0
    while IFS= read -r page; do
      NAME=$(basename "$page" .md)
      PAGE_CONTENT=$(head -200 "$page" 2>/dev/null)
      CONTENT="${CONTENT}--- ${NAME} (new) ---"$'\n'"${PAGE_CONTENT}"$'\n\n'
      NEW_COUNT=$((NEW_COUNT + 1))
    done <<< "$NEW_PAGES"
    touch "$NOTIFIED" 2>/dev/null || true
    NEW_NAMES=$(echo "$NEW_PAGES" | sed 's|.*/||;s|\.md$||' | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
    if [ -n "$DISPLAY" ]; then
      DISPLAY="${DISPLAY} + 📖 ${NEW_COUNT} new: ${NEW_NAMES}"
    else
      DISPLAY="📖 ${NEW_COUNT} new wiki page(s): ${NEW_NAMES}"
    fi
    CONTENT="New wiki pages extracted from recent sessions: ${NEW_NAMES}."$'\n\n'"${CONTENT}"
  fi
fi

# Output only if we have something to inject
[ -z "$CONTENT" ] && exit 0

jq -n --arg context "$CONTENT" --arg display "$DISPLAY" \
  '{"systemMessage": $display, "additionalContext": $context}'
