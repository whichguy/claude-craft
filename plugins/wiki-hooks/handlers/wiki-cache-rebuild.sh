#!/bin/bash
# Async: rebuild pre-computed wiki cache files after wiki/ content changes.
# Triggered by: SessionStart (async), PostToolUse on Write|Edit (async).
# Produces: wiki/.cache/{display.txt, context.txt, entity-index.tsv, mtime}
# Uses atomic write pattern: write to .tmp, then mv.

set -eo pipefail
shopt -s nullglob

# --- Fast exit for non-wiki contexts ---
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0
[ -z "$CWD" ] && exit 0

# Use wiki_find_root for consistent root detection (log.md marker, same as all handlers)
wiki_find_root || exit 0

CACHE_DIR="$REPO_ROOT/wiki/.cache"
ENTITIES_DIR="$REPO_ROOT/wiki/entities"

# --- PostToolUse path check ---
# If this was triggered by PostToolUse, check if the written file is under wiki/
TOOL_INPUT=$(echo "$HOOK_INPUT" | jq -r '.tool_input // empty' 2>/dev/null || true)
if [ -n "$TOOL_INPUT" ]; then
  FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
  if [ -n "$FILE_PATH" ]; then
    case "$FILE_PATH" in
      */wiki/*) ;; # Wiki file — proceed with rebuild
      *) exit 0 ;; # Not a wiki file — skip
    esac
  fi
fi

# --- Debounce: skip if rebuilt <30s ago ---
mkdir -p "$CACHE_DIR"
DEBOUNCE_FILE="$CACHE_DIR/last-rebuild"
if [ -f "$DEBOUNCE_FILE" ]; then
  LAST_REBUILD=$(stat -f %m "$DEBOUNCE_FILE" 2>/dev/null || stat -c %Y "$DEBOUNCE_FILE" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ $((NOW - LAST_REBUILD)) -lt 30 ]; then
    exit 0
  fi
fi

# --- Build entity-index.tsv ---
# Format: slug<TAB>word1 word2 word3 (one line per entity)
if [ -d "$ENTITIES_DIR" ]; then
  INDEX_TMP="$CACHE_DIR/entity-index.tsv.tmp"
  : > "$INDEX_TMP"
  for file in "$ENTITIES_DIR"/*.md; do
    [ -f "$file" ] || continue
    name=$(basename "$file" .md)
    words=$(echo "$name" | tr '-' ' ')
    printf '%s\t%s\n' "$name" "$words" >> "$INDEX_TMP"
  done
  mv "$INDEX_TMP" "$CACHE_DIR/entity-index.tsv"
fi

# --- Build display.txt + context.txt ---
# Intentionally duplicates wiki_build_display() logic from wiki-common.sh.
# Cannot call wiki_build_display() here — it reads the cache we're rebuilding.
repo_name=$(basename "$REPO_ROOT")
index_path="$REPO_ROOT/wiki/index.md"

page_count=$(grep -c '^|' "$index_path" 2>/dev/null || true)
page_count=${page_count:-2}
page_count=$((page_count > 2 ? page_count - 2 : 0))

topics=$(ls "$ENTITIES_DIR/" 2>/dev/null | sed 's/\.md$//' | head -10 | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
topic_count=$(ls "$ENTITIES_DIR/" 2>/dev/null | wc -l | tr -d ' ')
overflow=""
if [ "$topic_count" -gt 10 ]; then overflow=", +$((topic_count - 10)) more"; fi

sep="   ─────────────────────────────────────"

DISPLAY_TMP="$CACHE_DIR/display.txt.tmp"
if [ -n "$topics" ]; then
  topic_display=$(echo "$topics" | sed 's/, / · /g')
  {
    echo "📂 ${repo_name} wiki · ${page_count} pages · ${topic_count} topics"
    echo "$sep"
    echo "   ${topic_display}${overflow}"
    echo "$sep"
    echo "   /wiki-load <topic>  ·  /wiki-query <question>"
  } > "$DISPLAY_TMP"
else
  {
    echo "📂 ${repo_name} wiki · ${page_count} pages"
    echo "   /wiki-load <topic>  ·  /wiki-query <question>"
  } > "$DISPLAY_TMP"
fi
mv "$DISPLAY_TMP" "$CACHE_DIR/display.txt"

# Build context.txt
CONTEXT_TMP="$CACHE_DIR/context.txt.tmp"
index_content=$(grep '^|' "$index_path" 2>/dev/null | head -30 || true)
if [ -n "$index_content" ]; then
  {
    echo "Project wiki: ${repo_name}. Load pages with /wiki-load <topic>. Query with /wiki-query <question>."
    echo ""
    echo "$index_content"
  } > "$CONTEXT_TMP"
else
  echo "Wiki available: ${repo_name} (${page_count} pages). Use /wiki-load <topic> to load context. Use /wiki-query <question> to synthesize answers." > "$CONTEXT_TMP"
fi
mv "$CONTEXT_TMP" "$CACHE_DIR/context.txt"

# --- Touch mtime + debounce markers ---
touch "$CACHE_DIR/mtime"
touch "$DEBOUNCE_FILE"
