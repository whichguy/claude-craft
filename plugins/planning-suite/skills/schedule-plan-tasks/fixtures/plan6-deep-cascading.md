# Plan: Full User Authentication System

## Context

`my-node-server` needs a complete user authentication system: shared config, a user store,
JWT middleware, registration/login routes, a secured profile router, a rate limiter on auth
endpoints, integration tests, and a metrics endpoint.

**Idempotency:** each step is safe to re-run.
- File writes are unconditional overwrites.
- `git add && git commit` is diff-guarded throughout (`git diff --exit-code <files> || git commit`).
- All route/middleware mounts in `src/index.js` are grep-guarded.
- `npm test` is always safe to re-run.

**Project:** `fixtures/my-node-server`

## Expected Outcome

JWT-protected profile routes are live. Per-IP rate limiting enforces a threshold on `/auth/*`
endpoints. Integration test suite covers the full register → login → profile → rate-limit flow.
`GET /metrics/auth` returns per-IP request counts from the rate-limit store. `npm test` passes.

## Implementation Steps

---

### Phase A: Shared Auth Config

> Intent: Centralize all auth constants (JWT secret, expiry, rate-limit thresholds) in one
> importable config. Every downstream auth module imports from here — a single source of
> truth prevents constant drift across files.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `src/config/auth.js`

1. Create `src/config/auth.js`:
   ```js
   module.exports = {
     JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
     JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
     RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
     RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 20,
   };
   ```
2. `git diff --exit-code src/config/auth.js || git add src/config/auth.js && git commit -m "feat(auth): add shared auth config"`

---

### Phase B: User Store

> Intent: In-memory user store with `createUser`, `getUserById`, `getUserByEmail`, and
> `verifyPassword`. All downstream modules (JWT middleware and registration route) depend on
> this store. Imports `JWT_SECRET` from `src/config/auth.js` as the HMAC key for password hashing.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `src/db/userStore.js`

3. Read `src/config/auth.js` — confirm `JWT_SECRET` export before implementing.
4. Create `src/db/userStore.js`:
   ```js
   const crypto = require('crypto');
   const { JWT_SECRET } = require('../config/auth');

   const users = new Map();
   let nextId = 1;

   function hashPassword(pw) {
     return crypto.createHmac('sha256', JWT_SECRET).update(pw).digest('hex');
   }

   function createUser({ email, password, name }) {
     if (getUserByEmail(email)) throw new Error('Email already registered');
     const user = { id: String(nextId++), email, name, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
     users.set(user.id, user);
     return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
   }

   function getUserById(id) { return users.get(id) || null; }

   function getUserByEmail(email) {
     for (const u of users.values()) if (u.email === email) return u;
     return null;
   }

   function verifyPassword(user, password) {
     return user.passwordHash === hashPassword(password);
   }

   module.exports = { createUser, getUserById, getUserByEmail, verifyPassword };
   ```
5. `git diff --exit-code src/db/userStore.js || git add src/db/userStore.js && git commit -m "feat(auth): add in-memory user store"`

---

### Phase C: JWT Auth Middleware

> Intent: `requireJwt` middleware — validates `Authorization: Bearer <token>`, decodes the
> payload, looks up the user in the store, attaches `req.user`. Imports `getUserById` from
> `src/db/userStore.js` and `JWT_SECRET` from `src/config/auth.js`.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `src/middleware/requireJwt.js`, `test/middleware/requireJwt.test.js`

6. Read `src/db/userStore.js` and `src/config/auth.js` — verify exports.
7. Create `src/middleware/requireJwt.js`:
   ```js
   const crypto = require('crypto');
   const { JWT_SECRET } = require('../config/auth');
   const { getUserById } = require('../db/userStore');

   function verifyToken(token) {
     const parts = token.split('.');
     if (parts.length !== 3) throw new Error('malformed');
     const [h, p, sig] = parts;
     const expected = crypto.createHmac('sha256', JWT_SECRET)
       .update(`${h}.${p}`).digest('base64')
       .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
     if (expected !== sig) throw new Error('invalid signature');
     return JSON.parse(Buffer.from(p, 'base64').toString());
   }

   module.exports = function requireJwt(req, res, next) {
     const auth = req.headers['authorization'] || '';
     if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
     try {
       const payload = verifyToken(auth.slice(7));
       const user = getUserById(payload.sub);
       if (!user) return res.status(401).json({ error: 'User not found' });
       req.user = user;
       next();
     } catch {
       res.status(401).json({ error: 'Invalid token' });
     }
   };
   ```
8. Write `test/middleware/requireJwt.test.js`:
   - No Authorization header → 401 `{ error: 'Missing token' }`
   - Malformed token (not 3 parts) → 401 `{ error: 'Invalid token' }`
   - Valid-format token for non-existent user → 401 `{ error: 'User not found' }`
   - Valid token for an existing user → calls `next()` with `req.user` set
9. `npm test -- --grep requireJwt`
10. `git diff --exit-code src/middleware/requireJwt.js test/middleware/requireJwt.test.js || git add src/middleware/requireJwt.js test/middleware/requireJwt.test.js && git commit -m "feat(auth): add JWT verification middleware"`

---

### Phase D: User Registration/Login Routes

> Intent: `POST /auth/register` creates a new user; `POST /auth/login` returns a signed JWT.
> Imports `createUser`, `getUserByEmail`, `verifyPassword` from `src/db/userStore.js` and
> `JWT_SECRET` from `src/config/auth.js`.

**Idempotency:** overwrite + grep-guard for mount + diff-guarded commit.
**Outputs:** `src/routes/auth.js`, mounted at `/auth` in `src/index.js`

11. Read `src/db/userStore.js` and `src/config/auth.js` — verify exports.
12. Create `src/routes/auth.js`:
    ```js
    const crypto = require('crypto');
    const { Router } = require('express');
    const { JWT_SECRET } = require('../config/auth');
    const { createUser, getUserByEmail, verifyPassword } = require('../db/userStore');

    function signToken(payload) {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const p = Buffer.from(JSON.stringify(payload)).toString('base64');
      const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return `${h}.${p}.${sig}`;
    }

    const router = Router();

    router.post('/register', (req, res) => {
      const { email, password, name } = req.body || {};
      if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
      try {
        res.status(201).json(createUser({ email, password, name }));
      } catch (e) {
        res.status(409).json({ error: e.message });
      }
    });

    router.post('/login', (req, res) => {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });
      const user = getUserByEmail(email);
      if (!user || !verifyPassword(user, password)) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600 });
      res.json({ token });
    });

    module.exports = router;
    ```
13. Edit `src/index.js`: grep for `/auth` mount — if absent, add `app.use('/auth', require('./routes/auth'));`.
14. Write `test/routes/auth.test.js`:
    - `POST /auth/register` valid body → 201, body has `id`, `email`, `name`
    - `POST /auth/register` missing fields → 400
    - `POST /auth/register` duplicate email → 409
    - `POST /auth/login` valid credentials → 200, body has `token`
    - `POST /auth/login` wrong password → 401
15. `npm test -- --grep "auth routes"`
16. `git diff --exit-code src/routes/auth.js src/index.js test/routes/auth.test.js || git add src/routes/auth.js src/index.js test/routes/auth.test.js && git commit -m "feat(auth): add register and login routes"`

---

### Phase E: Secured Profile Router

> Intent: `GET /profile` and `PATCH /profile` endpoints protected by `requireJwt`. Imports
> the middleware from `src/middleware/requireJwt.js`. An integration test for this route
> needs to call `/auth/login` first to obtain a token, so both the auth routes and the JWT
> middleware must be committed before this phase can be tested end-to-end.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/profile.js`, mounted at `/profile` in `src/index.js`

17. Read `src/middleware/requireJwt.js` and `src/db/userStore.js` — verify exports.
18. Create `src/routes/profile.js`:
    ```js
    const { Router } = require('express');
    const requireJwt = require('../middleware/requireJwt');
    const { getUserById } = require('../db/userStore');

    const router = Router();

    router.get('/', requireJwt, (req, res) => {
      res.json(req.user);
    });

    router.patch('/', requireJwt, (req, res) => {
      const { name } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name required' });
      const user = getUserById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      user.name = name;
      res.json({ id: user.id, email: user.email, name: user.name });
    });

    module.exports = router;
    ```
19. Edit `src/index.js`: grep for `/profile` mount — if absent, add `app.use('/profile', require('./routes/profile'));`.
20. Write `test/routes/profile.test.js`:
    - `GET /profile` no token → 401
    - `GET /profile` valid token → 200, body is user object
    - `PATCH /profile` valid token, `{ name: 'New Name' }` → 200, updated name returned
    - `PATCH /profile` missing `name` → 400
21. `npm test -- --grep "profile routes"`
22. `git diff --exit-code src/routes/profile.js src/index.js test/routes/profile.test.js || git add src/routes/profile.js src/index.js test/routes/profile.test.js && git commit -m "feat(auth): add JWT-protected profile routes"`

---

### Phase F: Auth Rate Limiter

> Intent: Per-IP rate limiting on `/auth/*` endpoints (register and login). Exempts
> `/profile/*` — those are already JWT-gated. Reads `src/index.js` to confirm the current
> mount order before inserting the limiter ahead of the `/auth` handler.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/middleware/authRateLimit.js`, applied in `src/index.js` before `/auth` mount

23. Read `src/index.js` — note current order of `/auth` and `/profile` mounts.
24. Create `src/middleware/authRateLimit.js`:
    ```js
    const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = require('../config/auth');

    const store = new Map();

    function authRateLimit(req, res, next) {
      const key = req.ip;
      const now = Date.now();
      const entry = store.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_LIMIT_WINDOW_MS; }
      entry.count++;
      store.set(key, entry);
      res.setHeader('X-Auth-RateLimit-Limit', RATE_LIMIT_MAX);
      res.setHeader('X-Auth-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count));
      if (entry.count > RATE_LIMIT_MAX) return res.status(429).json({ error: 'Too many auth requests — slow down' });
      next();
    }

    authRateLimit.getStore = () => store;

    module.exports = authRateLimit;
    ```
25. Edit `src/index.js`: grep for `authRateLimit` — if absent, insert
    `app.use('/auth', require('./middleware/authRateLimit'));` immediately before the existing
    `/auth` route mount line (limiter must precede the handler).
26. Write `test/middleware/authRateLimit.test.js`:
    - First request to `/auth/login` → `X-Auth-RateLimit-Limit` header present
    - After `RATE_LIMIT_MAX + 1` requests from same IP → 429
    - Requests to `/profile` are NOT intercepted by this middleware (no rate-limit headers)
    - (Set `RATE_LIMIT_MAX=2` via env for test speed)
27. `npm test -- --grep authRateLimit`
28. `git diff --exit-code src/middleware/authRateLimit.js src/index.js test/middleware/authRateLimit.test.js || git add src/middleware/authRateLimit.js src/index.js test/middleware/authRateLimit.test.js && git commit -m "feat(auth): add per-IP rate limiting on auth endpoints"`

---

### Phase G: Auth Integration Tests

> Intent: End-to-end test of the complete auth flow: register → login → get profile →
> update profile → trigger rate limit. All six endpoints must be finalized (rate limiter
> in place) before these tests can make authoritative assertions about rate-limit headers
> and 429 behavior. Reads `src/index.js` to verify all mounts before writing.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `test/integration/authFlow.test.js`

29. Read `src/index.js` — verify `/auth` (with rate limiter before it) and `/profile` both mounted.
30. Create `test/integration/` directory if absent: `mkdir -p test/integration`.
31. Write `test/integration/authFlow.test.js`:
    ```js
    const request = require('supertest');
    const { expect } = require('chai');
    process.env.RATE_LIMIT_MAX = '50'; // avoid hitting limit mid-suite
    const app = require('../../src/index');

    describe('auth flow (integration)', () => {
      let token;

      it('POST /auth/register creates user', async () => {
        const res = await request(app).post('/auth/register')
          .send({ email: 'flow@example.com', password: 'secret', name: 'Flow Tester' });
        expect(res.status).to.equal(201);
        expect(res.body).to.have.property('id');
      });

      it('POST /auth/login returns token', async () => {
        const res = await request(app).post('/auth/login')
          .send({ email: 'flow@example.com', password: 'secret' });
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('token');
        token = res.body.token;
      });

      it('GET /profile returns user when authenticated', async () => {
        const res = await request(app).get('/profile')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).to.equal(200);
        expect(res.body.email).to.equal('flow@example.com');
      });

      it('PATCH /profile updates name', async () => {
        const res = await request(app).patch('/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Updated' });
        expect(res.status).to.equal(200);
        expect(res.body.name).to.equal('Updated');
      });

      it('auth endpoints expose rate-limit headers', async () => {
        const res = await request(app).post('/auth/login')
          .send({ email: 'flow@example.com', password: 'secret' });
        expect(res.headers).to.have.property('x-auth-ratelimit-limit');
        expect(res.headers).to.have.property('x-auth-ratelimit-remaining');
      });

      it('auth endpoint returns 429 after RATE_LIMIT_MAX exceeded', async () => {
        process.env.RATE_LIMIT_MAX = '1';
        // two requests — second exceeds limit of 1
        await request(app).post('/auth/login').send({ email: 'x@x.com', password: 'y' });
        const res = await request(app).post('/auth/login').send({ email: 'x@x.com', password: 'y' });
        expect(res.status).to.equal(429);
        process.env.RATE_LIMIT_MAX = '50';
      });
    });
    ```
32. `npm test -- --grep "auth flow"`
33. `git diff --exit-code test/integration/authFlow.test.js || git add test/integration/authFlow.test.js && git commit -m "test(auth): add end-to-end auth flow integration tests"`

---

### Phase H: Auth Metrics Endpoint

> Intent: `GET /metrics/auth` exposes per-IP request counts and current window state from
> the rate-limit store, giving operators visibility into auth traffic. Reads
> `src/middleware/authRateLimit.js` to confirm `getStore` is exported before building the route.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/metrics.js`, mounted at `/metrics` in `src/index.js`

34. Read `src/middleware/authRateLimit.js` — confirm `getStore` is exported.
35. Create `src/routes/metrics.js`:
    ```js
    const { Router } = require('express');
    const authRateLimit = require('../middleware/authRateLimit');

    const router = Router();

    router.get('/auth', (req, res) => {
      const entries = [];
      for (const [ip, entry] of authRateLimit.getStore().entries()) {
        entries.push({ ip, count: entry.count, resetAt: entry.resetAt });
      }
      res.json({ window: 'auth', entries });
    });

    module.exports = router;
    ```
36. Edit `src/index.js`: grep for `/metrics` mount — if absent, add `app.use('/metrics', require('./routes/metrics'));`.
37. Write `test/routes/metrics.test.js`:
    - `GET /metrics/auth` → 200, body has `window: 'auth'` and `entries` array
    - After a `/auth/login` request, the requesting IP appears in `entries` with `count >= 1`
38. `npm test -- --grep metrics`
39. `git diff --exit-code src/routes/metrics.js src/index.js test/routes/metrics.test.js || git add src/routes/metrics.js src/index.js test/routes/metrics.test.js && git commit -m "feat(auth): add /metrics/auth endpoint for rate-limit observability"`

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
upstream standalones) as well as the chain-1 tail delivery-agent (Phase B). Phase E (chain-2 head) cannot
start until all three upstream paths complete.

**Fan-in (Phase E):** Phase E declares DEPENDS ON Phase C and DEPENDS ON Phase D, because both the JWT
middleware and the auth routes must be committed before the profile router can be tested end-to-end.

**Regression Blocker Reduction:** Phase G and Phase H are direct successors of Phase F (chain-2 tail).
Because regression already waits on G and H, the edge from F to regression is redundant — Reduction
removes it, leaving F as a transitive (not direct) blocker. Phase F is NOT a direct regression blocker
after Reduction. Direct regression blockers: G and H (standalone delivery-agents that produce the final
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
