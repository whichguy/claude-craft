#!/bin/bash
# local-classifier.sh — UserPromptSubmit hook: classify prompt locality & statefulness
# Injects additionalContext when prompt can be answered locally (no external tools needed)
set -eo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "local-classifier: jq not found — disabled (install: brew install jq)" >&2
  exit 0
fi

# --- Parse hook input ---
INPUT=$(cat)
{
  read -r SID
  read -r AGENT_ID
  read -r TRANSCRIPT
  read -r CWD
} < <(echo "$INPUT" | jq -r '(.session_id // "unknown"), (.agent_id // ""), (.transcript_path // ""), (.cwd // "")' 2>/dev/null || printf 'unknown\n\n\n\n')
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""' 2>/dev/null || true)
SESSION_SHORT="${SID:0:8}"

# --- Early exits ---
# Skip subagent prompts
[ -n "$AGENT_ID" ] && exit 0
# Skip empty prompts
[ -z "$PROMPT" ] && exit 0
# Skip slash commands (they handle their own context)
case "$PROMPT" in
  /wiki-load*|/wiki-query*|/wiki-ingest*|/wiki-process*|/wiki-lint*|/review*|/agent-sync*) exit 0 ;;
esac

# Skip Stop-hook-feedback retries — Claude Code re-fires every UserPromptSubmit
# hook on retry, which would otherwise spam the user with repeated toasts.
case "$PROMPT" in
  *"<summary>Stop hook feedback</summary>"*) exit 0 ;;
esac

PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# --- Scoring ---
LOCAL_SCORE=0
EXTERNAL_SCORE=0
STATEFUL_SCORE=0

# ===== LOCAL signals =====
echo "$PROMPT_LOWER" | grep -qE '(\./|\.\./|/[\w.-]+\.(sh|js|ts|md|json|py|yaml|yml|toml))' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '\.(sh|js|ts|md|json|py|yaml|yml)\b' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qwE '(read|show|list|grep|find|cat|head|diff|glob|check|look)' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '(this (repo|project|file|codebase|directory)|the codebase)' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qwE '(install\.sh|claude\.md|settings\.json|hooks|wiki|schema\.md|model-map|model-router|package\.json|tsconfig|makefile|dockerfile)' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '(what (does|is) .*(do|mean|use)|how does .*(work|function)|where (is|are|was) )' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE 'git (status|log|branch|diff|show|blame|commit|stash)' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '(contents? of|inside|within)' && LOCAL_SCORE=$((LOCAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '(files? (that|which) |uses?|using)' && LOCAL_SCORE=$((LOCAL_SCORE + 1))

# ===== EXTERNAL signals =====
if echo "$PROMPT_LOWER" | grep -qwE '(latest|newest|current|today|recent|now)'; then
  if echo "$PROMPT_LOWER" | grep -qE 'git (status|log|branch|diff|show|blame)'; then
    : # "current git branch" — don't count "current" as external
  else
    EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
  fi
fi
echo "$PROMPT_LOWER" | grep -qE '\b20[0-9]{2}\b' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qwE '(search|fetch|download|google|browse)' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qwE '(npm|github|api|website|internet|registry|reddit|twitter|stackoverflow|blog|docs|release)' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qwE '(price|weather|stock|rate|market|bitcoin)' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '(look up|search (for|the web))' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '\b(web|online|internet|remote)\b' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '((latest|newest|current|new|newer) (version|release|features?|update|changes))' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE 'features? (in|of|for) ' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qwE '(issues?|posts?|articles?|news|changelog)' && EXTERNAL_SCORE=$((EXTERNAL_SCORE + 1))

# ===== STATEFUL signals =====
echo "$PROMPT_LOWER" | grep -qE '(that|this|the) (bug|error|issue|function|file|pattern|fix|method|approach|problem|test|code)' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '(continue|left off|earlier|just (wrote|did|fixed|made|created)|same (fix|pattern|approach|thing)|other (file|test|files)|where we)' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '^(this|that|it|these|those|the above) ' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE 'we (just|already|earlier|found|discussed|wrote|fixed|made|were)' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE '^(now|then|next|also|and) ' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE 'apply (the same|this|that|the other)' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))
echo "$PROMPT_LOWER" | grep -qE 'fix (that|this|the) ' && STATEFUL_SCORE=$((STATEFUL_SCORE + 1))

# --- Decision logic ---
LOCAL_THRESHOLD=2
EXTERNAL_THRESHOLD=2
STATEFUL_THRESHOLD=2

# Lower local threshold when only local signals present (no external competition)
if [ "$LOCAL_SCORE" -ge 1 ] && [ "$EXTERNAL_SCORE" -eq 0 ] && [ "$LOCAL_SCORE" -lt "$LOCAL_THRESHOLD" ]; then
  LOCAL_THRESHOLD=1
fi

if [ "$LOCAL_SCORE" -ge "$LOCAL_THRESHOLD" ] && [ "$EXTERNAL_SCORE" -lt "$EXTERNAL_THRESHOLD" ]; then
  LOCALITY="local"
elif [ "$EXTERNAL_SCORE" -ge "$EXTERNAL_THRESHOLD" ] && [ "$LOCAL_SCORE" -lt "$LOCAL_THRESHOLD" ]; then
  LOCALITY="external"
elif [ "$LOCAL_SCORE" -ge "$LOCAL_THRESHOLD" ] && [ "$EXTERNAL_SCORE" -ge "$EXTERNAL_THRESHOLD" ]; then
  LOCALITY="hybrid"
else
  LOCALITY="uncertain"
fi

# Strong external override
if [ "$EXTERNAL_SCORE" -ge 3 ] && [ "$LOCAL_SCORE" -lt 2 ]; then
  LOCALITY="external"
fi

# Social/forum override (Reddit + posts = always external)
if [ "$EXTERNAL_SCORE" -ge 2 ] && echo "$PROMPT_LOWER" | grep -qwE '(reddit|twitter|stackoverflow|blog|posts?|articles?|forum)'; then
  LOCALITY="external"
fi

# Git + "current" override
if [ "$LOCAL_SCORE" -eq 1 ] && [ "$EXTERNAL_SCORE" -eq 1 ]; then
  if echo "$PROMPT_LOWER" | grep -qE 'git (status|log|branch|diff|show|blame)'; then
    LOCALITY="local"
  fi
fi

# Stateful-biases-local: if prompt references prior session context and isn't clearly external,
# it's almost certainly about the local codebase (you discuss local code with Claude)
if [ "$STATEFUL_SCORE" -ge 2 ] && [ "$LOCALITY" != "external" ]; then
  LOCALITY="local"
fi

# Statefulness
if [ "$STATEFUL_SCORE" -ge "$STATEFUL_THRESHOLD" ]; then
  STATEFULNESS="stateful"
else
  STATEFULNESS="stateless"
fi

# Single strong stateful signal override
if [ "$STATEFUL_SCORE" -eq 1 ] && [ "$STATEFULNESS" = "stateless" ]; then
  if echo "$PROMPT_LOWER" | grep -qE '(we (just|already) (wrote|fixed|did|made)|fix (that|this|the) |apply (the same|this|that)|where we)'; then
    STATEFULNESS="stateful"
  fi
fi

# --- Build additionalContext ---
CONTEXT=""
DISPLAY=""

if [ "$LOCALITY" = "local" ]; then
  if [ "$STATEFULNESS" = "stateless" ]; then
    CONTEXT="LOCAL_FIRST: This question can be answered using only local project files and tools. Prioritize Read, Grep, Glob, and existing project knowledge. Avoid WebSearch, WebFetch, or external API calls unless explicitly requested."
    DISPLAY="🏠 Local answerable (stateless)"
  else
    CONTEXT="LOCAL_FIRST_SESSION: This question can be answered locally but references prior session context. Prioritize local tools and reference the conversation history for context. Avoid external calls unless explicitly requested."
    DISPLAY="🏠 Local answerable (session-aware)"
  fi
fi

# Exit with no output when no guidance needed
[ -z "$CONTEXT" ] && exit 0

# --- Queue async child agent for stateful prompts ---
# Fire-and-forget: reads transcript to disambiguate deictic references
# Writes refined hints to ~/.claude/.local-classifier-hints/{session_id}.md
if [ "$STATEFULNESS" = "stateful" ] && [ -n "$TRANSCRIPT" ] && [ "$TRANSCRIPT" != "null" ] && [ -f "$TRANSCRIPT" ]; then
  STATEFUL_AGENT="$(dirname "$0")/local-classifier-stateful-agent.sh"
  if [ -x "$STATEFUL_AGENT" ]; then
    jq -n --arg sid "$SID" --arg transcript "$TRANSCRIPT" --arg prompt "$PROMPT" \
      '{session_id: $sid, transcript_path: $transcript, prompt: $prompt}' \
    | "$STATEFUL_AGENT" &
  fi
fi

# Return structured hook output
jq -n --arg context "$CONTEXT" --arg display "$DISPLAY" \
  '{"systemMessage": $display, "hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": $context}}'