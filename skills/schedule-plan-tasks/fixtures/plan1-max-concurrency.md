# Plan: Add Four Route Handlers

## Context

`my-node-server` needs four independent route modules: health, users, posts, and status.
Each handler lives in its own file and is mounted independently in `src/index.js`. They share
no code and have no dependency on one another — the only prerequisite for all four is that
`npm install` has run so Express is available.

**Idempotency note:** every step in this plan is safe to re-run.
- `npm install` is idempotent.
- Route file writes are unconditional overwrites — re-running produces the same file.
- `git add && git commit` is guarded by checking `git diff --exit-code` first; if nothing
  changed the commit is skipped, not duplicated.
- Route mounting in `src/index.js` uses a require block keyed by route path — adding it twice
  would be a duplicate mount but the file edit is idempotent (grep-before-edit pattern).
- `npm test` is always safe to re-run.

**Project:** `fixtures/my-node-server`

## Expected Outcome

Four route modules exist and respond correctly. `src/index.js` mounts all four.
`npm test` passes. Server boots and responds on `PORT` (default 3000).

## Implementation Steps

### Global Prepare: Install Dependencies

> Intent: Ensure `node_modules/` is present before any route agent runs.

**Idempotency:** `npm install` is a no-op if `node_modules/` is already up to date.
**Outputs:** `node_modules/` present, `package-lock.json` committed

1. `cd fixtures/my-node-server && npm install`
2. `git diff --exit-code package-lock.json || git add package-lock.json && git commit -m "chore: npm install"`

### Phase 1a: Health Route

> Intent: `GET /health` returns `{ status: 'ok' }`.

**Idempotency:** file write is an unconditional overwrite.
**Outputs:** `src/routes/health.js` only — does NOT touch `src/index.js` (wiring handled by Phase 2).

3. Create `src/routes/health.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   router.get('/health', (req, res) => res.json({ status: 'ok' }));
   module.exports = router;
   ```
4. Write `test/health.test.js`: assert `GET /health` → 200, body `{ status: 'ok' }`.
5. `npm test -- --grep health`
6. `git diff --exit-code || git add src/routes/health.js test/health.test.js && git commit -m "feat: add /health route"`

### Phase 1b: Users Route

> Intent: `GET /users` returns an empty array (stub).

**Idempotency:** unconditional overwrite.
**Outputs:** `src/routes/users.js` only — does NOT touch `src/index.js`.

7. Create `src/routes/users.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   router.get('/users', (req, res) => res.json([]));
   module.exports = router;
   ```
8. Write `test/users.test.js`: assert `GET /users` → 200, body is an array.
9. `npm test -- --grep users`
10. `git diff --exit-code || git add src/routes/users.js test/users.test.js && git commit -m "feat: add /users route"`

### Phase 1c: Posts Route

> Intent: `GET /posts` returns an empty array (stub).

**Outputs:** `src/routes/posts.js` only — does NOT touch `src/index.js`.

11. Create `src/routes/posts.js`:
    ```js
    const { Router } = require('express');
    const router = Router();
    router.get('/posts', (req, res) => res.json([]));
    module.exports = router;
    ```
12. Write `test/posts.test.js`: assert `GET /posts` → 200, body is an array.
13. `npm test -- --grep posts`
14. `git diff --exit-code || git add src/routes/posts.js test/posts.test.js && git commit -m "feat: add /posts route"`

### Phase 1d: Status Route

> Intent: `GET /status` returns `{ uptime: <seconds>, version: <package.json version> }`.

**Outputs:** `src/routes/status.js` only — does NOT touch `src/index.js`.

15. Create `src/routes/status.js`:
    ```js
    const { Router } = require('express');
    const { version } = require('../../package.json');
    const router = Router();
    router.get('/status', (req, res) => res.json({ uptime: process.uptime(), version }));
    module.exports = router;
    ```
16. Write `test/status.test.js`: assert `GET /status` → 200, body has numeric `uptime` and
    string `version`.
17. `npm test -- --grep status`
18. `git diff --exit-code || git add src/routes/status.js test/status.test.js && git commit -m "feat: add /status route"`

### Phase 2: Wire Routes

> Intent: Mount all four routes in `src/index.js`. Route files exist by this point; this
> parent task performs the integration step that requires knowledge of all four routes
> simultaneously. Separating wiring from implementation keeps each route proposal focused
> on its own concern.

**Idempotency:** each mount line is grep-guarded before insertion.
**Outputs:** `src/index.js` (four `app.use(...)` lines added)

19. For each route in `[health, users, posts, status]`:
    - grep for the route name in `src/index.js`; if absent, add `app.use(require('./routes/<name>'));` before the `listen` call.
20. `npm test` (full suite — all four routes now mounted)
21. `git diff --exit-code || git add src/index.js && git commit -m "feat: wire all route handlers into index.js"`

## Verification

- `npm test` passes (all four route test files)
- `curl http://localhost:3000/health` → `{"status":"ok"}`
- `curl http://localhost:3000/users` → `[]`
- `curl http://localhost:3000/posts` → `[]`
- `curl http://localhost:3000/status` → `{"uptime":...,"version":"0.1.0"}`
