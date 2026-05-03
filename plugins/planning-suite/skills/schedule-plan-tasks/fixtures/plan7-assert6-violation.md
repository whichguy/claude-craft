# Plan: Assert 6 Metadata Control Test

## Context

Minimal single-proposal fixture that verifies Assert 6's new metadata-based check works
correctly on normal input. After Change 4 (Assert 6 checks `metadata.target_branch` instead
of description text), this fixture confirms: (a) the skill populates `metadata.target_branch`
in the ledger entry for the delivery-agent task, and (b) Assert 6 PASSES when the field is present
and non-placeholder.

**This is a positive-control test — Assert 6 should PASS, not fire.**

**Project:** `fixtures/my-node-server`

## Expected Outcome

The dry-run Wiring Integrity section reports `PASS — N tasks verified` with no Assert 6
violations. The task ledger entry for the delivery-agent shows `metadata.target_branch` set to
the current branch name (non-empty, non-placeholder).

## Implementation Steps

### Phase 1: Add Health Route

> Intent: Add a minimal `/health` endpoint that returns `{ status: "ok" }`.

**Idempotency:** overwrite + grep-guard + diff-guarded commit.
**Outputs:** `src/routes/health.js`, mounted in `src/index.js`

1. Create `src/routes/health.js`:
   ```js
   const { Router } = require('express');
   const router = Router();
   router.get('/health', (req, res) => res.json({ status: 'ok' }));
   module.exports = router;
   ```
2. Edit `src/index.js`: grep for `/health` — if absent, add `app.use(require('./routes/health'));`.
3. `git diff --exit-code src/routes/health.js src/index.js || git add src/routes/health.js src/index.js && git commit -m "feat: add /health route"`

## Verification

- `GET /health` → `{ status: "ok" }`
