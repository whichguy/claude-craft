# Plan: Full User Authentication System

## Context

`my-node-server` needs a complete user authentication system: shared config, a user store,
JWT middleware, registration/login routes, a secured profile router, a rate limiter on auth
endpoints, integration tests, and a metrics endpoint.

**Idempotency:** every phase is safe to re-run. File writes are unconditional overwrites;
commits are diff-guarded; route/middleware mounts in `src/index.js` are grep-guarded.

**Project:** `fixtures/my-node-server`

## Expected Outcome

JWT-protected profile routes are live. Per-IP rate limiting enforces a threshold on `/auth/*`
endpoints. Integration test suite covers the full register → login → profile → rate-limit flow.
`GET /metrics/auth` returns per-IP request counts from the rate-limit store. `npm test` passes.

## Implementation Steps

This plan describes WHAT each phase must produce. Implementation (the actual code bodies) is
left to the agent executing the task — only the contract is specified here.

---

### Phase A: Shared Auth Config

> Intent: Centralize all auth constants (JWT secret, expiry, rate-limit thresholds) in one
> importable config. Every downstream auth module imports from here — a single source of
> truth prevents constant drift across files.

**Outputs:** `src/config/auth.js`
**Depends on:** nothing (root of the dependency graph)

Create `src/config/auth.js` exporting four constants, each env-overridable with sensible defaults:
- `JWT_SECRET` — secret for HMAC signing/verification (env `JWT_SECRET`, default `'dev-secret-change-in-prod'`)
- `JWT_EXPIRES_IN` — token lifetime (env `JWT_EXPIRES_IN`, default `'1h'`)
- `RATE_LIMIT_WINDOW_MS` — rate-limit window in ms (env `RATE_LIMIT_WINDOW_MS`, default `60000`)
- `RATE_LIMIT_MAX` — max requests per window (env `RATE_LIMIT_MAX`, default `20`)

---

### Phase B: User Store

> Intent: In-memory user store with CRUD primitives for the auth flow. All downstream auth
> modules (JWT middleware and registration route) depend on this store.

**Outputs:** `src/db/userStore.js`
**Depends on:** Phase A — imports `JWT_SECRET` for password hashing

Read `src/config/auth.js` first to confirm `JWT_SECRET` is exported.

Create `src/db/userStore.js` — in-memory `Map`-backed store. Exports:

| Export | Signature | Behavior |
|--------|-----------|----------|
| `createUser` | `({email, password, name})` → `{id, email, name, createdAt}` | Throws on duplicate email; assigns monotonic string `id`; stores HMAC-hashed password (not plaintext) |
| `getUserById` | `(id)` → user record or `null` | |
| `getUserByEmail` | `(email)` → user record or `null` | |
| `verifyPassword` | `(user, password)` → `boolean` | Recomputes HMAC and compares |

Internals: passwords HMAC-hashed via `crypto.createHmac('sha256', JWT_SECRET)` — never stored plaintext.

---

### Phase C: JWT Auth Middleware

> Intent: Express middleware that validates `Authorization: Bearer <token>`, decodes the
> payload, looks up the user, attaches `req.user`. Rejects with 401 on any failure.

**Outputs:** `src/middleware/requireJwt.js`, `test/middleware/requireJwt.test.js`
**Depends on:** Phase B — imports `getUserById` from `src/db/userStore.js` and `JWT_SECRET` from `src/config/auth.js`

Read `src/db/userStore.js` and `src/config/auth.js` first to verify their exports.

Create `src/middleware/requireJwt.js` — exports a default function `(req, res, next)`:
- Reads `Authorization` header. Missing or not `Bearer ` prefix → 401 `{error: 'Missing token'}`
- Token is a 3-segment HMAC-SHA256 JWT (header.payload.signature, base64url). Invalid signature → 401 `{error: 'Invalid token'}`
- Decoded payload's `sub` claim is the user ID. `getUserById(sub)` returns null → 401 `{error: 'User not found'}`
- Otherwise: assign `req.user`, call `next()`.

Write `test/middleware/requireJwt.test.js` — labeled `requireJwt` for `npm test --grep`. Cover:
- No `Authorization` header → 401 `{error: 'Missing token'}`
- Malformed token (not 3 parts) → 401 `{error: 'Invalid token'}`
- Valid-format token for non-existent user → 401 `{error: 'User not found'}`
- Valid token for existing user → calls `next()` with `req.user` populated

Verify with `npm test -- --grep requireJwt`.

---

### Phase D: User Registration/Login Routes

> Intent: `POST /auth/register` creates a new user; `POST /auth/login` authenticates and
> returns a signed JWT.

**Outputs:** `src/routes/auth.js`, mount in `src/index.js` at `/auth`, `test/routes/auth.test.js`
**Depends on:** Phase B — imports `createUser`, `getUserByEmail`, `verifyPassword` from `src/db/userStore.js` and `JWT_SECRET` from `src/config/auth.js`

Read `src/db/userStore.js` and `src/config/auth.js` first to verify exports.

Create `src/routes/auth.js` — exports an Express `Router` with:
- `POST /register` — body `{email, password, name}`. Missing fields → 400. Duplicate email → 409. Success → 201 with the new user record.
- `POST /login` — body `{email, password}`. Missing fields → 400. Wrong credentials → 401. Success → 200 with `{token}` where `token` is an HMAC-SHA256 JWT signed with `JWT_SECRET`, payload includes `sub` (user id), `email`, and `exp` (1 hour from now).

Edit `src/index.js`: grep for the `/auth` mount; if absent, mount the router at `/auth`.

Write `test/routes/auth.test.js` — labeled `auth routes`. Cover:
- Register with valid body → 201, response has `id`, `email`, `name`
- Register missing fields → 400
- Register duplicate email → 409
- Login with valid credentials → 200, response has `token`
- Login with wrong password → 401

Verify with `npm test -- --grep "auth routes"`.

---

### Phase E: Secured Profile Router

> Intent: `GET /profile` and `PATCH /profile` endpoints, both gated by `requireJwt`. End-to-end
> testability requires both the JWT middleware AND the auth routes to be in place — Phase E
> integration tests must `POST /auth/login` first to obtain a real token.

**Outputs:** `src/routes/profile.js`, mount in `src/index.js` at `/profile`, `test/routes/profile.test.js`
**Depends on:** Phase C (uses `requireJwt`) AND Phase D (tests need `/auth/login` to be live)

Read `src/middleware/requireJwt.js` and `src/db/userStore.js` first.

Create `src/routes/profile.js` — Express `Router` with:
- `GET /` (gated by `requireJwt`) — returns `req.user`
- `PATCH /` (gated by `requireJwt`) — body `{name}`. Missing `name` → 400. User not found → 404. Success → 200 with the updated user record.

Edit `src/index.js`: grep for the `/profile` mount; if absent, mount the router at `/profile`.

Write `test/routes/profile.test.js` — labeled `profile routes`. Cover:
- `GET /profile` no token → 401
- `GET /profile` valid token → 200, response is the user object
- `PATCH /profile` valid token + `{name: 'New Name'}` → 200 with updated name
- `PATCH /profile` missing `name` → 400

Verify with `npm test -- --grep "profile routes"`.

---

### Phase F: Auth Rate Limiter

> Intent: Per-IP rate limiting on `/auth/*` endpoints. Inserted before the `/auth` mount so it
> only intercepts auth traffic — `/profile/*` is JWT-gated already and exempt. Exposes a
> `getStore` accessor for the metrics endpoint.

**Outputs:** `src/middleware/authRateLimit.js`, mount in `src/index.js` before `/auth`, `test/middleware/authRateLimit.test.js`
**Depends on:** Phase E — needs `/profile` mount in `src/index.js` already in place so the limiter can be inserted ahead of `/auth` without disturbing `/profile`

Read `src/index.js` first to verify current `/auth` and `/profile` mount order.

Create `src/middleware/authRateLimit.js` — exports a middleware function plus a `getStore()` accessor:
- Tracks `{count, resetAt}` per `req.ip` in an in-memory `Map`.
- Resets `count` when `Date.now() > resetAt`.
- Sets response headers `X-Auth-RateLimit-Limit` (= `RATE_LIMIT_MAX`) and `X-Auth-RateLimit-Remaining` (max(0, `RATE_LIMIT_MAX - count`)) on every call.
- Returns 429 `{error: 'Too many auth requests — slow down'}` when `count > RATE_LIMIT_MAX`; otherwise calls `next()`.
- Module also exports `getStore()` returning the underlying `Map` (used by Phase H).

Edit `src/index.js`: grep for `authRateLimit`; if absent, insert `app.use('/auth', require('./middleware/authRateLimit'))` immediately before the existing `/auth` route mount line. Limiter must precede the handler.

Write `test/middleware/authRateLimit.test.js` — labeled `authRateLimit`. Cover:
- First request to `/auth/login` → response includes `X-Auth-RateLimit-Limit` header
- After `RATE_LIMIT_MAX + 1` requests from the same IP → 429
- Requests to `/profile/*` are NOT rate-limit-headered (limiter doesn't intercept)
- Use `RATE_LIMIT_MAX=2` via env for fast test

Verify with `npm test -- --grep authRateLimit`.

---

### Phase G: Auth Integration Tests

> Intent: End-to-end test of the complete auth flow. All earlier phases must be merged before
> this can make authoritative assertions about rate-limit behavior and 429 emission.

**Outputs:** `test/integration/authFlow.test.js`
**Depends on:** Phase F — full mount chain (auth routes + JWT middleware + rate limiter) must be live in `src/index.js`

Read `src/index.js` first to verify `/auth` (with rate limiter ahead of it) and `/profile` are both mounted.

Create `test/integration/` directory if absent.

Write `test/integration/authFlow.test.js` — labeled `auth flow`. Use supertest. Set
`process.env.RATE_LIMIT_MAX = '50'` at file scope so the cross-test traffic doesn't hit the
limit until the dedicated 429 case. Cases (in order, sharing a `token` variable):
1. `POST /auth/register` for a fresh user → 201 with `id` populated
2. `POST /auth/login` for that user → 200 with `token` populated; capture token
3. `GET /profile` with `Authorization: Bearer <token>` → 200, `email` matches the registered user
4. `PATCH /profile` with the token and `{name: 'Updated'}` → 200 with `name === 'Updated'`
5. Auth endpoints expose rate-limit headers on every response (`x-auth-ratelimit-limit`, `x-auth-ratelimit-remaining`)
6. Setting `RATE_LIMIT_MAX = '1'` then making 2 login requests → second returns 429. Restore `RATE_LIMIT_MAX = '50'` after.

Verify with `npm test -- --grep "auth flow"`.

---

### Phase H: Auth Metrics Endpoint

> Intent: `GET /metrics/auth` exposes per-IP rate-limit observability — operators can see
> which IPs are hitting the limiter.

**Outputs:** `src/routes/metrics.js`, mount in `src/index.js` at `/metrics`, `test/routes/metrics.test.js`
**Depends on:** Phase F — uses `authRateLimit.getStore()` to read the rate-limit map

Read `src/middleware/authRateLimit.js` first to confirm `getStore` is exported.

Create `src/routes/metrics.js` — Express `Router` with:
- `GET /auth` — iterates `getStore()`, returns 200 with body `{window: 'auth', entries: [{ip, count, resetAt}, ...]}`

Edit `src/index.js`: grep for the `/metrics` mount; if absent, mount the router at `/metrics`.

Write `test/routes/metrics.test.js` — labeled `metrics`. Cover:
- `GET /metrics/auth` → 200 with body shape `{window: 'auth', entries: array}`
- After a `/auth/login` request, the requesting IP appears in `entries` with `count >= 1`

Verify with `npm test -- --grep metrics`.

---

## Git Strategy

This plan has a cascade topology. The schedule-plan-tasks skill will detect:

- **chain-1**: Phase A (Auth Config, head) → Phase B (User Store, chain-1 tail, succ=2 fan-out)
- **chain-2**: Phase E (Secured Profile, chain-2 head, pred=2 fan-in) → Phase F (Auth Rate Limiter, tail)
- **standalone C**: Phase C (JWT Auth Middleware) — DEPENDS ON Phase B
- **standalone D**: Phase D (User Registration/Login Routes) — DEPENDS ON Phase B
- **standalone G**: Phase G (Auth Integration Tests) — DEPENDS ON Phase F
- **standalone H**: Phase H (Auth Metrics Endpoint) — DEPENDS ON Phase F

**Fan-in wiring (chain-2 create-wt):** chain-2's create-wt task is blocked by both C and D (the two
upstream standalones) as well as the chain-1 tail run-agent (Phase B). Phase E (chain-2 head) cannot
start until all three upstream paths complete.

**Fan-in (Phase E):** Phase E declares DEPENDS ON Phase C and DEPENDS ON Phase D, because both the JWT
middleware and the auth routes must be committed before the profile router can be tested end-to-end.

**Regression Blocker Reduction:** Phase G and Phase H are direct successors of Phase F (chain-2 tail).
Because regression already waits on G and H, the edge from F to regression is redundant — Reduction
removes it, leaving F as a transitive (not direct) blocker. Phase F is NOT a direct regression blocker
after Reduction. Direct regression blockers: G and H (standalone run-agents that produce the final
test artifacts).

## Verification

- `npm test` passes (requireJwt, auth routes, profile routes, authRateLimit, integration, metrics)
- `POST /auth/register` → 201 `{ id, email, name, createdAt }`
- `POST /auth/login` → 200 `{ token: "..." }`
- `GET /profile` with valid token → 200 user object
- `PATCH /profile` with valid token → 200 updated user
- After `RATE_LIMIT_MAX` login attempts: 429 `{ error: "Too many auth requests..." }`
- `X-Auth-RateLimit-Limit` and `X-Auth-RateLimit-Remaining` headers on all `/auth/*` responses
- `GET /metrics/auth` → 200 `{ window: "auth", entries: [...] }`
