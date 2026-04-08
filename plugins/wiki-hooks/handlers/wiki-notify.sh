#!/bin/bash
# UserPromptSubmit: inject wiki context via two paths:
#   1. Prompt-aware: keyword-match user prompt against cached entity index → inject summaries
#   2. New-page: inject newly-created entity pages since last check
# Cache-first: reads entity-index.tsv instead of looping entity files

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0

ENTITIES_DIR="$REPO_ROOT/wiki/entities"
CACHE_DIR="$REPO_ROOT/wiki/.cache"
ENTITY_INDEX="$CACHE_DIR/entity-index.tsv"
CONTENT=""
DISPLAY=""

# --- Path 1: Prompt-aware entity matching via cached index ---
if [ -n "$PROMPT" ] && [ -f "$ENTITY_INDEX" ]; then
  PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
  MATCH_COUNT=0
  MATCHED_NAMES=""

  while IFS=$'\t' read -r slug words; do
    [ "$MATCH_COUNT" -ge 3 ] && break
    [ -z "$slug" ] && continue

    # Check word matches using bash case (no subprocess spawning)
    hits=0
    eligible=0
    for word in $words; do
      [ "${#word}" -lt 3 ] && continue
      eligible=$((eligible + 1))
      case "$PROMPT_LOWER" in
        *"$word"*) hits=$((hits + 1)) ;;
      esac
    done

    [ "$eligible" -eq 0 ] && continue
    # Require at least 2 hits (or 1 if only 1 eligible word)
    if [ "$eligible" -le 1 ] && [ "$hits" -ge 1 ]; then
      :
    elif [ "$hits" -lt 2 ]; then
      continue
    fi

    # Read first 10 lines directly from entity file (max 3 files)
    summary=$(head -10 "$ENTITIES_DIR/${slug}.md" 2>/dev/null)
    [ -z "$summary" ] && continue
    CONTENT="${CONTENT}--- ${slug} ---"$'\n'"${summary}"$'\n\n'
    MATCHED_NAMES="${MATCHED_NAMES:+${MATCHED_NAMES}, }${slug}"
    MATCH_COUNT=$((MATCH_COUNT + 1))
  done < "$ENTITY_INDEX"

  if [ "$MATCH_COUNT" -gt 0 ]; then
    DISPLAY="🔍 Wiki auto-loaded ${MATCH_COUNT} page(s): ${MATCHED_NAMES} — /wiki-load ${MATCHED_NAMES%%,*} for full content"
    CONTENT="Wiki pages matching your prompt (auto-loaded, first 10 lines each). Use /wiki-load <slug> to load full page content."$'\n\n'"${CONTENT}"
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
