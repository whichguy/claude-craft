# Plan: End-to-End Cascade — Express API Skeleton with Two Routes, Tests, and Docs

## Context

Live integration fixture for `/schedule-plan-tasks`. Designed to exercise the SKILL.md:231
cascade detection paths: chain-1=[A,B] (head/tail with shared worktree), standalones C and D
fanning out from chain-1's tail, chain-2=[E,F] (head/tail) seeded after fan-in.

**Idempotency:** all file writes are unconditional overwrites; `git add && git commit` is
diff-guarded; `npm install` and `npm test` are always safe to re-run.

**Project:** scratch repo; the orchestrator must `git init` if absent (the integration setup
script does this before invocation).

## Expected Outcome

`npm test` passes (supertest hits `GET /api/health` and `GET /api/version`). Manual smoke:
`(node src/server.js &) && sleep 1 && curl -fsS localhost:3000/api/health && curl -fsS localhost:3000/api/version && kill %1`
exits 0 on both curl calls. README documents the routes.

## Implementation Steps

---

### Step A: Scaffold package.json + Express server skeleton

> Intent: Minimal Express app listening on `:3000`. No routes yet — Step B mounts the router
> factory. Foundation for everything downstream. No DEPENDS ON.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `package.json`, `src/server.js`, `.gitignore`
**Note:** dependencies are installed at Step E; do not attempt to execute
`src/server.js` (or `require('./src/server')`) before Step E completes —
`express` is not yet on disk and Node will throw `Cannot find module`.

1. Create `package.json`:
   ```json
   {
     "name": "spt-cascade-fixture",
     "version": "0.1.0",
     "private": true,
     "scripts": { "test": "mocha test/**/*.test.js" },
     "dependencies": { "express": "^4.19.2" },
     "devDependencies": { "supertest": "^7.0.0", "mocha": "^10.4.0", "chai": "^4.4.1" }
   }
   ```
2. Create `src/server.js`:
   ```js
   const express = require('express');
   const app = express();
   app.use(express.json());
   const PORT = process.env.PORT || 3000;
   if (require.main === module) app.listen(PORT, () => console.log(`listening on ${PORT}`));
   module.exports = app;
   ```
3. Create `.gitignore` containing `node_modules/`.
4. `git diff --exit-code package.json src/server.js .gitignore || git add package.json src/server.js .gitignore && git commit -m "feat: scaffold express server skeleton"`

---

### Step B: Router factory mounted at /api

> Intent: Centralized `Router` factory in `src/routes/index.js`, mounted at `/api` from
> `server.js`. Foundation for routes added by C and D. **DEPENDS ON A.**

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/index.js`, edit to `src/server.js`

5. Create `src/routes/index.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   module.exports = router;
   ```
6. Edit `src/server.js`: grep for `/api` mount — if absent, add
   `app.use('/api', require('./routes'));` before the `listen` block.
7. `git diff --exit-code src/routes/index.js src/server.js || git add src/routes/index.js src/server.js && git commit -m "feat: mount /api router factory"`

---

### Step C: GET /api/health

> Intent: Health probe route in `src/routes/health.js`, registered through B's factory.
> **DEPENDS ON B.**

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/health.js`, edit to `src/routes/index.js`

8. Create `src/routes/health.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   router.get('/health', (req, res) => res.json({ status: 'ok' }));
   module.exports = router;
   ```
9. Edit `src/routes/index.js`: grep for `./health` — if absent, add
   `router.use(require('./health'));`.
10. `git diff --exit-code src/routes/health.js src/routes/index.js || git add src/routes/health.js src/routes/index.js && git commit -m "feat: add GET /api/health"`

---

### Step D: GET /api/version

> Intent: Version probe route in `src/routes/version.js`, reads `version` from `package.json`,
> registered through B's factory. **DEPENDS ON B.**

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/version.js`, edit to `src/routes/index.js`

11. Create `src/routes/version.js`:
    ```js
    const { Router } = require('express');
    const pkg = require('../../package.json');
    const router = Router();
    router.get('/version', (req, res) => res.json({ version: pkg.version }));
    module.exports = router;
    ```
12. Edit `src/routes/index.js`: grep for `./version` — if absent, add
    `router.use(require('./version'));`.
13. `git diff --exit-code src/routes/version.js src/routes/index.js || git add src/routes/version.js src/routes/index.js && git commit -m "feat: add GET /api/version"`

---

### Step E: Supertest integration tests

> Intent: supertest covers both `/api/health` and `/api/version`. **DEPENDS ON C AND D.**

**Idempotency:** overwrite + diff-guarded commit. `npm test` is always safe.
**Outputs:** `test/api.test.js`

14. Create `test/api.test.js`:
    ```js
    const request = require('supertest');
    const { expect } = require('chai');
    const app = require('../src/server');

    describe('api', () => {
      it('GET /api/health → 200 { status: "ok" }', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).to.equal(200);
        expect(res.body).to.deep.equal({ status: 'ok' });
      });
      it('GET /api/version → 200 with version string', async () => {
        const res = await request(app).get('/api/version');
        expect(res.status).to.equal(200);
        expect(res.body.version).to.be.a('string');
      });
    });
    ```
15. `npm install && npm test`
16. `git diff --exit-code test/api.test.js || git add test/api.test.js && git commit -m "test: supertest coverage for /api/health and /api/version"`

---

### Step F: README + npm test wiring

> Intent: README documents the two routes; package.json's `test` script already calls mocha
> (set in Step A) — confirm it's wired and run it. **DEPENDS ON E.**

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `README.md`

17. Create `README.md` with the following content (outer fence is `~~~` so the
    inner triple-backtick code block passes through unambiguously):
    ~~~markdown
    # spt-cascade-fixture

    Minimal Express server used as the live fixture for `/schedule-plan-tasks` integration audits.

    ## Routes
    - `GET /api/health` → `{ "status": "ok" }`
    - `GET /api/version` → `{ "version": "<package.json version>" }`

    ## Test
    ```
    npm install
    npm test
    ```
    ~~~
18. `npm test`
19. `git diff --exit-code README.md || git add README.md && git commit -m "docs: README with route list and test instructions"`

## Verification

```
npm install
npm test
(node src/server.js &) && sleep 1 && curl -fsS localhost:3000/api/health && curl -fsS localhost:3000/api/version && kill %1
```

All three commands exit 0; both curl calls return JSON bodies.
