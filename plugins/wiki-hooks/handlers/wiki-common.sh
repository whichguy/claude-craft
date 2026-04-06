#!/bin/bash
# Shared functions for wiki hook handlers
# Source this file: . "$(dirname "$0")/wiki-common.sh"

# --- Input parsing ---
# Reads hook JSON from stdin, sets: HOOK_INPUT, AGENT_ID, SID, SESSION_SHORT, TRANSCRIPT, CWD
wiki_parse_input() {
  HOOK_INPUT=$(cat)
  AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
  SID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
  SESSION_SHORT="${SID:0:8}"
  TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
  CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
}

# --- Wiki discovery ---
# Walks up from CWD to find wiki/log.md. Sets: REPO_ROOT, WIKI_PATH, LOG_PATH
# Returns 1 if no wiki found.
wiki_find_root() {
  local dir="${1:-$CWD}"
  REPO_ROOT=""; WIKI_PATH=""; LOG_PATH=""
  for i in 1 2 3 4; do
    if [ -f "$dir/wiki/log.md" ]; then
      REPO_ROOT="$dir"; WIKI_PATH="$dir/wiki/"; LOG_PATH="$dir/wiki/log.md"
      return 0
    fi
    local parent; parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && break
    dir="$parent"
  done
  return 1
}

# --- Queue entry writing ---
# wiki_queue_entry TYPE SOURCE PRIORITY [extra_jq_args...]
# Writes a queue entry to $HOME/.claude/reflection-queue/
# Filename: ${SID}-${TYPE_SUFFIX}.json (caller can override via QUEUE_SUFFIX)
wiki_queue_entry() {
  local type="$1" source="$2" priority="${3:-normal}"
  local queue_dir="$HOME/.claude/reflection-queue"
  local suffix="${QUEUE_SUFFIX:-${type}}"
  local queue_file="$queue_dir/${SID}-${suffix}.json"

  mkdir -p "$queue_dir"

  # Skip if already queued (idempotency)
  [ -f "$queue_file" ] && return 0

  jq -n \
    --arg sid "$SID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg type "$type" \
    --arg source "$source" \
    --arg priority "$priority" \
    --arg transcript "$TRANSCRIPT" \
    --arg wiki_path "$WIKI_PATH" \
    --arg cwd "$CWD" \
    '{type:$type,session_id:$sid,queued_at:$ts,source:$source,
      priority:$priority,transcript_path:$transcript,wiki_path:$wiki_path,
      cwd:$cwd,status:"pending"}' > "$queue_file" 2>/dev/null || true
}

# --- Wiki change detection ---
# Finds wiki .md files modified since MARKER file. Sets: CHANGED_FILES
wiki_detect_changes() {
  local marker="$1"
  CHANGED_FILES=""
  [ -f "$marker" ] || return 0
  CHANGED_FILES=$(find "$REPO_ROOT/wiki" -newer "$marker" -name '*.md' \
    ! -name 'index.md' ! -name 'log.md' ! -name 'SCHEMA.md' \
    2>/dev/null | head -20 | sed "s|$REPO_ROOT/wiki/||")
}

# --- Queue wiki_change entry ---
# Queues a wiki_change entry from CHANGED_FILES if non-empty.
wiki_queue_changes() {
  local source="$1"
  [ -z "$CHANGED_FILES" ] && return 0
  local suffix="${QUEUE_SUFFIX_CHANGE:-wikichange}"
  local queue_file="$HOME/.claude/reflection-queue/${SID}-${suffix}.json"
  [ -f "$queue_file" ] && return 0

  local changed_json
  changed_json=$(echo "$CHANGED_FILES" | jq -R . | jq -s .)
  jq -n \
    --arg sid "$SID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg source "$source" \
    --arg wiki_path "$WIKI_PATH" \
    --arg cwd "$CWD" \
    --argjson files "$changed_json" \
    '{type:"wiki_change",session_id:$sid,queued_at:$ts,source:$source,
      priority:"normal",wiki_path:$wiki_path,changed_files:$files,
      cwd:$cwd,status:"pending"}' > "$queue_file" 2>/dev/null || true
}

# --- Display construction ---
# Builds separator-lines display + additionalContext. Sets: DISPLAY, CONTEXT
wiki_build_display() {
  local label="${1:-}"  # optional suffix like "(post-compaction)"
  local repo_name; repo_name=$(basename "$REPO_ROOT")
  local index_path="$REPO_ROOT/wiki/index.md"

  local page_count; page_count=$(grep -c '^|' "$index_path" 2>/dev/null || true)
  page_count=${page_count:-2}
  page_count=$((page_count > 2 ? page_count - 2 : 0))

  local topics; topics=$(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | sed 's/\.md$//' | head -10 | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
  local topic_count; topic_count=$(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | wc -l | tr -d ' ')
  local overflow=""
  if [ "$topic_count" -gt 10 ]; then overflow=", +$((topic_count - 10)) more"; fi

  local sep="   ─────────────────────────────────────"

  if [ -n "$topics" ]; then
    local topic_display; topic_display=$(echo "$topics" | sed 's/, / · /g')
    DISPLAY="📂 ${repo_name} wiki · ${page_count} pages · ${topic_count} topics${label:+ $label}"
    DISPLAY="${DISPLAY}"$'\n'"${sep}"
    DISPLAY="${DISPLAY}"$'\n'"   ${topic_display}${overflow}"
    DISPLAY="${DISPLAY}"$'\n'"${sep}"
    DISPLAY="${DISPLAY}"$'\n'"   /wiki-load <topic>  ·  /wiki-query <question>"
  else
    DISPLAY="📂 ${repo_name} wiki · ${page_count} pages${label:+ $label}"
    DISPLAY="${DISPLAY}"$'\n'"   /wiki-load <topic>  ·  /wiki-query <question>"
  fi

  # Rich context: inject full index table so Claude can match questions to pages by summary
  local index_content; index_content=$(grep '^|' "$index_path" 2>/dev/null | head -30 || true)
  if [ -n "$index_content" ]; then
    CONTEXT="Project wiki: ${repo_name}. Load pages with /wiki-load <topic>. Query with /wiki-query <question>."$'\n\n'"${index_content}"
  else
    CONTEXT="Wiki available: ${repo_name} (${page_count} pages). Use /wiki-load <topic> to load context. Use /wiki-query <question> to synthesize answers."
  fi

  # Append entity digest if scale allows (≤50 entities)
  wiki_build_entity_summaries
  if [ -n "$ENTITY_DIGEST" ]; then
    CONTEXT="${CONTEXT}"$'\n\n'"${ENTITY_DIGEST}"
  fi
}

# --- Entity digest construction ---
# Reads the first 3-5 lines (overview paragraph) of each entity page.
# Sets: ENTITY_DIGEST (empty if >50 entities or no entities dir)
wiki_build_entity_summaries() {
  ENTITY_DIGEST=""
  local entities_dir="$REPO_ROOT/wiki/entities"
  [ -d "$entities_dir" ] || return 0

  local entity_count; entity_count=$(ls "$entities_dir"/*.md 2>/dev/null | wc -l | tr -d ' ')
  [ "$entity_count" -eq 0 ] && return 0
  # Scale guard: skip digest for large wikis
  [ "$entity_count" -gt 50 ] && return 0

  local digest=""
  local file name overview
  for file in "$entities_dir"/*.md; do
    [ -f "$file" ] || continue
    name=$(basename "$file" .md)
    # Read lines 2-5 (skip the # Title line), strip empty lines, join into one line
    overview=$(sed -n '2,5p' "$file" 2>/dev/null | grep -v '^$' | tr '\n' ' ' | sed 's/  */ /g;s/ *$//')
    [ -z "$overview" ] && continue
    # Truncate to ~200 chars to keep digest compact
    overview="${overview:0:200}"
    digest="${digest}"$'\n'"- **${name}**: ${overview}"
  done

  # Only set digest if at least one entity had an overview
  [ -z "$digest" ] && return 0
  ENTITY_DIGEST="## Entity Summaries${digest}"
}

# --- Log entry ---
wiki_log() {
  local event="$1" detail="$2"
  local timestamp; timestamp=$(date '+%Y-%m-%d %H:%M')
  [ -f "$LOG_PATH" ] && echo "[$timestamp] $event session:${SESSION_SHORT}: $detail" >> "$LOG_PATH" 2>/dev/null || true
}

# --- Orphan cleanup ---
# Clean up stale .processing-PID or .clearing-PID files
wiki_cleanup_orphans() {
  local dir="$1" pattern="$2"  # e.g. ".session-*-clearing-*" or "*.processing-*"
  for f in "$dir"/$pattern; do
    [ -f "$f" ] || continue
    local pid="${f##*-}"
    if ! kill -0 "$pid" 2>/dev/null; then
      local orig="${f%.*}.json"  # best-effort restore
      mv "$f" "$orig" 2>/dev/null || rm -f "$f"
    fi
  done
}
