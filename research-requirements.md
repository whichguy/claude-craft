# Research Requirements — Backend Framework Evaluation for Fintech Microservices Platform

**Date**: 2026-03-22
**Prepared for**: CTO and VP of Engineering presentation
**Execution Mode**: Standard (Full phases 0-6, three output documents)

---

## 1. Research Question
Which backend framework should a fintech startup adopt for net-new microservices handling payment processing, account management, and real-time transaction monitoring — considering team capabilities, performance demands, PCI DSS compliance, and a migration path away from existing Flask services?

## 2. Candidates
1. **FastAPI** (Python) — primary candidate given team's Python expertise
2. **NestJS** (TypeScript) — for frontend/backend language unification with React+TS
3. **Go with Gin or Echo** — compelling performance story, some team Go exposure
4. **Rust with Actix-web** — maximum performance ceiling, steepest learning curve

## 3. Evaluation Criteria (ranked by user priority)
1. Latency and throughput — payment processing is directly latency-sensitive
2. Developer productivity — competitive market, fast feature shipping required
3. Type safety and correctness — financial data demands reliability
4. Observability — distributed tracing, structured logging, metrics first-class
5. Hiring — grow from 8 to 15-20 engineers within 18 months

## 4. Project Context
- **Platform workloads**: Payment processing, account management, real-time transaction monitoring
- **Scale target**: 50,000 concurrent users Year 1; plan for 10x (500,000) growth
- **Infrastructure**: AWS ECS Fargate, PostgreSQL on RDS, Redis, GitHub Actions CI/CD
- **Frontend**: React + TypeScript (separate repo, REST/GraphQL)
- **Existing**: 4 Python Flask microservices — gradual migration or coexistence required
- **Team**: 8 backend engineers; strong Python and JavaScript; some Go experience
- **Inter-service**: gRPC required for internal service communication

## 5. Regulatory Context
**compliance_active: true**
- PCI DSS requirements explicitly stated and non-negotiable
- Audit logging required
- Encryption (at rest and in transit) required
- Payment processing scope implies cardholder data environment (CDE) considerations

## 6. Relevant Evaluation Dimensions
- **Technical**: raw performance, async model, type system, gRPC support, DB/ORM ecosystem, validation
- **Business**: TCO, Fargate resource efficiency (CPU/memory per request), talent market size
- **Team**: learning curve from Python/JS baseline, migration cost, documentation quality
- **Compliance**: PCI DSS controls, audit logging support, SAST tooling, CVE history
- **Migration**: Flask coexistence strategy, incremental migration path

---

## Search Gap Log
- **TechEmpower Round 22 data**: Page is JS-rendered; raw RPS numbers not extractable. Confidence reduced for exact throughput figures; estimates derived from published summaries and secondary sources.
- **State of JS survey**: Connection refused. NestJS adoption data sourced from GitHub stars (75k), npm dependents (673k), and LinkedIn job counts instead.
- **LinkedIn job counts caveat**: Framework-specific queries undercount Go because postings list "Golang" broadly, not specific frameworks. Go backend jobs: 1,000+; FastAPI jobs: 1,000+; NestJS jobs: 339; Rust Actix jobs: 8 (highly niche).
- **Stripe/Uber/Netflix stack internals**: Not accessible at depth; relied on public blog posts and documented FastAPI adopter list.
