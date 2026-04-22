#!/bin/bash
# UserPromptSubmit (async): probabilistic background wiki lint runner.
# Spawns a fire-and-forget child claude process to run structural lint checks.
# Two-layer debounce: global 45-min cooldown + per-session marker.
# Probability: ~1 in 37 prompts (~2.7%). Override: WIKI_LINT_MOD=1 to force.

trap 'exit 0' ERR
. "$(dirname "$0")/wiki-common.sh"
wiki_check_deps || exit 0

wiki_parse_input
[ -n "$AGENT_ID" ] && exit 0          # subagent guard
[ -z "$CWD" ] && exit 0
[ "${WIKI_SKIP:-}" = "1" ] && exit 0  # read-only session escape valve

wiki_find_root || exit 0

CACHE_DIR="$REPO_ROOT/.wiki/.cache"
TODAY=$(date +%Y-%m-%d)

# --- Gate 0: Global 45-minute cooldown — atomic claim via wiki_debounce ---
# Most invocations exit here without rolling dice. Atomic mv prevents concurrent
# sessions from both spawning lint when the cooldown window expires simultaneously.
GLOBAL_COOLDOWN="$CACHE_DIR/.lint-last-run"
COOLDOWN_SECONDS=2700  # 45 minutes
wiki_debounce "$GLOBAL_COOLDOWN" "$COOLDOWN_SECONDS" || exit 0

# --- Gate 1: Probability roll (~1 in MOD prompts) ---
MOD=${WIKI_LINT_MOD:-37}
[ "$MOD" -lt 1 ] && exit 0
[ $(( RANDOM % MOD )) -ne 0 ] && exit 0

# --- Gate 2: Per-session marker (belt-and-suspenders with global cooldown) ---
SESSION_MARKER="$CACHE_DIR/.lint-session-${SESSION_SHORT}"
[ -f "$SESSION_MARKER" ] && exit 0

# --- Gate 3: Today's bg report already exists ---
REPORT_PATH="$REPO_ROOT/.wiki/maintenance/lint-${TODAY}-bg.md"
[ -f "$REPORT_PATH" ] && exit 0

# --- All gates passed: claim session marker + resolve claude command ---
touch "$SESSION_MARKER" 2>/dev/null || true

# --- Resolve claude command (handles claude-router fallback) ---
wiki_resolve_claude_cmd

# --- Feature-detect --route support (same pattern as wiki-worker.sh) ---
WIKI_LINT_ROUTE="${WIKI_LINT_ROUTE:-background}"
if "$CLAUDE_CMD" --help 2>&1 | grep -q -- '--route'; then
  ROUTE_OR_MODEL=(--route "$WIKI_LINT_ROUTE")
else
  ROUTE_OR_MODEL=(--model claude-sonnet-4-6)
fi

# --- Ensure maintenance dir exists ---
mkdir -p "$REPO_ROOT/.wiki/maintenance" 2>/dev/null || true

# --- Build lint prompt (structural checks only; no semantic checks to keep runtime <3min) ---
LINT_PROMPT="You are a wiki health checker for a software project.

Run a structural health check on the wiki at: $REPO_ROOT/wiki/

TODAY = $TODAY
REPORT_PATH = $REPORT_PATH

## Step 1 — Inventory
Glob all .md files under the wiki directory.
Read wiki/index.md for INDEXED_PAGES (all rows in the Pages table).

## Step 2 — Find Orphan Pages
An orphan is a wiki .md file that:
1. Is not listed in index.md (not in INDEXED_PAGES), AND
2. Is not referenced (linked) by any other wiki page
Use Grep to check inbound links. Collect ORPHANS.

## Step 3 — Find Broken Links
Grep all wiki pages for markdown link patterns [text](path).
For each internal link (not starting with http): verify the target file exists.
Cap at 50 pages. Collect BROKEN_LINKS with: page, link text, target path.

## Step 4 — Find Stale Pages
A page is potentially stale if its last-updated date in index.md is > 180 days before $TODAY.
Collect STALE_CANDIDATES.

## Step 5 — Check Log Size
Count entries in wiki/log.md.
If count > 500: note \"Log has N entries (>500) — consider archiving old entries to wiki/log-archive-YYYY.md\"

## Step 6 — Find Missing v2 Frontmatter (advisory)
Read entity pages under wiki/entities/ (cap at 200).
Flag pages missing any of: confidence, sources, related, description in YAML frontmatter.
Collect MISSING_FRONTMATTER with page path and absent fields.

## Step 7 — Write Report
Write $REPORT_PATH with a markdown report containing:
- Summary counts for each check (orphans, broken links, stale, log size, missing frontmatter)
- Lists of issues found (up to 10 per category)
- Top 3 most actionable fixes

Append to wiki/log.md:
\`[$TODAY] LINT-BG lint-${TODAY}-bg: N orphans, N broken links, N stale\`

Do NOT update wiki/index.md (this is a background run; avoid index churn).
Do NOT run semantic checks (contradictions, missing concepts) — keep runtime under 3 minutes.

When done, write a one-line summary to stdout: \"lint-bg done: N orphans, N broken, N stale\"
"

# --- Spawn fire-and-forget background subshell ---
LINT_TIMEOUT=300
(
  TIMEOUT_CMD=""
  if command -v gtimeout >/dev/null 2>&1; then TIMEOUT_CMD="gtimeout $LINT_TIMEOUT"
  elif command -v timeout >/dev/null 2>&1; then TIMEOUT_CMD="timeout $LINT_TIMEOUT"
  fi

  if $TIMEOUT_CMD "$CLAUDE_CMD" -p "${ROUTE_OR_MODEL[@]}" \
    --dangerously-skip-permissions --no-session-persistence \
    "$LINT_PROMPT" < /dev/null >/dev/null \
    2>>"$CACHE_DIR/.lint-failures.log"; then
    : # success — report file written by claude
  else
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) session:${SESSION_SHORT} lint-bg failed" >> "$CACHE_DIR/.lint-failures.log" 2>/dev/null || true
  fi
) &

# ⚠ No wait — claude process runs independently. Hook returns immediately.
exit 0
