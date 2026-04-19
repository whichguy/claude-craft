#!/bin/bash
# UserPromptSubmit: emit wiki DELTAS only — never the evergreen mandate.
# The evergreen directive (location, /wiki-load, /wiki-query, WIKI_SKIP escape)
# lives in wiki-detect.sh's SessionStart injection, which is cached once per
# session and covers every provider uniformly.
#
# This handler fires per-prompt but emits ONLY when there's something new
# to report:
#   1. Prompt matched a cached entity → entity names + compliance signal
#   2. New wiki pages created since last check → names
# Silent exit otherwise. WIKI_SKIP=1 suppresses entirely.
#
# Cache-first: reads entity-index.tsv instead of looping entity files.

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0
[ "${WIKI_SKIP:-}" = "1" ] && exit 0

wiki_find_root || exit 0

# ⚠ Skip injection for all /wiki-* commands — they already handle their own wiki access.
# Matching here just adds noise (e.g., directive to "Use /wiki-load" when already running it).
case "$PROMPT" in
  /wiki-*) exit 0 ;;
esac

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

    # ⚠ Directive only — no page content injected. Partial previews cause the LLM
    # to skip /wiki-load (context poison). Force skill invocation instead.
    [ ! -f "$ENTITIES_DIR/${slug}.md" ] && continue
    MATCHED_NAMES="${MATCHED_NAMES:+${MATCHED_NAMES}, }${slug}"
    MATCH_COUNT=$((MATCH_COUNT + 1))
  done < "$ENTITY_INDEX"

  if [ "$MATCH_COUNT" -gt 0 ]; then
    DISPLAY="🔍 Wiki matched ${MATCH_COUNT} page(s): ${MATCHED_NAMES}"
    # A1: softer framing — "possible"/"if relevant" lets the LLM skip on weak matches.
    # Removed prior "name the page and quote one sentence" compliance demand which
    # forced a /wiki-load even when the match was coincidental (context poison risk).
    CONTENT="<wiki_match>Possible wiki matches: ${MATCHED_NAMES}. If relevant to the prompt, /wiki-load to retrieve. Skip if the match is coincidental (unrelated general topic).</wiki_match>"
    # Amplifier-fire logging — grep later to find false positives and tune the matcher.
    wiki_log "AMPLIFIER_MATCH" "matched=${MATCHED_NAMES} prompt=\"${PROMPT:0:80}\""
  fi
fi

# --- Path 2: New page detection (existing behavior) ---
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
if [ -f "$MARKER" ]; then
  NOTIFIED="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-notified"
  REF_MARKER="$NOTIFIED"
  [ ! -f "$REF_MARKER" ] && REF_MARKER="$MARKER"

  # ⚠ Directive only — no page content injected (context poison fix).
  # Old code dumped head -200 of each new page, giving the LLM enough to skip /wiki-load.
  NEW_PAGES=$(find "$ENTITIES_DIR" -newer "$REF_MARKER" -name '*.md' 2>/dev/null)
  if [ -n "$NEW_PAGES" ]; then
    # Bound the listed names so bulk-import sessions don't produce unbounded payloads.
    # NEW_COUNT still reflects the real total for display/telemetry.
    MAX_NEW=10
    NEW_COUNT=0
    NEW_NAMES=""
    while IFS= read -r page; do
      NEW_COUNT=$((NEW_COUNT + 1))
      [ "$NEW_COUNT" -gt "$MAX_NEW" ] && continue
      NAME="${page##*/}"
      NAME="${NAME%.md}"
      NEW_NAMES="${NEW_NAMES:+${NEW_NAMES}, }${NAME}"
    done <<< "$NEW_PAGES"
    if [ "$NEW_COUNT" -gt "$MAX_NEW" ]; then
      OVERFLOW=$((NEW_COUNT - MAX_NEW))
      NEW_NAMES="${NEW_NAMES} …+${OVERFLOW} more"
    fi
    touch "$NOTIFIED" 2>/dev/null || true
    if [ -n "$DISPLAY" ]; then
      DISPLAY="${DISPLAY} + 📖 ${NEW_COUNT} new: ${NEW_NAMES}"
    else
      DISPLAY="📖 ${NEW_COUNT} new wiki page(s): ${NEW_NAMES}"
    fi
    NEW_CONTENT="<wiki_new_pages>New wiki pages since last prompt: ${NEW_NAMES}. /wiki-load <name> to read.</wiki_new_pages>"
    CONTENT="${CONTENT:+${CONTENT}$'\n\n'}${NEW_CONTENT}"
  fi
fi

# Silent exit when no delta — evergreen directive already lives in SessionStart.
[ -z "$CONTENT" ] && exit 0

# Canonical hookSpecificOutput.additionalContext schema (Anthropic UserPromptSubmit docs).
# systemMessage = user-visible toast; additionalContext = LLM-visible per-turn context injection.
jq -n --arg context "$CONTENT" --arg display "$DISPLAY" \
  '{"systemMessage": $display, "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": $context}}'
