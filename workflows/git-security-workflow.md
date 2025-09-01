# Git Security Workflow

## Overview

This workflow ensures all git clone/pull operations are analyzed for security threats before files are integrated into the project.

## Workflow Steps

### 1. Pre-Operation Setup
```bash
# Create a temporary branch for analysis
git checkout -b security-review-$(date +%s)

# Record current state
git status > /tmp/git-state-before.txt
find . -type f -name "*.sh" -o -name "*.md" -o -name "*.json" | sort > /tmp/files-before.txt
```

### 2. Git Operation with Detailed Tracking
```bash
# For git clone
git clone --verbose <repository> 2>&1 | tee /tmp/git-clone-output.txt
cd <repository>
git ls-files > /tmp/files-cloned.txt

# For git pull
git pull --verbose --stat 2>&1 | tee /tmp/git-pull-output.txt
git diff --name-status HEAD@{1} HEAD > /tmp/files-changed.txt

# For git fetch + merge
git fetch --verbose origin
git diff --name-status HEAD origin/main > /tmp/files-incoming.txt
```

### 3. Capture Changed Files
```bash
# Identify all changed files
git diff --name-only HEAD@{1} HEAD > /tmp/changed-files.txt

# Get detailed changes
for file in $(cat /tmp/changed-files.txt); do
    echo "=== $file ===" >> /tmp/detailed-changes.txt
    git diff HEAD@{1} HEAD -- "$file" >> /tmp/detailed-changes.txt
done

# Special attention to executable and hook files
find . -type f \( -name "*.sh" -o -name "*.hook" -o -path "*/.git/hooks/*" \) \
    -newer /tmp/git-state-before.txt > /tmp/new-executables.txt
```

### 4. Security Analysis Phase
```bash
# Export changes for analysis
export FILES_CHANGED=$(cat /tmp/detailed-changes.txt)

# Run security threat analysis
claude code <<EOF
/prompts git-security-threat

Please analyze these files for security threats:
$(cat /tmp/changed-files.txt)

Detailed changes:
$(cat /tmp/detailed-changes.txt)
EOF
```

### 5. Quarantine Suspicious Files
```bash
# Create quarantine directory
mkdir -p ~/.git-quarantine/$(date +%Y%m%d)

# Function to quarantine a file
quarantine_file() {
    local file=$1
    local quarantine_path=~/.git-quarantine/$(date +%Y%m%d)/
    
    # Backup the file
    cp -p "$file" "$quarantine_path"
    
    # Replace with safe placeholder
    echo "# File quarantined for security review" > "$file"
    echo "# Original location: $file" >> "$file"
    echo "# Quarantine location: $quarantine_path$(basename $file)" >> "$file"
    
    # Remove execute permissions
    chmod -x "$file"
}
```

### 6. Hook Analysis Before Installation
```bash
# Check for git hooks
if [ -d .git/hooks ]; then
    for hook in .git/hooks/*; do
        if [ -f "$hook" ] && [ ! -L "$hook" ]; then
            echo "Analyzing hook: $hook"
            # Check for dangerous patterns
            if grep -E "(rm -rf|curl.*eval|wget.*sh|base64.*decode)" "$hook"; then
                echo "DANGEROUS HOOK DETECTED: $hook"
                quarantine_file "$hook"
            fi
        fi
    done
fi

# Check for Claude Code commands/hooks
if [ -d commands ] || [ -d hooks ]; then
    echo "Analyzing Claude Code extensions..."
    for file in commands/*.md hooks/scripts/*.sh; do
        if [ -f "$file" ]; then
            # Run targeted analysis
            ./tools/security-scan.sh "$file" secrets true
        fi
    done
fi
```

### 7. Rollback Capability
```bash
# Create rollback function
create_rollback() {
    git stash save "Security review checkpoint $(date)"
    git tag security-checkpoint-$(date +%s)
}

# Rollback if threats detected
rollback_changes() {
    echo "Rolling back to safe state..."
    git reset --hard HEAD@{1}
    git clean -fd
    
    # Restore from checkpoint if available
    if git tag -l | grep -q security-checkpoint; then
        latest_checkpoint=$(git tag -l | grep security-checkpoint | tail -1)
        git checkout $latest_checkpoint
    fi
}
```

### 8. Safe Integration
```bash
# If analysis passes, integrate changes
integrate_changes() {
    # Remove temporary branch
    git checkout main
    git branch -D security-review-*
    
    # Log the integration
    echo "$(date): Integrated changes from $(git remote get-url origin)" >> ~/.git-security-log
    
    # Clean up temp files
    rm -f /tmp/git-*.txt /tmp/files-*.txt /tmp/changed-*.txt
}
```

## Automated Security Checks

### Check 1: Dangerous Commands
```bash
DANGEROUS_PATTERNS=(
    "rm -rf /"
    ":(){ :|:& };:"  # Fork bomb
    "dd if=/dev/zero of="
    "mkfs."
    "> /dev/sda"
    "chmod -R 777 /"
    "curl.*|.*sh"
    "wget.*|.*bash"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if grep -r "$pattern" --include="*.sh" --include="*.md" .; then
        echo "CRITICAL: Dangerous pattern found: $pattern"
        exit 1
    fi
done
```

### Check 2: Credential Patterns
```bash
# Check for hardcoded credentials
./tools/security-scan.sh . secrets true

# Check for credential extraction attempts
grep -r "git config.*password" --include="*.sh" .
grep -r "cat.*ssh/id_rsa" --include="*.sh" .
grep -r "AWS_SECRET" --include="*.sh" .
```

### Check 3: Network Operations
```bash
# Find all network operations
grep -r -E "(curl|wget|nc|telnet|ssh|scp)" --include="*.sh" . | \
    grep -v "^#" | \
    while read -r line; do
        echo "Network operation found: $line"
        # Check if destination is trusted
        if echo "$line" | grep -vE "(github.com|npmjs.org|pypi.org)"; then
            echo "WARNING: Untrusted network destination"
        fi
    done
```

## Integration with CI/CD

```yaml
# .github/workflows/security-check.yml
name: Security Analysis
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      
      - name: Get changed files
        run: |
          git diff --name-only origin/${{ github.base_ref }}..HEAD > changed-files.txt
      
      - name: Security analysis
        run: |
          ./workflows/git-security-check.sh changed-files.txt
      
      - name: Report findings
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Security threats detected. Please review the security report.'
            })
```

## Manual Review Triggers

Files that ALWAYS require manual review:
- `.git/hooks/*`
- `*.sh` with sudo commands
- Files with eval/exec patterns
- New GitHub Actions workflows
- Package manager config changes
- Docker/container configurations

## Recovery Procedures

If malicious code is executed:
1. Immediately disconnect from network
2. Run `git reset --hard HEAD@{1}`
3. Check `~/.git-quarantine/` for quarantined files
4. Review `~/.git-security-log` for timeline
5. Revoke any potentially compromised credentials
6. Run full system security scan