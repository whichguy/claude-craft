#!/bin/bash

# Pre-Execution Security Hook for Claude Code
# Analyzes commands/scripts before execution for security threats

# This hook should be configured in Claude Code settings as a pre-execution hook

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get the command/file to be executed
COMMAND="$1"
FILE_PATH="$2"

# Quick threat patterns (non-exhaustive, for speed)
CRITICAL_PATTERNS=(
    "rm -rf /"
    "rm -rf ~"
    ":(){ :|:& };"
    "dd if=/dev/zero of=/dev/"
    "> /dev/sda"
    "chmod 777 /etc"
    "base64 -d|sh"
    "curl|bash"
    "wget|sh"
)

# Function to check for threats
check_threats() {
    local content="$1"
    local threat_found=0
    
    for pattern in "${CRITICAL_PATTERNS[@]}"; do
        if echo "$content" | grep -qF "$pattern"; then
            echo -e "${RED}🚨 BLOCKED: Critical security threat detected${NC}" >&2
            echo -e "${RED}Pattern: $pattern${NC}" >&2
            threat_found=1
            break
        fi
    done
    
    # Check for credential extraction
    if echo "$content" | grep -qE "(aws configure get|cat.*\.ssh/id_|printenv.*SECRET)"; then
        echo -e "${YELLOW}⚠️  WARNING: Potential credential access detected${NC}" >&2
        echo -e "${YELLOW}Proceed with caution${NC}" >&2
        # Don't block, just warn
    fi
    
    # Check for network operations to unknown hosts
    if echo "$content" | grep -qE "curl|wget|nc"; then
        if ! echo "$content" | grep -qE "(github\.com|npmjs\.org|pypi\.org|anthropic\.com)"; then
            echo -e "${YELLOW}⚠️  WARNING: Network operation to unknown host${NC}" >&2
        fi
    fi
    
    return $threat_found
}

# Main execution
if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ]; then
    # Analyzing a file
    echo -e "${BLUE}🔍 Security scanning: $FILE_PATH${NC}" >&2
    
    # Read file content
    CONTENT=$(cat "$FILE_PATH" 2>/dev/null)
    
    # Check for threats
    if check_threats "$CONTENT"; then
        echo -e "${RED}❌ Execution blocked for security reasons${NC}" >&2
        echo -e "${RED}File has been quarantined for review${NC}" >&2
        
        # Quarantine the file
        QUARANTINE_DIR="$HOME/.claude-quarantine/$(date +%Y%m%d)"
        mkdir -p "$QUARANTINE_DIR"
        cp "$FILE_PATH" "$QUARANTINE_DIR/$(basename $FILE_PATH).quarantined"
        
        # Log the event
        echo "[$(date)] Blocked execution of $FILE_PATH" >> "$HOME/.claude-security.log"
        
        # Exit with error to prevent execution
        exit 1
    fi
    
elif [ -n "$COMMAND" ]; then
    # Analyzing a command
    echo -e "${BLUE}🔍 Security scanning command${NC}" >&2
    
    # Check for threats in command
    if check_threats "$COMMAND"; then
        echo -e "${RED}❌ Command blocked for security reasons${NC}" >&2
        
        # Log the event
        echo "[$(date)] Blocked command: $COMMAND" >> "$HOME/.claude-security.log"
        
        # Exit with error to prevent execution
        exit 1
    fi
fi

# If we get here, no critical threats found
echo -e "${GREEN}✅ Security check passed${NC}" >&2
exit 0