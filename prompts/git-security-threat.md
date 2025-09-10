---
description: Security threat analysis for git clone/pull operations
context-type: prompt-context
validation-mode: strict
---

# Git Security Threat Analysis

Analyze the following files that were created or updated during a git operation for potential security threats, malicious code, or dangerous patterns.

## Files to Analyze

<prompt-arguments>
${FILES_CHANGED}
</prompt-arguments>

## Critical Security Threats to Detect

### 1. Destructive File Operations
- **rm -rf** patterns (especially with root/home directories)
- **unlink** commands targeting critical files
- **> /dev/sda** or disk write operations
- **dd** commands that could overwrite disks
- **shred** or **wipe** commands
- **chmod 000** on critical directories
- **chown** to change critical file ownership

### 2. Credential & Secret Extraction
- **AWS CLI** credential exports or queries
- **gcloud auth** print operations
- **az account** key listings
- **kubectl config** view commands
- **docker login** password extraction
- **npm token** or **npm whoami** captures
- **git config** credential extraction
- **ssh-keygen** or private key reads
- **gpg --export-secret-keys**
- **keychain** or **security** (macOS) dumps
- **pass** or password manager queries

### 3. Data Exfiltration Patterns
- **curl/wget POST** to external URLs with local data
- **nc** (netcat) connections sending data
- **base64** encoding followed by network sends
- **tar** piped to network commands
- **scp/sftp/rsync** to unknown hosts
- **openssl s_client** connections
- Unauthorized **telnet** or **ftp** uploads

### 4. System Manipulation
- **iptables** firewall modifications
- **systemctl/service** disabling security services
- **kill/killall** targeting security processes
- **crontab** installing backdoors
- **at/batch** scheduling malicious tasks
- **/etc/hosts** modifications
- **DNS** configuration changes

### 5. Development Tool Abuse
- **sfdx** force:org commands extracting Salesforce data
- **clasp** commands accessing Google Apps Script
- **firebase** commands with production targets
- **heroku** commands affecting production
- **vercel/netlify** deployment hijacking
- **terraform destroy** operations
- **kubectl delete** on production resources
- **helm delete** removing critical services

### 6. Certificate & PKI Manipulation
- **openssl req** creating rogue certificates
- **keytool** importing untrusted certs
- **update-ca-certificates** with malicious CAs
- **certbot** with unauthorized domains
- SSL/TLS certificate replacements

### 7. Package Manager Threats
- **npm install** with postinstall scripts
- **pip install** from untrusted sources
- **gem install** with native extensions
- **cargo** build scripts with system calls
- **go get** with replace directives
- Modified **package-lock.json** with different hashes

### 8. Shell & Environment Manipulation
- **eval** with user input or external data
- **source** or **.** sourcing untrusted files
- **export** modifying PATH to include malicious directories
- **alias** redirecting common commands
- **LD_PRELOAD** or **DYLD_INSERT_LIBRARIES** injection
- Profile/RC file modifications (.bashrc, .zshrc)

### 9. Container & Virtualization Threats
- **docker run --privileged** containers
- **docker cp** extracting sensitive files
- Volume mounts of sensitive directories
- **ENTRYPOINT** or **CMD** overrides
- **--cap-add** with dangerous capabilities

### 10. Git-Specific Threats
- **.git/hooks** with malicious scripts
- **git filter-branch** rewriting history
- **git config** core.editor exploitation
- Submodule URLs pointing to malicious repos
- **pre-commit** hooks with dangerous commands

## Analysis Requirements

1. **File Type Check**: Identify executable files, scripts, and configuration files
2. **Permission Analysis**: Check for chmod/chown that grant excessive permissions
3. **Network Analysis**: Identify all network operations and destinations
4. **Command Injection**: Look for command substitution and eval patterns
5. **Path Traversal**: Detect ../.. patterns accessing parent directories
6. **Encoding Detection**: Find base64/hex encoding hiding malicious content

## Severity Classification

- **CRITICAL**: Immediate system compromise or data theft
- **HIGH**: Credential access or production system manipulation
- **MEDIUM**: Suspicious patterns requiring investigation
- **LOW**: Best practice violations or minor concerns

## Response Actions

For each threat detected, provide:
1. **Location**: Exact file and line number
2. **Threat Type**: Category of malicious behavior
3. **Impact**: What damage could occur
4. **Evidence**: The specific code/command found
5. **Recommendation**: Block, quarantine, or allow with warning

## Safe Patterns to Ignore

- Standard build commands in established build files
- Known testing frameworks and assertions
- Documentation and comments (unless containing executable examples)
- Standard dependency installations from lock files

## Output Format

```markdown
## Security Analysis Report

### Summary
- Files Analyzed: X
- Threats Found: Y
- Severity: CRITICAL/HIGH/MEDIUM/LOW/CLEAN

### Critical Findings
[If any critical threats found]

### Detailed Analysis
[File by file breakdown]

### Recommendations
[Specific actions to take]
```

Analyze thoroughly but avoid false positives on legitimate development patterns.