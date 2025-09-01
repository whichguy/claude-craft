#!/bin/bash

# Simple secrets scanner for git hooks
# Scans any file for common secret patterns

FILE="$1"
EXIT_ON_ISSUES="${2:-true}"

# Return success if file doesn't exist
if [ ! -f "$FILE" ]; then
    exit 0
fi

# Security patterns (common secrets)
declare -a SECURITY_PATTERNS=(
    # API Keys (conservative patterns to avoid false positives)
    "sk-ant-api[0-9]{2}-[a-zA-Z0-9_-]{95}"
    "sk-proj-[a-zA-Z0-9_-]{40,}"
    "sk-[a-zA-Z0-9]{48}"
    "AKIA[0-9A-Z]{16}"
    "AIza[0-9A-Za-z\\-_]{35}"
    "gh[pousr]_[a-zA-Z0-9]{36}"
    "github_pat_[a-zA-Z0-9_]{82}"
    
    # Only flag obvious API key assignments (avoid false positives in docs)
    "api[_-]?key[\"']?\\s*[:=]\\s*[\"'][a-zA-Z0-9_-]{32,}[\"']"
    "[\"']apikey[\"']\\s*[:=]\\s*[\"'][a-zA-Z0-9_-]{32,}[\"']"
    "bearer\\s+[a-zA-Z0-9_-]{40,}"
    
    # JWT tokens (full format)
    "eyJ[a-zA-Z0-9_-]{20,}\\.[a-zA-Z0-9_-]{20,}\\.[a-zA-Z0-9_-]{20,}"
)

# Scan file for patterns
SECRETS_FOUND=false

for pattern in "${SECURITY_PATTERNS[@]}"; do
    if grep -qiE "$pattern" "$FILE"; then
        SECRETS_FOUND=true
        break
    fi
done

# Exit with appropriate code
if [ "$SECRETS_FOUND" = "true" ]; then
    if [ "$EXIT_ON_ISSUES" = "true" ]; then
        exit 1
    else
        exit 1  # Always indicate secrets found
    fi
else
    exit 0
fi