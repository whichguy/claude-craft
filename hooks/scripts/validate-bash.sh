#!/bin/bash

# Example hook: Validate bash commands before execution
# This hook is triggered before bash tools are executed

# Check for potentially dangerous commands
DANGEROUS_COMMANDS="rm -rf|sudo rm|mkfs|dd if=|:(){:|shutdown|reboot"

if echo "$CLAUDE_TOOL_INPUT" | grep -E "($DANGEROUS_COMMANDS)" >/dev/null; then
    echo "⚠️  WARNING: Potentially dangerous bash command detected"
    echo "Command contains: $(echo "$CLAUDE_TOOL_INPUT" | grep -E "($DANGEROUS_COMMANDS)" -o)"
    echo "Proceeding with caution..."
fi

# Always allow execution (hook doesn't block)
exit 0