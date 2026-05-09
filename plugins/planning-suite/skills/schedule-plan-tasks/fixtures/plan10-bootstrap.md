Repo: ~/src/ultra-fire
Bootstrap: yes

# Plan: Bootstrap a New Repo and Land a Hello Endpoint

## Context

This plan targets `~/src/ultra-fire`, which does NOT exist yet. The
`Bootstrap: yes` front-matter line authorizes schedule-plan-tasks to create
`REPO_ROOT`, run `git init`, write a placeholder `README.md`, and land an
initial commit before any other task runs. The existing `preflight` git-prep
task is wired to be blocked by the new `bootstrap` task.

After bootstrap completes, the rest of the plan executes normally — worktrees
land under `~/src/ultra-fire/.worktrees/...`, never under the invoker's CWD.

## Expected Outcome

- `~/src/ultra-fire` exists, is a git repo, and has at least one commit.
- A `GET /hello` route returns `200 { "message": "hello" }`.
- All worktree paths and git operations in the Dry-Run Report reference
  `~/src/ultra-fire`, not the orchestrator's CWD.

## Implementation Steps

### Phase 1: Hello route

> Intent: Initialize a minimal Express app and add a `/hello` endpoint that
> returns a static JSON body.

**Outputs:** `package.json`, `src/index.js`, `src/routes/hello.js`.

1. Initialize `package.json` with `express` and `supertest` as dependencies.
2. Create `src/index.js` that exports the Express app.
3. Create `src/routes/hello.js` exporting a router with the `/hello` handler.
4. Mount the router in `src/index.js`.
5. Commit.

### Phase 2: Test

> Intent: Supertest integration test for `/hello`. DEPENDS ON Phase 1.

**Outputs:** `test/hello.test.js`.

6. Write `test/hello.test.js`.
7. `npm install && npm test`.
8. Commit.

## Verification

- `npm test` passes.
- `git -C ~/src/ultra-fire log --oneline` shows the bootstrap commit + feature
  commits.
