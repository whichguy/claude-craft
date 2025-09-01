#!/bin/bash
set -e

# Memory Security Scanner
# Analyzes memory files for security risks before git operations

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MEMORY_PATH="${1:-memory/fragments}"
SCAN_TYPE="${2:-full}"
EXIT_ON_ISSUES="${3:-true}"

# Security patterns (comprehensive detection)
declare -a SECURITY_PATTERNS=(
    # Anthropic API Keys
    "sk-ant-api[0-9]{2}-[a-zA-Z0-9_-]{95}"
    
    # OpenAI API Keys
    "sk-proj-[a-zA-Z0-9_-]{40,}"
    "sk-[a-zA-Z0-9]{48,}"
    
    # Generic API Keys
    "api[_-]?key[\"']?\\s*[:=]\\s*[\"']?[a-zA-Z0-9_-]{20,}"
    "[\"']?apikey[\"']?\\s*[:=]\\s*[\"']?[a-zA-Z0-9_-]{20,}"
    
    # Bearer Tokens
    "bearer\\s+[a-zA-Z0-9_-]{20,}"
    "authorization[\"']?\\s*[:=]\\s*[\"']?bearer\\s+[a-zA-Z0-9_-]{20,}"
    
    # JWT Tokens
    "eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+"
    
    # GitHub Tokens
    "gh[pousr]_[a-zA-Z0-9]{36}"
    "github_pat_[a-zA-Z0-9_]{82}"
    
    # AWS Credentials
    "AKIA[0-9A-Z]{16}"
    "aws_access_key_id\\s*[:=]\\s*[a-zA-Z0-9]+"
    "aws_secret_access_key\\s*[:=]\\s*[a-zA-Z0-9/+]+"
    
    # Google Cloud
    "AIza[0-9A-Za-z\\-_]{35}"
    
    # Database URLs with credentials
    "postgres://[^:]+:[^@]+@[^/\\s]+"
    "mysql://[^:]+:[^@]+@[^/\\s]+"
    "mongodb://[^:]+:[^@]+@[^/\\s]+"
    "redis://[^:]+:[^@]+@[^/\\s]+"
    
    # Password patterns
    "[\"']?password[\"']?\\s*[:=]\\s*[\"']?[^\\s\"'\\n]{8,}"
    "[\"']?passwd[\"']?\\s*[:=]\\s*[\"']?[^\\s\"'\\n]{8,}"
    "[\"']?secret[\"']?\\s*[:=]\\s*[\"']?[^\\s\"'\\n]{8,}"
    
    # Private keys
    "-----BEGIN\\s+(RSA\\s+)?PRIVATE\\s+KEY-----"
    "-----BEGIN\\s+OPENSSH\\s+PRIVATE\\s+KEY-----"
    
    # Slack tokens
    "xox[baprs]-[a-zA-Z0-9-]+"
    
    # Discord tokens
    "[MN][a-zA-Z\\d]{23}\\.[\\w-]{6}\\.[\\w-]{27}"
)

# PII patterns (personal information)
declare -a PII_PATTERNS=(
    # Email addresses
    "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
    
    # Personal references
    "my\\s+(name\\s+is|dog|cat|pet|family|address|phone|email)"
    "i\\s+(live|work|went\\s+to|studied\\s+at)"
    "(live|lives|lived)\\s+(in|at)\\s+[A-Za-z][A-Za-z\\s]+[A-Za-z]"
    "born\\s+(in|on)\\s+[A-Za-z0-9][A-Za-z0-9\\s/,-]+"
    "work\\s+at\\s+[A-Z][A-Za-z\\s]+"
    "studied\\s+at\\s+[A-Z][A-Za-z\\s]+"
    
    # Phone numbers
    "\\(?[0-9]{3}\\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}"
    "\\+[1-9][0-9]{0,3}[-. ]?\\(?[0-9]{3}\\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}"
    
    # SSN format
    "[0-9]{3}-[0-9]{2}-[0-9]{4}"
    
    # Credit card format
    "[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}"
    
    # File paths with usernames
    "/Users/[^/\\s]+/[^\\s]*"
    "C:\\\\Users\\\\[^\\\\\\s]+\\\\"
    "/home/[^/\\s]+/"
)

# Function to scan a single file
scan_file() {
    local file="$1"
    local basename=$(basename "$file")
    local security_issues=0
    local pii_warnings=0
    
    # Check for security patterns
    for pattern in "${SECURITY_PATTERNS[@]}"; do
        if matches=$(grep -nE "$pattern" "$file" 2>/dev/null); then
            if [ $security_issues -eq 0 ]; then
                echo -e "${RED}🚨 CRITICAL SECURITY ISSUES in $basename:${NC}"
            fi
            security_issues=$((security_issues + 1))
            
            while IFS= read -r match; do
                local line_num=$(echo "$match" | cut -d: -f1)
                local content=$(echo "$match" | cut -d: -f2- | head -c 80)
                echo -e "${RED}  Line $line_num: ${YELLOW}$content...${NC}"
                
                # Identify the type of secret for specific recommendations
                echo -e "${BLUE}  Solutions:${NC}"
                if echo "$content" | grep -qE "sk-ant-api"; then
                    echo -e "${BLUE}    → Anthropic API key detected - use \${ANTHROPIC_API_KEY}${NC}"
                elif echo "$content" | grep -qE "sk-proj-"; then
                    echo -e "${BLUE}    → OpenAI API key detected - use \${OPENAI_API_KEY}${NC}"
                elif echo "$content" | grep -qE "gh[pousr]_"; then
                    echo -e "${BLUE}    → GitHub token detected - use \${GITHUB_TOKEN}${NC}"
                elif echo "$content" | grep -qE "AKIA[0-9A-Z]{16}"; then
                    echo -e "${BLUE}    → AWS key detected - use \${AWS_ACCESS_KEY_ID}${NC}"
                elif echo "$content" | grep -qiE "password|passwd|secret"; then
                    echo -e "${BLUE}    → Password detected - use environment variable or keychain${NC}"
                elif echo "$content" | grep -qE "Bearer "; then
                    echo -e "${BLUE}    → Bearer token detected - use \${AUTH_TOKEN}${NC}"
                fi
            done <<< "$matches"
        fi
    done
    
    # Check for PII patterns if in full scan mode
    if [ "$SCAN_TYPE" = "full" ] || [ "$SCAN_TYPE" = "pii" ]; then
        local patterns_shown=0
        for pattern in "${PII_PATTERNS[@]}"; do
            if matches=$(grep -niE "$pattern" "$file" 2>/dev/null | head -2); then
                if [ $pii_warnings -eq 0 ] && [ $security_issues -eq 0 ]; then
                    echo -e "${YELLOW}⚠️  PERSONAL INFO in $basename:${NC}"
                fi
                pii_warnings=$((pii_warnings + 1))
                
                while IFS= read -r match; do
                    local line_num=$(echo "$match" | cut -d: -f1)
                    local content=$(echo "$match" | cut -d: -f2- | head -c 60)
                    echo -e "${YELLOW}  Line $line_num: $content...${NC}"
                done <<< "$matches"
                
                patterns_shown=$((patterns_shown + 1))
                
                # Limit total output but check all patterns  
                if [ $patterns_shown -ge 10 ]; then
                    echo -e "${YELLOW}  ... (additional patterns found)${NC}"
                    break
                fi
            fi
        done
    fi
    
    if [ $security_issues -eq 0 ] && [ $pii_warnings -eq 0 ]; then
        echo -e "  ${GREEN}✅ $basename - Clean${NC}"
    else
        # Generate TODO tasks for remediation
        echo -e "${BLUE}  📝 TODO Tasks Generated:${NC}"
        
        if [ $security_issues -gt 0 ]; then
            echo -e "${YELLOW}  TODO: Fix critical security issues in $basename${NC}"
            echo -e "     [ ] Replace hardcoded secrets with environment variables"
            echo -e "     [ ] Use \${API_KEY} placeholder syntax in documentation"
            echo -e "     [ ] Move credentials to .env file (add to .gitignore)"
            echo -e "     [ ] Review line numbers above for exact locations"
        fi
        
        if [ $pii_warnings -gt 0 ] && [ "$SCAN_TYPE" != "secrets" ]; then
            echo -e "${YELLOW}  TODO: Remove personal information from $basename${NC}"
            echo -e "     [ ] Replace emails with user@example.com"
            echo -e "     [ ] Use placeholder names (John Doe, ACME Corp)"
            echo -e "     [ ] Remove specific addresses and phone numbers"
            echo -e "     [ ] Generalize personal references"
        fi
        echo
    fi
    
    return $security_issues
}

# Main scanning function
scan_memory_files() {
    local total_files=0
    local files_with_issues=0
    local total_security_issues=0
    
    echo -e "${BLUE}🔍 Security scanning: $MEMORY_PATH${NC}"
    echo -e "${BLUE}📋 Scan type: $SCAN_TYPE${NC}"
    echo
    
    if [ ! -d "$MEMORY_PATH" ]; then
        echo -e "${RED}❌ Memory path not found: $MEMORY_PATH${NC}"
        return 1
    fi
    
    # Find and scan all markdown files
    while IFS= read -r -d '' file; do
        total_files=$((total_files + 1))
        
        set +e  # Temporarily disable exit on error
        scan_file "$file"
        issues=$?
        set -e  # Re-enable exit on error
        if [ $issues -gt 0 ]; then
            files_with_issues=$((files_with_issues + 1))
            total_security_issues=$((total_security_issues + issues))
        fi
        
    done < <(find "$MEMORY_PATH" -name "*.md" -type f -print0 2>/dev/null)
    
    echo
    echo -e "${BLUE}📊 Scan Summary:${NC}"
    echo -e "  Files scanned: $total_files"
    echo -e "  Files with security issues: $files_with_issues"
    echo -e "  Total security issues: $total_security_issues"
    
    if [ $total_security_issues -gt 0 ]; then
        echo
        echo -e "${RED}🚨 CRITICAL: $total_security_issues security issues detected!${NC}"
        echo -e "${RED}❌ DO NOT commit or share these files until resolved${NC}"
        echo
        echo -e "${YELLOW}📝 MASTER TODO LIST FOR SECURITY REMEDIATION:${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # Generate file-specific TODOs
        local todo_count=1
        echo -e "${BLUE}Priority 1: Remove Secrets (CRITICAL)${NC}"
        while IFS= read -r -d '' file; do
            if grep -qE "${SECURITY_PATTERNS[0]}" "$file" 2>/dev/null; then
                local basename=$(basename "$file")
                echo -e "  ${todo_count}. [ ] Fix secrets in ${basename}"
                echo -e "      - Check lines with API keys and tokens"
                echo -e "      - Replace with environment variables"
                todo_count=$((todo_count + 1))
            fi
        done < <(find "$MEMORY_PATH" -name "*.md" -type f -print0 2>/dev/null)
        
        echo
        echo -e "${BLUE}Priority 2: General Security Tasks${NC}"
        echo -e "  ${todo_count}. [ ] Audit all files for hardcoded credentials"
        todo_count=$((todo_count + 1))
        echo -e "  ${todo_count}. [ ] Create .env.example with placeholder values"
        todo_count=$((todo_count + 1))
        echo -e "  ${todo_count}. [ ] Update .gitignore with sensitive patterns"
        todo_count=$((todo_count + 1))
        echo -e "  ${todo_count}. [ ] Document secure credential management"
        todo_count=$((todo_count + 1))
        
        if [ "$SCAN_TYPE" = "full" ] || [ "$SCAN_TYPE" = "pii" ]; then
            echo
            echo -e "${BLUE}Priority 3: Privacy Tasks${NC}"
            echo -e "  ${todo_count}. [ ] Remove or anonymize personal information"
            todo_count=$((todo_count + 1))
            echo -e "  ${todo_count}. [ ] Replace real emails with examples"
            todo_count=$((todo_count + 1))
            echo -e "  ${todo_count}. [ ] Generalize location references"
        fi
        
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo
        
        if [ "$EXIT_ON_ISSUES" = "true" ]; then
            exit 1
        else
            return 0  # Return 0 when exit_on_issues is false, even if issues exist
        fi
    else
        echo -e "${GREEN}✅ No critical security issues found${NC}"
        if [ "$SCAN_TYPE" = "full" ]; then
            echo -e "${YELLOW}⚠️  Review any personal information warnings above${NC}"
        fi
        return 0
    fi
}

# Display usage
show_usage() {
    echo "Usage: $0 [memory-path] [scan-type] [exit-on-issues]"
    echo
    echo "Arguments:"
    echo "  memory-path      Path to memory files (default: memory/fragments)"
    echo "  scan-type        Type of scan: secrets, pii, full (default: full)"
    echo "  exit-on-issues   Exit with error code if issues found (default: true)"
    echo
    echo "Examples:"
    echo "  $0                                    # Full scan of memory/fragments"
    echo "  $0 memory/fragments secrets          # Scan only for secrets"
    echo "  $0 memory/fragments full false       # Full scan but don't exit on issues"
}

# Command line argument handling
case "${1:-}" in
    -h|--help|help)
        show_usage
        exit 0
        ;;
esac

# Main execution
echo -e "${BLUE}🛡️  Claude Craft Memory Security Scanner${NC}"
echo

# Validate scan type
case "$SCAN_TYPE" in
    secrets|pii|full)
        ;;
    *)
        echo -e "${RED}❌ Invalid scan type: $SCAN_TYPE${NC}"
        echo -e "${YELLOW}Valid options: secrets, pii, full${NC}"
        exit 1
        ;;
esac

# Run the scan
scan_memory_files
exit $?  # Exit with the function's return code