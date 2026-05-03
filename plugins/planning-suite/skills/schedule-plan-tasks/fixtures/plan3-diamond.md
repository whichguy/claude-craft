# Plan: Add Auth + Static Middleware, then Protected Dashboard Route

## Context

`my-node-server` needs a `/dashboard` route that requires both authentication (token check)
and static file serving (reads `public/dashboard.html`). The two middleware modules are
independent of one another — auth knows nothing about static files and vice versa. The
dashboard route imports both.

**Idempotency:** each step is safe to re-run.
- File writes are unconditional overwrites.
- `git add && git commit` is diff-guarded (`git diff --exit-code <files> || git commit …`).
- Route/middleware mounting in `src/index.js` is grep-guarded.
- `npm test` is always safe to re-run.

**Project:** `fixtures/my-node-server`

## Expected Outcome

`GET /dashboard` returns 401 when the `Authorization` header is absent or invalid, and serves
`public/dashboard.html` when a valid `Bearer test-token` is present. All middleware is
independently unit-tested. `npm test` passes.

## Implementation Steps

### Phase 1a: Auth Middleware

> Intent: `requireAuth` middleware that checks for `Authorization: Bearer <token>` header.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `src/middleware/requireAuth.js`, `test/middleware/requireAuth.test.js`

1. Create `src/middleware/requireAuth.js`:
   ```js
   const VALID_TOKEN = process.env.AUTH_TOKEN || 'test-token';
   module.exports = function requireAuth(req, res, next) {
     const auth = req.headers['authorization'] || '';
     if (auth !== `Bearer ${VALID_TOKEN}`) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     next();
   };
   ```
2. Write `test/middleware/requireAuth.test.js`:
   - No header → 401
   - Wrong token → 401
   - `Authorization: Bearer test-token` → calls `next()`
3. `npm test -- --grep requireAuth`
4. `git diff --exit-code src/middleware/requireAuth.js test/middleware/requireAuth.test.js || git add src/middleware/requireAuth.js test/middleware/requireAuth.test.js && git commit -m "feat: add requireAuth middleware"`

### Phase 1b: Static File Middleware

> Intent: `serveStatic` middleware that resolves files from `public/` relative to the project root.

**Idempotency:** overwrite + diff-guarded commit. `public/` directory creation is idempotent
(`mkdir -p`).
**Outputs:** `src/middleware/serveStatic.js`, `public/dashboard.html`,
`test/middleware/serveStatic.test.js`

5. Create `public/` directory: `mkdir -p public`
6. Create `public/dashboard.html`:
   ```html
   <!DOCTYPE html>
   <html><head><title>Dashboard</title></head>
   <body><h1>Dashboard</h1><p>Welcome.</p></body></html>
   ```
7. Create `src/middleware/serveStatic.js`:
   ```js
   const path = require('path');
   const fs = require('fs');
   module.exports = function serveStatic(basePath) {
     return function(req, res, next) {
       const file = path.join(basePath, req.path);
       if (fs.existsSync(file) && fs.statSync(file).isFile()) {
         return res.sendFile(file);
       }
       next();
     };
   };
   ```
8. Write `test/middleware/serveStatic.test.js`:
   - Existing file path → responds with file content
   - Non-existent path → calls `next()`
9. `npm test -- --grep serveStatic`
10. `git diff --exit-code src/middleware/serveStatic.js public/dashboard.html test/middleware/serveStatic.test.js || git add src/middleware/serveStatic.js public/dashboard.html test/middleware/serveStatic.test.js && git commit -m "feat: add serveStatic middleware and dashboard HTML"`

### Phase 2: Protected Dashboard Route

> Intent: `GET /dashboard` — applies `requireAuth` then `serveStatic` to serve
> `public/dashboard.html`. Imports both middleware modules.

**Idempotency:** overwrite + grep-guard for mount + diff-guarded commit.
**Outputs:** `src/routes/dashboard.js`, route mounted in `src/index.js`

11. Read `src/middleware/requireAuth.js` — verify export.
12. Read `src/middleware/serveStatic.js` — verify export.
13. Create `src/routes/dashboard.js`:
    ```js
    const { Router } = require('express');
    const path = require('path');
    const requireAuth = require('../middleware/requireAuth');
    const serveStatic = require('../middleware/serveStatic');
    const PUBLIC_DIR = path.resolve(__dirname, '../../public');
    const router = Router();
    router.get('/dashboard', requireAuth, serveStatic(PUBLIC_DIR), (req, res) => {
      res.status(404).json({ error: 'Not found in public/' });
    });
    module.exports = router;
    ```
14. Edit `src/index.js`: grep for `dashboard` — if absent, add
    `app.use(require('./routes/dashboard'));`.
15. Write `test/dashboard.test.js`:
    - `GET /dashboard` no auth → 401
    - `GET /dashboard` wrong token → 401
    - `GET /dashboard` `Authorization: Bearer test-token` → 200, HTML body contains `<h1>Dashboard</h1>`
16. `npm test -- --grep dashboard`
17. `git diff --exit-code src/routes/dashboard.js src/index.js test/dashboard.test.js || git add src/routes/dashboard.js src/index.js test/dashboard.test.js && git commit -m "feat: add protected /dashboard route"`

## Verification

- `npm test` passes (requireAuth, serveStatic, dashboard tests)
- `GET /dashboard` no auth → `{"error":"Unauthorized"}` (401)
- `curl -H "Authorization: Bearer test-token" http://localhost:3000/dashboard` → HTML page
