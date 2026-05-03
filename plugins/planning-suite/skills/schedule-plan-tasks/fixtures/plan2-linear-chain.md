# Plan: Add Items API — Types, Validator, Route, Integration Test

## Context

`my-node-server` needs a `/api/items` CRUD endpoint. The work builds up in layers: shared
types first, then a validator that references those types, then a route that applies the
validator, then an integration test that exercises the full flow end-to-end.

**Idempotency note:** each step guards against double-application.
- File writes are unconditional overwrites (re-run produces identical output).
- `git add && git commit` is guarded: `git diff --exit-code <files> || git commit …` — if
  the tree is already clean the commit is skipped.
- Route mounting in `src/index.js` is grep-guarded: add only if not already present.
- `npm test` is always safe to re-run.

**Project:** `fixtures/my-node-server`

## Expected Outcome

`GET /api/items` returns `[]`. `POST /api/items` validates the body (requires `name: string`)
and returns 201 with the created item. Invalid bodies return 400 with a message. Integration
tests pass. `npm test` clean.

## Implementation Steps

### Phase 1: Shared Types

> Intent: Define the `Item` type and error-shape constants used by all downstream modules.
> Nothing else can be written until the canonical shape is committed.

**Idempotency:** file write is idempotent (overwrite). Commit is diff-guarded.
**Outputs:** `src/types/item.js`

1. Create `src/types/item.js`:
   ```js
   // Item shape: { id: string, name: string, createdAt: string }
   const ITEM_SCHEMA = { required: ['name'], types: { name: 'string' } };
   module.exports = { ITEM_SCHEMA };
   ```
2. `git diff --exit-code src/types/item.js || git add src/types/item.js && git commit -m "feat(items): add Item schema constants"`

### Phase 2: Request Validator

> Intent: Middleware that validates `POST /api/items` body against `ITEM_SCHEMA`.
> Imports `ITEM_SCHEMA` from `src/types/item.js`.

**Idempotency:** overwrite + diff-guarded commit.
**Outputs:** `src/middleware/validateItem.js`

3. Read `src/types/item.js` — confirm `ITEM_SCHEMA` export before writing validator.
4. Create `src/middleware/validateItem.js`:
   ```js
   const { ITEM_SCHEMA } = require('../types/item');
   module.exports = function validateItem(req, res, next) {
     for (const field of ITEM_SCHEMA.required) {
       if (typeof req.body[field] !== ITEM_SCHEMA.types[field]) {
         return res.status(400).json({ error: `"${field}" is required and must be a ${ITEM_SCHEMA.types[field]}` });
       }
     }
     next();
   };
   ```
5. Write `test/middleware/validateItem.test.js`:
   - Valid body → calls `next()`
   - Missing `name` → 400 with `error` field
   - `name` is not a string → 400 with `error` field
6. `npm test -- --grep validateItem`
7. `git diff --exit-code src/middleware/validateItem.js test/middleware/validateItem.test.js || git add src/middleware/validateItem.js test/middleware/validateItem.test.js && git commit -m "feat(items): add validateItem middleware"`

### Phase 3: Items Route

> Intent: `GET /api/items` and `POST /api/items` handlers using the `validateItem` middleware.
> Imports `validateItem` from `src/middleware/validateItem.js`.

**Idempotency:** overwrite + grep-guard for mount + diff-guarded commit.
**Outputs:** `src/routes/items.js`, route mounted in `src/index.js`

8. Read `src/middleware/validateItem.js` — verify export before using.
9. Create `src/routes/items.js`:
   ```js
   const { Router } = require('express');
   const validateItem = require('../middleware/validateItem');
   const router = Router();
   const store = []; // in-memory store; replaced by a real DB in a later plan
   router.get('/api/items', (req, res) => res.json(store));
   router.post('/api/items', validateItem, (req, res) => {
     const item = { id: Date.now().toString(), name: req.body.name, createdAt: new Date().toISOString() };
     store.push(item);
     res.status(201).json(item);
   });
   module.exports = router;
   ```
10. Edit `src/index.js`: grep for `items` — if absent, add `app.use(require('./routes/items'));`.
11. `git diff --exit-code src/routes/items.js src/index.js || git add src/routes/items.js src/index.js && git commit -m "feat(items): add /api/items route"`

### Phase 4: Integration Test

> Intent: End-to-end test of the full items flow via supertest. The route must be mounted in
> `src/index.js` before these tests can run.

**Idempotency:** overwrite + diff-guarded commit. `npm test` is always safe.
**Outputs:** `test/items.test.js`

12. Read `src/index.js` — confirm items route is mounted before writing test.
13. Write `test/items.test.js`:
    - `GET /api/items` → 200, empty array on fresh start
    - `POST /api/items` with `{ name: 'widget' }` → 201, body has `id`, `name`, `createdAt`
    - `POST /api/items` with `{}` → 400, body has `error` field
    - `POST /api/items` with `{ name: 42 }` → 400 (name must be string)
14. `npm test -- --grep items`
15. `git diff --exit-code test/items.test.js || git add test/items.test.js && git commit -m "test(items): integration tests for /api/items"`

## Verification

- `npm test` passes (validateItem unit tests + items integration tests)
- `GET /api/items` → `[]`
- `POST /api/items` `{"name":"widget"}` → 201 `{"id":"...","name":"widget","createdAt":"..."}`
- `POST /api/items` `{}` → 400 `{"error":"\"name\" is required..."}`
