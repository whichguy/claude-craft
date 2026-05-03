#!/bin/bash
# Skill Change Notification - Once-Per-Change Pattern
# Shows notification ONLY when skills actually change, not every session
#
# UX Pattern: Track manifest hash, notify once per change
# Anti-pattern avoided: Every-session notifications cause fatigue
#
# Hook: SessionStart (fires once at session start)

set -euo pipefail

# Skip subagent events (defensive — SessionStart shouldn't fire for subagents, but guard anyway)
HOOK_INPUT=$(cat)
AGENT_ID=$(echo "$HOOK_INPUT" | jq -r '.agent_id // empty' 2>/dev/null || true)
[[ -n "$AGENT_ID" ]] && exit 0

SKILLS_DIR="$HOME/claude-craft/skills"
COMMANDS_DIR="$HOME/claude-craft/commands"
AGENTS_DIR="$HOME/claude-craft/agents"
STATE_DIR="$HOME/.claude/plugins/craft-hooks/state"
STATE_FILE="$STATE_DIR/notification-state.json"

# Self-healing: migrate state from old reflection-system path if it exists
OLD_STATE="$HOME/.claude/plugins/reflection-system/state/notification-state.json"
if [ ! -f "$STATE_FILE" ] && [ -f "$OLD_STATE" ]; then
  mkdir -p "$STATE_DIR"
  cp "$OLD_STATE" "$STATE_FILE" 2>/dev/null || true
fi

# Dependency check: jq required for JSON processing
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

# Exit silently if skills directory doesn't exist
if [[ ! -d "$SKILLS_DIR" ]]; then
  exit 0
fi

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# ============================================
# STEP 1: Compute current skill manifest hash
# ============================================

# Find all skill-bearing files:
#   - SKILL.md in skills/ (mandatory — checked above, exits if missing)
#   - flat .md in commands/ and agents/ (optional — silent no-op if missing)
# Exclude infrastructure commands that are not skills
SKILL_FILES=$(
  find "$SKILLS_DIR" -name "SKILL.md" -type f 2>/dev/null
  find "$COMMANDS_DIR" -maxdepth 1 -name "*.md" -type f \
    ! -name "alias.md" ! -name "unalias.md" ! -name "prompt.md" 2>/dev/null
  find "$AGENTS_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null
)
SKILL_FILES=$(echo "$SKILL_FILES" | sort -u)

# Generate manifest: list of skill names + their last modified times
# This creates a stable fingerprint of the current skill state
MANIFEST=""
SKILL_NAMES=""
while IFS= read -r skill_md; do
  if [[ -n "$skill_md" ]]; then
    if [[ "$(basename "$skill_md")" == "SKILL.md" ]]; then
      skill_name=$(basename -- "$(dirname "$skill_md")")
    else
      skill_name=$(basename "$skill_md" .md)
    fi
    # Cross-platform stat: macOS (-f "%m") fallback to Linux (-c "%Y")
    skill_mtime=$(stat -f "%m" "$skill_md" 2>/dev/null || stat -c "%Y" "$skill_md" 2>/dev/null || echo "0")
    MANIFEST="${MANIFEST}${skill_name}:${skill_mtime}\n"
    SKILL_NAMES="${SKILL_NAMES}${skill_name},"
  fi
done <<< "$SKILL_FILES"
SKILL_NAMES="${SKILL_NAMES%,}"  # Remove trailing comma

# Compute hash of manifest
if [[ -n "$MANIFEST" ]]; then
  CURRENT_HASH=$(echo -e "$MANIFEST" | shasum -a 256 | cut -d' ' -f1)
else
  # No skills found - exit silently (don't notify about 0 skills)
  exit 0
fi

# ============================================
# STEPS 2-6: Compare, notify, update (under flock)
# ============================================
# flock serializes the read-compare-write across concurrent SessionStart hooks.
# FD 9 is used so we don't interfere with stdin/stdout.
LOCK_FILE="$STATE_DIR/.notification.lock"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0  # Another instance holds the lock — skip (async hook, will retry next session)

LAST_HASH=""
if [[ -f "$STATE_FILE" ]]; then
  LAST_HASH=$(jq -r '.lastNotifiedHash // ""' "$STATE_FILE" 2>/dev/null || echo "")
fi

# Exit if hash unchanged (no new changes since last notification)
if [[ -n "$CURRENT_HASH" && "$CURRENT_HASH" == "$LAST_HASH" ]]; then
  exit 0
fi

# Count skills (handle empty case properly)
if [[ -z "$SKILL_NAMES" ]]; then
  SKILL_COUNT=0
else
  SKILL_COUNT=$(echo "$SKILL_NAMES" | tr ',' '\n' | wc -l | tr -d ' ')
fi

# Build message
if [[ "$LAST_HASH" == "" ]]; then
  MSG="Skills discovered: $SKILL_COUNT skill(s) available"
else
  MSG="Skills updated since last session"
fi

if [[ -n "$SKILL_NAMES" ]] && [[ "$SKILL_COUNT" -le 5 ]]; then
  MSG="$MSG: $SKILL_NAMES"
elif [[ "$SKILL_COUNT" -gt 5 ]]; then
  FIRST_FIVE=$(echo "$SKILL_NAMES" | tr ',' '\n' | head -5 | tr '\n' ',' | sed 's/,$//')
  MSG="$MSG: $FIRST_FIVE (+$((SKILL_COUNT - 5)) more)"
fi

MSG="$MSG."

# Update state file (atomic write, under flock)
SKILL_ARRAY=$(echo "$SKILL_NAMES" | tr ',' '\n' | jq -R . | jq -s .)
TMP_STATE="${STATE_FILE}.tmp.$$"
jq -n \
  --arg hash "$CURRENT_HASH" \
  --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson skills "$SKILL_ARRAY" \
  '{
    lastNotifiedHash: $hash,
    lastNotifiedAt: $time,
    lastNotifiedSkills: $skills,
    userChoice: null
  }' > "$TMP_STATE"
mv "$TMP_STATE" "$STATE_FILE"

# flock released automatically when FD 9 closes at exit

# Output system message
jq -n --arg msg "$MSG" '{"systemMessage": $msg}'
exit 0
