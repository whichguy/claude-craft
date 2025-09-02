# New Feature Development Workflow

Complete workflow for implementing new features with claude-craft integration.

## Phase 1: Planning & Design

### 1. Requirements Analysis
```bash
# Use planning command
/plan feature "User authentication system"

# Document requirements in project memory
vim ~/claude-craft/memory/fragments/auth-requirements.md
```

### 2. API Design (if applicable)
```bash
# Use API design template
/prompts api-design

# Create API specification
/agent-sync push "Add API specification for auth endpoints"
```

### 3. Security Review
```bash
# Security analysis of design
/security auth-design.md

# Document security considerations
/agent-sync push "Add security requirements for auth system"
```

## Phase 2: Implementation

### 1. Test-Driven Development
```bash
# Generate comprehensive tests first
/test AuthService

# Run tests to confirm they fail
npm test

# Implement minimal code to make tests pass
/review AuthService.js
```

### 2. Incremental Development
```bash
# Implement feature incrementally
/agent-sync push "Implement basic auth service"

# Code review after each major component
/review 

# Security scan after implementation
/security src/auth/
```

### 3. Integration Testing
```bash
# Test integration points
/test integration auth-flow

# Performance testing if needed
/test performance auth-endpoints
```

## Phase 3: Quality Assurance

### 1. Comprehensive Review
```bash
# Full code review
/review src/auth/

# Security audit
/security src/auth/

# Performance analysis
/performance auth-system
```

### 2. Documentation
```bash
# Update project memory with implementation details
vim ~/claude-craft/memory/fragments/auth-implementation.md

# API documentation
/prompts api-docs auth-endpoints
```

### 3. Final Testing
```bash
# Full test suite
npm test

# Integration tests
npm run test:integration

# Security tests
npm run test:security
```

## Phase 4: Deployment

### 1. Pre-deployment Checklist
- [ ] All tests passing
- [ ] Security review complete
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Monitoring in place

### 2. Deployment Process
```bash
# Final commit
/agent-sync push "Complete authentication feature implementation"

# Create deployment branch
git checkout -b deploy/auth-feature

# Deploy to staging
/deploy staging

# Production deployment after validation
/deploy production
```

### 3. Post-deployment
```bash
# Monitor metrics
/monitor auth-metrics

# Update memory with lessons learned
vim ~/claude-craft/memory/fragments/auth-lessons-learned.md

# Archive workflow documentation
/agent-sync push "Archive auth feature workflow"
```

## Integration with claude-craft

Throughout this workflow, claude-craft provides:
- **Consistent tooling** via `/agent-sync` commands
- **Reusable templates** via `/prompts`
- **Project memory** for context preservation
- **Custom commands** for domain-specific operations
- **Hook integration** for automated quality checks

This ensures every feature follows the same high-quality development process.