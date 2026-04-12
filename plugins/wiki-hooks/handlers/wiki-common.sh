#!/bin/bash
# Shared functions for wiki hook handlers
# Source this file: . "$(dirname "$0")/wiki-common.sh"
shopt -s nullglob

# --- Input parsing ---
# Reads hook JSON from stdin, sets: HOOK_INPUT, AGENT_ID, SID, SESSION_SHORT, TRANSCRIPT, CWD
wiki_parse_input() {
  HOOK_INPUT=$(cat)
  # Single jq call extracts all fields (4 pipes → 1, ~80ms → ~20ms).
  # Uses read instead of eval to avoid shell injection.
  {
    read -r SID
    read -r AGENT_ID
    read -r TRANSCRIPT
    read -r CWD
  } < <(echo "$HOOK_INPUT" | jq -r '(.session_id // "unknown"), (.agent_id // ""), (.transcript_path // ""), (.cwd // "")' 2>/dev/null || printf 'unknown\n\n\n\n')
  # Read PROMPT separately to preserve multi-line content
  PROMPT=$(echo "$HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || true)
  SESSION_SHORT="${SID:0:8}"
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

  # Atomic idempotency: write to PID-tagged tmp, then mv -n (no-clobber).
  # If another process already created queue_file, mv -n fails and we clean up.
  local tmp_file="$queue_file.tmp.$$"
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
      cwd:$cwd,status:"pending",in_progress_at:null}' > "$tmp_file" 2>/dev/null || { rm -f "$tmp_file"; wiki_warn "queue entry failed: $SID ($type)"; return 0; }
  # mv -n: atomic no-clobber — fails if queue_file already exists (another writer won)
  mv -n "$tmp_file" "$queue_file" 2>/dev/null || rm -f "$tmp_file"
}

# --- Wiki change detection ---
# Finds wiki .md files modified since MARKER file. Sets: CHANGED_FILES
wiki_detect_changes() {
  local marker="$1"
  CHANGED_FILES=""
  [ -f "$marker" ] || return 0
  local prefix="$REPO_ROOT/wiki/"
  CHANGED_FILES=$(find "$REPO_ROOT/wiki" -newer "$marker" -name '*.md' \
    ! -name 'index.md' ! -name 'log.md' ! -name 'SCHEMA.md' \
    2>/dev/null | head -20 | while IFS= read -r f; do echo "${f#$prefix}"; done)
}

# --- Queue wiki_change entry ---
# Queues a wiki_change entry from CHANGED_FILES if non-empty.
wiki_queue_changes() {
  local source="$1"
  [ -z "$CHANGED_FILES" ] && return 0
  local suffix="${QUEUE_SUFFIX_CHANGE:-wikichange}"
  local queue_file="$HOME/.claude/reflection-queue/${SID}-${suffix}.json"
  local tmp_file="$queue_file.tmp.$$"

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
      cwd:$cwd,status:"pending"}' > "$tmp_file" 2>/dev/null || { rm -f "$tmp_file"; wiki_warn "queue changes failed: $SID"; return 0; }
  mv -n "$tmp_file" "$queue_file" 2>/dev/null || rm -f "$tmp_file"
}

# --- Display construction ---
# Builds separator-lines display + additionalContext. Sets: DISPLAY, CONTEXT
wiki_build_display() {
  local label="${1:-}"  # optional suffix like "(post-compaction)"
  local cache_dir="$REPO_ROOT/wiki/.cache"

  # Cache hit: read pre-computed files (fast path, ~2ms)
  if [ -f "$cache_dir/display.txt" ] && [ -f "$cache_dir/context.txt" ]; then
    DISPLAY=$(cat "$cache_dir/display.txt")
    CONTEXT=$(cat "$cache_dir/context.txt")
    # Append label if provided (e.g., post-compaction)
    if [ -n "$label" ]; then
      # Insert label into first line of display
      DISPLAY=$(echo "$DISPLAY" | sed "1s/$/ $label/")
    fi
    return 0
  fi

  # Cache miss: legacy computation inline (one-time cold start)
  local repo_name; repo_name=$(basename "$REPO_ROOT")
  local index_path="$REPO_ROOT/wiki/index.md"

  local page_count; page_count=$(grep -c '^|' "$index_path" 2>/dev/null || true)
  page_count=${page_count:-2}
  page_count=$((page_count > 2 ? page_count - 2 : 0))

  local topic_count; topic_count=$(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | wc -l | tr -d ' ')

  # ⚠ No topic names in display — they give the LLM enough context to skip /wiki-load
  DISPLAY="📂 ${repo_name} wiki · ${page_count} pages · ${topic_count} topics${label:+ $label}"
  DISPLAY="${DISPLAY}"$'\n'"   /wiki-load <topic> — entity lookup  ·  /wiki-query <question> — cross-page synthesis"

  CONTEXT="Project wiki: ${repo_name}/wiki/ — /wiki-load <search> or browse index.md before answering project-domain questions."
}

# --- Log entry ---
wiki_log() {
  local event="$1" detail="$2"
  local timestamp; timestamp=$(date '+%Y-%m-%d %H:%M')
  [ -f "$LOG_PATH" ] && echo "[$timestamp] $event session:${SESSION_SHORT}: $detail" >> "$LOG_PATH" 2>/dev/null || true
}

# --- Dependency validation ---
# wiki_warn: stderr warning for hook diagnostics (surfaced by Claude Code hook system)
wiki_warn() {
  echo "wiki-hooks: $1" >&2
}

# wiki_check_deps: pre-flight validation. Pass "true" to also require claude CLI.
wiki_check_deps() {
  local need_claude="${1:-false}"
  if ! command -v jq >/dev/null 2>&1; then
    wiki_warn "jq not found — wiki hooks disabled (install: brew install jq)"
    return 1
  fi
  if [ "$need_claude" = "true" ]; then
    if ! command -v claude >/dev/null 2>&1; then
      wiki_warn "claude CLI not found — wiki extraction disabled"
      return 1
    fi
    if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ ! -f "$HOME/.claude/.credentials.json" ]; then
      wiki_warn "no API key or credentials found — claude extraction may fail"
    fi
  fi
  return 0
}

# wiki_resolve_claude_cmd: find claude-router (Bedrock/OpenRouter/Ollama) or fall back to bare claude.
# Sets CLAUDE_CMD variable for caller to use.
wiki_resolve_claude_cmd() {
  local router
  for router in \
    "$HOME/.claude/tools/claude-router" \
    "$(cd "$(dirname "$0")/../../.." 2>/dev/null && pwd)/tools/claude-router" \
    "$(command -v claude-router 2>/dev/null)"; do
    if [ -n "$router" ] && [ -x "$router" ]; then
      CLAUDE_CMD="$router"
      return 0
    fi
  done
  CLAUDE_CMD="claude"
  return 0
}

# --- Atomic debounce ---
# wiki_debounce DEBOUNCE_FILE SECONDS
# Returns 0 if caller wins the debounce (proceed), 1 if debounced (exit).
# Atomic: touch claim-$$, mv claim → debounce_file. Exactly one caller wins.
wiki_debounce() {
  local debounce_file="$1" seconds="${2:-30}"
  if [ -f "$debounce_file" ]; then
    local age=$(( $(date +%s) - $(stat -f %m "$debounce_file" 2>/dev/null || stat -c %Y "$debounce_file" 2>/dev/null || echo 0) ))
    [ "$age" -lt "$seconds" ] && return 1
  fi
  local claim="${debounce_file}.claim-$$"
  touch "$claim"
  mv "$claim" "$debounce_file" 2>/dev/null || { rm -f "$claim"; return 1; }
  return 0
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

# --- Unclaim batch files ---
# Restores .batch-PID files back to .json (exact content, no jq rewrite).
# Usage: wiki_unclaim_batch QUEUE_DIR PID
wiki_unclaim_batch() {
  local queue_dir="$1" pid="$2"
  for f in "$queue_dir"/*.batch-"$pid"; do
    [ -f "$f" ] || continue
    mv "$f" "${f%.batch-*}.json" 2>/dev/null || rm -f "$f"
  done
}

# --- Wait for foreign batch files to clear ---
# Returns 0 if clear (proceed), 1 if timed out.
# Usage: wiki_wait_foreign_batches QUEUE_DIR MY_PID MAX_SECONDS POLL_INTERVAL
wiki_wait_foreign_batches() {
  local queue_dir="$1" my_pid="$2" max_seconds="${3:-86400}" poll="${4:-20}"
  local elapsed=0
  while [ "$elapsed" -lt "$max_seconds" ]; do
    local found=0
    for f in "$queue_dir"/*.batch-*; do
      [ -f "$f" ] || continue
      local pid="${f##*.batch-}"
      [ "$pid" = "$my_pid" ] && continue
      # Dead PID? Clean it up and keep checking
      if ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$f"
        continue
      fi
      found=1
      break
    done
    [ "$found" -eq 0 ] && return 0
    sleep "$poll"
    elapsed=$((elapsed + poll))
  done
  return 1
}
