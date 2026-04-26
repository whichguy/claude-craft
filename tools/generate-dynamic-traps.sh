#!/usr/bin/env bash
set -eo pipefail

# tools/generate-dynamic-traps.sh — Orchestrates runtime trap generation for the GAN test.
#
# Logic: If agents/code-reviewer.md was modified more than 1 hour after the latest 
# dynamic fixture, trigger the trap-generator to synthesize 5 new zero-day traps.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROMPT_FILE="${REPO_DIR}/agents/code-reviewer.md"
DYNAMIC_DIR="${REPO_DIR}/test/benchmarks/adversarial/dynamic"
NUM_TRAPS=5

# ── The 1-Hour Rule Check ─────────────────────────────────────────────

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Error: code-reviewer.md not found." >&2
  exit 1
fi

PROMPT_MTIME=$(stat -f %m "$PROMPT_FILE" 2>/dev/null || stat -c %Y "$PROMPT_FILE")
DIR_MTIME=$(stat -f %m "$DYNAMIC_DIR" 2>/dev/null || stat -c %Y "$DYNAMIC_DIR")

# 3600 seconds = 1 hour
DIFF=$((PROMPT_MTIME - DIR_MTIME))

if [[ $DIFF -lt 3600 ]]; then
  echo "GAN Check: Prompt is stable. Using existing dynamic traps."
  exit 0
fi

echo "GAN Check: Prompt was updated recently (>1hr since last generation)."
echo "Generating $NUM_TRAPS novel traps to prevent overfitting..."

# ── Trap Synthesis ────────────────────────────────────────────────────

LANGUAGES=("javascript" "typescript" "python" "go" "bash" "java")
DOMAINS=("concurrency" "security" "architecture" "logic" "platform")

# Cleanup stale dynamic traps
rm -f "${DYNAMIC_DIR}"/*.{js,jsx,ts,tsx,py,go,sh,java,gs}
rm -f "${DYNAMIC_DIR}"/*.ground-truth.json

for i in $(seq 1 "$NUM_TRAPS"); do
  LANG=${LANGUAGES[$RANDOM % ${#LANGUAGES[@]}]}
  DOMAIN=${DOMAINS[$RANDOM % ${#DOMAINS[@]}]}
  
  echo "  [$i/$NUM_TRAPS] Synthesizing $LANG trap in domain: $DOMAIN..."
  
  # Use claude CLI to invoke trap-generator (assuming ~/.claude/agents/trap-generator.md is synced)
  # Fallback to bare generalist if not installed.
  RESPONSE=$(claude --print -p "Act as the 'trap-generator' agent. Generate a trap with language='$LANG' and domain='$DOMAIN'. Output ONLY the code block and the ground truth JSON block.")
  
  # Parse Code Block
  CODE=$(echo "$RESPONSE" | sed -n '/^```[a-z]*$/,/^```$/p' | sed '1d;$d' | head -n 100) # Simple parser for first block
  # Parse JSON Block
  GT_JSON=$(echo "$RESPONSE" | sed -n '/^```json$/,/^```$/p' | sed '1d;$d')
  
  if [[ -n "$GT_JSON" ]]; then
    FILENAME=$(echo "$GT_JSON" | python3 -c "import json, sys; print(json.load(sys.stdin)['fixture'])")
    EXT="${FILENAME##*.}"
    BASENAME=$(basename "$FILENAME" ".$EXT")
    
    echo "$CODE" > "${DYNAMIC_DIR}/${FILENAME}"
    echo "$GT_JSON" > "${DYNAMIC_DIR}/${BASENAME}.ground-truth.json"
    echo "    Created: ${FILENAME}"
  else
    echo "    Error: Failed to parse generator response for trap $i"
  fi
done

# Touch directory to update its mtime
touch "$DYNAMIC_DIR"
echo "GAN Synthesis Complete."
