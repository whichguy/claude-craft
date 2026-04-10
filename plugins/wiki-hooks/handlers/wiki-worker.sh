#!/bin/bash
# Lock-less wiki queue processor.
# Concurrency: atomic mv-claim with PID verification. No lock files.
# ⚠ mv is the ONLY concurrency primitive — exactly one caller wins each rename.
# Claude extraction subshells are fire-and-forget (no wait, no detach wrapper).

set -o pipefail
shopt -s nullglob
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps true || exit 0
wiki_resolve_claude_cmd

HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[ -n "$AGENT_ID" ] && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"

# --- Pre-check: any .json files at all? ---
# ⚠ Pure glob — no grep/find subprocess (was grep -rl in old design)
files=("$QUEUE_DIR"/*.json)
[ ${#files[@]} -eq 0 ] && exit 0

# --- Debounce: skip if another worker started <30s ago ---
DEBOUNCE="$QUEUE_DIR/.last-worker"
if [ -f "$DEBOUNCE" ]; then
  age=$(( $(date +%s) - $(stat -f %m "$DEBOUNCE" 2>/dev/null || stat -c %Y "$DEBOUNCE" 2>/dev/null || echo 0) ))
  [ "$age" -lt 30 ] && exit 0
fi
touch "$DEBOUNCE"

# --- Phase 0.5: Clean orphaned claims from crashed workers ---
# ⚠ 10min threshold = 5× margin over 120s extraction timeout
for stale in "$QUEUE_DIR"/*.batch-*; do
  [ -f "$stale" ] || continue
  stale_age=$(( $(date +%s) - $(stat -f %m "$stale" 2>/dev/null || stat -c %Y "$stale" 2>/dev/null || echo 0) ))
  [ "$stale_age" -gt 600 ] && rm -f "$stale"
done

# --- Phase 1: Claim — rename all .json to .batch-$$ ---
# ⚠ Atomic: exactly one caller wins each file. Losers get "No such file" silently.
for f in "$QUEUE_DIR"/*.json; do
  mv "$f" "${f%.json}.batch-$$" 2>/dev/null
done

# --- Phase 2: Verify — only work on files we actually own ---
claimed=("$QUEUE_DIR"/*.batch-$$)
[ ${#claimed[@]} -eq 0 ] && exit 0

# --- Phase 3: Validate + process each claimed entry ---
for entry in "${claimed[@]}"; do
  # Skip 0-byte files (corrupted by previous herd)
  [ ! -s "$entry" ] && { rm -f "$entry"; continue; }

  # ⚠ read-based extraction (not eval) — same pattern as wiki_parse_input in wiki-common.sh
  {
    read -r STATUS
    read -r TRANSCRIPT
    read -r WIKI_PATH
    read -r SID
    read -r RETRY
  } < <(jq -r '(.status // "pending"), (.transcript_path // ""), (.wiki_path // ""), (.session_id // ""), (.retry_count // 0)' "$entry" 2>/dev/null || printf 'invalid\n\n\n\n0\n')
  [ "$STATUS" = "invalid" ] && { rm -f "$entry"; continue; }

  # Skip non-pending
  [ "$STATUS" != "pending" ] && { rm -f "$entry"; continue; }

  # Validate transcript exists (if specified)
  if [ -n "$TRANSCRIPT" ] && [ "$TRANSCRIPT" != "null" ] && [ ! -f "$TRANSCRIPT" ]; then
    rm -f "$entry"; continue
  fi

  # Validate wiki path
  if [ -z "$WIKI_PATH" ] || [ "$WIKI_PATH" = "null" ] || [ ! -d "$WIKI_PATH" ]; then
    rm -f "$entry"; continue
  fi

  # --- Spawn claude extraction (fire-and-forget background subshell) ---
  (
    EXTRACT_PROMPT="You are a wiki curator for a software project. Your job is to read a conversation
transcript and extract lasting knowledge into wiki entity pages.

You have access to: Read, Write, Edit, Glob, Grep, Bash tools.

## Inputs

- Transcript: $TRANSCRIPT (read the last 2000 lines with the Read tool)
- Wiki root: $WIKI_PATH
- Session ID: ${SID:0:8}

## Critical: read before you write — do not trust memory

You know NOTHING about this wiki until you read it. Do not assume page names, formats,
or content based on the transcript alone. You MUST read real files before every decision.

1. Read ${WIKI_PATH%/}/SCHEMA.md — this defines all page formats, naming rules, and conventions.
   Every page you create or edit MUST follow the schema exactly.
2. Read ${WIKI_PATH%/}/index.md — this is the registry of all pages. You will update it at the end.
3. Glob ${WIKI_PATH%/}/entities/*.md — know what already exists before creating anything.
4. Before editing ANY existing entity: Read it first. Do not assume its content or structure.

## What to extract

Read the transcript carefully. Look for concepts that meet 2+ of these criteria:
  (a) Named 3+ times across the conversation
  (b) A non-obvious decision or tradeoff was made about it
  (c) It caused confusion, correction, or debugging
  (d) It is a named architectural component, design pattern, or integration point

Skip: routine tool usage, trivial file edits, boilerplate, anything already fully captured
in an existing entity page for this session.

## How to write entities

For EXISTING entity pages (file already in entities/):
- Grep the file for \"${SID:0:8}\" first — if this session is already recorded, skip it (idempotency).
- Append a bullet: \`- **From Session ${SID:0:8}:** <2-3 sentences of what was learned>\`
- Do NOT add ## headers — bullets only. This saves tokens when pages are loaded.
- If your new bullet contradicts an older one, note the evolution explicitly.
- If multiple older bullets are now subsumed by deeper understanding, consolidate them into one.

For NEW entities (concept not yet in entities/):
- Create entities/SLUG.md following the Entity format in SCHEMA.md exactly:
  # Entity Name
  Overview (2-3 sentences defining what this IS — retrieval-friendly, not narrative).
  - **From Session ${SID:0:8}:** <detail>
  → See also: [[related-entity-slug]]
- Slug: lowercase, hyphens, max 50 chars.

## Cross-linking

Every entity should link to related entities. When you add or create an entity:
- Add \`→ See also: [[slug]]\` links to related pages
- Update BOTH sides — if A links to B, B should link back to A
- Use Grep to find mentions of the new entity name in other pages

## Finishing up

1. Update ${WIKI_PATH%/}/index.md: add a row for each new page, update the summary/date for
   modified pages. Format: \`| entities/SLUG.md | one-line summary (start with what it IS, then key search terms) | YYYY-MM-DD |\`
2. Append to ${WIKI_PATH%/}/log.md: \`[YYYY-MM-DD HH:MM] EXTRACT session:${SID:0:8}: <comma-separated list of pages created/updated>\`

## Anti-patterns — do NOT do these

- Do NOT create pages for trivial concepts (a single file rename, a typo fix).
- Do NOT duplicate content already in the transcript — synthesize and distill.
- Do NOT create a page with only a title and no substantive content.
- Do NOT remove or overwrite existing entity bullets from other sessions.
- Do NOT add the same session's content twice (always grep for session ID first)."

    TIMEOUT_CMD=""
    if command -v gtimeout >/dev/null 2>&1; then TIMEOUT_CMD="gtimeout 120"
    elif command -v timeout >/dev/null 2>&1; then TIMEOUT_CMD="timeout 120"
    fi

    if $TIMEOUT_CMD "$CLAUDE_CMD" -p --model claude-sonnet-4-6 \
      --dangerously-skip-permissions --no-session-persistence \
      "$EXTRACT_PROMPT" < /dev/null >/dev/null 2>/dev/null; then
      rm -f "$entry"
    else
      NEW_RETRY=$((RETRY + 1))
      if [ "$NEW_RETRY" -ge 3 ]; then
        rm -f "$entry"
      else
        # ⚠ Restore as .json with incremented retry — makes it claimable by next worker
        ORIG="${entry%.batch-*}.json"
        jq --argjson rc "$NEW_RETRY" '.status="pending"|.retry_count=$rc' "$entry" > "${entry}.tmp" 2>/dev/null \
          && mv "${entry}.tmp" "$ORIG" 2>/dev/null \
          || rm -f "$entry" "${entry}.tmp"
      fi
    fi
  ) &
done

# ⚠ No wait — claude processes run independently. Hook returns immediately.
