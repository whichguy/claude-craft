---
description: Security analysis for memory files and personal information detection
allowed-tools: Read, Grep, Bash(find:*), WebSearch
argument-hint: [memory-path] [scan-type]
---

# Memory Security Scanner

Analyze memory fragments and documentation for secrets, API keys, and personally identifiable information before committing or sharing.

## Security Analysis

```bash
#!/bin/bash

# Memory Security Analysis Script
MEMORY_PATH="${1:-memory/fragments}"
SCAN_TYPE="${2:-full}"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# Security patterns to detect
SECURITY_PATTERNS=(
    # API Keys and Tokens
    "sk-[a-zA-Z0-9]{24,}"                    # Anthropic API keys
    "api[_-]?key[\"']?\\s*[:=]\\s*[\"']?[a-zA-Z0-9_-]{16,}"  # Generic API keys
    "bearer\\s+[a-zA-Z0-9_-]{20,}"          # Bearer tokens
    "token[\"']?\\s*[:=]\\s*[\"']?[a-zA-Z0-9_.-]{20,}"      # Generic tokens
    
    # Cloud Provider Keys
    "AKIA[0-9A-Z]{16}"                       # AWS Access Keys
    "AIza[0-9A-Za-z\\-_]{35}"               # Google API Keys
    "[a-zA-Z0-9_-]{24}\\.[a-zA-Z0-9_-]{6}\\.[a-zA-Z0-9_-]{27}" # GitHub tokens
    
    # Database Credentials
    "postgres://[^\\s]*:[^\\s]*@[^\\s]+"    # PostgreSQL URLs
    "mongodb://[^\\s]*:[^\\s]*@[^\\s]+"     # MongoDB URLs
    "mysql://[^\\s]*:[^\\s]*@[^\\s]+"       # MySQL URLs
    
    # Personal Information
    "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"  # Email addresses
    "\\b[0-9]{3}-[0-9]{2}-[0-9]{4}\\b"      # SSN format
    "\\b[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}\\b"  # Credit card format
    
    # Passwords and Secrets
    "password[\"']?\\s*[:=]\\s*[\"']?[^\\s\"']{8,}"  # Password assignments
    "secret[\"']?\\s*[:=]\\s*[\"']?[^\\s\"']{8,}"    # Secret assignments
    "private[_-]?key"                         # Private key references
    
    # File Paths (potential PII)
    "/Users/[^/\\s]+"                        # macOS user paths
    "C:\\\\Users\\\\[^\\\\\\s]+"             # Windows user paths
    "/home/[^/\\s]+"                         # Linux user paths
)

# PII Context Patterns (more nuanced detection)
PII_PATTERNS=(
    "my\\s+(name|dog|cat|pet|family|address|phone)"  # Personal references
    "(live|lives|lived)\\s+(in|at)\\s+[A-Za-z]+"   # Location references  
    "born\\s+(in|on)"                               # Birth information
    "work\\s+at\\s+[A-Za-z]+"                       # Employment info
    "went\\s+to\\s+[A-Za-z]+\\s+(school|college|university)"  # Education
)

# Scan files for security issues
scan_memory_files() {
    local issues_found=false
    local files_scanned=0
    
    echo -e "${YELLOW}🔍 Scanning memory files in: $MEMORY_PATH${NC}"
    
    if [ ! -d "$MEMORY_PATH" ]; then
        echo -e "${RED}❌ Memory path not found: $MEMORY_PATH${NC}"
        return 1
    fi
    
    while IFS= read -r -d '' file; do
        files_scanned=$((files_scanned + 1))
        local file_issues=false
        
        echo -e "${GREEN}📄 Scanning: $(basename "$file")${NC}"
        
        # Check for security patterns
        for pattern in "${SECURITY_PATTERNS[@]}"; do
            if grep -qE "$pattern" "$file" 2>/dev/null; then
                if [ "$file_issues" = false ]; then
                    echo -e "${RED}🚨 SECURITY RISK DETECTED in $(basename "$file"):${NC}"
                    file_issues=true
                    issues_found=true
                fi
                
                # Show context of the match
                local matches=$(grep -nE "$pattern" "$file" 2>/dev/null | head -3)
                if [ -n "$matches" ]; then
                    echo -e "${RED}  • Potential secret/credential found:${NC}"
                    while IFS= read -r match; do
                        echo -e "${YELLOW}    Line $match${NC}"
                    done <<< "$matches"
                fi
            fi
        done
        
        # Check for PII patterns if in full scan mode
        if [ "$SCAN_TYPE" = "full" ] || [ "$SCAN_TYPE" = "pii" ]; then
            for pattern in "${PII_PATTERNS[@]}"; do
                if grep -qiE "$pattern" "$file" 2>/dev/null; then
                    if [ "$file_issues" = false ]; then
                        echo -e "${YELLOW}⚠️  PERSONAL INFO DETECTED in $(basename "$file"):${NC}"
                        file_issues=true
                        # Don't set issues_found=true for PII, just warn
                    fi
                    
                    local matches=$(grep -niE "$pattern" "$file" 2>/dev/null | head -2)
                    if [ -n "$matches" ]; then
                        echo -e "${YELLOW}  • Potential personal information:${NC}"
                        while IFS= read -r match; do
                            echo -e "${YELLOW}    Line $match${NC}"
                        done <<< "$matches"
                    fi
                fi
            done
        fi
        
        if [ "$file_issues" = false ]; then
            echo -e "  ${GREEN}✅ Clean${NC}"
        fi
        
    done < <(find "$MEMORY_PATH" -name "*.md" -type f -print0 2>/dev/null)
    
    echo
    echo -e "${GREEN}📊 Scan Summary:${NC}"
    echo -e "  Files scanned: $files_scanned"
    
    if [ "$issues_found" = true ]; then
        echo -e "${RED}🚨 CRITICAL: Security risks detected!${NC}"
        echo -e "${RED}❌ DO NOT commit or share these files until issues are resolved${NC}"
        echo
        echo -e "${YELLOW}Recommended Actions:${NC}"
        echo -e "  1. Remove or redact sensitive information"
        echo -e "  2. Use environment variables for secrets"
        echo -e "  3. Add sensitive patterns to .gitignore"
        echo -e "  4. Consider using separate private memory files"
        return 1
    else
        echo -e "${GREEN}✅ No critical security issues found${NC}"
        echo -e "${YELLOW}⚠️  Review any personal information warnings above${NC}"
        return 0
    fi
}

# Main execution
case "$SCAN_TYPE" in
    "secrets")
        echo "Scanning for secrets only..."
        scan_memory_files
        ;;
    "pii")
        echo "Scanning for personal information only..."
        scan_memory_files
        ;;
    "full"|"")
        echo "Full security scan..."
        scan_memory_files
        ;;
    *)
        echo "Usage: /security-scan [memory-path] [secrets|pii|full]"
        exit 1
        ;;
esac
```

## Manual Analysis Instructions

If you prefer manual review, check for:

### 🔴 Critical Security Issues (MUST FIX)
- API keys, tokens, passwords
- Database connection strings with credentials  
- Private keys or certificates
- Cloud provider access keys
- Authentication credentials

### 🟡 Personal Information (REVIEW CAREFULLY)
- Full names, addresses, phone numbers
- Email addresses (personal ones)
- Personal anecdotes or family details
- Location information
- Employment or education details

### 🟢 Safe Information (OK TO SHARE)
- Technical preferences and workflows
- Code patterns and best practices
- Development methodologies
- Tool configurations (without credentials)
- Project structure preferences

## Usage Examples

```bash
# Quick security scan
/security-scan

# Scan specific memory path
/security-scan memory/fragments

# Scan only for secrets
/security-scan memory/fragments secrets

# Full comprehensive scan
/security-scan memory/fragments full
```

**Always run this before committing memory files to version control!**