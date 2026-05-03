# Plan: Two Config Cleanups + Request Logger Middleware

## Context

`my-node-server` needs two minor config cleanups (rename a constant, add `.nvmrc`) and one
substantive addition (a request logger middleware). The config changes are single-line/single-file
edits. The logger is real work with tests and its own module.

**Idempotency:**
- Trivial edits are single-line overwrites — re-running produces the same result.
- `.nvmrc` write is idempotent (overwrite).
- Logger file write is idempotent (overwrite). Mount is grep-guarded.
- `git diff --exit-code || git commit` guards all commits — no duplicate commits.
- `npm test` is always safe to re-run.

**Project:** `fixtures/my-node-server`

## Expected Outcome

`PORT` constant is renamed to `SERVER_PORT`. `.nvmrc` sets Node 20. Request logger middleware
logs `METHOD /path STATUS ms` for every request. All three changes committed and `npm test`
clean.

## Implementation Steps

### Phase 1: Rename PORT constant

> Intent: Single rename — `PORT` → `SERVER_PORT` in `src/index.js`. No new logic.

**Idempotency:** grep-before-edit; if `SERVER_PORT` already present, skip.
**Outputs:** `src/index.js` updated

1. Read `src/index.js` — confirm current port line (`const PORT = …`).
2. Grep for `SERVER_PORT` in `src/index.js` — if already present, skip steps 2-3.
3. Edit `src/index.js`: replace `const PORT =` with `const SERVER_PORT =` and update the
   `listen(PORT,` call to `listen(SERVER_PORT,`.
4. `git diff --exit-code src/index.js || git add src/index.js && git commit -m "chore: rename PORT → SERVER_PORT"`

### Phase 2: Add .nvmrc

> Intent: Pin Node version to 20 via `.nvmrc`.

**Idempotency:** overwrite is safe. Commit is diff-guarded.
**Outputs:** `.nvmrc`

5. Grep for `.nvmrc` in project root — if already present with `20`, skip.
6. Write `.nvmrc` containing `20`.
7. `git diff --exit-code .nvmrc || git add .nvmrc && git commit -m "chore: pin Node 20 via .nvmrc"`

### Phase 3: Request Logger Middleware

> Intent: Middleware that logs `METHOD /path STATUS Xms` for every request, using
> `process.hrtime.bigint()` for sub-millisecond precision.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/middleware/requestLogger.js`, `test/middleware/requestLogger.test.js`,
mounted in `src/index.js`

8. Create `src/middleware/requestLogger.js`:
   ```js
   module.exports = function requestLogger(req, res, next) {
     const start = process.hrtime.bigint();
     res.on('finish', () => {
       const ms = Number(process.hrtime.bigint() - start) / 1e6;
       console.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(2)}ms`);
     });
     next();
   };
   ```
9. Write `test/middleware/requestLogger.test.js`:
   - Middleware calls `next()` synchronously
   - After response finishes, `console.log` is called with a string matching
     `/GET \/health \d+ \d+\.\d+ms/`
   - Works when mounted before route handlers (use supertest to fire a real request)
10. `npm test -- --grep requestLogger`
11. Read `src/index.js` — grep for `requestLogger`; if absent, add
    `app.use(require('./middleware/requestLogger'));` as the first `app.use` call.
12. `git diff --exit-code src/middleware/requestLogger.js src/index.js test/middleware/requestLogger.test.js || git add src/middleware/requestLogger.js src/index.js test/middleware/requestLogger.test.js && git commit -m "feat: add request logger middleware"`

## Verification

- `grep SERVER_PORT src/index.js` — present; `grep '\bPORT\b' src/index.js` — absent
- `cat .nvmrc` → `20`
- `npm test` passes (requestLogger tests included)
- Server startup logs include `my-node-server listening on port 3000`
- Each request produces a log line like `GET /health 200 0.42ms`
