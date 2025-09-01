#!/bin/bash

# User Prompt Submit Hook for Auto-Sync
# Triggered when user submits a prompt
# Uses probabilistic checking to avoid excessive syncing

# Configuration file location
CONFIG_FILE="$HOME/.claude/claude-craft.json"

# Get repository path from configuration
if [ -f "$CONFIG_FILE" ]; then
    REPO_DIR=$(jq -r '.repository.path // ""' "$CONFIG_FILE" 2>/dev/null)
fi

# Fallback to detection if not configured
if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
    # Try to find the repository
    for path in \
        "$HOME/src5/subagent-sync/claude-craft" \
        "$HOME/claude-craft" \
        "$HOME/projects/claude-craft"
    do
        if [ -d "$path/.git" ] && [ -f "$path/tools/auto-sync.sh" ]; then
            REPO_DIR="$path"
            break
        fi
    done
fi

if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
    # Silently fail - repository not found
    exit 0
fi

# Check if auto-sync tool exists
AUTO_SYNC_TOOL="$REPO_DIR/tools/auto-sync.sh"

if [ ! -x "$AUTO_SYNC_TOOL" ]; then
    # Silently fail - don't interrupt user prompts
    exit 0
fi

# Run prompt check in background
# This will internally handle the probability check
(
    export REPO_DIR
    "$AUTO_SYNC_TOOL" prompt-check 2>&1 | while IFS= read -r line; do
        # Completely silent unless there's a critical error
        if [[ "$line" == *"CRITICAL"* ]]; then
            echo "$line" >&2
        fi
    done
) &

# Always return success to not block prompt processing
exit 0