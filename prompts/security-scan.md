# Security Analysis Prompt Template

## Context Analysis

Target for security analysis: **$1**

### Automated Security Scan Results

!`# Run automated security scanner first
SCAN_TARGET="${1:-memory/fragments}"

# Check if security scanner exists
if [ -f "./tools/security-scan.sh" ]; then
    echo "=== Automated Security Scanner Results ==="
    ./tools/security-scan.sh "$SCAN_TARGET" full false
    echo "=== End Automated Results ==="
else
    echo "⚠️  Security scanner not found - manual analysis only"
fi`

### File Contents for Manual Review

!`# Include contents of files to be analyzed
SCAN_TARGET="${1:-memory/fragments}"

if [ -d "$SCAN_TARGET" ]; then
    echo "=== Files to Review ==="
    find "$SCAN_TARGET" -name "*.md" -type f | while read -r file; do
        echo "--- File: $file ---"
        head -20 "$file" 2>/dev/null || echo "[Could not read file]"
        echo ""
    done
else
    echo "⚠️  Directory $SCAN_TARGET not found"
fi`

## Manual Security Analysis

Based on the automated scan results and file contents above, perform a comprehensive security analysis:

### 🔴 Critical Security Issues (Must Fix Before Sharing)

Analyze for:
- **API Keys & Tokens**: Look for patterns like `sk-`, `api_key=`, `bearer`, JWT tokens
- **Database Credentials**: Connection strings with usernames/passwords
- **Private Keys**: Any private key material or certificates
- **Hardcoded Secrets**: Passwords, tokens, or sensitive configuration values
- **Cloud Provider Keys**: AWS, GCP, Azure access keys

### 🟡 Personal Information (Review Carefully)

Check for:
- **Personal Details**: Names, addresses, phone numbers, personal email addresses
- **Location Data**: Home addresses, specific locations, geographic details
- **Personal Context**: Family information, personal anecdotes, private details
- **Employment Info**: Specific company names, internal tools, confidential business information
- **Educational Info**: Schools attended, graduation years, academic details

### 🟢 Safe Information (Generally OK to Share)

Identify:
- **Technical Preferences**: Code style, development tools, programming patterns
- **Best Practices**: Development methodologies, coding standards
- **Public Information**: Open source tools, public APIs, general technical knowledge
- **Template Content**: Reusable workflows, command patterns, documentation templates

## Recommended Actions

For each issue found, provide specific recommendations:

1. **Immediate Actions**: What needs to be fixed before any git commit/push
2. **Redaction Strategy**: How to remove or replace sensitive information
3. **Prevention Measures**: How to avoid similar issues in the future
4. **Alternative Approaches**: Safer ways to handle the information

## Security-Safe Alternatives

Suggest secure alternatives for any problematic content:
- Environment variables for secrets
- Placeholder values for examples
- Generic examples instead of personal details
- Configuration templates instead of actual config files

## Final Assessment

Provide a clear go/no-go recommendation for sharing these memory files in version control.

**IMPORTANT**: Be thorough but practical. Personal preferences and non-sensitive technical information are generally safe to share, while actual credentials and private personal details are not.