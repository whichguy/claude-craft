# Plan: Add Rate Limiting to MCP Gas API Endpoints

## Context
The mcp_gas server currently has no rate limiting on API endpoints. Heavy usage from concurrent Claude Code sessions can overwhelm the Google Apps Script execution quota. Need to add per-user rate limiting with configurable thresholds.

**Project:** mcp_gas (~/src/mcp_gas)

## Expected Outcome
After this change, each user's requests to the MCP Gas API are throttled to 60 requests/minute (burst of 10). Exceeding the limit returns HTTP 429 with a `retry-after` header. The GAS execution quota is protected from burst exhaustion by concurrent Claude Code sessions. Success is verified by all unit tests passing (token bucket algorithm correct), integration tests confirming 429 is returned after threshold, `tsc --noEmit` passing, and a manual rapid-call test returning 429 at threshold.

## Architectural Note
`src/middleware/` is a new directory — an intentional structural choice. Rate limiting is a cross-cutting concern applied at the facade level, not an operation module concern. Placing it in `src/middleware/` keeps `gasClient.ts` clean and makes the middleware independently testable. Alternative considered: inline rate limiting in `gasClient.ts` — rejected to preserve separation of concerns.

## Test Strategy
Unit tests must cover: (1) token bucket refills correctly after the configured interval, (2) burst size respected — requests beyond burst return 429, (3) per-user isolation — user A's limit does not affect user B, (4) cleanup removes expired buckets from the Map. Integration tests must cover: rapid sequential calls exceed threshold and return 429 with Retry-After header.

## Implementation Steps

### Phase 1: Rate Limiter Module

> Intent: Build the standalone rate limiter module with token bucket algorithm. This phase creates all new files with no modifications to existing code — safe to commit independently.

**Pre-check:** None (new module)
**Outputs:** `src/middleware/rateLimiter.ts`, rate limiter types

1. Create `src/middleware/rateLimiter.ts` **[parallel with step 2]**:
   - Token bucket algorithm with per-user tracking
   - Configurable rate (requests/minute) and burst size
   - In-memory store (Map<string, TokenBucket>) — bounded: evict least-recently-used entries when Map exceeds 10,000 entries to prevent unbounded growth in long-running process
   - Export `createRateLimiter(config: RateLimitConfig): RateLimiterHandle` (returns handle with `middleware` and `stop` — use `RateLimiterHandle` type, not `RateLimitMiddleware` directly)
   - `createRateLimiter` returns `{ middleware: RateLimitMiddleware, stop: () => void }` where `stop()` calls `clearInterval` on the cleanup timer
   - Initialization case: when userId not found in Map, initialize fresh TokenBucket with `tokens = burstSize` (first request from new user always succeeds)
   - Token check and update must be synchronous (no `await` between reading and writing tokens) — document in code: "token check-and-update is synchronous for atomicity in Node's event loop"
   - `RateLimitMiddleware` wraps execution in try/catch — if token bucket throws, fall through to allowing the request rather than crashing the server
   - Cleanup interval callback wrapped in try/catch — log errors but never let cleanup crash the process
   - Add brief comments: module purpose at top of file, token refill logic, cleanup interval registration

2. Add types to `src/types/rateLimitTypes.ts` **[parallel with step 1]**:
   - `RateLimitConfig { ratePerMinute: number, burstSize: number, cleanupIntervalMs: number }`
   - `TokenBucket { tokens: number, lastRefill: number }`
   - `RateLimitMiddleware` function signature
   - `RateLimiterHandle { middleware: RateLimitMiddleware, stop: () => void }`

> In a SINGLE message, create steps 1 and 2 as parallel Tasks.

3. Run `tsc --noEmit` to verify `rateLimiter.ts` and `rateLimitTypes.ts` compile without errors before proceeding to Phase 2.

4. `git add src/middleware/rateLimiter.ts src/types/rateLimitTypes.ts && git commit -m "feat: add rate limiter module and types"`

### Phase 2: Integration

> Intent: Wire the rate limiter into the existing gasClient facade. This phase modifies existing files — depends on Phase 1 outputs being available and verified.

**Pre-check:** `src/middleware/rateLimiter.ts` and `src/types/rateLimitTypes.ts` exist and `tsc --noEmit` passes on Phase 1 files
**Outputs:** Updated `gasClient.ts`, config entries, updated `.env.example`

5. Read `src/api/gasClient.ts` and verify: (1) facade structure — which operation module functions exist and where calls are made, (2) request context parameter — confirm it carries a userId or caller identifier (name the exact field), (3) which operations should be rate-limited vs exempt (health checks, internal admin operations). If userId is absent from context, define the fallback identifier (session ID, API key, IP) before proceeding.

6. Read the ConfigManager source file (locate path first) and verify: current initialization pattern and how to add new config keys with environment variable overrides — confirm the naming convention for env vars (check 1-2 existing env var entries).

7. Integrate rate limiter into `src/api/gasClient.ts` facade:
   - Apply before each operation module call (using exemption list identified in step 5)
   - Extract userId from request context using the field name verified in step 5
   - Return 429 with Retry-After header on limit exceeded
   - Integrate `rateLimiterHandle.stop()` into the server shutdown handler (SIGTERM/SIGINT)
   - **Caller impact:** gasClient.ts is the central facade — all 7 operation modules (gasAuthOperations, gasProjectOperations, gasFileOperations, gasDeployOperations, gasScriptOperations, gasProcessOperations, gasLoggingOperations) route through it. Each caller receives 429 transparently; verify that the MCP server layer already handles 429-typed errors gracefully (error propagated to Claude Code session, not silently swallowed)
   - Update any existing gasClient tests that call operation modules directly — configure with high rate limit or mock the limiter to avoid test interference

8. Add rate limit configuration to `ConfigManager`:
   - Default: 60 requests/minute, burst of 10
   - Environment variable overrides: `MCP_GAS_RATE_LIMIT`, `MCP_GAS_RATE_BURST` (using naming convention verified in step 6)
   - Add `MCP_GAS_RATE_LIMIT` and `MCP_GAS_RATE_BURST` to `.env.example` with default values and descriptions
   - Add startup validation: if values are present but non-numeric, fail fast with descriptive error

9. Run `tsc --noEmit` to verify Phase 2 integration compiles before writing tests.

10. `git add src/api/gasClient.ts [ConfigManager path] .env.example && git commit -m "feat: integrate rate limiter into gasClient facade"`

### Phase 3: Testing & Deployment

> Intent: Verify correctness with automated tests, update documentation, and confirm the full build passes. This phase makes the feature production-ready and generates the commit artifact for the feature branch.

**Pre-check:** `gasClient.ts` updated with rate limiter integration, `ConfigManager` has `MCP_GAS_RATE_LIMIT`/`MCP_GAS_RATE_BURST` config keys, `.env.example` updated, and Phase 2 `tsc --noEmit` passes
**Outputs:** Test files, updated README

11. Write unit tests for token bucket algorithm (covering all cases from Test Strategy above) **[parallel with step 12]**

12. Write integration tests for rate-limited API calls **[parallel with step 11]**:
    - Mock gasClient operation modules — test that middleware correctly intercepts and limits without making real GAS API calls

> In a SINGLE message, write steps 11 and 12 as parallel Tasks.

13. Update README with rate limit configuration docs

14. Build and verify: `npm run build && npm test`

15. `git add [test files] README.md && git commit -m "test: rate limiter unit/integration tests; docs: update README"`

## Git Strategy
- Feature branch: `feat/rate-limiting`
- Squash merge to main after tests pass

## Verification
- `tsc --noEmit` passes
- All tests pass
- Manual test: rapid API calls return 429 after threshold

## Post-Implementation Workflow
1. `/review-fix --scope=branch` — loop until clean
2. Run build: `npm run build`
3. Run tests: `npm test`
4. If build or tests fail: fix issues → re-run `/review-fix --scope=branch` → re-run build/tests — repeat until passing

## Push & Merge
- `git push -u origin feat/rate-limiting`
- Open PR to main; squash merge after tests pass
