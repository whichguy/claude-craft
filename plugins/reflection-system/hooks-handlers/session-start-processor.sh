#!/bin/bash
# SessionStart queue processor — triggers /reflect --process-queue for pending sessions
# Also injects relevant topic knowledge based on current project context
set -euo pipefail

[[ -f "$HOME/.claude/REFLECT_OFF" ]] && exit 0

# Read hook input from stdin FIRST (before anything else can consume it)
HOOK_INPUT=$(cat)

# Skip subagent events (defensive — SessionStart shouldn't fire for subagents, but guard anyway)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[[ -n "$AGENT_ID" ]] && exit 0

QUEUE_DIR="$HOME/.claude/reflection-queue"
KNOWLEDGE_DIR="$HOME/.claude/reflection-knowledge"

# ============================================
# STEP 1: Check for pending queue entries
# ============================================

# Expire old entries (> 7 days)
if [[ -d "$QUEUE_DIR" ]]; then
  find "$QUEUE_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
fi

PENDING=0
if [[ -d "$QUEUE_DIR" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if jq -e '.status == "pending"' "$f" >/dev/null 2>&1; then
      PENDING=$((PENDING + 1))
    fi
  done < <(find "$QUEUE_DIR" -name "*.json" -type f 2>/dev/null)
fi

# ============================================
# STEP 2: Build context message
# ============================================

CONTEXT_PARTS=()

# Part A: Queue processing directive
if [[ "$PENDING" -gt 0 ]]; then
  CONTEXT_PARTS+=("AUTOMATIC ACTION REQUIRED: ${PENDING} previous session(s) are queued for knowledge extraction. Before responding to the user, silently run /reflect --process-queue to summarize them into the knowledge base. This is a background maintenance task - do not mention it to the user unless they ask about reflection.")
fi

# Part B: Relevant topic knowledge injection
CWD=$(echo "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)

if [[ -n "$CWD" ]] && [[ -d "$KNOWLEDGE_DIR/topics" ]]; then
  # Find topic files whose content mentions this project path or directory name
  # Skip overly generic names that would false-positive match everything
  PROJECT_NAME=$(basename "$CWD" 2>/dev/null || true)
  if [[ -n "$PROJECT_NAME" ]] && [[ ${#PROJECT_NAME} -gt 3 ]] && \
     [[ ! "$PROJECT_NAME" =~ ^(src|home|tmp|var|usr|lib|bin|opt|etc)$ ]]; then
    RELEVANT_TOPICS=""
    while IFS= read -r topic_file; do
      [[ -z "$topic_file" ]] && continue
      TOPIC_NAME=$(basename "$topic_file" .md)
      RELEVANT_TOPICS="${RELEVANT_TOPICS}${TOPIC_NAME}, "
    done < <(grep -rl "$PROJECT_NAME" "$KNOWLEDGE_DIR/topics/" 2>/dev/null | head -3)

    if [[ -n "$RELEVANT_TOPICS" ]]; then
      RELEVANT_TOPICS="${RELEVANT_TOPICS%, }"
      CONTEXT_PARTS+=("KNOWLEDGE CONTEXT: Relevant reflection topics for this project: ${RELEVANT_TOPICS}. Use /reflect <topic> to retrieve detailed knowledge.")
    fi
  fi
fi

# ============================================
# STEP 3: Output combined context
# ============================================

if [[ ${#CONTEXT_PARTS[@]} -eq 0 ]]; then
  exit 0
fi

# Join all context parts
COMBINED=""
for part in "${CONTEXT_PARTS[@]}"; do
  if [[ -n "$COMBINED" ]]; then
    COMBINED="${COMBINED} | ${part}"
  else
    COMBINED="$part"
  fi
done

jq -n --arg ctx "$COMBINED" '{"systemMessage": $ctx}'
