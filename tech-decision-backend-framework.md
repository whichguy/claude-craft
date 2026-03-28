# Backend Framework Decision: Fintech Microservices Platform
## Executive Summary for CTO / VP Engineering

**Decision date**: March 2026
**Decision scope**: Primary framework for new microservices — payment processing, account management, real-time transaction monitoring
**Supporting research**: tech-research-backend-framework.md

---

## Decision

**Primary framework: Go with Echo**
**Secondary framework: FastAPI (Python)**
**Not recommended: NestJS, Rust/Actix-web**

This is a bifurcated, not monolingual, strategy. It is the pragmatic path given the team's current capabilities, the performance requirements of payment services, and the need to migrate four existing Flask services with minimal disruption.

---

## The Recommendation in One Paragraph

New performance-critical services (payment processing, real-time transaction monitoring, gRPC inter-service layer) should be built in **Go with Echo**. Existing Flask services should be migrated to **FastAPI** — same language, far better type safety, modern async support, and auto-generated OpenAPI documentation. This two-language backend is well-established at companies like Uber and Stripe. The shared infrastructure — OpenTelemetry observability, protobuf-defined gRPC contracts, containerized ECS Fargate deployment — works identically across both. The result is a clear architecture: Go owns the performance-critical payment path; Python owns the data-heavy and ML-adjacent services.

---

## Why Go, Not FastAPI, for Payment Services

| Concern | Evidence |
|---|---|
| p99 latency under mixed load | Python's GIL prevents multi-core parallelism; goroutines handle 50,000 concurrent connections with 4–8 KB each vs Python's ~20–50 KB per async task |
| 10x growth trajectory | At 500,000 users, Go services run at 128–256 MB RAM vs FastAPI's 256–512 MB — translating to $75,000–$150,000/year in Fargate savings across 10 services |
| gRPC requirement | Go's official gRPC library has 267,000 importers and production-grade interceptors; Python's gRPC runs as a separate server process alongside the ASGI app |
| Observability completeness | `otelecho` + `otelgrpc` + `go-grpc-middleware` provide automatic trace propagation across HTTP and gRPC with metrics in a single dependency set |
| Type safety | Go enforces types at compile time; `sqlc` generates type-safe database queries from SQL; mismatches caught in CI before deployment |

---

## Why Not NestJS

NestJS has genuine strengths (best gRPC DX, TypeScript at the boundary, 673,000 npm dependents, Microsoft backing). It is not recommended here for three reasons:

1. **Performance ceiling**: Node.js is single-threaded; at 10x growth this requires cluster mode and careful concurrency management. Go handles this natively.
2. **Team transition cost**: The team is "strong in Python and JavaScript" — but NestJS's Angular-derived module/decorator paradigm has a 3–6 month ramp-up for Python engineers, similar to Go's ramp-up with less performance payoff.
3. **Supply chain risk**: The npm ecosystem has had multiple significant supply chain incidents. For a PCI DSS environment managing cardholder data, the transitive dependency graph of a NestJS service (~400–800 npm packages) vs a Go service (~20–50 modules with go.sum checksums) is a meaningful security surface area difference.

If the team had strong existing TypeScript/Node.js expertise, this recommendation would be closer. It is not the right choice to *start from* given the current Python-heavy team profile.

---

## Why Not Rust/Actix-web

Rust's performance and safety story is compelling and should not be dismissed permanently. It is wrong *for this timeline*:

- 12–18 months to proficiency for Python/JavaScript engineers
- Hiring target of 15–20 engineers in 18 months is at high risk; Rust engineers command 30–50% salary premiums
- OpenTelemetry Rust ecosystem is immature compared to Go
- The performance gain over Go (2–4x on compute-bound tasks) does not justify the talent and productivity costs for API workloads that are primarily I/O-bound

**Revisit Rust in 24–36 months** for specific components: a cryptographic signing service, a ledger write-path hot loop, or a zero-downtime payment gateway component.

---

## Migration Plan (High-Level)

### Months 1–3: Foundation
- Establish Go + Echo service template with OTel, gRPC, Prometheus, structured logging, health endpoints
- Migrate one Flask service to FastAPI (lowest-risk first, proves Python observability stack)
- Define shared `.proto` files for all gRPC contracts in a dedicated schema repository

### Months 3–6: First Go Service in Production
- Build real-time transaction monitoring in Go/Echo as first greenfield service
- Complete all four Flask → FastAPI migrations
- Validate end-to-end distributed traces from frontend through to database

### Months 6–12: Payment Processing Migration
- Rebuild payment processing in Go; run old and new in parallel with feature flags
- gRPC-enable all inter-service communication; deprecate REST-based service-to-service calls
- Hire Go-experienced engineers; establish coding standards

### Months 12–18: Scale and Harden
- Set explicit p50/p95/p99 SLOs per service
- Consider Rust for isolated high-performance components
- Evaluate service mesh (AWS App Mesh or Linkerd) for PCI DSS network segmentation and mTLS

---

## Risk Summary

| Risk | Level | Mitigation |
|---|---|---|
| Go ramp-up slows near-term feature velocity | Medium | FastAPI absorbs feature work during Go onboarding; Go starts with non-critical service |
| Bifurcated stack increases maintenance overhead | Low-Medium | Solved at infrastructure layer: shared CI templates, Docker base images, OTel collector config |
| Go hiring misses timeline | Medium | Python/FastAPI engineers remain productive; Go headcount is growth-path, not replacement |
| Performance bottleneck in FastAPI Python tier | Low (near-term) | Acceptable at current scale; migration path to Go exists for any service that breaches SLOs |

---

## Scoring Summary

| Framework | Weighted Score (100-pt scale) | Recommendation |
|---|---|---|
| **Go with Echo** | **77.5** | PRIMARY — new performance-critical services |
| FastAPI | 70.5 | SECONDARY — Flask migrations, Python-ecosystem services |
| NestJS | 67.0 | PASS — viable if team TypeScript fluency were higher |
| Rust/Actix-web | 65.0 | DEFER — revisit in 24–36 months for specific components |

---

## Key Commitments Required

For this recommendation to succeed, the following commitments are needed:

1. **Dedicated Go ramp-up time**: 4–8 weeks for the first two engineers to become productive; this is an investment, not a delay
2. **Protobuf schema governance**: Establish a `.proto` schema repository with CI validation (buf.build) before the first gRPC service ships
3. **Observability budget**: OpenTelemetry collector + backend (Jaeger, AWS X-Ray, or Grafana Tempo) must be provisioned before Go services go to production
4. **No third language**: Do not introduce Rust, Java, or another language until the Go + Python stack is stable and the team is at target headcount

---

*Full technical evaluation, benchmark data, code examples, and reference compilation: tech-research-backend-framework.md*
