<!-- ADDING A QUESTION: (1) add row here with gate weight, (2) update Gate1_unresolved
     formula in SKILL.md if weight=3, (3) add Q-ID to evaluator's assigned list in
     SKILL.md AND EVALUATE.md triage/evaluate sections. All 3 steps required. -->

# Node.js/TypeScript Plan Question Definitions

## Gate Weight Reference

Gate 1 (blocking, weight 3) | Gate 2 (important, weight 2) | Gate 3 (advisory, weight 1)
N/A counts as PASS for gate evaluation.

### Quick-Reference Weight Table

**Gate 1 — Blocking (weight 3, must all PASS):**
N1 TypeScript build check [TS]

**Gate 2 — Important (weight 2, must stabilize):**
N2 npm/package changes [TS] | N3 lock file [TS] | N4 type safety [TS] | N5 tsconfig interaction [TS] |
N6 async error handling [TS] | N7 floating promises [TS] | N8 concurrency safety [Shared] |
N9 environment variables [NR] | N10 config hygiene [NR] | N11 module system [TS] |
N12 circular dependencies [TS] | N13 graceful shutdown [NR] | N14 memory/streaming [NR] |
N15 framework integration [NR] | N16 Node version compat [NR] | N17 security surface [NR] |
N18 database migrations [NR] | N22 event loop blocking [NR] | N23 ReDoS safety [NR] |
N24 stream pipeline safety [NR] | N25 EventEmitter hygiene [NR] | N27 child process/worker mgmt [NR] |
N28 HTTP client timeouts [NR] | N30 monorepo phantom deps [TS] | N33 secret management [NR] |
N35 process crash safety [NR] | N36 K8s/container shutdown [NR]

**Gate 3 — Advisory (weight 1, note only):**
N19 test isolation [TS] | N26 timer cleanup [NR] | N29 path handling [TS] |
N31 Docker/container concerns [NR] | N32 native addon compat [TS] |
N34 API contract drift [NR] | N37 TS declaration output [TS] | N38 health check endpoint [NR]

**Triage shortcut — evaluator skip:** If no TS/package changes, skip TypeScript evaluator entirely; mark all TS-owned questions N/A. If no runtime/env/framework changes, skip Node runtime evaluator entirely; mark all NR-owned questions N/A. Shared questions are NEVER bulk-N/A'd.
**Triage shortcut — question-level bulk N/A:** Bulk-mark specific questions N/A when clearly irrelevant (no TS files → skip N2-N5, N11, N12; no async code → skip N6, N7, N22-N25, N27, N28, N35; no deployment → skip N31, N36; no HTTP server → skip N38). Shared questions are NEVER bulk-N/A'd.

---

## Question Definitions

Each returns **PASS** / **NEEDS_UPDATE** / **N/A**.
Weights: **3** = blocking | **2** = important | **1** = advisory.

### TypeScript Build & Types

**N1: Does the plan include a TypeScript build check?** (3, TS, never N/A when TS files present)
Plan must include `tsc --noEmit` or an equivalent compile step. A plan that skips type-checking
will push broken TypeScript silently and catch errors only at runtime.

**N4: Is type safety maintained throughout the change?** (2, TS)
`any` usage avoided or explicitly justified. New functions have typed parameters and return
types. No `as unknown as X` casts without justification. N/A: no new TypeScript code.

**N5: Does the plan interact with tsconfig.json correctly?** (2, TS)
strict mode, paths aliases, target, module format preserved. N/A: no tsconfig changes.

---

### Dependencies & Module System

**N2: Are npm/package changes justified and safe?** (2, TS)
Each new dependency justified (functionality, bundle size, maintenance). `npm audit` planned.
dev vs prod placement correct. N/A: no package.json changes.

**N3: Is the lock file updated?** (2, TS)
package-lock.json / yarn.lock / pnpm-lock.yaml updated as part of the change. N/A: no
dependency changes.

**N11: Is the module system consistent?** (2, TS)
ESM/CJS consistent with project setup. `import`/`require` not mixed. `"type": "module"` in
package.json aligns with file extensions. N/A: no new imports.

**N12: Are circular dependencies avoided?** (2, TS)
No new circular imports introduced. Flag if new module depends on a module that imports it.
N/A: no new modules.

**N30: Are phantom dependencies guarded in monorepos?** (2, TS)
Dependencies declared in the correct workspace package. No reliance on hoisted transitive
deps. TypeScript project references (`references` in tsconfig) correct. N/A: not a
monorepo/workspace.

**N37: Is TypeScript declaration output configured correctly?** (1, TS)
`.d.ts` generation configured correctly. `exports` map in package.json covers entry points.
strict compat for downstream consumers. N/A: not a published library/package.

---

### Async & Concurrency

**N6: Are async entry points wrapped in error handlers?** (2, TS)
All async route handlers, event listeners, top-level async code wrapped in `try/catch` or
`.catch()`. Unhandled async errors crash Node processes. N/A: no new async code.

**N7: Are all promises awaited or caught?** (2, TS)
All async calls awaited or `.catch()`-ed. No fire-and-forget without error handling.
`void` operator used intentionally where non-blocking is desired. N/A: no new async code.

**N8: Is concurrency safety addressed?** (2, Shared)
No race conditions on shared mutable state. `Promise.all` where parallel is safe.
Mutex/lock for shared resources. N/A: read-only operations only.

---

### Environment & Configuration

**N9: Are new environment variables documented?** (2, NR)
New `process.env.*` references documented in `.env.example`. Validated at startup for
crash-fast behavior (not silently undefined mid-request). N/A: no new `process.env` refs.

**N10: Is configuration hygiene maintained?** (2, NR)
`.env.example` updated alongside `.env` changes. No secrets hardcoded in source files or
committed `.env`. N/A: no env changes.

**N33: Are secrets managed securely?** (2, NR)
Secrets sourced from vault/runtime injection rather than static `.env` files. `process.env`
exposure minimized (don't pass entire `process.env` to functions). N/A: no new secrets or
credentials.

---

### Node Process Lifecycle

**N13: Is graceful shutdown implemented for new resources?** (2, NR)
SIGTERM/SIGINT handlers cover new resources: DB connections, open handles, HTTP servers,
timers, queues. `server.close()` before `process.exit()`. N/A: no new persistent resources.

**N35: Are process crash handlers in place for new async paths?** (2, NR)
`process.on('unhandledRejection')` and `process.on('uncaughtException')` cover new async
paths. Pattern: log-then-exit, not swallow. N/A: no new async code paths.

**N36: Is Kubernetes/container shutdown handled correctly?** (2, NR)
SIGTERM handler includes readiness probe delay and connection draining before exit.
CMD in Dockerfile uses exec form (not shell wrapper) so signal forwarding works.
N/A: not containerized/K8s, or no service lifecycle changes.

---

### Runtime Safety

**N14: Is memory and streaming handled safely?** (2, NR)
Large data sets processed with streams or pagination. Buffer accumulation bounded. No
unbounded array growth in long-lived processes. N/A: no bulk data operations.

**N22: Are event-loop-blocking operations avoided?** (2, NR)
No `readFileSync`/`writeFileSync` in request handlers. No synchronous CPU-heavy operations
(large `JSON.parse`, heavy regex, tight loops) on the main thread. Offload to worker
threads where needed. N/A: no new file I/O, no heavy computation in request handlers.

**N23: Are regular expressions safe from ReDoS?** (2, NR)
No nested quantifiers (`(a+)+`, `(a|a)*`) applied to user-controlled input. Regex
complexity proportional to bounded input. N/A: no new regex patterns, or regex only on
bounded internal data.

**N24: Is stream pipeline safety addressed?** (2, NR)
Uses `stream.pipeline()` over `.pipe()` for automatic error propagation. Errors handled on
all stream segments. Backpressure respected. N/A: no stream operations.

**N25: Is EventEmitter hygiene maintained?** (2, NR)
Listeners cleaned up with `.once()` or explicit `.removeListener()`/`.off()`.
`error` event handled on all custom EventEmitter instances to prevent crash. N/A: no new
EventEmitter usage.

**N26: Are timers stored and cleared?** (1, NR)
`setTimeout`/`setInterval` return values stored and cleared in cleanup paths.
Long-lived timers `.unref()`'d to prevent blocking process exit. N/A: no new timers.

**N27: Are child processes and worker threads managed safely?** (2, NR)
Workers/child processes have `error` event handlers. Terminated in shutdown path. No
orphan processes on parent exit. N/A: no `child_process` or `worker_threads` usage.

**N28: Do outbound HTTP calls configure timeouts?** (2, NR)
Outbound HTTP/HTTPS calls set connect and response timeouts. Connection pooling and
keep-alive configured for high-throughput paths. N/A: no outbound HTTP calls.

---

### Framework & Infrastructure

**N15: Is framework integration correct?** (2, NR)
Express/Fastify/Koa/NestJS middleware order correct (auth before route handlers, error
middleware last in Express). New routes registered in the correct router/module. N/A: no
framework-level changes.

**N16: Are changes compatible with the Node.js version constraint?** (2, NR)
Changes compatible with `.nvmrc` or `engines` field in package.json. No APIs used that
require a newer Node than specified. N/A: no version-sensitive API usage.

**N17: Is the security surface considered for new endpoints?** (2, NR)
New HTTP endpoints use appropriate middleware: helmet, cors with whitelist, rate-limit.
Authentication/authorization applied. N/A: no new HTTP endpoints.

**N18: Are database schema changes handled with migrations?** (2, NR)
Schema changes include forward migration files. Rollback migration exists. Migration run
order explicit. N/A: no schema changes.

**N38: Does the HTTP service include a health/readiness endpoint?** (1, NR)
If the plan creates or modifies an HTTP service (Express, Fastify, Koa, etc.): does it
include or preserve a /health or /readiness endpoint suitable for load balancer or
container orchestration readiness probes? N/A: non-HTTP service (CLI tool, library,
background worker without HTTP interface).

---

### Containers & Deployment

**N31: Are Docker/container concerns addressed?** (1, NR)
Non-root user in Dockerfile. Signal forwarding via exec form CMD. `.dockerignore` excludes
`node_modules`, `.env`, secrets. Multi-stage build for smaller production image. N/A: no
Docker/container changes.

---

### Testing & Quality

**N19: Is test isolation maintained?** (1, TS)
New tests mock external dependencies (DB, HTTP, file system). No shared mutable state
between test cases. No test ordering dependencies. N/A: no new tests.

---

### Developer Experience

**N29: Are file paths handled correctly?** (1, TS)
Uses `path.join()`/`path.resolve()` rather than string concatenation for cross-platform
compatibility. ESM vs CJS path resolution accounted for (`__dirname` vs `import.meta.url`).
N/A: no file path operations.

**N32: Are native addons compatible across platforms?** (1, TS)
Packages with native bindings (bcrypt, sharp, better-sqlite3, canvas) account for
platform/ABI/architecture. Prebuilt binaries or compile toolchain documented. N/A: no
packages with native bindings.

**N34: Is the API contract kept in sync?** (1, NR)
OpenAPI/GraphQL/JSON Schema spec updated when endpoint response shapes change. Consumer
teams notified. N/A: no API endpoint changes, or no formal contract definitions.
