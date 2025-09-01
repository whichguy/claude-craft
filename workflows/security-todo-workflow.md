# Security TODO Workflow

## Overview

This workflow explains how security scanners generate actionable TODO items for remediation.

## How Security TODOs Work

### 1. Automatic Generation During Scans

Whenever a security scan runs, it automatically generates TODO items:

```bash
# Run security scan with TODO generation
./tools/security-scan.sh memory/fragments full false

# Output includes:
# - Specific file and line numbers
# - Categorized TODO tasks
# - Remediation instructions
```

### 2. TODO Categories

#### Priority 1: CRITICAL (Secrets & Credentials)
- API keys and tokens
- Database connection strings
- Private keys
- Passwords in code

**Example TODO:**
```
[ ] Fix secrets in config.md:42
    - Replace API key with ${ANTHROPIC_API_KEY}
    - Move to .env file
```

#### Priority 2: HIGH (Security Vulnerabilities)
- Dangerous shell commands
- Code injection risks
- Unsafe network operations

**Example TODO:**
```
[ ] Remove dangerous pattern from script.sh:15
    - Pattern: rm -rf /
    - Action: Review and make safe
```

#### Priority 3: MEDIUM (Privacy Concerns)
- Email addresses
- Phone numbers
- Personal names
- Physical addresses

**Example TODO:**
```
[ ] Anonymize email in about.md:23
    - Replace john@gmail.com with user@example.com
```

#### Priority 4: LOW (Best Practices)
- Configuration improvements
- Documentation updates
- Code quality issues

### 3. Working with TODOs

#### View TODOs in Different Formats

```bash
# Markdown format (human-readable)
./tools/security-todos.sh . markdown

# JSON format (for tools)
./tools/security-todos.sh . json

# Claude Code format (for AI assistance)
./tools/security-todos.sh . claude
```

#### Using TODOs in Claude Code

```bash
# Generate TODOs for Claude Code
/security-todos memory/fragments

# Claude will:
# 1. Run the security scan
# 2. Parse the results
# 3. Create TODO items using TodoWrite
# 4. Track remediation progress
```

### 4. Remediation Process

#### Step 1: Review Generated TODOs
```bash
# See all security TODOs
./tools/security-scan.sh . full false | grep -A50 "TODO"
```

#### Step 2: Fix Issues by Priority
Start with CRITICAL issues first:

**For API Keys:**
```javascript
// Before:
const key = "sk-ant-api03-abc123...";

// After:
const key = process.env.ANTHROPIC_API_KEY;
```

**For Database URLs:**
```javascript
// Before:
const db = "mongodb://user:pass@host/db";

// After:
const db = process.env.DATABASE_URL;
```

#### Step 3: Create .env File
```bash
# Create .env for local development
cat > .env << EOF
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
DATABASE_URL=your-connection-string
EOF

# Add to .gitignore
echo ".env" >> .gitignore
```

#### Step 4: Verify Fixes
```bash
# Re-run scan to verify issues are resolved
./tools/security-scan.sh . full false

# Should see:
# ✅ No critical security issues found
```

### 5. Git Integration

TODOs are also generated during git operations:

#### During Git Pull
```bash
# The post-merge hook generates TODOs for new threats
git pull

# Output:
# 📝 TODO LIST FOR REMEDIATION:
# 1. [ ] Remove dangerous pattern from new-file.sh
# 2. [ ] Replace credential in config.json
```

#### During Git Clone
```bash
# Using secure-git wrapper
./tools/secure-git.sh clone https://github.com/user/repo

# Generates TODOs for any threats found
```

### 6. Automation with Hooks

#### Pre-commit Hook
Prevents committing files with unresolved TODOs:
```bash
# Automatically runs before commit
git commit -m "Update"

# If TODOs exist:
# ❌ Commit blocked: 5 security TODOs must be resolved
```

#### Post-merge Hook
Creates TODOs for changes pulled from remote:
```bash
# After git pull
# 📝 Security TODOs generated: 3 issues found
```

### 7. TODO Tracking Best Practices

#### Use Descriptive Commit Messages
```bash
# After fixing TODOs
git commit -m "Security: Replace API keys with env vars (resolves TODO #1-3)"
```

#### Document Remediation
```markdown
## Security Fixes Applied
- [x] Replaced all API keys with environment variables
- [x] Removed hardcoded database credentials
- [x] Anonymized personal information in examples
```

#### Regular Audits
```bash
# Weekly security audit
./tools/security-todos.sh . markdown > security-audit-$(date +%Y%m%d).md
```

## Example Complete Workflow

```bash
# 1. Clone repository with security check
./tools/secure-git.sh clone https://github.com/example/repo

# 2. Review generated TODOs
# 📝 5 CRITICAL security TODOs generated

# 3. Fix each TODO
vim config.js  # Replace API key on line 42
vim .env       # Add ANTHROPIC_API_KEY=xxx
vim .gitignore # Add .env

# 4. Verify fixes
./tools/security-scan.sh . secrets false
# ✅ No security issues found

# 5. Commit safely
git add -A
git commit -m "Security: Resolved all API key TODOs"

# 6. Push with confidence
git push origin main
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Security TODO Check
on: [pull_request]

jobs:
  security-todos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Generate Security TODOs
        run: |
          ./tools/security-todos.sh . markdown > todos.md
          
      - name: Comment TODOs on PR
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const todos = fs.readFileSync('todos.md', 'utf8');
            github.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: todos
            });
```

## Benefits

1. **Actionable**: Each TODO has specific remediation steps
2. **Prioritized**: Critical issues are highlighted first
3. **Trackable**: Progress can be monitored
4. **Integrated**: Works with existing git workflow
5. **Automated**: Generated without manual review