#!/bin/bash
# UserPromptSubmit: fire-and-forget background wiki queue nudge
# Spawns on every prompt, sleeps 20s (quiescence), then nudges Claude
# No lock needed — duplicate nudges are harmless (queue entries are independent files,
# wiki-process marks each in_progress before processing)

set -o pipefail
trap 'exit 0' ERR
command -v jq >/dev/null 2>&1 || exit 0

HOOK_INPUT=$(cat)
echo "$HOOK_INPUT" | jq -e '.agent_id // empty' >/dev/null 2>&1 && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"

# Quick pre-check: any pending entries? Exit early if not (zero-cost path)
[ ! -d "$QUEUE_DIR" ] && exit 0
PENDING=$(grep -rl '"status".*"pending"' "$QUEUE_DIR/" 2>/dev/null | wc -l | tr -d ' ')
[ "${PENDING:-0}" -eq 0 ] && exit 0

# Quiescence: wait for conversation to settle
sleep 20

# Re-check after quiescence (entries may have been processed by a prior nudge)
PENDING=$(grep -rl '"status".*"pending"' "$QUEUE_DIR/" 2>/dev/null | wc -l | tr -d ' ')
[ "${PENDING:-0}" -eq 0 ] && exit 0

# Nudge — short, authoritative, no fluff
jq -n --argjson n "$PENDING" \
  '{"systemMessage": ("REQUIRED: " + ($n | tostring) + " wiki entries pending. Run /wiki-process now.")}'
