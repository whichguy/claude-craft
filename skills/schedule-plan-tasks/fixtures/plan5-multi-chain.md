# Plan: Full Server Assembly — API Router Chain, Middleware Chain, Admin Page, Smoke Test

## Context

`my-node-server` gets its complete feature set in one plan: two parallel chains (API router
stack, middleware stack), one independent standalone (admin HTML page), and a final smoke test
that depends on all three. This is the most complex graph this plan set exercises.

**Topology:**
- **Chain A** (API router stack): items router → paginated items extension. Items router must
  land first; pagination extends it in the same worktree.
- **Chain B** (middleware stack): CORS middleware → rate-limit middleware. CORS lands first;
  rate-limit adds a dependency on CORS config in the same worktree.
- **Standalone**: Admin HTML page at `GET /admin` — a fully self-contained static page.
  No dependency on A or B.
- **Final smoke test**: boots the full server and exercises all three outputs. DEPENDS ON
  Chain A tail, Chain B tail, and the standalone.

This exercises: multi-chain worktree isolation, Assert 5 (regression blocked only by chain
tails + standalone), Assert 7 (one create-wt per chain), and the parallel merge-back timing
when all three complete before the smoke test can start.

**Idempotency:**
- File writes are unconditional overwrites — re-runs are safe.
- `git add && git commit` is diff-guarded throughout.
- All mount/require additions are grep-guarded.
- `npm test` and the smoke test are always safe to re-run.

**Project:** `fixtures/my-node-server`

## Expected Outcome

`GET /api/items?page=1&limit=10` returns paginated results. CORS headers present on all
responses. Rate limiting returns 429 after threshold. `GET /admin` returns an admin HTML page.
Full smoke test passes confirming all routes respond correctly end-to-end.

## Implementation Steps

---

### Chain A — Phase 1: API Router + Items Handler

> Intent: Centralized Express Router mounted at `/api`, with the items handler as its first
> route. Foundation for paginated extension in Chain A Phase 2.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/api/index.js`, `src/routes/api/items.js`, mounted in `src/index.js`

1. Create `src/routes/api/items.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   const store = [];
   router.get('/items', (req, res) => res.json({ items: store, total: store.length }));
   router.post('/items', (req, res) => {
     if (typeof req.body.name !== 'string') return res.status(400).json({ error: 'name required' });
     const item = { id: Date.now().toString(), name: req.body.name };
     store.push(item);
     res.status(201).json(item);
   });
   module.exports = router;
   ```
2. Create `src/routes/api/index.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   router.use(require('./items'));
   module.exports = router;
   ```
3. Edit `src/index.js`: grep for `/api` mount — if absent, add
   `app.use('/api', require('./routes/api'));`.
4. Write `test/api/items.test.js`:
   - `GET /api/items` → 200, `{ items: [], total: 0 }`
   - `POST /api/items` valid → 201, body has `id` and `name`
   - `POST /api/items` no `name` → 400
5. `npm test -- --grep "api/items"`
6. `git diff --exit-code src/routes/api src/index.js test/api/items.test.js || git add src/routes/api src/index.js test/api/items.test.js && git commit -m "feat(api): add centralized API router and items handler"`

### Chain A — Phase 2: Paginated Items Extension

> Intent: Extend `GET /api/items` with `?page` and `?limit` query params.
> DEPENDS ON Chain A Phase 1 — edits `src/routes/api/items.js` from the same chain worktree.

**Pre-check:** `src/routes/api/items.js` present from Chain A Phase 1.
**Idempotency:** in-place edit is idempotent if guard comment is already present; diff-guarded commit.
**Outputs:** `src/routes/api/items.js` updated with pagination logic

7. Read `src/routes/api/items.js` — grep for `page` param; if already present, skip to step 9.
8. Edit `src/routes/api/items.js` — replace the `GET /items` handler:
   ```js
   router.get('/items', (req, res) => {
     const page = Math.max(1, parseInt(req.query.page, 10) || 1);
     const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
     const start = (page - 1) * limit;
     const items = store.slice(start, start + limit);
     res.json({ items, total: store.length, page, limit });
   });
   ```
9. Write `test/api/items-pagination.test.js`:
   - Seed 15 items; `GET /api/items?page=1&limit=10` → 10 items, `total: 15`, `page: 1`
   - `GET /api/items?page=2&limit=10` → 5 items, `total: 15`, `page: 2`
   - `limit` clamps to 100; `page` defaults to 1
10. `npm test -- --grep "pagination"`
11. `git diff --exit-code src/routes/api/items.js test/api/items-pagination.test.js || git add src/routes/api/items.js test/api/items-pagination.test.js && git commit -m "feat(api): add pagination to GET /api/items"`

---

### Chain B — Phase 1: CORS Middleware

> Intent: CORS headers on all responses, configurable via `CORS_ORIGIN` env var.
> Independent of Chain A.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/middleware/cors.js`, mounted in `src/index.js`

12. Create `src/middleware/cors.js`:
    ```js
    const ORIGIN = process.env.CORS_ORIGIN || '*';
    module.exports = function cors(req, res, next) {
      res.setHeader('Access-Control-Allow-Origin', ORIGIN);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    };
    ```
13. Write `test/middleware/cors.test.js`:
    - `GET /health` response has `Access-Control-Allow-Origin: *`
    - `OPTIONS /health` → 204 with CORS headers
14. `npm test -- --grep cors`
15. Edit `src/index.js`: grep for `cors` — if absent, add `app.use(require('./middleware/cors'));`
    as the first `app.use` (before any route mounts).
16. `git diff --exit-code src/middleware/cors.js src/index.js test/middleware/cors.test.js || git add src/middleware/cors.js src/index.js test/middleware/cors.test.js && git commit -m "feat: add CORS middleware"`

### Chain B — Phase 2: Rate Limit Middleware

> Intent: Simple token-bucket rate limiter keyed by IP. Shares the Chain B worktree.
> DEPENDS ON Chain B Phase 1 — rate limiter exempts preflight requests using the same
> OPTIONS check already established by the CORS config pattern.

**Pre-check:** `src/middleware/cors.js` present from Chain B Phase 1.
**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/middleware/rateLimit.js`, mounted in `src/index.js`

17. Create `src/middleware/rateLimit.js`:
    ```js
    const WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS, 10) || 60000;
    const MAX_REQUESTS = parseInt(process.env.RATE_MAX, 10) || 100;
    const store = new Map();
    module.exports = function rateLimit(req, res, next) {
      if (req.method === 'OPTIONS') return next(); // exempt preflight (mirrors CORS exemption)
      const key = req.ip;
      const now = Date.now();
      const entry = store.get(key) || { count: 0, resetAt: now + WINDOW_MS };
      if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + WINDOW_MS; }
      entry.count++;
      store.set(key, entry);
      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
      if (entry.count > MAX_REQUESTS) return res.status(429).json({ error: 'Too Many Requests' });
      next();
    };
    ```
18. Write `test/middleware/rateLimit.test.js`:
    - First request → 200, `X-RateLimit-Remaining` header present
    - After `MAX_REQUESTS + 1` requests from same IP → 429
    - `OPTIONS` request → exempt (never 429)
    - (Set `RATE_MAX=2` via env for test speed)
19. `npm test -- --grep rateLimit`
20. Edit `src/index.js`: grep for `rateLimit` — if absent, add
    `app.use(require('./middleware/rateLimit'));` after `cors` but before routes.
21. `git diff --exit-code src/middleware/rateLimit.js src/index.js test/middleware/rateLimit.test.js || git add src/middleware/rateLimit.js src/index.js test/middleware/rateLimit.test.js && git commit -m "feat: add IP-based rate limit middleware"`

---

### Standalone: Admin Page

> Intent: `GET /admin` returns a minimal HTML admin page listing available routes.
> No dependency on Chain A or Chain B.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/admin.js`, mounted in `src/index.js`

22. Create `public/admin.html`:
    ```html
    <!DOCTYPE html>
    <html><head><title>Admin</title></head>
    <body>
      <h1>my-node-server admin</h1>
      <ul>
        <li><a href="/health">GET /health</a></li>
        <li><a href="/api/items">GET /api/items</a></li>
        <li><a href="/status">GET /status</a></li>
      </ul>
    </body></html>
    ```
23. Create `src/routes/admin.js`:
    ```js
    const { Router } = require('express');
    const path = require('path');
    const router = Router();
    router.get('/admin', (req, res) => {
      res.sendFile(path.resolve(__dirname, '../../public/admin.html'));
    });
    module.exports = router;
    ```
24. Edit `src/index.js`: grep for `admin` — if absent, add `app.use(require('./routes/admin'));`.
25. Write `test/admin.test.js`:
    - `GET /admin` → 200, `Content-Type: text/html`, body contains `<h1>my-node-server admin</h1>`
26. `npm test -- --grep admin`
27. `git diff --exit-code src/routes/admin.js public/admin.html src/index.js test/admin.test.js || git add src/routes/admin.js public/admin.html src/index.js test/admin.test.js && git commit -m "feat: add /admin HTML page"`

---

### Phase Final: Full Smoke Test

> Intent: Boot the full server and assert all route families respond correctly in a single
> integration pass. DEPENDS ON Chain A tail (paginated items), Chain B tail (rate limit),
> AND the standalone admin page — all three must be merged before this starts.

**Pre-check:** `src/routes/api/items.js` has pagination logic; `src/middleware/rateLimit.js`
present; `public/admin.html` present.
**Idempotency:** overwrite + diff-guarded commit. `npm test` is always safe.
**Outputs:** `test/smoke.test.js` (replaces the scaffold version)

28. Read `src/index.js` — verify all routes are mounted before writing smoke test.
29. Write `test/smoke.test.js`:
    ```js
    // Full smoke test — replaces fixture stub
    const request = require('supertest');
    const { expect } = require('chai');
    const app = require('../src/index');

    describe('smoke', () => {
      it('GET /health', async () => {
        const res = await request(app).get('/health');
        expect(res.status).to.equal(200);
        expect(res.body.status).to.equal('ok');
      });
      it('GET /api/items (paginated)', async () => {
        const res = await request(app).get('/api/items?page=1&limit=5');
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('items').that.is.an('array');
        expect(res.body).to.have.property('total');
      });
      it('GET /admin', async () => {
        const res = await request(app).get('/admin');
        expect(res.status).to.equal(200);
        expect(res.text).to.include('my-node-server admin');
      });
      it('CORS headers present', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['access-control-allow-origin']).to.equal('*');
      });
      it('rate limit headers present', async () => {
        const res = await request(app).get('/health');
        expect(res.headers).to.have.property('x-ratelimit-limit');
        expect(res.headers).to.have.property('x-ratelimit-remaining');
      });
    });
    ```
30. `npm test`
31. `git diff --exit-code test/smoke.test.js || git add test/smoke.test.js && git commit -m "test: full smoke test covering all route families"`

## Git Strategy

- Branch: `feat/full-server`
- Chain A (steps 1–11) and Chain B (steps 12–21) run in parallel worktrees
- Standalone admin (steps 22–27) runs in its own worktree, independent of A and B
- Smoke test create-wt is blocked by Chain A tail, Chain B tail, and standalone run-agent

## Verification

- `npm test` passes (all middleware, route, api, and smoke tests)
- `GET /api/items?page=1&limit=5` → `{ items: [], total: 0, page: 1, limit: 5 }`
- CORS `Access-Control-Allow-Origin: *` header on all responses
- `GET /admin` → HTML page with route list
- `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers on every non-OPTIONS response
