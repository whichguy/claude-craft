#!/bin/bash
# Skill Change Notification - Once-Per-Change Pattern
# Shows notification ONLY when skills actually change, not every session
#
# UX Pattern: Track manifest hash, notify once per change
# Anti-pattern avoided: Every-session notifications cause fatigue
#
# Hook: SessionStart (fires once at session start)

set -euo pipefail

SKILLS_DIR="$HOME/claude-craft/skills"
STATE_DIR="$HOME/.claude/plugins/reflection-system/state"
STATE_FILE="$STATE_DIR/notification-state.json"

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

# Find all SKILL.md files once (reused in Step 4)
SKILL_FILES=$(find "$SKILLS_DIR" -name "SKILL.md" -type f 2>/dev/null | sort)

# Generate manifest: list of skill names + their last modified times
# This creates a stable fingerprint of the current skill state
MANIFEST=""
SKILL_NAMES=""
while IFS= read -r skill_md; do
  if [[ -n "$skill_md" ]]; then
    skill_name=$(dirname "$skill_md" | xargs basename)
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
# STEP 2: Load previous state
# ============================================

LAST_HASH=""
if [[ -f "$STATE_FILE" ]]; then
  LAST_HASH=$(jq -r '.lastNotifiedHash // ""' "$STATE_FILE" 2>/dev/null || echo "")
fi

# ============================================
# STEP 3: Compare and decide
# ============================================

# Exit if hash unchanged (no new changes since last notification)
if [[ "$CURRENT_HASH" == "$LAST_HASH" ]]; then
  exit 0
fi

# ============================================
# STEP 4: Build notification for new changes
# ============================================

# SKILL_NAMES already populated in Step 1 (single find call)

# Count skills (handle empty case properly)
if [[ -z "$SKILL_NAMES" ]]; then
  SKILL_COUNT=0
else
  SKILL_COUNT=$(echo "$SKILL_NAMES" | tr ',' '\n' | wc -l | tr -d ' ')
fi

# Build message
if [[ "$LAST_HASH" == "" ]]; then
  # First time - welcome message
  MSG="Skills discovered: $SKILL_COUNT skill(s) available"
else
  # Change detected
  MSG="Skills updated since last session"
fi

if [[ -n "$SKILL_NAMES" ]] && [[ "$SKILL_COUNT" -le 5 ]]; then
  MSG="$MSG: $SKILL_NAMES"
elif [[ "$SKILL_COUNT" -gt 5 ]]; then
  FIRST_FIVE=$(echo "$SKILL_NAMES" | tr ',' '\n' | head -5 | tr '\n' ',' | sed 's/,$//')
  MSG="$MSG: $FIRST_FIVE (+$((SKILL_COUNT - 5)) more)"
fi

MSG="$MSG. Run 'skills-list' for details."

# ============================================
# STEP 5: Update state file (atomic write)
# ============================================

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

# ============================================
# STEP 6: Output system message
# ============================================

jq -n --arg msg "$MSG" '{"systemMessage": $msg}'
exit 0
