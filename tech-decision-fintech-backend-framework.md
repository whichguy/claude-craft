# Technology Decision: Fintech Backend Framework
**For:** CTO + VP Engineering
**Date:** 2026-03-22
**Decision Owner:** Engineering Leadership
**Review By:** 2026-04-15 (before next sprint planning cycle)

---

## Executive Summary

**Primary Recommendation: Go + Gin**
**Runner-Up (acceptable alternative): FastAPI**
**Do Not Select: Rust + Actix-web (primary), NestJS**

The evaluation covers four candidates against five ranked priorities (latency/throughput, developer productivity, type safety, observability, hiring) plus PCI DSS compliance requirements. Go + Gin is recommended for long-term platform health, informed by extensive fintech industry adoption evidence and your 10x growth target. FastAPI remains a valid short-term choice if 6-month feature velocity outweighs 18-month operational efficiency.

---

## The Decision in One Paragraph

Go + Gin is the correct framework for this payment platform because the fintech industry has already validated it at scale — Monzo, Revolut, Wise, Capital One, Razorpay, and 20+ documented payment companies chose Go specifically for payment backends. Your 10x growth target makes performance compounding consequential: Go requires 3–5x fewer containers than FastAPI for the same throughput, translating to meaningful compute cost savings as you scale. Go's gRPC ecosystem is the most mature of the candidates, its observability integration with AWS is well-documented, and it has the cleanest security track record for PCI DSS environments. The trade-off is a 2–4 month productivity investment to build team proficiency — a cost that is real but bounded, and mitigated by your team's existing partial Go experience.

---

## Scoring Summary

| Framework | Performance (0.25) | Productivity (0.25) | Type Safety (0.15) | Observability (0.10) | Hiring (0.15) | PCI DSS (0.10) | Weighted Total |
|-----------|-------------------|--------------------|--------------------|----------------------|---------------|----------------|----------------|
| **Go + Gin** | **5** | 3 | 3 | 4 | 3 | 4 | **3.70** |
| FastAPI | 3 | **5** | 4 | 4 | **5** | 3 | **4.05** |
| NestJS | 3 | 4 | 4 | 4 | **5** | 3 | **3.80** |
| Rust + Actix-web | 4 | 1 | **5** | 3 | 1 | **5** | **2.95** |

*Note: FastAPI scores higher on the weighted matrix. The recommendation for Go is based on the time-horizon analysis below — the matrix weights the team's current state, not the 18-month target state.*

---

## Why the Scoring Doesn't Directly Drive the Recommendation

FastAPI wins the weighted matrix at 4.05 vs Go's 3.70. The recommendation for Go requires explicit justification:

**The matrix is right for Month 1. Go is right for Month 18.**

The productivity and hiring scores favor FastAPI because your team is Python-proficient today. But this decision is a platform foundation, not a sprint choice. By month 12, a team that invested in Go will have:
- 10–12 engineers proficient in Go (the language's simplicity accelerates learning)
- Compute costs 3–5x lower per unit throughput
- The infrastructure pattern used by the fintech companies you're competing with
- A talent magnet (Go fintech stack attracts experienced engineers who want to work with modern tools)

If this were a 6-month project, FastAPI wins. For an 18-month platform build with a 10x growth target, Go wins.

**If your leadership is not prepared to accept a 2–4 month productivity investment, choose FastAPI.** It is a legitimate, defensible choice that will serve you well at 50k users. The recommendation acknowledges this explicitly.

---

## Framework Profiles

### Go + Gin — Recommended

**What it is:** Compiled, statically typed, garbage-collected systems language with a thin, high-performance HTTP router. Go is Google's answer to C++ complexity — designed for large teams building large systems.

**Performance:** 500k–900k RPS baseline (synthetic JSON); realistic payment workloads (with Postgres/Redis): 20,000–50,000 RPS per container. P99 latency consistently under 5ms. True parallelism across all CPU cores — no GIL, no event loop bottleneck.

**gRPC:** Native. `google.golang.org/grpc` is the reference implementation with 267k+ dependent projects. Clean separation: run gRPC server on :50051, Gin REST on :8080. Use grpc-gateway to auto-generate REST from proto definitions.

**Observability:** otelgin v0.67.0 auto-instruments traces (per-request spans, route info) and HTTP server metrics. zerolog/zap for structured JSON logging. AWS X-Ray + Go = well-documented integration.

**PCI DSS:** Strongest fintech production precedent. No manual memory management eliminates buffer overflow class vulnerabilities. Go standard library crypto/tls is extensively audited. Audit log pattern with immutable CloudWatch shipping is well-established.

**Hiring:** Go at 14.4% professional adoption is the third-smallest candidate pool, but it's growing fastest (82.2% admiration — developers want to learn it). Fintech Go roles are well-understood in the market. Budget 4–8 weeks per senior Go hire.

**Migration from Flask:** Full rewrite. No code reuse. 12–20 weeks for 4 services if done carefully. Recommend migrating one service at a time; keep Flask services until each migration is validated in production.

**Key risks:**
- Echo v5 is in a stabilization window until April 2026 — use Gin for all new services
- 2–4 month productivity ramp is real; plan for it in sprint commitments
- Verbose error handling creates boilerplate — establish team patterns early

---

### FastAPI — Runner-Up

**What it is:** Python's premier async web framework. Built on Starlette (ASGI) + Pydantic (validation). The default choice for new Python APIs.

**Performance:** 50k–100k RPS synthetic; 5,000–15,000 RPS realistic payment workloads with 4-worker uvicorn deployment. At 50k concurrent users, manageable — needs 3–5x more containers than Go for equivalent throughput. Python GIL remains a constraint (Python 3.13 free-threaded mode is experimental-only, not production-ready as of 2026).

**gRPC:** Not first-class. Can run a separate grpcio server process alongside FastAPI, sharing business logic. Functional but architecturally awkward — two processes per service, or a dedicated gRPC service tier separate from FastAPI REST services.

**Observability:** opentelemetry-instrumentation-fastapi auto-collects request spans and HTTP metrics. 51 OpenTelemetry Python contrib packages for databases, Redis, and other integrations. Strong Python APM ecosystem (Datadog, New Relic have excellent Python agents).

**PCI DSS:** No framework CVEs; compatible with all PCI DSS requirements. Less fintech payment-specific production evidence than Go. Pydantic's runtime validation is a security strength — all request data is validated before business logic executes.

**Hiring:** Python is #2 professional language at 46.9%. Largest talent pool by far. Any experienced Python engineer is productive in FastAPI within 1–2 days. Strong junior pipeline.

**Migration from Flask:** Best-in-class. Same language; Pydantic replaces Flask-Marshmallow; async can be added incrementally. 2–4 weeks for 4 services. Services can coexist as separate containers indefinitely.

**Key risks:**
- GIL limits CPU-bound parallelism; fraud detection or ML-heavy operations need separate Python worker processes
- Infrastructure cost compounds at 10x scale
- gRPC architectural friction for inter-service communication

---

### NestJS — Not Recommended

**What it is:** Angular-inspired TypeScript framework for Node.js. Excellent structure, strong DI, first-class microservices including gRPC.

**Why not recommended for this team:** NestJS does not win on any decision-relevant dimension. Its performance is below Go, its productivity is not better than FastAPI for a Python team, its fintech production evidence is weaker than Go, and the migration from Flask is a full rewrite without clear advantage over Go. NestJS is excellent for teams already in TypeScript — it is not the right choice for this team's specific context.

**When to reconsider:** If a future audit shows the team is predominantly TypeScript rather than Python, or if frontend-backend code sharing (monorepo with shared types) becomes a strong business requirement.

---

### Rust + Actix-web — Do Not Select as Primary

**What it is:** Systems programming language with compile-time memory safety guarantees and near-zero runtime overhead. Best possible performance and security properties.

**Why not recommended:** The hiring constraint disqualifies Rust as the primary platform framework. Scaling from 8 to 20 engineers in 18 months using Rust is near-impossible in most markets. Senior Rust web backend engineers are among the most competitive hires in software engineering. The 4–6 month proficiency ramp per engineer significantly delays feature delivery in a competitive fintech market.

**Appropriate future use:** After the team grows and stabilizes (18+ months), consider Rust for an isolated service with extreme requirements — a real-time risk scoring engine, a high-frequency transaction matcher, or a critical hot path that Go cannot optimize further. This is a valid specialized deployment, not a platform-wide choice.

---

## Migration Strategy

### Recommended Path (Go + Gin)

```
Today                    Month 3              Month 6              Month 12
─────────────────────────────────────────────────────────────────────────
Flask (4 services)       Flask (4 services)   Flask (2 services)   Legacy Flask gone
                         +                    +                    +
                         Go Service #1        Go (4 services)      Go (all new)
                         (non-critical)       [payment core live]  +
                                                                   FastAPI (1 Flask
                                                                   migrated bridge)
```

**Phase 1 (Months 1–3): Foundation without risk**
- Build one internal/non-critical service in Go (e.g., account preferences, reporting)
- Establish Go patterns: error handling, logging, OTel, gRPC proto management
- Flask services continue serving production traffic — no migration pressure
- Goal: 2 engineers at senior Go proficiency

**Phase 2 (Months 4–6): First payment service in Go**
- Build payment processing core in Go with grpc-gateway (exposes both REST and gRPC)
- Parallel-run against Flask payment service; A/B test outputs for correctness
- Migrate traffic gradually via ALB: 5% → 25% → 50% → 100%
- Simultaneously migrate one lower-risk Flask service to FastAPI (preserves Python investment, reduces migration risk for that service)

**Phase 3 (Months 7–12): Accelerate**
- Migrate remaining Flask services to Go
- All new services in Go
- Build shared Go libraries: auth middleware, audit logger, domain types, gRPC interceptors

### Alternative Path (FastAPI)

```
Today                    Month 1              Month 3              Month 6
─────────────────────────────────────────────────────────────────────────
Flask (4 services)       Flask → FastAPI      FastAPI (all 4)      FastAPI + new
                         migration begins     migration complete   services
```

FastAPI migration is dramatically simpler — 2–4 weeks per service, same language, parallel coexistence. If choosing FastAPI, begin migrating Flask services immediately to capture Python modernization benefits (Pydantic v2, async, OpenAPI docs) before investing in new features.

---

## Decision Factors Checklist

Present this to your CTO and VP Engineering:

| Factor | Favors FastAPI | Favors Go |
|--------|---------------|-----------|
| Current team expertise | ✓ Strong Python | — Some Go only |
| 18-month growth target | — | ✓ Go talent market manageable |
| 10x scale target | — | ✓ 3–5x lower infrastructure cost per unit |
| gRPC requirement | — | ✓ Most mature gRPC ecosystem |
| Flask migration cost | ✓ 2–4 weeks | — 12–20 weeks |
| Fintech industry precedent | — | ✓ 20+ documented payment companies |
| Months 1–6 feature velocity | ✓ Higher | — Lower during ramp |
| Months 12–18 feature velocity | — | ✓ Higher after proficiency built |
| PCI DSS security posture | ✓ Adequate | ✓ Strong (better documented) |
| Real-time transaction monitoring | — | ✓ Low-latency concurrency |
| ML/fraud detection workloads | ✓ Python ecosystem | — External Python service needed |

**If your answers are:**
- "We need to ship features in the next 6 months more than anything else" → **Choose FastAPI**
- "We are building the foundation for a 5-year platform" → **Choose Go**
- "Both matter equally" → **Choose Go** (the tie goes to the long-term winner in this category)

---

## Immediate Next Actions (Go Path)

1. **This week:** Survey team for Go experience levels; identify 2 engineers for Go technical lead roles
2. **Week 2:** Purchase team Go training licenses (Go Bootcamp, or equivalent); budget $2,000–5,000
3. **Week 3:** Stand up Go service scaffold with Gin, zerolog, otelgin, testify — internal repo template
4. **Month 1:** First pull request in Go for a non-critical internal endpoint
5. **Month 2:** First Go service deployed to ECS Fargate staging environment
6. **Month 3:** Begin hiring 2–3 Go engineers with fintech background (post JD now, pipeline takes 4–8 weeks)

## Immediate Next Actions (FastAPI Path)

1. **This week:** Create FastAPI migration templates from existing Flask services
2. **Week 2:** Begin migrating lowest-risk Flask service to FastAPI
3. **Month 1:** All 4 Flask services migrated or migration in progress
4. **Month 2:** First all-new service built on FastAPI
5. **Month 3:** gRPC strategy session — decide on separate gRPC tier vs REST-only inter-service

---

## Confidence Levels

| Claim | Confidence | Notes |
|-------|-----------|-------|
| Go fintech production evidence | HIGH | 20+ documented companies from go.dev/wiki/GoUsers |
| Performance rankings (relative) | HIGH | Well-established in community; multiple sources |
| Absolute RPS numbers | MEDIUM | TechEmpower site JS-rendered; ranges are indicative |
| NestJS gRPC capabilities | MEDIUM | Docs JS-rendered; claims from GitHub README |
| Hiring timeline estimates | MEDIUM | Market conditions variable |
| Flask→Go migration timeline | MEDIUM | Depends heavily on service complexity |
| Flask→FastAPI migration timeline | HIGH | Well-documented, straightforward language match |
| Echo v5 stabilization window | HIGH | Confirmed from GitHub release notes |
| Python 3.13 free-threaded mode | HIGH | Explicitly marked experimental in release notes |
