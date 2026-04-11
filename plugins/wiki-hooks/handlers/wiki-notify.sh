#!/bin/bash
# UserPromptSubmit: inject wiki context via two paths:
#   1. Mandate injection: unconditional WIKI_CHECK reminder on every prompt (WIKI_CHECK directive)
#      — fires on every UserPromptSubmit to keep mandate in active context; WIKI_SKIP=1 to suppress
#      See: ~/.claude/CLAUDE.md WIKI_CHECK directive + plan draft 3.5 (research-backed phrasing)
#   2. Prompt-aware: keyword-match user prompt against cached entity index → inject summaries
#   3. New-page: inject newly-created entity pages since last check
# Cache-first: reads entity-index.tsv instead of looping entity files

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

wiki_find_root || exit 0

# ⚠ Skip injection for wiki commands — they already handle their own wiki access.
# Matching here just adds noise (e.g., directive to "Use /wiki-load" when already running it).
case "$PROMPT" in
  /wiki-load*|/wiki-query*|/wiki-ingest*|/wiki-process*|/wiki-lint*) exit 0 ;;
esac

ENTITIES_DIR="$REPO_ROOT/wiki/entities"
CACHE_DIR="$REPO_ROOT/wiki/.cache"
ENTITY_INDEX="$CACHE_DIR/entity-index.tsv"
CONTENT=""
DISPLAY=""

# --- Mandate injection: fires on every UserPromptSubmit to keep WIKI_CHECK in active context ---
# Honors WIKI_SKIP=1 escape valve for read-only review sessions (existing behavior unaffected).
WIKI_CHECK_REMINDER=""
if [ "${WIKI_SKIP:-}" != "1" ]; then
  # Compute relative wiki path from stdin cwd (not $CLAUDE_PROJECT_DIR — unset in some wrappers).
  # CWD is set by wiki_parse_input from stdin .cwd field (guaranteed per Anthropic hooks docs).
  WIKI_REL="${WIKI_PATH%/}"     # remove trailing slash from WIKI_PATH set by wiki_find_root
  WIKI_REL="${WIKI_REL#$CWD/}" # strip CWD prefix → relative path (e.g. "wiki")

  # XML-tag wrapper distinguishes directive from Claude Code harness irrelevance-filter disclaimer.
  # Positive imperative voice (Anthropic best practices). Quote-first compliance signal converts
  # wiki consultation from unobservable commitment to grep-able audit signal. Named anti-patterns
  # remove rhetorical escape hatches the model otherwise generates (ArXiv 2603.25056).
  WIKI_CHECK_REMINDER="<wiki_grounding_required>
REQUIRED: Before planning, tasking, researching, debugging, or answering project-domain questions, load wiki entries from ${WIKI_REL}/index.md via /wiki-load <topic>. The wiki records decisions and conventions that contradict what the code appears to do at face value — skipping it produces plausible-but-wrong plans.

Compliance: in your first response, name the wiki entries you consulted and quote one relevant sentence from each. If none apply after scanning the index, state \"wiki/index.md scanned — no relevant entries\" and name 2-3 index entries you considered.

Do not rationalize past this with \"execution-only session\", \"I already know the code\", or \"this is a trivial change\". Escape valve for read-only review sessions: set WIKI_SKIP=1 in the shell hosting Claude Code.
</wiki_grounding_required>"
fi

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
    CONTENT="Wiki pages may be relevant: ${MATCHED_NAMES}. Use /wiki-load <search> to retrieve."
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
    NEW_COUNT=0
    NEW_NAMES=""
    while IFS= read -r page; do
      NAME="${page##*/}"
      NAME="${NAME%.md}"
      NEW_NAMES="${NEW_NAMES:+${NEW_NAMES}, }${NAME}"
      NEW_COUNT=$((NEW_COUNT + 1))
    done <<< "$NEW_PAGES"
    touch "$NOTIFIED" 2>/dev/null || true
    if [ -n "$DISPLAY" ]; then
      DISPLAY="${DISPLAY} + 📖 ${NEW_COUNT} new: ${NEW_NAMES}"
    else
      DISPLAY="📖 ${NEW_COUNT} new wiki page(s): ${NEW_NAMES}"
    fi
    CONTENT="New wiki pages: ${NEW_NAMES}. Use /wiki-load <search> to retrieve."${CONTENT:+$'\n\n'"${CONTENT}"}
  fi
fi

# Exit only if nothing to output (no mandate — WIKI_SKIP=1 — and no entity content)
[ -z "$WIKI_CHECK_REMINDER" ] && [ -z "$CONTENT" ] && exit 0

# Combine mandate reminder + entity content; mandate prepended so it lands first in context.
if [ -n "$WIKI_CHECK_REMINDER" ]; then
  ADDITIONAL_CONTEXT="$WIKI_CHECK_REMINDER${CONTENT:+$'\n\n'$CONTENT}"
else
  ADDITIONAL_CONTEXT="$CONTENT"
fi

# Canonical hookSpecificOutput.additionalContext schema (Anthropic UserPromptSubmit docs).
# systemMessage = user-visible toast; additionalContext = LLM-visible per-turn context injection.
SYSTEM_MSG="${DISPLAY:-Wiki available — /wiki-load <topic> or Read wiki/index.md}"
jq -n --arg context "$ADDITIONAL_CONTEXT" --arg display "$SYSTEM_MSG" \
  '{"systemMessage": $display, "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": $context}}'
