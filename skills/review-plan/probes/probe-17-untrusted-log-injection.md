<!-- expected-finding: Untrusted user-supplied X-Request-Id header flows directly into a log statement without sanitization, enabling log injection (CRLF / forged log lines). Should be flagged by Security & Error Handling: untrusted input crossing trust boundary without validation. -->

# Plan: Add Per-Request Correlation IDs to API Logging

## Context
Our Express API at `src/api/server.ts` produces logs without correlation across the request lifecycle — when a single request triggers `routes/orders.ts:placeOrder` → `services/inventory.ts:reserve` → `services/payments.ts:charge`, debugging requires manually stitching timestamps. Customer support escalations cite this gap (ticket OPS-4421, OPS-4502). We will thread a correlation ID through the request lifecycle and emit it on every log line.

**Project:** order-api (~/src/order-api)

## Approach
Add an Express middleware `src/middleware/requestId.ts` that reads the incoming `X-Request-Id` header from the client (clients already supply this — verified by reading `src/api/server.ts:42-58` and the request log dashboard). Attach it to `req.requestId`. Update the existing logger at `src/lib/logger.ts` (using `pino`) to include `requestId` as a structured field on every log call within a request scope. The chosen mechanism is `pino`'s child logger, created per-request from `req.requestId`.

**Why a header passthrough vs server-generated UUID:** the upstream gateway (`infra/gateway/nginx.conf:88`) already injects `X-Request-Id` and propagates it to downstream services; generating a fresh ID in this service would break end-to-end traceability across the gateway → order-api → inventory boundary.

## Implementation Steps

### Phase 1: Middleware + Logger Wiring

**Pre-check:** `src/api/server.ts` exists and currently registers middleware at line 64; `src/lib/logger.ts` exports `logger` from `pino()`.
**Outputs:** `src/middleware/requestId.ts`, updated `src/lib/logger.ts`, updated `src/api/server.ts`

1. Read `src/api/server.ts` to confirm middleware registration order (line ~64, after `bodyParser`).
2. Read `src/lib/logger.ts` to confirm `pino` is the active logger (verified: `pino({ level: process.env.LOG_LEVEL })`).
3. Create `src/middleware/requestId.ts`:
   - Export `requestIdMiddleware(req, res, next)`.
   - Read `req.headers['x-request-id']` (string).
   - Set `req.requestId = headerValue`.
   - Attach a child logger: `req.log = logger.child({ requestId: req.requestId })`.
   - Call `next()`.
4. Update `src/api/server.ts` to register `requestIdMiddleware` immediately after `bodyParser` (line 65 insertion).
5. Update `src/lib/logger.ts`: export the base `pino()` instance (no behavior change; child loggers are created per-request).

### Phase 2: Propagate to Route Handlers

**Pre-check:** Phase 1 outputs exist; `req.log` is populated on a sample request (manual curl test).
**Outputs:** Updated `routes/orders.ts`, `services/inventory.ts`, `services/payments.ts`

6. Update `routes/orders.ts:placeOrder`:
   - Replace `logger.info("placing order", {...})` with `req.log.info("placing order", {...})` at lines 24, 47, 89.
   - Pass `req.log` into `inventory.reserve(req.log, ...)` and `payments.charge(req.log, ...)`.
7. Update `services/inventory.ts:reserve(log, ...)` to accept the child logger as the first arg and use it for all `info`/`warn`/`error` calls.
8. Update `services/payments.ts:charge(log, ...)` similarly.

### Phase 3: Tests + Deployment

**Pre-check:** Phase 2 changes compile (`tsc --noEmit`).
**Outputs:** Updated `test/middleware/requestId.test.ts`, deployment notes

9. Add unit test in `test/middleware/requestId.test.ts`:
   - Mocked req with `X-Request-Id: abc123` → asserts `req.requestId === 'abc123'` and `req.log.bindings().requestId === 'abc123'`.
10. Add integration test in `test/integration/order-flow.test.ts`:
    - Issue a POST `/orders` with header `X-Request-Id: test-corr-1`. Capture `pino` output via a memory transport. Assert all 3 service-tier log lines include `requestId: "test-corr-1"`.
11. `npm run build && npm test` — all tests pass.
12. Deploy via existing pipeline: `git push origin feat/correlation-ids` → CI builds → staging deploy → smoke test → prod.

## Git Strategy
- Branch: `feat/correlation-ids`
- Per-phase commits.
- Push to remote, open PR, squash merge.

## Post-Implementation
1. `/review-fix` — loop until clean.
2. `npm run build`.
3. `npm test`.
4. If build/tests fail → fix → re-run `/review-fix` → re-run build/tests.

## Verification
- `tsc --noEmit` passes.
- All tests pass including new request-id tests.
- Manual curl with `-H "X-Request-Id: manual-test-1"` produces logs containing `"requestId":"manual-test-1"` across all 3 services.
- Staging dashboard (Grafana → "API Logs" panel) shows requestId field populated for the past hour after deploy.
