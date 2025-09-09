# Requirements Generator

## Iterative Discovery Engine Parameters

**Target Iterations**: Minimum 9 cycles, maximum 50 cycles
**Convergence Criteria**: Discovery rate < 10% for 2 consecutive iterations
**Quality Gates**: Each phase must achieve >85% completeness before proceeding
**Traceability**: Track requirement genealogy back to originating use cases and discovery methods

## Phase 1: Use Case Analysis & Classification

**Parse the provided use cases** from `<prompt-content>` and systematically analyze each one:

1. **Extract core functionality** described in each use case
   - **Example**: "Users need to upload files" → Core function: file upload capability
   - **Do**: Focus on the essential action being performed
   - **Don't**: Get distracted by implementation details mentioned in the use case

2. **Identify user personas** and their specific needs
   - **Example**: "Administrators need bulk user management" vs "End users need profile updates"
   - **Do**: Distinguish between different user types and their unique requirements
   - **Don't**: Assume all users have the same needs or permissions

3. **Classify use cases by domain**: 
   - **Examples**: UI/UX (user interactions), backend services (data processing), integrations (API connections), security (authentication), performance (speed/scale)
   - **Do**: Categorize broadly to understand system scope
   - **Don't**: Force use cases into rigid categories - some may span multiple domains

4. **Determine complexity levels**: 
   - **Simple**: Single component change (add field to form)
   - **Moderate**: Multiple components (new feature with database + UI + API)
   - **Complex**: System-wide changes (authentication overhaul)
   - **Do**: Assess impact scope realistically
   - **Don't**: Underestimate complexity of seemingly simple requests

5. **Map relationships** between use cases to identify dependencies and interaction points
   - **Example**: "User registration" must come before "user profile management"
   - **Do**: Look for logical sequences and prerequisite relationships
   - **Don't**: Treat use cases as completely independent when they're not

## Phase 1.5: Multi-Lens Use Case Discovery

**Apply systematic analytical lenses to uncover implicit use cases** (iterate until convergence):

### Lens 1: Actor Analysis
- **Primary Actors**: End users, administrators, system operators
- **Secondary Actors**: External systems, background processes, maintenance tools
- **Edge Case Actors**: Emergency responders, auditors, compliance checkers
- **Do**: Consider all possible interaction points with the system
- **Don't**: Focus only on primary user workflows

### Lens 2: Data Flow Analysis  
- **Data Sources**: Where does information originate (users, files, APIs, sensors)?
- **Transformations**: How is data processed, validated, enriched, aggregated?
- **Storage Points**: Temporary buffers, permanent storage, caches, logs
- **Output Destinations**: Reports, notifications, API responses, file exports
- **Do**: Trace complete data lifecycle from source to destination
- **Don't**: Assume data magically appears or disappears

### Lens 3: Temporal Analysis
- **System Lifecycle**: Installation, configuration, normal operation, maintenance, upgrades, decommissioning
- **Session Lifecycle**: Login, active use, idle time, session expiry, logout
- **Data Lifecycle**: Creation, modification, archival, deletion, backup/restore
- **Business Cycles**: Daily operations, weekly reports, monthly processing, annual audits
- **Do**: Consider time-based triggers and scheduled operations
- **Don't**: Focus only on immediate user-initiated actions

### Lens 4: Error Analysis
- **Input Errors**: Invalid data, missing fields, format violations
- **System Errors**: Network failures, database unavailability, resource exhaustion
- **Integration Errors**: External API failures, timeout conditions, authentication failures
- **Business Rule Violations**: Insufficient permissions, policy violations, constraint failures
- **Do**: Consider comprehensive error scenarios and recovery mechanisms
- **Don't**: Assume happy path scenarios only

### Lens 5: Integration Analysis
- **Upstream Dependencies**: Systems that provide data or services to this system
- **Downstream Consumers**: Systems that receive data or services from this system  
- **Synchronization Points**: Real-time updates, batch processing, event-driven communication
- **Protocol Requirements**: REST APIs, message queues, file transfers, database connections
- **Do**: Map complete integration ecosystem and data flow patterns
- **Don't**: Treat the system as isolated or self-contained

### Lens 6: Platform Analysis
- **Device Variations**: Desktop, mobile, tablet interfaces with different capabilities
- **Browser Differences**: Feature support, performance characteristics, security models
- **Network Conditions**: High-speed, mobile, offline, intermittent connectivity
- **Environment Differences**: Development, staging, production configurations
- **Do**: Design for platform diversity and graceful degradation
- **Don't**: Assume single target platform or optimal conditions

### Lens 7: Scale Analysis
- **User Scale**: Single user, small team, department, enterprise, public access
- **Data Volume**: Records, file sizes, concurrent operations, historical data
- **Geographic Distribution**: Local, regional, national, global deployments
- **Load Patterns**: Peak usage, seasonal variations, growth trajectories
- **Do**: Consider scalability requirements at multiple dimensions
- **Don't**: Design only for current scale without growth planning

### Lens 8: Compliance Analysis  
- **Data Protection**: GDPR, CCPA, HIPAA, industry-specific privacy requirements
- **Security Standards**: ISO 27001, SOC 2, PCI DSS, government regulations
- **Accessibility**: WCAG guidelines, ADA compliance, assistive technology support
- **Industry Standards**: Domain-specific regulations and best practices
- **Do**: Research applicable compliance requirements early in discovery
- **Don't**: Defer compliance considerations to implementation phase

### Lens 9: Lifecycle Analysis
- **Installation**: System setup, configuration, initial data migration
- **Operation**: Normal use patterns, maintenance tasks, monitoring
- **Evolution**: Updates, feature additions, configuration changes
- **Migration**: Data imports/exports, system transitions, legacy integrations
- **Decommissioning**: Data extraction, archival, secure deletion
- **Do**: Plan for complete system lifecycle management
- **Don't**: Focus only on steady-state operation

**Convergence Check**: After applying all lenses, count newly discovered use cases. If discovery rate is <15% compared to previous iteration, proceed to Phase 2. Otherwise, apply lenses again with deeper analysis.

## Phase 2: Stated Requirements Conversion

**Transform each use case into explicit functional requirements**:

1. **Convert narrative descriptions** into precise "The system shall..." statements
   - **Example**: "Users want to search for products" → "The system shall provide a search interface that accepts text input and returns filtered product results"
   - **Do**: Use active, specific language with clear actors and actions
   - **Don't**: Leave requirements vague or ambiguous ("system should be user-friendly")

2. **Extract user interactions** and define expected system responses
   - **Example**: User clicks "Save" → System validates data → Shows success message OR error details
   - **Do**: Define complete interaction flows with all possible outcomes
   - **Don't**: Assume happy path only - include error scenarios

3. **Identify data inputs and outputs** with validation requirements
   - **Example**: Email field → Must validate format, check uniqueness, return specific error messages
   - **Do**: Specify validation rules, formats, and constraints explicitly
   - **Don't**: Assume standard validations without documenting them

4. **Define business rules** and logic constraints explicitly
   - **Example**: "Only account owners can delete accounts" → Authorization requirement
   - **Do**: Extract implicit business logic and make it explicit
   - **Don't**: Bury business rules within technical descriptions

5. **Specify error handling** and edge case behaviors
   - **Example**: Network timeout → Show retry option, save draft locally
   - **Do**: Consider what happens when things go wrong
   - **Don't**: Focus only on success scenarios

6. **Document integration touchpoints** with external systems
   - **Example**: "Send notification" → Requires email service integration with specific API calls
   - **Do**: Identify all external dependencies early
   - **Don't**: Assume integrations are trivial implementation details

## Phase 3: Technology Research & Dependencies

**Research and specify technical implementation requirements**:

1. **Identify required technology stack** components based on functional needs
2. **Determine database requirements**: schema changes, query patterns, performance needs
3. **Analyze API dependencies**: external services, authentication, rate limits
4. **Specify frontend frameworks** and UI component libraries needed
5. **Identify development tools**: testing frameworks, build systems, deployment pipelines
6. **Research security libraries** and authentication mechanisms required
7. **Document operational requirements**: monitoring, logging, backup strategies

## Phase 4: Iterative Non-Functional Requirements (NFR) Derivation Engine

**Execute systematic NFR discovery cycles** (minimum 9 cycles, maximum 50):

### NFR Cycle 1: Core Performance Requirements
**Derive performance NFRs from functional requirements**:
- **Response Time**: Maximum acceptable delays for user interactions
- **Throughput**: Transactions, requests, or operations per second/minute/hour
- **Resource Usage**: CPU, memory, disk, network bandwidth consumption limits
- **Concurrent Users**: Maximum simultaneous user capacity
- **Data Processing**: Batch job completion times, real-time processing latencies
- **Example**: "File upload function" → "File uploads shall complete within 30 seconds for files up to 100MB"
- **Cross-Reference**: Link each NFR back to specific functional requirements

### NFR Cycle 2: Scalability & Growth Requirements  
**Analyze functional requirements for scalability implications**:
- **Horizontal Scaling**: Multi-server deployment, load distribution patterns
- **Vertical Scaling**: Resource upgrade paths, hardware limitations
- **Data Growth**: Storage expansion, archival strategies, partitioning needs
- **User Growth**: Capacity planning, performance degradation thresholds
- **Geographic Scaling**: Multi-region deployment, content delivery networks
- **Example**: "User management system" → "System shall support 10x user growth (10K to 100K users) without architectural changes"
- **Dependency Analysis**: How scaling affects previously identified performance NFRs

### NFR Cycle 3: Security & Privacy Requirements
**Extract security NFRs from functional and data requirements**:
- **Authentication**: Multi-factor, SSO, session management, password policies
- **Authorization**: Role-based access, permissions, privilege escalation protection
- **Data Protection**: Encryption at rest/transit, PII handling, data masking
- **Audit Trails**: Security event logging, compliance reporting, forensic capabilities
- **Threat Protection**: Input validation, SQL injection, XSS, CSRF protection
- **Example**: "User profile management" → "Profile data shall be encrypted using AES-256 and accessible only to authorized users"
- **Security Model**: How security requirements interact with performance and usability

### NFR Cycle 4: Reliability & Availability Requirements
**Derive reliability NFRs from business criticality analysis**:
- **Uptime Targets**: SLA commitments, planned vs unplanned downtime
- **Fault Tolerance**: Component failure handling, graceful degradation
- **Disaster Recovery**: Backup strategies, recovery time/point objectives
- **Health Monitoring**: System health checks, alerting, automated recovery
- **Data Integrity**: Consistency guarantees, corruption detection, repair mechanisms
- **Example**: "Payment processing" → "Payment system shall maintain 99.9% uptime with <4 hours recovery time"
- **Impact Analysis**: How reliability requirements affect performance and scalability

### NFR Cycle 5: Usability & Accessibility Requirements
**Extract user experience NFRs from interface and interaction requirements**:
- **Accessibility Standards**: WCAG 2.1 AA compliance, screen reader support, keyboard navigation
- **User Experience**: Task completion times, error rates, user satisfaction metrics
- **Interface Design**: Responsive design, mobile optimization, cross-browser compatibility
- **Localization**: Multi-language support, cultural adaptations, timezone handling
- **Help & Support**: Documentation, in-app guidance, error messaging clarity
- **Example**: "Search function" → "Search results shall appear within 2 seconds with clear relevance ranking"
- **User Impact**: How usability interacts with performance and reliability requirements

### NFR Cycle 6: Maintainability & Supportability Requirements
**Derive maintenance NFRs from system complexity and lifecycle needs**:
- **Code Quality**: Static analysis standards, complexity metrics, documentation coverage
- **Debugging Support**: Logging levels, diagnostic tools, performance profiling
- **Update Mechanisms**: Deployment automation, rollback capabilities, zero-downtime updates
- **Configuration Management**: Environment separation, feature toggles, A/B testing
- **Monitoring & Observability**: Application metrics, business KPIs, alert management
- **Example**: "Data processing pipeline" → "All processing steps shall log execution times and error details for troubleshooting"
- **Operational Impact**: How maintainability affects reliability and performance

### NFR Cycle 7: Compliance & Legal Requirements
**Identify regulatory NFRs from data handling and business operations**:
- **Data Protection Laws**: GDPR, CCPA, HIPAA data handling requirements
- **Industry Standards**: PCI DSS, SOX, ISO certifications, sector-specific regulations
- **Accessibility Laws**: ADA compliance, regional accessibility standards
- **Audit Requirements**: Record keeping, reporting capabilities, evidence preservation
- **International Compliance**: Cross-border data transfer, local regulation compliance
- **Example**: "User data collection" → "System shall provide GDPR-compliant data export and deletion within 30 days"
- **Compliance Stack**: How compliance requirements layer on security and privacy

### NFR Cycle 8: Operational & DevOps Requirements
**Extract operational NFRs from deployment and management needs**:
- **Deployment Automation**: CI/CD pipeline requirements, automated testing gates
- **Environment Management**: Development, staging, production isolation and promotion
- **Backup & Recovery**: Automated backup schedules, restoration procedures, data validation
- **Capacity Planning**: Resource monitoring, auto-scaling triggers, capacity alerts
- **Incident Management**: Error tracking, escalation procedures, post-mortem processes
- **Example**: "Database operations" → "Database backups shall run nightly with 4-week retention and 15-minute restoration capability"
- **Operational Stack**: How DevOps requirements support reliability and maintainability

### NFR Cycle 9: Integration & Interoperability Requirements
**Derive integration NFRs from external system interactions**:
- **API Compatibility**: Versioning strategies, backward compatibility, deprecation policies  
- **Data Exchange**: Format standards, transformation requirements, validation rules
- **Protocol Support**: REST, GraphQL, message queues, real-time communication
- **Service Dependencies**: External service SLAs, fallback strategies, circuit breakers
- **Standards Compliance**: Industry data formats, communication protocols, integration patterns
- **Example**: "Third-party payment integration" → "Payment API shall support retry logic with exponential backoff for network failures"
- **Integration Impact**: How external dependencies affect internal performance and reliability

### NFR Cycle 10: Business Continuity & Risk Requirements  
**Identify business continuity NFRs from risk analysis**:
- **Business Impact Analysis**: Critical functions, maximum tolerable downtime, recovery priorities
- **Risk Mitigation**: Single points of failure, redundancy requirements, failover procedures  
- **Data Loss Prevention**: Backup frequency, replication strategies, consistency guarantees
- **Emergency Procedures**: Manual overrides, emergency contacts, escalation procedures
- **Insurance & Compliance**: Risk coverage, regulatory reporting, audit trail preservation
- **Example**: "Order processing system" → "Order data shall be replicated across 3 geographic regions with <1 hour synchronization"
- **Business Alignment**: How technical NFRs map to business risk tolerance

### NFR Cycle 11: Cross-Cutting & Emergent Requirements
**Analyze interactions between previous NFR cycles to discover emergent requirements**:
- **Performance vs Security Trade-offs**: Encryption overhead, authentication delays
- **Scalability vs Compliance Conflicts**: Data residency vs geographic scaling
- **Reliability vs Maintainability Balance**: Complexity of high-availability vs operational simplicity  
- **Cost vs Performance Optimization**: Resource usage vs response time requirements
- **Usability vs Security Tensions**: Convenience vs security controls
- **Example**: "Real-time chat + GDPR compliance" → "Chat messages shall be encrypted end-to-end while supporting right-to-deletion within 24 hours"
- **Conflict Resolution**: Document trade-offs and decisions for stakeholder approval

### NFR Cycle 12+: Adaptive Discovery & Validation
**Continue iterating until convergence criteria are met**:
- **Gap Analysis**: Compare derived NFRs against industry benchmarks and best practices
- **Stakeholder Validation**: Verify NFRs align with business expectations and constraints  
- **Feasibility Assessment**: Ensure technical achievability within budget and timeline constraints
- **Priority Refinement**: Rank NFRs by business impact, technical risk, and implementation effort
- **Dependency Mapping**: Create detailed dependency matrix between functional and non-functional requirements
- **Convergence Check**: If <10% new NFRs discovered in this cycle compared to previous, proceed to Phase 5
- **Quality Gate**: Ensure >85% of functional requirements have derived NFRs before proceeding

**NFR Iteration Control**:
- Track discovery rate: (New NFRs in cycle / Total NFRs before cycle) × 100%
- Continue cycles until discovery rate <10% for 2 consecutive cycles  
- Maximum 50 total NFR cycles to prevent infinite iteration
- Document rationale for each NFR linking back to originating functional requirements

## Phase 5: Hidden Requirements Discovery

**Uncover implicit and undeclared requirements** by systematically checking these common areas:

1. **Audit trail requirements**: Who changed what, when, and why tracking
   - **Example**: User profile changes → Need change history, rollback capability
   - **Do**: Consider regulatory and compliance needs for data tracking
   - **Don't**: Add audit trails everywhere - focus on sensitive data and operations

2. **Data migration needs**: Existing data transformation and preservation
   - **Example**: New user table structure → Need migration scripts for existing users
   - **Do**: Plan for data transformation and backup strategies
   - **Don't**: Assume fresh start - consider existing data impact

3. **Backward compatibility**: Legacy system integration and API versioning
   - **Example**: API changes → Need versioning strategy to avoid breaking existing clients
   - **Do**: Plan deprecation timelines and migration paths
   - **Don't**: Break existing functionality without transition planning

4. **Internationalization**: Multi-language support, timezone handling, currency formatting
   - **Example**: Global user base → Need locale-specific formatting and translations
   - **Do**: Consider cultural and regional differences early
   - **Don't**: Assume English-only or single timezone usage

5. **Mobile responsiveness**: Touch interfaces, offline capabilities, app store requirements
   - **Example**: File upload feature → Need mobile-friendly interface and offline queuing
   - **Do**: Design for multiple device types and connection states
   - **Don't**: Treat mobile as afterthought or simple responsive CSS

6. **Administrative functions**: User management, system configuration, bulk operations
   - **Example**: User registration system → Need admin tools for user management, bulk imports
   - **Do**: Consider operational needs for managing the system at scale
   - **Don't**: Focus only on end-user features - admins need tools too

7. **Reporting and analytics**: Business intelligence, usage metrics, compliance reporting
   - **Example**: E-commerce system → Need sales reports, inventory tracking, tax reporting
   - **Do**: Identify business intelligence needs early
   - **Don't**: Build reporting as pure afterthought - design for data collection

8. **Integration hooks**: Webhook support, event publishing, third-party connectors
   - **Example**: User actions → May need to trigger external systems or notifications
   - **Do**: Design for extensibility and integration from the start
   - **Don't**: Build isolated systems - consider ecosystem integration needs

9. **Development and testing**: Mock services, test data generation, staging environments
   - **Example**: Payment processing → Need test modes, mock services, staging environment
   - **Do**: Plan development infrastructure as part of requirements
   - **Don't**: Assume development needs will be handled separately

## Phase 6: Consolidation & Deduplication

**Organize and refine the complete requirements set**:

1. **Group related requirements** into logical modules and components
2. **Eliminate duplicate requirements** across different phases
3. **Resolve conflicting requirements** through priority analysis
4. **Standardize requirement language** and formatting consistency
5. **Assign unique identifiers** to each requirement for traceability
6. **Establish requirement priorities**: must-have, should-have, nice-to-have
7. **Create requirement traceability matrix** linking back to original use cases

## Phase 7: Final Validation & Quality Assurance

**Ensure completeness and consistency of requirements**:

1. **Validate mapping** - Confirm every use case maps to specific requirements
2. **Check completeness** - Verify no functional gaps or missing user journeys
3. **Assess feasibility** - Ensure requirements are technically achievable within constraints
4. **Review dependencies** - Confirm all prerequisite requirements are identified
5. **Validate NFR alignment** - Ensure non-functional requirements support functional goals
6. **Test scenario coverage** - Verify requirements enable comprehensive testing strategies
7. **Stakeholder review readiness** - Confirm requirements are clear and unambiguous

## Phase 8: Implementation Specification Output

**Generate LLM-optimized requirements for feature-developer consumption**:

### Requirements Format with Traceability:
```
# [Module Name] Requirements

## Functional Requirements
- REQ-F-001: [Clear, actionable requirement statement]
  - **Source**: Use Case UC-001 (Phase 1)
  - **Discovery Method**: Actor Analysis (Phase 1.5, Lens 1)
  - **Dependencies**: REQ-T-003, REQ-N-002
  - **Acceptance Criteria**: [Specific, testable conditions]
  - **Priority**: Must-have | Should-have | Nice-to-have
  - **Risk Level**: Low | Medium | High

## Non-Functional Requirements  
- REQ-N-001: [Specific, measurable performance/quality requirement]
  - **Source**: REQ-F-001 (Phase 4, NFR Cycle 1)
  - **Discovery Method**: Performance Analysis → User interaction flow
  - **Metrics**: [Specific measurable criteria with thresholds]
  - **Testing Strategy**: [How this will be validated]
  - **Trade-offs**: [Conflicts with other requirements]

## Technical Requirements
- REQ-T-001: [Specific technology, library, or framework requirement]
  - **Source**: REQ-F-001, REQ-N-001 (Phase 3)
  - **Discovery Method**: Technology Research → Database analysis  
  - **Justification**: [Why this technology was selected]
  - **Constraints**: [Version requirements, compatibility notes]
  - **Alternatives**: [Other options considered and why rejected]

## Requirement Genealogy Matrix
| Requirement | Original Use Case | Discovery Path | Dependencies | Conflicts |
|-------------|------------------|----------------|--------------|-----------|
| REQ-F-001   | UC-001          | Phase 1 → 1.5 (Lens 1) | REQ-T-003 | None |
| REQ-N-001   | REQ-F-001       | Phase 4 (Cycle 1) | REQ-F-001 | REQ-N-005 |

## Implementation Notes
- **Architecture Patterns**: [Patterns that emerged from requirements analysis]
- **Security Considerations**: [Requirements-driven security decisions]  
- **Testing Strategies**: [Test approaches for each requirement category]
- **Development Workflow**: [Process requirements derived from complexity analysis]
- **Risk Mitigation**: [High-risk requirements and mitigation strategies]
```

## Enhanced Process Flow with Feedback Loops

```mermaid
flowchart TD
    A[Use Cases Input] --> B[Phase 1: Parse & Classify]
    B --> B_CHECK{Quality Gate:<br/>85% Completeness?}
    B_CHECK -->|No| B
    B_CHECK -->|Yes| C[Phase 1.5: Multi-Lens Discovery]
    
    C --> C1[Lens 1: Actor Analysis]
    C --> C2[Lens 2: Data Flow Analysis] 
    C --> C3[Lens 3: Temporal Analysis]
    C --> C4[Lens 4: Error Analysis]
    C --> C5[Lens 5: Integration Analysis]
    C --> C6[Lens 6: Platform Analysis]
    C --> C7[Lens 7: Scale Analysis] 
    C --> C8[Lens 8: Compliance Analysis]
    C --> C9[Lens 9: Lifecycle Analysis]
    
    C1 --> C_CONV{Convergence:<br/>Discovery <15%?}
    C2 --> C_CONV
    C3 --> C_CONV
    C4 --> C_CONV
    C5 --> C_CONV
    C6 --> C_CONV
    C7 --> C_CONV
    C8 --> C_CONV
    C9 --> C_CONV
    
    C_CONV -->|No| C
    C_CONV -->|Yes| D[Phase 2: Stated Requirements]
    
    D --> E[Phase 3: Technology Research]
    E --> F[Phase 4: NFR Derivation Engine]
    
    F --> F1[Cycle 1: Performance NFRs]
    F --> F2[Cycle 2: Scalability NFRs]
    F --> F3[Cycle 3: Security NFRs]
    F --> F4[Cycle 4: Reliability NFRs]
    F --> F5[Cycle 5: Usability NFRs]
    F --> F6[Cycle 6: Maintainability NFRs]
    F --> F7[Cycle 7: Compliance NFRs]
    F --> F8[Cycle 8: Operational NFRs]
    F --> F9[Cycle 9: Integration NFRs]
    F --> F10[Cycle 10: Business Continuity NFRs]
    F --> F11[Cycle 11: Cross-Cutting NFRs]
    F --> F12[Cycle 12+: Adaptive Discovery]
    
    F1 --> F_CONV{NFR Convergence:<br/>Discovery <10%<br/>for 2 cycles?}
    F2 --> F_CONV
    F3 --> F_CONV
    F4 --> F_CONV
    F5 --> F_CONV
    F6 --> F_CONV
    F7 --> F_CONV
    F8 --> F_CONV
    F9 --> F_CONV
    F10 --> F_CONV
    F11 --> F_CONV
    F12 --> F_CONV
    
    F_CONV -->|No<br/>(Max 50 cycles)| F
    F_CONV -->|Yes| G[Phase 5: Hidden Requirements]
    
    G --> H[Phase 6: Consolidation & Deduplication]
    H --> I[Phase 7: Final Validation & QA]
    
    I --> I_CHECK{Validation:<br/>All use cases<br/>mapped?}
    I_CHECK -->|No| B
    I_CHECK -->|Yes| J[Phase 8: Implementation Specs]
    
    J --> K[Feature-Developer Ready Output<br/>with Traceability Matrix]
    
    %% Feedback loops
    F -.->|New functional requirements discovered| D
    G -.->|New use cases identified| C
    I -.->|Gaps identified| B
    
    %% Quality gates
    B_CHECK -.->|Quality issues| QUALITY_REVIEW[Quality Review Process]
    F_CONV -.->|Max iterations reached| CONVERGENCE_REVIEW[Convergence Review]
    I_CHECK -.->|Validation failures| VALIDATION_REVIEW[Validation Review]
    
    QUALITY_REVIEW -.-> B
    CONVERGENCE_REVIEW -.-> G
    VALIDATION_REVIEW -.-> B
```

## Output Instructions

**Present the final requirements** in a structured, implementation-ready format that enables feature-developer agents to:

1. **Understand the complete scope** of implementation work required
2. **Identify all dependencies** and prerequisite components
3. **Plan development phases** based on requirement priorities and dependencies
4. **Design appropriate test strategies** covering all requirement categories
5. **Implement with confidence** knowing all edge cases and NFRs are specified
6. **Validate completeness** through clear acceptance criteria and success metrics

**Focus on clarity, actionability, and completeness** - every requirement should be specific enough for direct implementation without further clarification needed.