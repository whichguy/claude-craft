#!/bin/bash
# SessionStart: inject project wiki context via systemMessage + additionalContext
# Cache-first: reads pre-computed display/context from wiki/.cache/
# Falls back to legacy computation on cache miss (first session after deploy)

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
{ [ -z "$CWD" ] || [[ "$CWD" != /* ]]; } && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

# Use wiki_find_root (pure directory walk, no git subprocess)
if ! wiki_find_root; then
  # No wiki found — check if this is a git repo and suggest initialization
  GIT_ROOT=""
  dir="$CWD"
  for i in 1 2 3 4; do
    if [ -d "$dir/.git" ]; then GIT_ROOT="$dir"; break; fi
    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && break
    dir="$parent"
  done
  if [ -n "$GIT_ROOT" ]; then
    # Only suggest once per repo (track in state file to avoid nagging)
    STATE_FILE="$HOME/.claude/wiki-prompted-repos.json"
    [ ! -f "$STATE_FILE" ] && echo '{}' > "$STATE_FILE"
    REPO_KEY=$(echo "$GIT_ROOT" | sed 's/[^a-zA-Z0-9]/_/g')
    if ! jq -e --arg k "$REPO_KEY" 'has($k)' "$STATE_FILE" >/dev/null 2>&1; then
      # Mark as prompted
      jq --arg k "$REPO_KEY" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.[$k] = $t' "$STATE_FILE" > "${STATE_FILE}.tmp" \
        && mv "${STATE_FILE}.tmp" "$STATE_FILE" 2>/dev/null
      REPO_NAME=$(basename "$GIT_ROOT")
      jq -n --arg display "📂 ${REPO_NAME} — no wiki. Run /wiki-init to set one up." \
        '{"systemMessage": $display}'
    fi
  fi
  exit 0
fi

# Session marker for change detection (consumed by wiki-stop.sh via find -newer)
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
touch "$MARKER" 2>/dev/null || true

wiki_log "SESSION_START" "opened in $(basename "$REPO_ROOT")"

# systemMessage = user-visible status line, additionalContext = LLM directive.
REPO_NAME=$(basename "$REPO_ROOT")

# Count pages/topics for display (fast — reads from cache or falls back to ls)
CACHE_DIR="$REPO_ROOT/wiki/.cache"
if [ -f "$CACHE_DIR/display.txt" ]; then
  DISPLAY=$(cat "$CACHE_DIR/display.txt")
else
  PAGE_COUNT=$(grep -c '^|' "$REPO_ROOT/wiki/index.md" 2>/dev/null || echo 2)
  PAGE_COUNT=$((PAGE_COUNT > 2 ? PAGE_COUNT - 2 : 0))
  TOPIC_COUNT=$(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | wc -l | tr -d ' ')
  DISPLAY="📂 ${REPO_NAME} wiki · ${PAGE_COUNT} pages · ${TOPIC_COUNT} topics"
  DISPLAY="${DISPLAY}"$'\n'"   /wiki-load <topic> — entity lookup  ·  /wiki-query <question> — cross-page synthesis"
fi

# Minimal directive: location + tool availability. LLM decides when to use it.
CONTEXT="Project wiki: ${REPO_NAME}/wiki/ — /wiki-load <search> or browse index.md before answering project-domain questions."

jq -n --arg display "$DISPLAY" --arg context "$CONTEXT" \
  '{"systemMessage": $display, "additionalContext": $context}'
