Repo: ~/src/projectB

# Plan: Add Health Endpoint to External Repo

## Context

This plan targets `~/src/projectB`, a Node/Express app, even though the orchestrator
is invoked from `~/claude-craft`. The `Repo:` front-matter line above is what
schedule-plan-tasks resolves into `REPO_ROOT` so all worktrees, git operations, and
agent envelopes route through `~/src/projectB` rather than the invoker's CWD.

The repo already exists and contains a `.git` — no bootstrap is needed.

## Expected Outcome

- `GET /health` returns `200 { "status": "ok" }`.
- Integration test asserts the body shape and status.
- All worktree paths in the Dry-Run Report appear as
  `<absolute-path-to-projectB>/.worktrees/...` — never relative.

## Implementation Steps

### Phase 1: Health route

> Intent: A new `src/routes/health.js` that exposes `GET /health` returning a
> 200 OK JSON body.

**Outputs:** `src/routes/health.js`, mount line in `src/index.js`.

1. Create `src/routes/health.js` exporting an Express router with one handler.
2. Mount it in `src/index.js` if not already mounted.
3. Commit.

### Phase 2: Integration test

> Intent: Supertest-based integration test asserting status + body. DEPENDS ON Phase 1.

**Outputs:** `test/health.test.js`.

4. Write `test/health.test.js`.
5. `npm test -- --grep health`.
6. Commit.

## Verification

- `npm test` passes.
- `curl http://localhost:3000/health` returns `200 {"status":"ok"}`.
