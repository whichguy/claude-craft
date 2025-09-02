---
argument-hint: "[context...]"
description: "Code review with intent-based analysis"
allowed-tools: "all"
---

# Code Review Analysis

<prompt-context>

## Intent Analysis
Parse the context to determine review focus:
- "security" → Security vulnerabilities, auth, injection risks
- "performance" → Algorithm complexity, memory usage, optimization
- "style" → Code conventions, readability, maintainability
- "bugs" → Logic errors, edge cases, null checks
- "all" or no specific focus → Comprehensive review

## Review Execution

Based on detected intent, analyze code for:

**Security Focus:**
- SQL/command injection vulnerabilities
- Authentication/authorization issues
- Sensitive data exposure
- Input validation gaps

**Performance Focus:**
- O(n) complexity issues
- Memory leaks or excessive allocation
- Database query optimization
- Caching opportunities

**Style Focus:**
- Naming conventions
- Code duplication
- Function length and complexity
- Comment quality

**Bug Focus:**
- Null/undefined handling
- Race conditions
- Error handling gaps
- Edge case coverage

## Output Format

Return findings in this structure:
```
🔍 [ISSUE TYPE]: Brief description
   Line X: Specific problem
   Fix: Recommended solution
```

Group by severity: Critical → High → Medium → Low

NO introduction, NO summary, JUST the findings.