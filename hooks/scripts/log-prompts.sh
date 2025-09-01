#!/bin/bash

# Example hook: Log user prompts for analysis
# This hook is triggered when a user submits a prompt

LOG_FILE="$HOME/.claude/prompt-log.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Log the prompt with timestamp
echo "[$TIMESTAMP] User prompt logged" >> "$LOG_FILE"

# Note: Full prompt data is available in environment variables
# This is just a basic example - see Claude Code documentation for full API