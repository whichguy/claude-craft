---
description: Analyze git operations for security threats
allowed-tools: Read, Grep, Bash(git:*), Bash(find:*), WebSearch
argument-hint: [operation] [repository-or-options]
---

# Git Security Analysis Command

Perform secure git operations with threat analysis and quarantine capabilities.

## Usage

```bash
# Secure clone with analysis
./tools/secure-git.sh clone <repository-url>

# Secure pull with threat detection  
./tools/secure-git.sh pull [remote] [branch]

# Secure fetch
./tools/secure-git.sh fetch [options]
```

## Operation: ${1:-clone}
## Target: ${2:-current-repository}

## Security Analysis Steps

1. **Pre-Operation State Capture**
   - Current branch and commit
   - Existing file inventory
   - Permission snapshot

2. **Git Operation Monitoring**
   - Verbose operation logging
   - File change tracking
   - New file detection

3. **Threat Analysis**
   - Dangerous command patterns
   - Credential extraction attempts
   - Network operations audit
   - Executable file inspection
   - Git hook validation

4. **Quarantine & Response**
   - Suspicious file isolation
   - Rollback capability
   - Security event logging

## Analyzing: $ARGUMENTS

Please wait while I perform security analysis...