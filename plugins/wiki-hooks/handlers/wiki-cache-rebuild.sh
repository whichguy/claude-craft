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
wiki_debounce "$CACHE_DIR/last-rebuild" 30 || exit 0

# --- Build entity-index.tsv ---
# Format: slug<TAB>word1 word2 word3 (one line per entity)
if [ -d "$ENTITIES_DIR" ]; then
  INDEX_TMP="$CACHE_DIR/entity-index.tsv.tmp"
  : > "$INDEX_TMP"
  for file in "$ENTITIES_DIR"/*.md; do
    [ -f "$file" ] || continue
    # ⚠ Pure bash — no basename/tr forks (was 2 forks × N entities)
    name="${file##*/}"
    name="${name%.md}"
    words="${name//-/ }"
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

topic_count=$(ls "$ENTITIES_DIR/" 2>/dev/null | wc -l | tr -d ' ')

DISPLAY_TMP="$CACHE_DIR/display.txt.tmp"
# ⚠ No topic names in display — they give the LLM enough context to skip /wiki-load
{
  echo "📂 ${repo_name} wiki · ${page_count} pages · ${topic_count} topics"
  echo "   /wiki-load <topic> — entity lookup  ·  /wiki-query <question> — cross-page synthesis"
} > "$DISPLAY_TMP"
mv "$DISPLAY_TMP" "$CACHE_DIR/display.txt"

# Build context.txt
CONTEXT_TMP="$CACHE_DIR/context.txt.tmp"
echo "Project wiki: ${repo_name}/wiki/ — /wiki-load <search> or browse index.md before answering project-domain questions." > "$CONTEXT_TMP"
mv "$CONTEXT_TMP" "$CACHE_DIR/context.txt"

# --- Touch mtime marker ---
touch "$CACHE_DIR/mtime"
