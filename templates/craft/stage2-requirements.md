# Requirements: [Epic Name]

## Functional Requirements

**FR-1**: [Requirement Statement]
  * **Derived From**: UC-[N] - [Use Case Name]
  * **Rationale**: [Why this requirement exists]
  * **Acceptance Criteria**: [How to verify this requirement is met]
  * **Priority**: Must-have / Should-have / Nice-to-have

[Repeat for each functional requirement from use cases]

---

## Non-Functional Requirements

### Performance Requirements
**NFR-P1**: [Specific Performance Requirement]
  * **Metric**: [Measurable target - e.g., "<200ms response time at p95"]
  * **Rationale**: [Research finding or user need that drives this]
  * **Measurement Method**: [Tool/approach to verify - load testing, APM, profiling]
  * **Priority**: Must-have / Should-have / Nice-to-have
  * **Derived From**: [UC-X or research finding]

[Repeat for throughput, latency, resource usage, etc.]

### Scalability Requirements
**NFR-S1**: [Specific Scalability Requirement]
  * **Metric**: [e.g., "Support 10,000 concurrent users with <5% degradation"]
  * **Rationale**: [Business projection or research finding]
  * **Constraint**: [Service limits, architectural limits from research.md]
  * **Scaling Strategy**: [Horizontal/vertical, caching, sharding]
  * **Priority**: Must-have / Should-have / Nice-to-have

[Repeat for data volume, traffic patterns, growth targets, etc.]

### Security Requirements
**NFR-SE1**: [Specific Security Requirement]
  * **Control**: [Authentication method, encryption standard, access control]
  * **Rationale**: [Threat model, compliance need, anti-case prevention]
  * **Standard**: [OAuth 2.0, AES-256, OWASP ASVS Level X, etc.]
  * **Verification**: [Security scan, penetration test, code review]
  * **Priority**: Must-have (security is non-negotiable)
  * **Related Anti-Case**: AC-[N] - [Which anti-case this prevents]

[Repeat for authentication, authorization, encryption, privacy, audit, etc.]

### Reliability Requirements
**NFR-R1**: [Specific Reliability Requirement]
  * **Metric**: [e.g., "99.9% uptime", "RTO <4 hours, RPO <1 hour"]
  * **Rationale**: [Business impact, user expectation from research]
  * **Recovery Strategy**: [Automatic failover, backup restore, retry logic]
  * **Monitoring**: [Health checks, alerts, SLO tracking]
  * **Priority**: Must-have / Should-have / Nice-to-have

[Repeat for uptime, fault tolerance, error recovery, disaster recovery, etc.]

### Compliance & Regulatory Requirements
**NFR-C1**: [Specific Compliance Requirement]
  * **Regulation**: [GDPR, HIPAA, SOC2, PCI-DSS, industry regulation]
  * **Applicability**: [Why this regulation applies - data type, industry, geography]
  * **Specific Requirements**: [Specific obligations - data retention, right to erasure, etc.]
  * **Evidence**: [Regulation citation, legal requirement, audit standard]
  * **Verification**: [Compliance audit, certification, legal review]
  * **Impact**: [What this means for design - data encryption, audit logs, consent management]
  * **Priority**: Must-have (compliance is non-negotiable)

[Repeat for each applicable regulation]

### Usability Requirements
**NFR-U1**: [Specific Usability Requirement]
  * **Standard**: [WCAG 2.1 AA, Nielsen heuristics, industry UX standard]
  * **Rationale**: [User population needs, legal requirement]
  * **Acceptance Criteria**: [Specific testable criteria]
  * **Verification**: [Usability testing, accessibility audit, user feedback]
  * **Priority**: Must-have / Should-have / Nice-to-have

[Repeat for accessibility, learnability, efficiency, error prevention, etc.]

### Maintainability Requirements
**NFR-M1**: [Specific Maintainability Requirement]
  * **Metric**: [e.g., "80% test coverage", "Cyclomatic complexity <10", "API documentation complete"]
  * **Rationale**: [Team capability, longevity needs from research.md]
  * **Verification**: [Code coverage tool, static analysis, documentation review]
  * **Priority**: Must-have / Should-have / Nice-to-have

[Repeat for code quality, documentation, testability, modularity, etc.]

### Operational Requirements
**NFR-O1**: [Specific Operational Requirement]
  * **Capability**: [Monitoring, logging, deployment, backup, configuration management]
  * **Rationale**: [Operations team needs, incident response, debugging]
  * **Tools**: [Specific tools/systems to use or integrate]
  * **Verification**: [Operational readiness review, runbook testing]
  * **Priority**: Must-have / Should-have / Nice-to-have

[Repeat for monitoring, logging, deployment, backup/recovery, configuration, etc.]

---

## Requirements Research Sources
- **Industry Standards**: [ISO, NIST, OWASP, domain standards consulted]
- **Similar Systems**: [Systems researched for NFR patterns]
- **Compliance Documentation**: [Regulations reviewed, legal guidance]
- **Existing System Metrics**: [Baseline measurements from current system in research.md]
- **User Research**: [User interviews, surveys, feedback]
- **Service Provider Docs**: [SaaS service documentation from research.md]

---

## Requirement Gaps & Questions for User

### Gap 1: [Requirement Category]
**What We Know**: [Current understanding from epic/research]
**What We Need**: [Missing quantitative target or clarification]
**Question for User**: [Specific question to resolve gap]
**Impact if Not Resolved**: [Why this matters for design - blocking decisions, risk if assumed wrong]
**Default Assumption**: [What we'll assume if user doesn't respond - with rationale]

[Repeat for each gap identified]

---

## Requirements Traceability

**Use Cases → Functional Requirements**:
- **UC-1** → FR-1, FR-2, FR-3: [Use case fulfilled by these FRs]
- **UC-2** → FR-4, FR-5: [Use case fulfilled by these FRs]

**Use Cases → Non-Functional Requirements**:
- **UC-1** (real-time updates) → NFR-P1 (response time), NFR-R1 (uptime)
- **UC-5** (handle payments) → NFR-SE1 (PCI compliance), NFR-SE2 (encryption)

**Anti-Cases → Non-Functional Requirements**:
- **AC-1** (prevent injection) → NFR-SE3 (input validation), NFR-SE4 (parameterized queries)
- **AC-2** (prevent DoS) → NFR-P2 (rate limiting), NFR-S1 (horizontal scaling)

---

## Requirements Priority Matrix

**Must-Have** (blocking launch):
[List of must-have FRs and NFRs]

**Should-Have** (important but not blocking):
[List of should-have FRs and NFRs]

**Nice-to-Have** (can defer to v2):
[List of nice-to-have FRs and NFRs]
