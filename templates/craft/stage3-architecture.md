# Stage 3: Architecture Research Templates

## Forums Discovery

### Forums Discovered for [Technology Domain]
- Forum 1: [Name] - [Activity level] - [URL if applicable]
- Forum 2: [Name] - [Activity level] - [URL if applicable]
- Forum 3: [Name] - [Activity level] - [URL if applicable]

---

## Research Gaps

### Research Gaps Remaining (Iteration [N])

**Gap 1: [Question/uncertainty]**
- **Why it matters:** [Impact on architecture or implementation]
- **Current assumption:** [What we think but aren't sure]
- **Risk if wrong:** [Consequences]
- **Targeted research needed:** [Specific queries to resolve this]

**Gap 2: [Question/uncertainty]**
- **Why it matters:** [Impact on architecture or implementation]
- **Current assumption:** [What we think but aren't sure]
- **Risk if wrong:** [Consequences]
- **Targeted research needed:** [Specific queries to resolve this]

[Continue for all critical gaps...]

---

## Iteration History

### Technology Research Iteration History

**Iteration 1: Initial Broad Research**
- Forums discovered: [list]
- Technologies evaluated: [count]
- Findings: [key discoveries]
- Gaps remaining: [critical unknowns]
- Decision: ITERATE / PROCEED

**Iteration 2: Targeted Gap Research** (if needed)
- Focused questions: [specific gaps from iteration 1]
- Additional research: [targeted queries executed]
- New findings: [what we learned]
- Gaps remaining: [reduced set]
- Decision: ITERATE / PROCEED

[Continue up to 5 iterations if needed]

**Final iteration count:** [N]
**Final decision:** PROCEED with [X] options identified

---

## Technology Gap Analysis

### Pre-Decided Technologies
- [List technologies already selected/mandated]
- [Note why they were pre-selected]

### Identified Gaps
1. **[Gap Name]:** [Description of missing capability]
   - **Use Case Requirements:** [Which use cases need this]
   - **Complexity Level:** [Minimal/Moderate/Comprehensive needed]

### Technology Research & Scoring

#### [Gap Name] Solutions

| Option | Quality | Trending | Philosophy | Total | Notes |
|--------|---------|----------|------------|-------|-------|
| [Library A] | 8.5 | 7.0 | 9.5 | 8.4 | GitHub 15k★, active, zero deps, pure functions |
| [Library B] | 9.0 | 9.0 | 4.0 | 7.5 | GitHub 50k★, trending up, many deps, complex API |
| [Library C] | 6.0 | 3.0 | 10.0 | 6.1 | GitHub 500★, declining, standalone, simple but immature |

**Recommendation:** [Library A] - Best balance of quality and philosophy alignment
**Rationale:** [Explain why this choice fits use cases and constraints]
**Confidence:** [HIGH/MEDIUM/LOW]
**Alternative if issues:** [Library B as fallback if A proves insufficient]

### Research Sources
- GitHub repositories reviewed: [links]
- Reddit discussions: [r/subreddit threads]
- NPM packages evaluated: [package names]
- Key decision factors: [what mattered most for this choice]

---

## UI Architecture

**Requirements:** [What UI interactions are needed from use cases]

**Approach:** [Framework + component library + styling solution]
- Framework: [Next.js 14+ / Nuxt 3+ / SvelteKit / None]
- Components: [shadcn/ui / Radix / Headless UI / Custom]
- Styling: [Tailwind CSS / CSS Modules / Styled Components]
- State: [Context / Zustand / Redux / None]

**Rationale:** [Why this combination fits requirements and team]
- Trending: [shadcn is community favorite 2024+, Tailwind widely adopted]
- Sufficient: [Covers all use case interactions without over-engineering]
- Fancy factor: [Modern aesthetics, smooth interactions, professional appearance]

**Satisfied by:** [Existing packages] **Needs investigation:** [Unknowns or decisions pending]

---

## Service Architecture

**Requirements:** [What backend capabilities are needed]

**Approach:** [Monolith vs. microservices, framework choice]
- Pattern: [Monolith / Microservices / Serverless / Hybrid]
- Framework: [Express / Fastify / Nest.js / None]
- Processing: [Synchronous only / Job queues / Background workers]
- State: [Stateless / Session-based / Distributed state]

**Rationale:** [Why this approach fits scale and complexity needs]

**Satisfied by:** [Existing infrastructure] **Needs investigation:** [Scalability testing, deployment model]

---

## API Architecture

**Requirements:** [Who needs to call what]

**Approach:** [API style and contracts]
- Style: [REST / GraphQL / gRPC / Hybrid]
- Contracts: [OpenAPI / GraphQL Schema / Protocol Buffers]
- Authentication: [JWT / OAuth 2.0 / API Keys / None]
- Versioning: [URL-based /v1/ / Header-based / None]
- Documentation: [OpenAPI/Swagger / GraphQL Playground / Custom]

**Rationale:** [Why this API style fits consumers and use cases]

**Satisfied by:** [Existing patterns] **Needs investigation:** [Authentication provider, rate limiting strategy]

---

## Data Storage Architecture

**Requirements:** [What data needs to be persisted]

**Storage Complexity Chosen:** [Level 1-9 from prioritization list above]

**Approach:** [Specific implementation]
- Primary: [Technology name - SQLite, S3, PostgreSQL, Redis, etc.]
- Rationale: [Why this level of complexity is necessary]
- Simpler options rejected: [Why stateless/files/etc. are insufficient]

**Concurrency approach:** [Based on level - none needed, file locks, optimistic locking, transactions]
- Concurrent access patterns: [Single-user, read-heavy, write-heavy, multi-user edits]
- Conflict resolution: [N/A, last-write-wins, transactions, queues, optimistic locking]
- State management: [Where state lives - client, server, database]

**Scale estimate:** [Current: X, 1-year: Y, 5-year: Z]

**Rationale:**
- Necessary: [What requirements force this complexity level]
- Sufficient: [Why more complexity isn't needed yet]
- Upgrade trigger: [What would force moving to next complexity level]

**Satisfied by:** [Existing infrastructure]
**Needs setup:** [New infrastructure to provision]

---

## Quality Testing Architecture

**Testing Framework:** Mocha + Chai (align with existing codebase)
- **Why:** Project already uses Mocha/Chai, maintain consistency
- **Confidence:** HIGH - established pattern in codebase

**Test Categories:**
1. **Unit Tests** (Mocha + Chai)
   - **Coverage target:** 80% for business logic, 60% for utilities
   - **Mocking strategy:** Sinon for stubs/spies, proxyquire for module mocks
   - **Test data:** JSON fixtures in test/fixtures/
   - **Run frequency:** Every commit (pre-commit hook)

2. **Integration Tests** (Mocha + Chai + Supertest for APIs)
   - **Coverage target:** 70% of API endpoints and database interactions
   - **Test environment:** Dedicated test database (SQLite in-memory or PostgreSQL test instance)
   - **Test data:** Database seeding scripts in test/seeds/
   - **Run frequency:** Pre-push hook, CI/CD pipeline

3. **End-to-End Tests** (Playwright preferred, Cypress fallback)
   - **Coverage target:** Critical user journeys only (authentication, checkout, core workflows)
   - **Test environment:** Staging environment with production-like data
   - **Test data:** Synthetic user accounts, anonymized production data subset
   - **Run frequency:** CI/CD on main branch, nightly for full suite
   - **Limitations:** No tests for admin-only features (manual QA), no performance testing in e2e

4. **Performance Tests** (k6 or Artillery - decide based on existing infrastructure)
   - **Coverage target:** API endpoints under expected load + 2x surge capacity
   - **Performance budgets:**
     * API response time: p95 < 200ms, p99 < 500ms
     * Page load: First Contentful Paint < 1.5s, Time to Interactive < 3.5s
   - **Test data:** Load testing data generator (faker.js or custom scripts)
   - **Run frequency:** Weekly on staging, before major releases
   - **Limitations:** Limited to staging environment, not production traffic patterns

5. **Security Tests** (npm audit, Snyk, OWASP dependency check)
   - **Coverage target:** All dependencies scanned, critical vulnerabilities blocked
   - **Security standards:** OWASP Top 10 awareness, dependency vulnerability scanning
   - **Run frequency:** Every CI/CD build, weekly full security scans
   - **Limitations:** Automated tools only (no manual penetration testing), focus on dependencies

**Minimal Quality Bar (Must Pass):**
- Unit tests: >70% coverage on business logic
- Integration tests: All critical API endpoints tested
- E2E tests: Authentication + primary user journey working
- No high/critical security vulnerabilities in dependencies
- Performance: API p95 < 500ms (relaxed from ideal)

**Nice-to-Have (Not Blocking):**
- 80% overall code coverage (aspirational)
- Visual regression tests (nice for UI-heavy apps)
- Accessibility audits (WCAG AA compliance)
- Load testing beyond 2x expected capacity

**Test Data Strategy:**
- **Fixtures:** JSON files in test/fixtures/ for deterministic unit tests
- **Factories:** faker.js + factory pattern for dynamic test data generation
- **Seeding:** Database seed scripts for integration/e2e environments
- **Production data:** NEVER use in tests; anonymize/synthesize if needed
- **Limitations:** No access to production data, synthetic data may miss edge cases
