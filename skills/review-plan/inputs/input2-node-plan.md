# Plan: Add Rate Limiting to MCP Gas API Endpoints

## Context
The mcp_gas server currently has no rate limiting on API endpoints. Heavy usage from concurrent Claude Code sessions can overwhelm the Google Apps Script execution quota. Need to add per-user rate limiting with configurable thresholds.

**Project:** mcp_gas (~/src/mcp_gas)

## Implementation Steps

### Phase 1: Rate Limiter Module

**Pre-check:** None (new module)
**Outputs:** `src/middleware/rateLimiter.ts`, rate limiter types

1. Create `src/middleware/rateLimiter.ts`:
   - Token bucket algorithm with per-user tracking
   - Configurable rate (requests/minute) and burst size
   - In-memory store (Map<userId, TokenBucket>)
   - Export `createRateLimiter(config: RateLimitConfig): RateLimitMiddleware`

2. Add types to `src/types/rateLimitTypes.ts`:
   - `RateLimitConfig { ratePerMinute: number, burstSize: number, cleanupIntervalMs: number }`
   - `TokenBucket { tokens: number, lastRefill: number }`
   - `RateLimitMiddleware` function signature

### Phase 2: Integration

**Pre-check:** Phase 1 outputs exist
**Outputs:** Updated `gasClient.ts`, config entries

3. Integrate rate limiter into `src/api/gasClient.ts` facade:
   - Apply before each operation module call
   - Extract userId from request context
   - Return 429 with retry-after header on limit exceeded

4. Add rate limit configuration to `ConfigManager`:
   - Default: 60 requests/minute, burst of 10
   - Environment variable overrides: `MCP_GAS_RATE_LIMIT`, `MCP_GAS_RATE_BURST`

### Phase 3: Testing & Deployment

**Pre-check:** Phase 2 outputs exist
**Outputs:** Test files, updated docs

5. Write unit tests for token bucket algorithm
6. Write integration tests for rate-limited API calls
7. Update README with rate limit configuration docs
8. Build and verify: `npm run build && npm test`

## Git Strategy
- Feature branch: `feat/rate-limiting`
- Squash merge to main after tests pass

## Verification
- `tsc --noEmit` passes
- All tests pass
- Manual test: rapid API calls return 429 after threshold
