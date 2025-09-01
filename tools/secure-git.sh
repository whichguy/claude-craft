#!/bin/bash
set -e

# Secure Git Operations Wrapper
# Analyzes git clone/pull for security threats before integration

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
QUARANTINE_DIR="$HOME/.git-quarantine/$(date +%Y%m%d_%H%M%S)"
TEMP_DIR="/tmp/git-security-$$"
SECURITY_LOG="$HOME/.git-security.log"
OPERATION="$1"
shift

# Dangerous command patterns
DANGEROUS_PATTERNS=(
    "rm -rf /"
    "rm -rf ~"
    "rm -rf \$HOME"
    ":(){ :|:& };:"
    "dd if=/dev/zero"
    "dd if=/dev/random"
    "> /dev/sda"
    "> /dev/null 2>&1 &"
    "mkfs\."
    "chmod -R 777"
    "chmod 777 /"
    "chown -R"
    "curl.*\|.*sh"
    "curl.*\|.*bash"
    "wget.*\|.*sh"
    "wget.*\|.*bash"
    "nc -l"
    "base64 -d.*\|.*sh"
    "eval.*curl"
    "eval.*wget"
    "python -c.*eval"
    "perl -e.*eval"
)

# Files to exclude from security scanning (documentation, prompts, etc.)
EXCLUDE_PATTERNS=(
    "*/README.md"
    "*/CHANGELOG.md"
    "*/docs/*"
    "*/prompts/*"
    "*/examples/*"
    "*/templates/*"
)

# Credential extraction patterns
CREDENTIAL_PATTERNS=(
    "aws configure get"
    "aws sts get-"
    "gcloud auth.*print"
    "az account.*show"
    "kubectl config view"
    "docker login.*password-stdin"
    "npm token"
    "cat.*\.ssh/id_"
    "cat.*\.aws/credentials"
    "cat.*\.netrc"
    "gpg --export-secret"
    "security find-generic-password"
    "git config.*credential"
    "printenv.*KEY"
    "printenv.*TOKEN"
    "printenv.*SECRET"
    "echo.*\$AWS_"
    "echo.*\$GITHUB_"
)

# Initialize
initialize() {
    mkdir -p "$TEMP_DIR"
    mkdir -p "$QUARANTINE_DIR"
    
    echo -e "${BLUE}🔒 Secure Git Operation Started${NC}"
    echo "[$(date)] Starting secure $OPERATION operation" >> "$SECURITY_LOG"
}

# Cleanup
cleanup() {
    rm -rf "$TEMP_DIR"
}

# Capture current state
capture_state() {
    echo -e "${BLUE}📸 Capturing current state...${NC}"
    
    # Save current branch and commit
    if [ -d .git ]; then
        git rev-parse HEAD > "$TEMP_DIR/head-before.txt" 2>/dev/null || true
        git branch --show-current > "$TEMP_DIR/branch-before.txt" 2>/dev/null || true
    fi
    
    # List current files
    find . -type f -name "*.sh" -o -name "*.md" -o -name "*.json" 2>/dev/null | \
        sort > "$TEMP_DIR/files-before.txt" || true
}

# Perform git operation
perform_operation() {
    echo -e "${BLUE}🔄 Performing git $OPERATION...${NC}"
    
    case "$OPERATION" in
        clone)
            # Capture repository URL
            REPO_URL="$1"
            echo "Repository: $REPO_URL" >> "$SECURITY_LOG"
            
            # Clone with verbose output
            git clone --verbose "$@" 2>&1 | tee "$TEMP_DIR/git-output.txt"
            
            # Get cloned directory
            CLONE_DIR=$(echo "$REPO_URL" | sed 's/.*\///' | sed 's/\.git$//')
            cd "$CLONE_DIR" 2>/dev/null || cd "$(ls -d */ | head -1)"
            
            # List all files
            git ls-files > "$TEMP_DIR/files-after.txt"
            ;;
            
        pull|fetch)
            # Save before state
            git rev-parse HEAD > "$TEMP_DIR/head-before.txt"
            
            # Perform operation
            git "$OPERATION" --verbose "$@" 2>&1 | tee "$TEMP_DIR/git-output.txt"
            
            # Get changed files
            if [ "$OPERATION" = "pull" ]; then
                git diff --name-status HEAD@{1} HEAD > "$TEMP_DIR/files-changed.txt" 2>/dev/null || \
                git diff --name-status "$(cat $TEMP_DIR/head-before.txt)" HEAD > "$TEMP_DIR/files-changed.txt"
            fi
            ;;
            
        *)
            echo -e "${RED}❌ Unsupported operation: $OPERATION${NC}"
            exit 1
            ;;
    esac
}

# Analyze file for threats
analyze_file() {
    local file="$1"
    local threats_found=0
    
    if [ ! -f "$file" ]; then
        return 0
    fi
    
    # Check dangerous patterns
    for pattern in "${DANGEROUS_PATTERNS[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            echo -e "${RED}  🚨 DANGEROUS: $pattern found in $file${NC}"
            threats_found=$((threats_found + 1))
        fi
    done
    
    # Check credential patterns
    for pattern in "${CREDENTIAL_PATTERNS[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            echo -e "${YELLOW}  ⚠️  CREDENTIAL RISK: $pattern found in $file${NC}"
            threats_found=$((threats_found + 1))
        fi
    done
    
    # Check for eval/exec patterns
    if grep -qE "(eval|exec|system)\s*\(" "$file" 2>/dev/null; then
        echo -e "${YELLOW}  ⚠️  CODE EXECUTION: eval/exec pattern in $file${NC}"
        threats_found=$((threats_found + 1))
    fi
    
    # Check for base64 encoded content
    if grep -qE "base64\s+-d|base64\s+--decode" "$file" 2>/dev/null; then
        echo -e "${YELLOW}  ⚠️  ENCODED CONTENT: base64 decode in $file${NC}"
        threats_found=$((threats_found + 1))
    fi
    
    return $threats_found
}

# Security analysis
analyze_security() {
    echo -e "${BLUE}🔍 Analyzing for security threats...${NC}"
    
    local total_threats=0
    local files_analyzed=0
    
    # Get list of files to analyze - focus on executable files and scripts
    if [ -f "$TEMP_DIR/files-changed.txt" ]; then
        # For pull operations - only check executable/script files
        FILES_TO_CHECK=$(awk '{print $2}' "$TEMP_DIR/files-changed.txt" | grep -E "\.(sh|hook|py|js|pl|rb|exe)$|^[^.]*$" | grep -v -E "/(docs|prompts|examples|templates)/" || true)
    elif [ -f "$TEMP_DIR/files-after.txt" ]; then
        # For clone operations - only check executable/script files  
        FILES_TO_CHECK=$(cat "$TEMP_DIR/files-after.txt" | grep -E "\.(sh|hook|py|js|pl|rb|exe)$|^[^.]*$" | grep -v -E "/(docs|prompts|examples|templates)/" || true)
    else
        # Fallback: check all script files
        FILES_TO_CHECK=$(find . -type f \( -name "*.sh" -o -name "*.hook" -o -name "*.py" -o -name "*.js" \) -not -path "*/docs/*" -not -path "*/prompts/*" 2>/dev/null || true)
    fi
    
    # Analyze each file
    for file in $FILES_TO_CHECK; do
        if [ -f "$file" ]; then
            files_analyzed=$((files_analyzed + 1))
            analyze_file "$file"
            total_threats=$((total_threats + $?))
        fi
    done
    
    # Check git hooks
    if [ -d .git/hooks ]; then
        echo -e "${BLUE}🪝 Checking git hooks...${NC}"
        for hook in .git/hooks/*; do
            # Skip git hook samples and symlinks
            if [ -f "$hook" ] && [ ! -L "$hook" ] && [[ "$hook" != *.sample ]]; then
                analyze_file "$hook"
                local hook_threats=$?
                total_threats=$((total_threats + hook_threats))
                
                # Quarantine suspicious hooks
                if [ $hook_threats -gt 0 ]; then
                    echo -e "${YELLOW}  Quarantining hook: $hook${NC}"
                    mv "$hook" "$QUARANTINE_DIR/$(basename $hook)"
                    echo "# Hook quarantined for security review" > "$hook"
                    chmod -x "$hook"
                fi
            fi
        done
    fi
    
    # Check for Claude Code extensions
    if [ -d commands ] || [ -d hooks ]; then
        echo -e "${BLUE}🔌 Checking Claude Code extensions...${NC}"
        
        # Use our security scanner if available
        if [ -f ./tools/security-scan.sh ]; then
            ./tools/security-scan.sh . secrets false
        fi
    fi
    
    # Summary
    echo
    echo -e "${BLUE}📊 Security Analysis Summary:${NC}"
    echo "  Files analyzed: $files_analyzed"
    echo "  Threats found: $total_threats"
    
    if [ $total_threats -gt 0 ]; then
        echo
        echo -e "${RED}🚨 SECURITY THREATS DETECTED!${NC}"
        echo -e "${YELLOW}Review quarantined files in: $QUARANTINE_DIR${NC}"
        echo
        
        # Generate TODO list for remediation
        echo -e "${BLUE}📝 TODO LIST FOR REMEDIATION:${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        local todo_num=1
        for file in $FILES_TO_CHECK; do
            if [ -f "$file" ]; then
                # Check if file had issues
                local file_threats=0
                for pattern in "${DANGEROUS_PATTERNS[@]}"; do
                    if grep -q "$pattern" "$file" 2>/dev/null; then
                        echo "  $todo_num. [ ] Remove dangerous pattern from $file"
                        echo "      Pattern: $pattern"
                        echo "      Action: Review and remove or make safe"
                        todo_num=$((todo_num + 1))
                        file_threats=$((file_threats + 1))
                        break
                    fi
                done
                
                for pattern in "${CREDENTIAL_PATTERNS[@]}"; do
                    if grep -q "$pattern" "$file" 2>/dev/null; then
                        echo "  $todo_num. [ ] Replace credential in $file"
                        echo "      Pattern: $pattern"
                        echo "      Action: Use environment variable instead"
                        todo_num=$((todo_num + 1))
                        file_threats=$((file_threats + 1))
                        break
                    fi
                done
            fi
        done
        
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo
        
        echo -e "${YELLOW}Options:${NC}"
        echo "  1. Rollback changes (recommended)"
        echo "  2. Review and fix threats manually"
        echo "  3. Proceed anyway (dangerous)"
        echo
        read -p "Choose option [1-3]: " choice
        
        case $choice in
            1)
                rollback_changes
                ;;
            2)
                echo "Quarantined files are in: $QUARANTINE_DIR"
                echo "Fix the issues and run the operation again"
                exit 1
                ;;
            3)
                echo -e "${RED}⚠️  Proceeding despite threats (logged)${NC}"
                echo "[$(date)] PROCEEDED WITH THREATS: $total_threats threats" >> "$SECURITY_LOG"
                ;;
            *)
                echo "Invalid choice, rolling back for safety"
                rollback_changes
                ;;
        esac
    else
        echo -e "${GREEN}✅ No security threats detected${NC}"
    fi
    
    return $total_threats
}

# Rollback changes
rollback_changes() {
    echo -e "${YELLOW}⏪ Rolling back changes...${NC}"
    
    if [ -f "$TEMP_DIR/head-before.txt" ]; then
        git reset --hard "$(cat $TEMP_DIR/head-before.txt)" 2>/dev/null || true
        git clean -fd
        echo -e "${GREEN}✅ Rolled back to previous state${NC}"
    else
        echo -e "${RED}Cannot rollback - no previous state found${NC}"
    fi
    
    echo "[$(date)] Rolled back due to security threats" >> "$SECURITY_LOG"
    exit 1
}

# Create git command wrapper
create_safe_git_alias() {
    echo -e "${BLUE}💡 To always use secure git, add this alias:${NC}"
    echo "  alias git-secure='$0'"
    echo "  alias gits='$0'"
}

# Main execution
main() {
    # Check if operation provided
    if [ -z "$OPERATION" ]; then
        echo "Usage: $0 <clone|pull|fetch> [git arguments]"
        echo
        echo "Examples:"
        echo "  $0 clone https://github.com/user/repo.git"
        echo "  $0 pull origin main"
        echo "  $0 fetch --all"
        echo
        create_safe_git_alias
        exit 1
    fi
    
    # Initialize
    initialize
    trap cleanup EXIT
    
    # Capture state before operation
    capture_state
    
    # Perform git operation
    perform_operation "$@"
    
    # Analyze security
    analyze_security
    
    # Log success
    echo "[$(date)] Completed secure $OPERATION successfully" >> "$SECURITY_LOG"
    echo -e "${GREEN}✅ Secure git operation completed${NC}"
}

# Run main
main "$@"