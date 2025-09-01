#!/bin/bash
set -e

# Security TODO Generator
# Generates actionable TODO items from security scan results

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCAN_PATH="${1:-memory/fragments}"
OUTPUT_FORMAT="${2:-markdown}"  # markdown, json, or claude
SCAN_TYPE="${3:-full}"

# Arrays to store TODOs
declare -a CRITICAL_TODOS
declare -a HIGH_TODOS
declare -a MEDIUM_TODOS
declare -a LOW_TODOS

# Security patterns with specific remediation
declare -A SECURITY_REMEDIATIONS=(
    ["sk-ant-api"]="Replace Anthropic API key with \${ANTHROPIC_API_KEY} environment variable"
    ["sk-proj-"]="Replace OpenAI API key with \${OPENAI_API_KEY} environment variable"
    ["gh[pousr]_"]="Replace GitHub token with \${GITHUB_TOKEN} environment variable"
    ["AKIA[0-9A-Z]{16}"]="Replace AWS access key with \${AWS_ACCESS_KEY_ID} environment variable"
    ["password.*="]="Move password to secure credential store or environment variable"
    ["BEGIN.*PRIVATE KEY"]="Remove private key and use secure key management service"
    ["mongodb://"]="Replace connection string with \${DATABASE_URL} environment variable"
    ["mysql://"]="Replace connection string with \${DATABASE_URL} environment variable"
)

# Scan for issues and generate TODOs
scan_and_generate_todos() {
    local file="$1"
    local basename=$(basename "$file")
    local line_num=0
    
    while IFS= read -r line; do
        line_num=$((line_num + 1))
        
        # Check each security pattern
        for pattern in "${!SECURITY_REMEDIATIONS[@]}"; do
            if echo "$line" | grep -qE "$pattern"; then
                local remediation="${SECURITY_REMEDIATIONS[$pattern]}"
                local todo="Fix $basename:$line_num - $remediation"
                CRITICAL_TODOS+=("$todo")
            fi
        done
        
        # Check for PII
        if [ "$SCAN_TYPE" = "full" ] || [ "$SCAN_TYPE" = "pii" ]; then
            # Email addresses
            if echo "$line" | grep -qE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"; then
                local todo="Anonymize email in $basename:$line_num - Replace with user@example.com"
                MEDIUM_TODOS+=("$todo")
            fi
            
            # Phone numbers
            if echo "$line" | grep -qE "\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}"; then
                local todo="Remove phone number in $basename:$line_num - Replace with XXX-XXX-XXXX"
                MEDIUM_TODOS+=("$todo")
            fi
            
            # Personal references
            if echo "$line" | grep -qiE "my (name|address|phone|email|family)"; then
                local todo="Generalize personal reference in $basename:$line_num"
                LOW_TODOS+=("$todo")
            fi
        fi
    done < "$file"
}

# Output TODOs in markdown format
output_markdown() {
    echo "# Security Remediation TODO List"
    echo
    echo "Generated: $(date)"
    echo "Scan Path: $SCAN_PATH"
    echo
    
    if [ ${#CRITICAL_TODOS[@]} -gt 0 ]; then
        echo "## 🔴 CRITICAL - Secrets & Credentials"
        echo
        local count=1
        for todo in "${CRITICAL_TODOS[@]}"; do
            echo "$count. [ ] $todo"
            count=$((count + 1))
        done
        echo
    fi
    
    if [ ${#HIGH_TODOS[@]} -gt 0 ]; then
        echo "## 🟡 HIGH - Security Risks"
        echo
        local count=1
        for todo in "${HIGH_TODOS[@]}"; do
            echo "$count. [ ] $todo"
            count=$((count + 1))
        done
        echo
    fi
    
    if [ ${#MEDIUM_TODOS[@]} -gt 0 ]; then
        echo "## 🟠 MEDIUM - Privacy Concerns"
        echo
        local count=1
        for todo in "${MEDIUM_TODOS[@]}"; do
            echo "$count. [ ] $todo"
            count=$((count + 1))
        done
        echo
    fi
    
    if [ ${#LOW_TODOS[@]} -gt 0 ]; then
        echo "## ⚪ LOW - Best Practices"
        echo
        local count=1
        for todo in "${LOW_TODOS[@]}"; do
            echo "$count. [ ] $todo"
            count=$((count + 1))
        done
        echo
    fi
    
    echo "## Implementation Guide"
    echo
    echo "### For Secrets (CRITICAL)"
    echo '```bash'
    echo '# 1. Create .env file'
    echo 'touch .env'
    echo 'echo "ANTHROPIC_API_KEY=your-key-here" >> .env'
    echo ''
    echo '# 2. Add .env to .gitignore'
    echo 'echo ".env" >> .gitignore'
    echo ''
    echo '# 3. Update code to use environment variables'
    echo '# Replace: api_key = "sk-ant-api..."'
    echo '# With: api_key = process.env.ANTHROPIC_API_KEY'
    echo '```'
    echo
    echo "### For Personal Information (MEDIUM)"
    echo '```markdown'
    echo '# Replace:'
    echo 'Email: john.smith@gmail.com'
    echo ''
    echo '# With:'
    echo 'Email: user@example.com'
    echo '```'
}

# Output TODOs in JSON format
output_json() {
    echo '{'
    echo '  "generated": "'$(date)'",'
    echo '  "scan_path": "'$SCAN_PATH'",'
    echo '  "todos": {'
    
    # Critical TODOs
    echo '    "critical": ['
    local first=true
    for todo in "${CRITICAL_TODOS[@]}"; do
        if [ "$first" = false ]; then echo -n ","; fi
        echo
        echo -n '      {"task": "'$todo'", "priority": "critical"}'
        first=false
    done
    if [ ${#CRITICAL_TODOS[@]} -gt 0 ]; then echo; fi
    echo '    ],'
    
    # High TODOs
    echo '    "high": ['
    first=true
    for todo in "${HIGH_TODOS[@]}"; do
        if [ "$first" = false ]; then echo -n ","; fi
        echo
        echo -n '      {"task": "'$todo'", "priority": "high"}'
        first=false
    done
    if [ ${#HIGH_TODOS[@]} -gt 0 ]; then echo; fi
    echo '    ],'
    
    # Medium TODOs
    echo '    "medium": ['
    first=true
    for todo in "${MEDIUM_TODOS[@]}"; do
        if [ "$first" = false ]; then echo -n ","; fi
        echo
        echo -n '      {"task": "'$todo'", "priority": "medium"}'
        first=false
    done
    if [ ${#MEDIUM_TODOS[@]} -gt 0 ]; then echo; fi
    echo '    ],'
    
    # Low TODOs
    echo '    "low": ['
    first=true
    for todo in "${LOW_TODOS[@]}"; do
        if [ "$first" = false ]; then echo -n ","; fi
        echo
        echo -n '      {"task": "'$todo'", "priority": "low"}'
        first=false
    done
    if [ ${#LOW_TODOS[@]} -gt 0 ]; then echo; fi
    echo '    ]'
    
    echo '  }'
    echo '}'
}

# Output TODOs in Claude Code format
output_claude() {
    echo "## Security TODOs for Claude Code"
    echo
    echo "Please add these tasks to your TODO list:"
    echo
    
    if [ ${#CRITICAL_TODOS[@]} -gt 0 ]; then
        echo "### Critical Security Issues (Fix Immediately)"
        for todo in "${CRITICAL_TODOS[@]}"; do
            echo "- $todo"
        done
        echo
    fi
    
    if [ ${#HIGH_TODOS[@]} -gt 0 ]; then
        echo "### High Priority Issues"
        for todo in "${HIGH_TODOS[@]}"; do
            echo "- $todo"
        done
        echo
    fi
    
    if [ ${#MEDIUM_TODOS[@]} -gt 0 ]; then
        echo "### Medium Priority Issues"
        for todo in "${MEDIUM_TODOS[@]}"; do
            echo "- $todo"
        done
        echo
    fi
    
    if [ ${#LOW_TODOS[@]} -gt 0 ]; then
        echo "### Low Priority Issues"
        for todo in "${LOW_TODOS[@]}"; do
            echo "- $todo"
        done
        echo
    fi
    
    echo "Use the TodoWrite tool to track these tasks."
}

# Main execution
main() {
    echo -e "${BLUE}🔍 Scanning for security issues and generating TODOs...${NC}" >&2
    
    if [ ! -d "$SCAN_PATH" ] && [ ! -f "$SCAN_PATH" ]; then
        echo -e "${RED}❌ Path not found: $SCAN_PATH${NC}" >&2
        exit 1
    fi
    
    # Scan files
    if [ -f "$SCAN_PATH" ]; then
        scan_and_generate_todos "$SCAN_PATH"
    else
        while IFS= read -r -d '' file; do
            scan_and_generate_todos "$file"
        done < <(find "$SCAN_PATH" -name "*.md" -type f -print0 2>/dev/null)
    fi
    
    # Output based on format
    case "$OUTPUT_FORMAT" in
        json)
            output_json
            ;;
        claude)
            output_claude
            ;;
        markdown|*)
            output_markdown
            ;;
    esac
    
    # Summary to stderr
    local total_todos=$((${#CRITICAL_TODOS[@]} + ${#HIGH_TODOS[@]} + ${#MEDIUM_TODOS[@]} + ${#LOW_TODOS[@]}))
    echo -e "${BLUE}📊 Summary:${NC}" >&2
    echo -e "  Critical: ${#CRITICAL_TODOS[@]}" >&2
    echo -e "  High: ${#HIGH_TODOS[@]}" >&2
    echo -e "  Medium: ${#MEDIUM_TODOS[@]}" >&2
    echo -e "  Low: ${#LOW_TODOS[@]}" >&2
    echo -e "  Total TODOs: $total_todos" >&2
    
    if [ $total_todos -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Action required to resolve security issues${NC}" >&2
        exit 1
    else
        echo -e "${GREEN}✅ No security issues found${NC}" >&2
        exit 0
    fi
}

# Show usage
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [scan-path] [format] [scan-type]"
    echo
    echo "Arguments:"
    echo "  scan-path  Path to scan (default: memory/fragments)"
    echo "  format     Output format: markdown, json, claude (default: markdown)"
    echo "  scan-type  Type of scan: secrets, pii, full (default: full)"
    echo
    echo "Examples:"
    echo "  $0                              # Scan memory/fragments, output markdown"
    echo "  $0 . json                       # Scan current dir, output JSON"
    echo "  $0 commands/ claude full        # Scan commands, output for Claude Code"
    exit 0
fi

main