---
description: Generate security remediation TODOs from scan results
allowed-tools: Read, Bash, TodoWrite
argument-hint: [scan-path] [priority-filter]
---

# Security TODO Generator

Analyze security scan results and create actionable TODO items for remediation.

## Scanning: ${1:-memory/fragments}
## Priority Filter: ${2:-all}

```bash
#!/bin/bash

# Run security TODO generator
SCAN_PATH="${1:-memory/fragments}"
PRIORITY="${2:-all}"

# Execute the security TODO scanner
~/claude-craft/tools/security-todos.sh "$SCAN_PATH" claude full
```

## TODO Integration

Based on the security scan results, I'll now create TODO items for tracking remediation:

1. **Critical Issues** - Secrets and credentials that must be removed
2. **High Priority** - Security vulnerabilities requiring immediate attention
3. **Medium Priority** - Privacy and data protection concerns
4. **Low Priority** - Best practice improvements

These TODOs will be added to your task list with specific remediation steps for each issue found.

## Remediation Workflow

For each TODO item generated:
1. Navigate to the specified file and line number
2. Apply the recommended fix (usually replacing with environment variables)
3. Test the change to ensure functionality is maintained
4. Mark the TODO as complete
5. Run the security scan again to verify the fix

## Example Fixes

### For API Keys:
```javascript
// Before (INSECURE):
const apiKey = "sk-ant-api03-abc123...";

// After (SECURE):
const apiKey = process.env.ANTHROPIC_API_KEY;
```

### For Database URLs:
```javascript
// Before (INSECURE):
const dbUrl = "mongodb://user:password@host:27017/db";

// After (SECURE):
const dbUrl = process.env.DATABASE_URL;
```

### For Personal Information:
```markdown
<!-- Before (PRIVACY ISSUE): -->
Contact: john.smith@gmail.com

<!-- After (ANONYMIZED): -->
Contact: user@example.com
```

The security scan will continue monitoring for these patterns to ensure ongoing compliance.