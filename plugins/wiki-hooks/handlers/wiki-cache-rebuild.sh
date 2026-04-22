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

CACHE_DIR="$REPO_ROOT/.wiki/.cache"
ENTITIES_DIR="$REPO_ROOT/.wiki/entities"

# --- PostToolUse path check ---
# If this was triggered by PostToolUse, check if the written file is under wiki/
TOOL_INPUT=$(echo "$HOOK_INPUT" | jq -r '.tool_input // empty' 2>/dev/null || true)
if [ -n "$TOOL_INPUT" ]; then
  FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
  if [ -n "$FILE_PATH" ]; then
    case "$FILE_PATH" in
      */.wiki/*) ;; # Wiki file — proceed with rebuild
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

# --- Build file-refs.tsv ---
# Format: <repo-relative-path>\t<slug1,slug2,...>  (5-slug cap with ...+N overflow)
# Consumed by: wiki-read-gate.sh (PreToolUse:Read) — injects a hint pointing to the
# wiki entity/source that documents the file being Read.
#
# Extraction: (a) backtick-wrapped paths in body; (b) frontmatter `sources:` list
# entries that look like repo-relative paths. Every candidate is filtered by:
#   - noise dirs:   wiki/ .git/ node_modules/ raw/ .cache/
#   - noise exts:   .lock .log .tmp
#   - existence:    must resolve to a real file under REPO_ROOT
# Full rewrite — stale/deleted entries drop out naturally.
SOURCES_DIR="$REPO_ROOT/.wiki/sources"
if [ -d "$ENTITIES_DIR" ] || [ -d "$SOURCES_DIR" ]; then
  REFS_RAW="$CACHE_DIR/file-refs.raw.tmp"
  REFS_TMP="$CACHE_DIR/file-refs.tsv.tmp"
  : > "$REFS_RAW"

  # Write the frontmatter-sources awk program to a temp file so we avoid
  # quoting grief. Kept simple on purpose — shape-specific extractor, not
  # a general YAML parser.
  AWK_SRC="$CACHE_DIR/extract-sources.awk.tmp"
  cat > "$AWK_SRC" <<'AWK_PROG'
BEGIN { fm = 0; in_src = 0 }
/^---$/ { fm = 1 - fm; next }
fm == 0 { next }
/^sources:[[:space:]]*\[/ {
  line = $0
  sub(/^sources:[[:space:]]*\[/, "", line)
  sub(/\].*$/, "", line)
  gsub(/[[:space:]]/, "", line)
  n = split(line, arr, ",")
  for (i = 1; i <= n; i++) {
    v = arr[i]
    gsub(/^["']|["']$/, "", v)
    if (length(v) > 0) print v
  }
  next
}
/^sources:[[:space:]]*$/ { in_src = 1; next }
in_src == 1 && /^[[:space:]]*-[[:space:]]/ {
  v = $0
  sub(/^[[:space:]]*-[[:space:]]+/, "", v)
  gsub(/^["']|["']$/, "", v)
  if (length(v) > 0) print v
  next
}
in_src == 1 && /^[a-zA-Z]/ { in_src = 0 }
AWK_PROG

  # Iterate both entities/ and sources/ wiki pages
  for file in "$ENTITIES_DIR"/*.md "$SOURCES_DIR"/*.md; do
    [ -f "$file" ] || continue
    slug="${file##*/}"
    slug="${slug%.md}"

    # (a) backtick-wrapped body paths — grep returns 1 on no match, tolerate
    { grep -oE '`[a-zA-Z0-9][a-zA-Z0-9_/.-]{2,}\.[a-z0-9]{1,6}`' "$file" 2>/dev/null || true; } | \
      tr -d '`' | while IFS= read -r p; do
        case "$p" in
          .wiki/*|.git/*|node_modules/*|raw/*|.cache/*|*.lock|*.log|*.tmp) continue ;;
        esac
        [ -f "$REPO_ROOT/$p" ] || continue
        printf '%s\t%s\n' "$p" "$slug"
      done >> "$REFS_RAW"

    # (b) frontmatter sources:
    awk -f "$AWK_SRC" "$file" 2>/dev/null | while IFS= read -r p; do
      # require a slash — skip bare slugs / entity refs
      case "$p" in
        */*) ;;
        *) continue ;;
      esac
      case "$p" in
        .wiki/*|.git/*|node_modules/*|raw/*|.cache/*|*.lock|*.log|*.tmp) continue ;;
      esac
      [ -f "$REPO_ROOT/$p" ] || continue
      printf '%s\t%s\n' "$p" "$slug"
    done >> "$REFS_RAW"
  done

  # Aggregate: group by path, join slugs (sorted), cap at 5 with ...+N overflow
  sort -u "$REFS_RAW" | awk -F'\t' '
  {
    if (paths[$1] == "") { paths[$1] = $2 } else { paths[$1] = paths[$1] "," $2 }
    counts[$1]++
  }
  END {
    for (p in paths) {
      if (counts[p] > 5) {
        n = split(paths[p], arr, ",")
        out = arr[1]
        for (i = 2; i <= 5; i++) out = out "," arr[i]
        print p "\t" out "...+" (counts[p] - 5)
      } else {
        print p "\t" paths[p]
      }
    }
  }' | sort > "$REFS_TMP"

  mv "$REFS_TMP" "$CACHE_DIR/file-refs.tsv"
  rm -f "$REFS_RAW" "$AWK_SRC" 2>/dev/null || true
fi

# --- Build display.txt + context.txt ---
# Intentionally duplicates wiki_build_display() logic from wiki-common.sh.
# Cannot call wiki_build_display() here — it reads the cache we're rebuilding.
repo_name=$(basename "$REPO_ROOT")
index_path="$REPO_ROOT/.wiki/index.md"

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
echo "Project wiki: ${repo_name}/.wiki/ — /wiki-load <search> or browse index.md before answering project-domain questions." > "$CONTEXT_TMP"
mv "$CONTEXT_TMP" "$CACHE_DIR/context.txt"

# --- Touch mtime marker ---
touch "$CACHE_DIR/mtime"
