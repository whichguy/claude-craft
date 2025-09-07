# Architecture Specification
## Comprehensive Technology Stack and Implementation Patterns

**VERSION**: 1.0  
**LAST UPDATED**: 2025-01-07  
**MAINTAINED BY**: system-architect agent  
**REFERENCED BY**: feature-developer, ui-designer, qa-analyst, deployment-orchestrator agents

---

## OVERVIEW

This document serves as the **single source of truth** for all architectural decisions, technology choices, implementation patterns, and agent reference materials. All agents must reference this file for consistent implementation.

---

## SECTION 1: ARCHITECTURE DECISION REGISTRY

### Project Context Discovery
- **Project Type**: [To be populated by system-architect based on discovery]
- **Existing Environment**: [Specific technologies found with version/capability analysis]
- **User Complexity Assessment**: [Actual user technical sophistication with evidence]
- **Scale Requirements**: [Realistic volume/performance needs with growth projections]
- **Integration Constraints**: [Existing system integration requirements and limitations]

### Core Architecture Stack (KISS/YAGNI Validated)

#### Authentication Architecture Decision
- **CHOSEN APPROACH**: [Specific implementation with reasoning]
- **EXISTING SYSTEM ANALYSIS**: [What authentication already exists and capabilities]
- **LEVERAGE STRATEGY**: [Exactly how we're extending existing vs replacing]
- **IMPLEMENTATION DETAILS**: [Specific libraries, patterns, configuration approaches]
- **KISS VALIDATION**: [Why this is simplest solution that meets requirements]

#### UI Framework Architecture Decision
- **CHOSEN APPROACH**: [Specific UI framework/approach with reasoning]
- **EXISTING PATTERNS ANALYSIS**: [What UI patterns, components, styling already exist]
- **LEVERAGE STRATEGY**: [How we're building on existing design system/components]
- **IMPLEMENTATION DETAILS**: [Specific framework version, build setup, component patterns]
- **COMPLEXITY JUSTIFICATION**: [Evidence for why this UI complexity level is necessary]

#### API Architecture Decision
- **CHOSEN APPROACH**: [REST/GraphQL/hybrid with specific reasoning]
- **EXISTING INTEGRATION ANALYSIS**: [Current API patterns, endpoints, data flow]
- **LEVERAGE STRATEGY**: [How new API extends existing patterns vs new approaches]
- **IMPLEMENTATION DETAILS**: [Specific framework, serialization, validation, error handling]
- **EVOLUTION STRATEGY**: [How API can grow with changing requirements]
- **PERFORMANCE CHARACTERISTICS**: [Expected response times, throughput, caching strategy]

#### Storage Architecture Decision
- **CHOSEN APPROACH**: [Specific storage solution with reasoning]
- **DATA VOLUME ANALYSIS**: [Realistic current/projected data size with growth curves]
- **QUERY PATTERN ANALYSIS**: [Actual query complexity, frequency, performance needs]
- **EXISTING STORAGE ANALYSIS**: [What storage/database already exists and capabilities]
- **LEVERAGE STRATEGY**: [How we're extending existing storage vs new storage]
- **IMPLEMENTATION DETAILS**: [Specific database, ORM, migration strategy, backup approach]
- **SCALING STRATEGY**: [How storage handles growth - indexing, partitioning, caching]

#### Concurrency & State Management Architecture Decision
- **CHOSEN APPROACH**: [Concurrency level selected with progressive justification]
- **CONCURRENCY ANALYSIS**: [Actual concurrency requirements - single/multi-user, shared state needs]
- **STATE STRATEGY**: [Stateless vs stateful approach with existing session analysis]
- **COMPLEXITY LEVEL**: [Level 1-4 with evidence for why simpler levels insufficient]
- **IMPLEMENTATION DETAILS**: [Specific patterns - async/sync, locking, event handling]
- **ISOLATION STRATEGY**: [How concurrent operations are isolated and managed]

#### Data Validation & Security Architecture Decision
- **CHOSEN APPROACH**: [Security level selected with threat model justification]
- **THREAT MODEL ANALYSIS**: [Actual security risks - internal/public, data sensitivity]
- **VALIDATION STRATEGY**: [Input validation approach with existing auth leverage]
- **SECURITY LEVEL**: [Level 1-4 with evidence for chosen security posture]
- **IMPLEMENTATION DETAILS**: [Specific validation framework, sanitization, encryption]
- **COMPLIANCE REQUIREMENTS**: [Regulatory/compliance needs influencing decisions]

#### Performance & Caching Architecture Decision
- **CHOSEN APPROACH**: [Performance level selected with measurement justification]
- **PERFORMANCE REQUIREMENTS**: [Actual latency/throughput needs with user analysis]
- **CACHING STRATEGY**: [Caching approach with existing infrastructure leverage]
- **PERFORMANCE LEVEL**: [Level 1-4 with evidence for optimization necessity]
- **IMPLEMENTATION DETAILS**: [Specific caching technology, invalidation, monitoring]
- **MEASUREMENT APPROACH**: [How performance will be measured and maintained]

#### Error Handling & Resilience Architecture Decision
- **CHOSEN APPROACH**: [Resilience level selected with failure scenario analysis]
- **FAILURE ANALYSIS**: [Expected failure modes and impact assessment]
- **RECOVERY STRATEGY**: [Error handling approach with user experience focus]
- **RESILIENCE LEVEL**: [Level 1-4 with evidence for complexity justification]
- **IMPLEMENTATION DETAILS**: [Specific error handling, retry logic, circuit breakers]
- **GRACEFUL DEGRADATION**: [How system degrades when components fail]

#### Deployment Architecture Decision
- **CHOSEN APPROACH**: [Deployment approach with reasoning]
- **EXISTING INFRASTRUCTURE ANALYSIS**: [Current deployment, CI/CD, monitoring setup]
- **LEVERAGE STRATEGY**: [How we're using existing deployment infrastructure]
- **IMPLEMENTATION DETAILS**: [Specific deployment tools, environments, rollback strategy]
- **OPERATIONAL COMPLEXITY ASSESSMENT**: [Actual operational burden with mitigation]
- **SCALING APPROACH**: [How deployment scales with usage - load balancing, auto-scaling]

---

## SECTION 2: TEST FRAMEWORK SPECIFICATION

### Test Framework Decision Matrix

#### End-to-End Testing Framework
**DECISION**: Playwright with MCP Server Integration
- **RATIONALE**: Playwright MCP server provides powerful browser automation with Claude Code integration
- **IMPLEMENTATION APPROACH**: Use `mcp__playwright__*` tools for browser automation
- **COVERAGE SCOPE**: User workflows, integration flows, cross-browser compatibility
- **CONFIGURATION**: Headless for CI, headed for debugging, mobile device simulation

#### Unit Testing Framework
**DECISION**: Mocha + Chai (with Sinon for mocking)
- **RATIONALE**: Mocha/Chai provides excellent BDD-style syntax with flexible assertion library
- **IMPLEMENTATION APPROACH**: describe/it/expect patterns with comprehensive test organization
- **COVERAGE SCOPE**: Individual functions, classes, modules with isolation
- **MOCKING STRATEGY**: Sinon for stubs/spies/mocks, avoiding complex mocking frameworks

#### Integration Testing Framework
**DECISION**: Mocha + Chai + Supertest (for API testing)
- **RATIONALE**: Consistent with unit testing framework, Supertest for HTTP assertion
- **IMPLEMENTATION APPROACH**: Test API endpoints, database interactions, service integrations
- **COVERAGE SCOPE**: Component interactions, API contracts, data flow validation
- **DATABASE STRATEGY**: Test database setup/teardown, data seeding approaches

#### Performance Testing Framework (if needed)
**DECISION**: [Evaluate based on performance requirements]
- **LIGHTWEIGHT OPTION**: Artillery for load testing (if performance testing required)
- **PLAYWRIGHT OPTION**: Playwright performance APIs for web performance metrics
- **RATIONALE**: [Decision based on actual performance requirements discovered]

### Test Organization Strategy
```
tests/
├── unit/           # Mocha + Chai unit tests
├── integration/    # Mocha + Chai + Supertest integration tests
├── e2e/           # Playwright end-to-end tests with MCP integration
├── fixtures/      # Test data and fixtures
└── helpers/       # Test utility functions and setup
```

### Quality Gates and Coverage Requirements
- **Unit Test Coverage**: Minimum 80% line coverage for business logic
- **Integration Test Coverage**: All API endpoints and critical data flows
- **E2E Test Coverage**: All major user workflows and critical paths
- **Performance Benchmarks**: [Specific performance criteria based on requirements]

---

## SECTION 3: IMPLEMENTATION PATTERNS

### Authentication Patterns
```javascript
// Authentication Implementation Patterns
// [To be populated based on chosen authentication approach]

// Login endpoint pattern
app.post('/api/auth/login', async (req, res) => {
  // Implementation following chosen authentication strategy
});

// Session management pattern
const authenticateRequest = (req, res, next) => {
  // Middleware implementation
};

// Role-based access control pattern
const requireRole = (roles) => (req, res, next) => {
  // RBAC implementation
};
```

### API Implementation Patterns
```javascript
// API Implementation Patterns
// [To be populated based on chosen API framework]

// Endpoint creation template
app.get('/api/resource/:id', async (req, res) => {
  // Standard endpoint pattern with validation and error handling
});

// Request validation pattern
const validateRequest = (schema) => (req, res, next) => {
  // Validation middleware
};

// Error handling pattern
const handleError = (error, req, res, next) => {
  // Centralized error handling
};
```

### UI Component Patterns
```javascript
// UI Component Patterns
// [To be populated based on chosen UI framework]

// Component creation template
const ComponentTemplate = ({ prop1, prop2, ...props }) => {
  // Component implementation following design system
};

// State management pattern
const useComponentState = () => {
  // State management hook/pattern
};

// Styling pattern
const componentStyles = {
  // Styling approach based on chosen framework
};
```

### Data Access Patterns
```javascript
// Data Access Patterns
// [To be populated based on chosen storage solution]

// Repository pattern
class EntityRepository {
  async create(data) {
    // Create implementation
  }
  
  async findById(id) {
    // Read implementation
  }
  
  async update(id, data) {
    // Update implementation
  }
  
  async delete(id) {
    // Delete implementation
  }
}

// Migration pattern
const migration = {
  up: async (queryInterface, Sequelize) => {
    // Migration up
  },
  down: async (queryInterface, Sequelize) => {
    // Migration down
  }
};
```

### Concurrency & State Management Patterns
```javascript
// Concurrency & State Management Patterns
// [To be populated based on chosen concurrency level]

// Level 1: Stateless Processing Pattern
const processRequest = (input) => {
  // Pure function - no shared state
  return processData(input);
};

// Level 2: Per-Request State Pattern
const handleRequest = (req, res) => {
  const requestState = createRequestContext(req);
  // Process with isolated state
  const result = processWithState(requestState);
  return result;
};

// Level 3: Optimistic Locking Pattern
const updateWithLocking = async (id, data, version) => {
  // Optimistic concurrency control
  const result = await updateIfVersionMatches(id, data, version);
  if (!result.success) {
    throw new ConflictError('Resource modified by another user');
  }
  return result;
};

// Level 4: Event Sourcing Pattern (if chosen)
const processEvent = (event) => {
  // Event-driven state management
  return applyEvent(getCurrentState(), event);
};
```

### Data Validation & Security Patterns
```javascript
// Data Validation & Security Patterns
// [To be populated based on chosen security level]

// Level 1: Basic Input Sanitization
const sanitizeInput = (input) => {
  // Basic HTML escaping and validation
  return escapeHtml(input.trim());
};

// Level 2: Schema Validation Pattern
const validateRequest = (data, schema) => {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new ValidationError(error.details);
  }
  return value;
};

// Level 3: Comprehensive Security Pattern
const secureEndpoint = (req, res, next) => {
  // Rate limiting, input validation, auth
  if (!rateLimiter.check(req.ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  validateAndSanitize(req.body);
  next();
};

// Level 4: Zero-Trust Pattern (if needed)
const zeroTrustValidation = (request) => {
  // Comprehensive validation for high-security
  return validateEveryInput(request);
};
```

### Performance & Caching Patterns
```javascript
// Performance & Caching Patterns
// [To be populated based on chosen performance level]

// Level 1: No Cache - Direct Operations
const getData = async (id) => {
  return await database.findById(id);
};

// Level 2: In-Memory Caching Pattern
const getCachedData = async (id) => {
  const cached = memoryCache.get(id);
  if (cached) return cached;
  
  const data = await database.findById(id);
  memoryCache.set(id, data, TTL);
  return data;
};

// Level 3: Distributed Caching Pattern
const getDistributedCachedData = async (id) => {
  const cached = await redis.get(`data:${id}`);
  if (cached) return JSON.parse(cached);
  
  const data = await database.findById(id);
  await redis.setex(`data:${id}`, TTL, JSON.stringify(data));
  return data;
};

// Level 4: Advanced Cache with Warming (if needed)
const getAdvancedCachedData = async (id) => {
  // Complex cache warming and invalidation
  return await advancedCacheManager.get(id);
};
```

### Error Handling & Resilience Patterns
```javascript
// Error Handling & Resilience Patterns
// [To be populated based on chosen resilience level]

// Level 1: Basic Error Handling
const basicErrorHandler = (error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
};

// Level 2: Graceful Error Handling with Retry
const withRetry = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
};

// Level 3: Circuit Breaker Pattern
class CircuitBreaker {
  constructor(threshold = 5, resetTime = 60000) {
    this.threshold = threshold;
    this.resetTime = resetTime;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }
    // Circuit breaker logic
  }
}

// Level 4: Advanced Resilience (if needed)
const advancedResilienceHandler = async (operation) => {
  // Complex resilience with bulkhead, timeout, etc.
  return await resilienceManager.execute(operation);
};
```

---

## SECTION 4: TESTING PATTERNS

### Unit Test Patterns
```javascript
// Unit Testing Patterns using Mocha + Chai

describe('ComponentName', () => {
  beforeEach(() => {
    // Test setup
  });

  afterEach(() => {
    // Test cleanup
  });

  it('should handle expected behavior', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).to.equal('expected output');
  });

  it('should handle error conditions', () => {
    // Error condition testing
    expect(() => functionWithError()).to.throw('Expected error message');
  });
});
```

### Integration Test Patterns
```javascript
// Integration Testing Patterns using Mocha + Chai + Supertest

describe('API Integration Tests', () => {
  before(async () => {
    // Test database setup
    await setupTestDatabase();
  });

  after(async () => {
    // Test database cleanup
    await cleanupTestDatabase();
  });

  describe('POST /api/resource', () => {
    it('should create resource successfully', async () => {
      const response = await request(app)
        .post('/api/resource')
        .send({ name: 'Test Resource' })
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal('Test Resource');
    });
  });
});
```

### End-to-End Test Patterns
```javascript
// E2E Testing Patterns using Playwright MCP Integration

// E2E test example using Playwright MCP tools
const testUserWorkflow = async () => {
  // Use mcp__playwright__browser_navigate
  await navigateToPage('/login');
  
  // Use mcp__playwright__browser_type
  await fillLoginForm('user@example.com', 'password');
  
  // Use mcp__playwright__browser_click
  await clickLoginButton();
  
  // Use mcp__playwright__browser_snapshot
  const snapshot = await takeSnapshot();
  
  // Validate expected state
  validateUserLoggedIn(snapshot);
};
```

---

## SECTION 5: DEPLOYMENT PATTERNS

### Build Configuration
```json
// Build configuration based on chosen technology stack
{
  "scripts": {
    "build": "[Build command based on technology choice]",
    "test": "mocha tests/**/*.test.js",
    "test:integration": "mocha tests/integration/**/*.test.js",
    "test:e2e": "playwright test",
    "test:coverage": "nyc mocha tests/**/*.test.js"
  }
}
```

### Environment Configuration
```javascript
// Environment configuration pattern
const config = {
  development: {
    // Development environment settings
  },
  test: {
    // Test environment settings
  },
  production: {
    // Production environment settings
  }
};
```

### Deployment Configuration
```yaml
# Deployment configuration based on chosen infrastructure
# [To be populated based on deployment architecture decision]
version: '1.0'
deploy:
  # Deployment steps following chosen approach
```

---

## SECTION 6: SECURITY PATTERNS

### Authentication Security Patterns
```javascript
// Security patterns for authentication implementation
// [To be populated based on security requirements and chosen auth approach]

const securePasswordHash = (password) => {
  // Password hashing implementation
};

const validateSession = (sessionToken) => {
  // Session validation implementation
};

const rateLimit = {
  // Rate limiting configuration
};
```

### Data Security Patterns
```javascript
// Data security and validation patterns
// [To be populated based on data sensitivity and compliance requirements]

const sanitizeInput = (input) => {
  // Input sanitization
};

const validateSchema = (data, schema) => {
  // Schema validation
};

const auditLog = (action, user, resource) => {
  // Audit logging
};
```

---

## SECTION 7: PERFORMANCE PATTERNS

### Caching Strategies
```javascript
// Caching implementation patterns
// [To be populated based on performance requirements]

const cacheStrategy = {
  // Caching configuration and patterns
};
```

### Database Optimization
```sql
-- Database optimization patterns
-- [To be populated based on storage architecture decisions]

-- Index strategies
-- Query optimization patterns
-- Performance monitoring queries
```

---

## SECTION 8: MONITORING AND OBSERVABILITY

### Logging Patterns
```javascript
// Logging implementation patterns
// [To be populated based on operational requirements]

const logger = {
  info: (message, context) => {
    // Info logging
  },
  error: (message, error, context) => {
    // Error logging
  },
  performance: (metric, value) => {
    // Performance metric logging
  }
};
```

### Health Check Patterns
```javascript
// Health check implementation
// [To be populated based on deployment architecture]

const healthCheck = {
  // Health check endpoints and monitoring
};
```

---

## SECTION 9: AGENT REFERENCE GUIDE

### For feature-developer Agent
- **Authentication**: Reference Section 3 Authentication Patterns
- **API Implementation**: Reference Section 3 API Implementation Patterns  
- **Data Access**: Reference Section 3 Data Access Patterns
- **Testing**: Reference Section 4 Unit and Integration Test Patterns
- **Security**: Reference Section 6 Security Patterns

### For ui-designer Agent
- **UI Framework**: Reference Section 1 UI Framework Architecture Decision
- **Component Patterns**: Reference Section 3 UI Component Patterns
- **Testing**: Reference Section 4 E2E Test Patterns (for UI testing)
- **Performance**: Reference Section 7 Performance Patterns (for UI optimization)

### For qa-analyst Agent
- **Test Framework**: Reference Section 2 Test Framework Specification
- **Testing Patterns**: Reference Section 4 (All Testing Patterns)
- **Quality Gates**: Reference Section 2 Quality Gates and Coverage Requirements
- **Performance Testing**: Reference Section 2 Performance Testing Framework

### For deployment-orchestrator Agent
- **Deployment Architecture**: Reference Section 1 Deployment Architecture Decision
- **Build Configuration**: Reference Section 5 Build Configuration
- **Environment Setup**: Reference Section 5 Environment Configuration
- **Monitoring**: Reference Section 8 Monitoring and Observability

---

## SECTION 9.5: ARCHITECTURE DECISION EVOLUTION AND REHYDRATION

### Decision Rehydration Process

When system-architect is invoked multiple times, it follows this rehydration approach to build upon existing decisions rather than starting from scratch:

#### Rehydration Status Categories
```markdown
FRESH DECISION: No previous decision exists or decision is marked "[To be populated]"
  → Apply full progressive decision matrix (Level 1-4) with current requirements
  
EVOLUTION DECISION: Decision exists but is outdated (>30 days) or requirements changed
  → Validate against current requirements, update complexity level if justified
  
REFINEMENT DECISION: Decision is recent and populated but lacks detail
  → Elaborate implementation details, add missing patterns, optimize existing choices
  
VALIDATION DECISION: Decision is comprehensive and current  
  → Confirm still appropriate, document any new considerations, validate patterns
```

#### Decision Evolution Patterns

**Authentication Evolution:**
```javascript
// Evolution from basic to comprehensive auth
// Level 1 → Level 2 Evolution
if (existingAuth.level === 1 && newRequirements.multiUser === true) {
  evolveAuthentication({
    from: "basic login",
    to: "session management + roles",
    preserving: "existing login flow",
    adding: "role-based access control"
  });
}

// Level 2 → Level 3 Evolution  
if (existingAuth.level === 2 && newRequirements.enterprise === true) {
  evolveAuthentication({
    from: "session + roles",
    to: "SSO integration",
    preserving: "existing role system",
    adding: "SAML/OAuth integration"
  });
}
```

**Storage Evolution:**
```javascript
// Evolution from simple to scalable storage
// Level 1 → Level 2 Evolution
if (existingStorage.level === 1 && currentDataVolume > 100000) {
  evolveStorage({
    from: "file-based storage",
    to: "database with indexing", 
    migration: "data migration script",
    preserving: "existing data structure"
  });
}

// Level 2 → Level 3 Evolution
if (existingStorage.level === 2 && performanceIssues.detected === true) {
  evolveStorage({
    from: "single database",
    to: "read replicas + caching",
    preserving: "existing queries", 
    adding: "cache layer + read scaling"
  });
}
```

#### Elaboration Opportunities Template

```markdown
### ELABORATION ASSESSMENT for [Decision Area]

**Current State**: [Level X - Brief description]
**Implementation Status**: [Not started|Partially implemented|Fully implemented]
**Last Updated**: [Date]

**Elaboration Opportunities**:
- [ ] **Implementation Details**: Add specific library versions, configuration examples
- [ ] **Integration Patterns**: Define how this integrates with other system components  
- [ ] **Error Handling**: Add specific error scenarios and recovery patterns
- [ ] **Performance Characteristics**: Define expected performance metrics and optimization
- [ ] **Security Considerations**: Add security patterns specific to this decision
- [ ] **Testing Strategies**: Define testing approach for this architectural choice
- [ ] **Monitoring/Observability**: Add monitoring and alerting for this component
- [ ] **Documentation**: Create implementation guides and troubleshooting docs

**Priority**: [High|Medium|Low] based on implementation timeline and dependencies
```

#### User Confirmation Integration

Before implementing evolved decisions, present major changes to user:

```markdown
# ARCHITECTURE EVOLUTION CONFIRMATION

## EXISTING DECISIONS BEING EVOLVED

### [Decision Area] - Evolution from Level X to Level Y
**Current Approach**: [Description of what exists today]
**Proposed Evolution**: [Description of proposed changes]
**Trigger**: [Why evolution is needed - requirements change, performance issue, etc.]

**Evolution Impact**:
- **Code Changes Required**: [Estimate of implementation effort]
- **Data Migration**: [Any data migration needed] 
- **Downtime**: [Expected downtime for changes]
- **Risk Assessment**: [Risks of evolution vs staying current]
- **Rollback Plan**: [How to revert if evolution fails]

**Evolution vs Fresh Decision**:
- **✅ Preserving**: [What we keep from existing approach]
- **🔄 Evolving**: [What we're changing/improving]
- **➕ Adding**: [What new capabilities we're adding]

## USER CONFIRMATION REQUIRED
1. **APPROVE EVOLUTION**: Proceed with proposed evolution approach
2. **MODIFY EVOLUTION**: Adjust specific aspects of evolution
3. **FRESH DECISION**: Discard existing and make fresh decision  
4. **POSTPONE EVOLUTION**: Keep existing decision, revisit later
```

### Decision Continuity Validation

Ensure evolved decisions maintain system coherence:

```bash
# Validate decision evolution maintains system integrity
validate_decision_continuity() {
    local decision_area="$1"
    local old_level="$2" 
    local new_level="$3"
    
    # Check for breaking changes
    if [ "$new_level" -lt "$old_level" ]; then
        echo "⚠️ WARNING: Downgrading complexity level - validate compatibility"
    fi
    
    # Check integration points
    validate_integration_compatibility "$decision_area" "$new_level"
    
    # Check implementation dependencies
    validate_implementation_dependencies "$decision_area" "$new_level"
    
    # Check team capability alignment
    validate_team_capability_alignment "$decision_area" "$new_level"
}
```

---

## SECTION 10: MAINTENANCE AND UPDATES

### Architecture Evolution Process
1. **Change Proposal**: Document proposed architecture changes
2. **Impact Analysis**: Assess impact on existing patterns and implementations
3. **Agent Notification**: Update this file and notify all dependent agents
4. **Implementation**: Execute changes following established patterns
5. **Validation**: Verify changes work as intended across all components

### Version Control
- This file is the authoritative source for all architecture decisions
- All agents must check this file before making implementation decisions
- Changes to this file must be coordinated across all dependent agents
- Version history is maintained through git commits

---

**END OF SPECIFICATION**

*This architecture specification is maintained by the system-architect agent and referenced by all other agents for consistent implementation. Any changes to architectural decisions must be reflected in this document first.*