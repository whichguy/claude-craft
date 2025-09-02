# Security Workflow for Memory Files

Complete security review process for claude-craft memory files before committing to version control.

## Security Analysis Options

### Option 1: Automated Security Scanning (`/security-scan`)

Quick automated detection of common security issues:

```bash
# Fast automated scan
/security-scan

# Scan specific directory
/security-scan memory/fragments 

# Scan only for secrets (skip PII warnings)
/security-scan memory/fragments secrets

# Full comprehensive scan
/security-scan memory/fragments full
```

**Best for**: Quick checks, automated workflows, CI/CD integration

### Option 2: AI-Powered Security Analysis (`/prompt security-scan`)

Comprehensive analysis with context and recommendations:

```bash
# Interactive AI security analysis
/prompt security-scan memory/fragments

# Analyze specific files
/prompt security-scan path/to/specific/file.md

# Quick scan of current directory
/prompt security-scan .
```

**Best for**: Thorough review, understanding context, getting recommendations

### Option 3: Integrated Workflow (`/agent-sync push`)

Automatic security scanning before git operations:

```bash
# Automatically runs security scan before push
/agent-sync push "Added new memory fragments"
```

**Best for**: Standard workflow, prevents accidental commits of sensitive data

## Security Issues Classification

### 🔴 Critical Issues (MUST FIX)

**API Keys & Credentials**
- Anthropic API keys (`sk-ant-api...`)
- OpenAI API keys (`sk-proj-...`, `sk-...`)
- GitHub tokens (`ghp_`, `github_pat_`)
- AWS credentials (`AKIA...`)
- Database connection strings with passwords
- JWT tokens and bearer tokens
- Any hardcoded passwords or secrets

**Impact**: Immediate security breach risk
**Action**: Remove or redact immediately, never commit

### 🟡 Personal Information (REVIEW CAREFULLY)

**Personal Details**
- Full names and personal email addresses
- Home addresses or specific locations
- Phone numbers and personal identifiers
- Family information (like pet names)
- Employment details with company names
- Educational background specifics

**Impact**: Privacy risk, potential doxxing
**Action**: Evaluate necessity, consider redaction or placeholder values

### 🟢 Safe Technical Information (GENERALLY OK)

**Development Preferences**
- Code style preferences and patterns
- Tool configurations (without credentials)
- Development methodologies and workflows
- Public API usage examples
- Technical best practices and conventions

**Impact**: No security or privacy risk
**Action**: Safe to share, enhances collaboration

## Pre-Commit Security Checklist

Before committing memory files to version control:

### 1. Automated Scan
```bash
/agent-sync scan
```
- [ ] No critical security issues detected
- [ ] Review any PII warnings
- [ ] All secrets removed or replaced with placeholders

### 2. Manual Review
- [ ] Read through each memory fragment
- [ ] Verify no personal information is exposed
- [ ] Check that examples use placeholder data
- [ ] Confirm no internal company details are included

### 3. AI Analysis (Optional)
```bash
/prompt security-scan memory/fragments
```
- [ ] Review AI recommendations
- [ ] Address any additional concerns raised
- [ ] Confirm final assessment is positive

### 4. Safe Commit
```bash
/agent-sync push "Description of changes"
```
- [ ] Security scan passes automatically
- [ ] Changes committed safely
- [ ] Repository remains secure

## Common Patterns to Watch For

### High-Risk Patterns
```bash
# API keys
sk-ant-api03-...
sk-proj-...
api_key = "..."
bearer eyJ...

# Personal info
my name is John
I live in 123 Main St
work at CompanyName
my dog's name is Fluffy
email: personal@gmail.com
phone: 555-1234
```

### Safe Alternatives
```bash
# Use placeholders
api_key = "${ANTHROPIC_API_KEY}"
bearer ${JWT_TOKEN}

# Generic examples
my preference is...
I use the pattern...
configure the tool to...
the example shows...
email: user@example.com
phone: xxx-xxx-xxxx
```

## Remediation Strategies

### For API Keys and Secrets
1. **Remove completely** if they were examples
2. **Replace with environment variables**: `${API_KEY}`
3. **Use placeholder values**: `your-api-key-here`
4. **Reference external docs**: "See authentication setup guide"

### For Personal Information
1. **Generic examples**: Instead of "I live in Seattle" → "configure your location"
2. **Placeholder values**: Instead of real names → "your-name-here"
3. **Remove specifics**: Instead of "work at Google" → "work at your company"
4. **Use examples**: Instead of real emails → "user@example.com"

### For Safe Information
1. **Keep as-is**: Technical preferences are helpful for collaboration
2. **Add context**: Explain why certain patterns are preferred
3. **Provide examples**: Show how to apply the principles
4. **Document rationale**: Help others understand the decisions

## Integration with Git Workflow

The security workflow integrates seamlessly with git operations:

1. **Pre-commit**: Automatic security scan via `/agent-sync push`
2. **Manual scan**: On-demand via `/agent-sync scan` or `/security-scan`
3. **Deep analysis**: Interactive via `/prompt security-scan`
4. **Failure handling**: Push blocked if critical issues found

## Best Practices

### Development Workflow
1. Create memory fragments with placeholder values from the start
2. Run security scans regularly during development
3. Use the AI analysis for comprehensive review
4. Never commit first drafts without security review

### Team Collaboration
1. Include security scan in PR review process
2. Document security considerations in memory fragments
3. Share security-safe templates with the team
4. Regular security audits of shared memory files

### Maintenance
1. Periodic re-scan of existing memory files
2. Update security patterns as new risks emerge
3. Review and update placeholder values
4. Monitor for accidental inclusion of real data

This workflow ensures that claude-craft memory files enhance productivity while maintaining security and privacy.