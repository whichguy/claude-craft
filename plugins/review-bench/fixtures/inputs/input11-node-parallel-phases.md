# Plan: Add Request Tracing — Backend Middleware + Frontend Header Injection

## Context

The API service has no distributed tracing. When a frontend request fails, there is no way to
correlate it with a backend log entry. We need to add trace ID propagation: the frontend attaches
an `X-Trace-Id` header to every API call; the backend middleware reads it (or generates one if
absent) and includes it in all log entries for that request. Both sides are independent — the
only shared contract is the header name (`X-Trace-Id`) and the UUID format, established here.

**Project:** api-service + frontend-app (TypeScript monorepo, `apps/api` + `apps/frontend`)

## Implementation Steps

### Phase 1: Backend Trace Middleware

New-file work: creates the Express middleware that reads or generates the trace ID and attaches
it to the request object, then registers it in the app and threads it through the logger.

**Pre-check:** None (new file — no prior phase dependencies)
**Outputs:** `apps/api/src/middleware/traceMiddleware.ts`; `req.traceId` accessible in all route handlers; `apps/api/src/logger.ts` emitting `traceId` field

1. Read `apps/api/src/middleware/authMiddleware.ts` — verify Express middleware pattern
   (signature, module export style, registration order in `app.ts`)
2. Create `apps/api/src/middleware/traceMiddleware.ts`:
   - `traceMiddleware(req, res, next)`: read `X-Trace-Id` header; if absent, generate
     `crypto.randomUUID()`; set `req.traceId = traceId`; forward header in response;
     call `next()`
3. Read `apps/api/src/app.ts` — verify middleware registration at line ~30 and confirm
   `authMiddleware` is currently first before route handlers
4. Edit `apps/api/src/app.ts`: register `traceMiddleware` before `authMiddleware`
5. Read `apps/api/src/logger.ts` — verify current log format string at line ~15
6. Edit `apps/api/src/logger.ts`: add `traceId` field to every log entry via `cls-hooked` context
7. Test: `npm run test:middleware --workspace=apps/api` — trace propagation unit tests
8. Commit: `git add apps/api/src/middleware/traceMiddleware.ts apps/api/src/app.ts apps/api/src/logger.ts && git commit -m "feat(trace): add backend trace ID middleware"`

### Phase 2: Frontend Trace Client

Independent new-file work: wraps `fetch` to inject the `X-Trace-Id` header. No backend code
needed at build time — the only shared contract (header name + UUID format) was established in
Context above.

**Pre-check:** None (new file — no dependency on Phase 1 at build time)
**Outputs:** `apps/frontend/src/client/traceClient.ts`; `X-Trace-Id` header present on all `fetch` calls from `apiClient.ts`

9. Read `apps/frontend/src/client/apiClient.ts` — verify current `fetch` call pattern at
   line ~22 and the module export style used by other client utilities
10. Create `apps/frontend/src/client/traceClient.ts`:
    - `createTracedFetch()`: returns a `fetch` wrapper that generates `crypto.randomUUID()`
      per request and injects `X-Trace-Id` header before delegating to native `fetch`
    - Export as `tracedFetch`
11. Edit `apps/frontend/src/client/apiClient.ts`:
    - Import `tracedFetch` from `./traceClient`
    - Replace `fetch(url, options)` with `tracedFetch(url, options)` at all call sites
12. Test: `npm run test:client --workspace=apps/frontend` — trace header injection unit tests
13. Commit: `git add apps/frontend/src/client/traceClient.ts apps/frontend/src/client/apiClient.ts && git commit -m "feat(trace): inject X-Trace-Id header on all API calls"`

### Phase 3: End-to-End Integration Test

Both the backend middleware (Phase 1) and frontend client (Phase 2) must exist before an
end-to-end test can send a traced request through the full stack and assert the same trace ID
appears in backend log output.

**Pre-check:** Phase 1 **Outputs** (`req.traceId` in route handlers) and Phase 2 **Outputs** (`tracedFetch` injecting `X-Trace-Id`) both present

14. Write `test/trace-integration.test.ts`:
    - Start test server with `traceMiddleware` registered
    - Use `tracedFetch` to POST to a test endpoint
    - Capture structured log output — assert `traceId` in log entry matches `X-Trace-Id` value
      sent by the client
15. Run full test suite: `npm test` — all passing
16. `tsc --noEmit` — zero type errors across both workspaces
17. Commit: `git add test/trace-integration.test.ts && git commit -m "test(trace): end-to-end trace ID propagation integration test"`

## Git Strategy

- Branch: `feat/request-tracing`
- Squash merge to main after integration tests pass

## Verification

- `npm run test:middleware` passes after Phase 1
- `npm run test:client` passes after Phase 2
- `npm test` passes after Phase 3
- `tsc --noEmit` zero errors
- Backend logs include `traceId` field matching `X-Trace-Id` header from frontend requests
