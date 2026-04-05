#!/bin/bash
# SessionStart: inject project wiki context + surface raw/ files + global cross-refs
# Pattern: fast check → build rich hint → output systemMessage

set -euo pipefail
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0  # Subagents inherit parent context

CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
[ -z "$CWD" ] || [[ "$CWD" != /* ]] && exit 0
[ "${#CWD}" -gt 4096 ] && exit 0

REPO_ROOT=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)
[ -z "$REPO_ROOT" ] && exit 0

INDEX_PATH="$REPO_ROOT/wiki/index.md"
[ ! -f "$INDEX_PATH" ] && exit 0  # No wiki — silent exit

SESSION_SHORT=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null | cut -c1-8 || echo "unknown")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Session marker: created NOW, consumed by wiki-stop.sh via `find -newer` to detect wiki changes
# Named with session short ID so concurrent sessions have independent markers (no interference)
# Note: SESSION_SHORT is 8 chars of UUID — collision probability is negligible (1 in 4 billion
# for any two concurrent sessions). In the unlikely event of collision, both sessions write to
# the same marker; the later Stop hook may see an empty change set. Acceptable for developer-local use.
MARKER="$REPO_ROOT/wiki/.session-${SESSION_SHORT}-start"
touch "$MARKER" 2>/dev/null || true

# Log session start (safe write — || true ensures we never crash before systemMessage output)
LOG_PATH="$REPO_ROOT/wiki/log.md"
[ -f "$LOG_PATH" ] && echo "[$TIMESTAMP] SESSION_START session:${SESSION_SHORT}: opened in $(basename "$REPO_ROOT")" >> "$LOG_PATH" || true

# Stale detection: compare index rows vs actual file count
PAGE_COUNT=$(grep -c '^|' "$INDEX_PATH" 2>/dev/null || echo "2")
PAGE_COUNT=$((PAGE_COUNT > 2 ? PAGE_COUNT - 2 : 0))
ACTUAL=$(find "$REPO_ROOT/wiki" -name '*.md' ! -name 'index.md' ! -name 'log.md' ! -name 'SCHEMA.md' 2>/dev/null | wc -l | tr -d ' ')
STALE=""
[ "$ACTUAL" -gt 0 ] && DIFF=$((PAGE_COUNT > ACTUAL ? PAGE_COUNT - ACTUAL : ACTUAL - PAGE_COUNT)) && \
  [ "$DIFF" -gt 3 ] && STALE="⚠️ Index may be stale (${PAGE_COUNT} indexed, ${ACTUAL} files)"$'\n'

# Surface unprocessed raw/ files
RAW_COUNT=$(find "$REPO_ROOT/raw" -type f 2>/dev/null | wc -l | tr -d ' ')
RAW_INDEXED=$(grep -c 'raw/' "$INDEX_PATH" 2>/dev/null || echo "0")
RAW_HINT=""
UNPROCESSED=$((RAW_COUNT - RAW_INDEXED))
[ "$UNPROCESSED" -gt 0 ] && RAW_HINT=$'\n'"📥 ${UNPROCESSED} file(s) in raw/ not yet ingested — ask me to /wiki-ingest them"

# Check for failed queue entries from previous sessions
FAILED_COUNT=$(find "$HOME/.claude/reflection-queue" -name '*-wiki.json' -o -name '*-wikichange.json' 2>/dev/null | \
  xargs -I{} sh -c 'jq -e ".status == \"failed\"" "{}" >/dev/null 2>&1 && echo 1' | wc -l | tr -d ' ')
FAILED_HINT=""
[ "$FAILED_COUNT" -gt 0 ] && FAILED_HINT=$'\n'"⚠️ ${FAILED_COUNT} wiki synthesis failed last session — check ~/.claude/reflection-queue/ for details"

# Index content (truncation visible)
TOTAL_LINES=$(wc -l < "$INDEX_PATH" 2>/dev/null || echo "0")
INDEX_CONTENT=$(head -80 "$INDEX_PATH" 2>/dev/null || true)
TRUNCATION=""
[ "$TOTAL_LINES" -gt 80 ] && TRUNCATION=$'\n'"...and $((TOTAL_LINES - 80)) more lines — /wiki-load or /wiki-query for full search"

# Global wiki cross-reference (cap: top 3 entities × max 10 global topics = bounded grep)
GLOBAL_DIRS=("$HOME/.claude/wiki/topics" "$HOME/.claude/reflection-knowledge/topics")
RELATED=""
for GDIR in "${GLOBAL_DIRS[@]}"; do
  [ ! -d "$GDIR" ] && continue
  # Cap: check top 3 entities only, grep limited to max 10 topic files
  TOPIC_FILES=$(ls "$GDIR"/*.md 2>/dev/null | head -10)
  [ -z "$TOPIC_FILES" ] && break
  for EF in $(ls "$REPO_ROOT/wiki/entities/" 2>/dev/null | head -3); do
    E=$(basename "$EF" .md)
    MATCH=$(echo "$TOPIC_FILES" | xargs grep -l "$E" 2>/dev/null | head -1 | xargs -I{} basename {} .md 2>/dev/null || true)
    [ -n "$MATCH" ] && RELATED="$RELATED$MATCH "
  done
  break  # Only check first available global dir
done
GLOBAL_NOTE=""
[ -n "$RELATED" ] && GLOBAL_NOTE=$'\n'"🔗 Related global knowledge: ${RELATED}(use /wiki-load <topic>)"

RULES="Key rules: never write to raw/ (LLM-write-protected) · always update index.md after wiki changes · entity pages use ## From [Source] subsections · use /wiki-load for JIT context · /wiki-query for synthesis"

MSG="${STALE}📂 Wiki: $(basename "$REPO_ROOT") — ${PAGE_COUNT} pages${RAW_HINT}${FAILED_HINT}

${INDEX_CONTENT}${TRUNCATION}${GLOBAL_NOTE}

Skills: /wiki-ingest · /wiki-query · /wiki-load · /wiki-lint
${RULES}"

jq -n --arg msg "$MSG" '{"systemMessage": $msg}'
