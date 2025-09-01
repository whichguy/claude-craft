---
description: Code security analysis and vulnerability assessment
allowed-tools: Read, Grep, Bash(git:*), WebSearch
argument-hint: [file-pattern] or [specific-file-path]
---

# Code Security Analysis Command

Perform a comprehensive security analysis of the specified code:

## Security Checklist

### Input Validation & Sanitization
- [ ] All user inputs are validated at entry points
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Path traversal prevention
- [ ] File upload restrictions

### Authentication & Authorization  
- [ ] Strong password requirements
- [ ] Session management security
- [ ] JWT token validation
- [ ] Role-based access controls
- [ ] Multi-factor authentication where appropriate

### Data Protection
- [ ] Sensitive data encryption at rest
- [ ] TLS/SSL for data in transit
- [ ] Secure key management
- [ ] PII handling compliance
- [ ] Database security configurations

### Infrastructure Security
- [ ] Dependency vulnerability scanning
- [ ] Container security (if applicable)
- [ ] Environment variable protection
- [ ] Error message sanitization
- [ ] Rate limiting implementation

### Compliance & Standards
- [ ] OWASP Top 10 compliance
- [ ] Industry-specific requirements (HIPAA, PCI, etc.)
- [ ] Data retention policies
- [ ] Audit logging

## Analysis Target
${1:-"Current working directory and staged changes"}

Please analyze: $ARGUMENTS