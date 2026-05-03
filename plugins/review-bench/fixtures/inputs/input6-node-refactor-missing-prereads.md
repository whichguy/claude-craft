# Plan: Refactor Auth Module — Callbacks to Async/Await

## Context

The `auth` module in `mcp_gas` was written with Node callback-style functions before the team
standardized on async/await. This causes awkward interop at every call site and makes error
handling inconsistent. The goal is to convert `auth/login.ts` and `auth/logout.ts` to return
Promises, update all consumers, and ensure no regressions.

**Project:** mcp_gas (~/src/mcp_gas)

**Test strategy:** Existing test suite (`npm test`) verifies no regressions. New tests for `loginUser` async interface (happy path + rejection on bad credentials) and `logoutUser` async interface confirm the new Promise-based API contract. Consumer-level tests with callback mocks are updated to use Promises.
## Implementation Steps

### Phase 1: Convert Core Auth Functions

> Intent: Convert the core auth function signatures from callback-style to async/await, establishing the new Promise-based API contract. This phase intentionally introduces type errors at all consumer call sites to force Phase 2 updates.
**Pre-checks (before any edits):**- Read `package.json` and verify bcrypt version ≥5 (Promise-returning API); if v4, plan to use `util.promisify(bcrypt.compare)` instead of direct `await`- Read the `sessionStore` module definition to verify `.delete()` returns a Promise; if callback-based, plan to promisify it- Grep all call sites: run `grep -rn 'loginUser\|logoutUser' src/` to identify all consumers beyond the three named in Phase 2
1. Update `src/types/authTypes.ts`:   - Remove `AuthCallback` type   - Add `LoginResult { userId: string, token: string, expiresAt: Date }`
2. Edit `src/auth/login.ts`:
   - Read `src/auth/login.ts` first and verify: function `loginUser` exists with callback signature `(userId: string, callback: (err, result) => void)` and identify the `bcrypt.compare` call pattern   - Change `loginUser(userId: string, callback: (err, result) => void)` to
     `async loginUser(userId: string): Promise<LoginResult>`
   - Wrap internal `bcrypt.compare` call with `await` (requires bcrypt ≥5 — confirmed in Pre-checks)
   - Replace `callback(null, result)` with `return result`
   - Replace `callback(err)` patterns with `throw err`

3. Edit `src/auth/logout.ts`:
   - Read `src/auth/logout.ts` first and verify: function `logoutUser` exists with callback signature `(sessionId: string, callback: (err) => void)` and confirm `sessionStore.delete` is called   - Change `logoutUser(sessionId: string, callback: (err) => void)` to
     `async logoutUser(sessionId: string): Promise<void>`
   - Wrap `sessionStore.delete(sessionId)` with `await` (requires sessionStore.delete to return a Promise — confirmed in Pre-checks)
   - Replace `callback(null)` with `return`

**Phase 1 checkpoint:** Run `tsc --noEmit` — expect type errors at callback-style call sites in `authMiddleware.ts`, `gasClient.ts`, `gasAuthOperations.ts`. This confirms Phase 1 signatures are correct and complete before proceeding to Phase 2.
**Outputs:** `loginUser` returns `Promise<LoginResult>`, `logoutUser` returns `Promise<void>`, `AuthCallback` type removed from `authTypes.ts`
### Phase 2: Update Consumers

> Intent: Update all consumers of `loginUser` and `logoutUser` to use the new async API, resolving the type errors introduced in Phase 1. Each consumer independently replaces the callback pattern with try/catch. Update any affected tests that mock the callback-based auth interface.
**Pre-check:** Verify Phase 1 `tsc --noEmit` produced type errors at all three consumer files listed below (confirming Phase 1 is complete). Also confirm no additional consumers were found in the Phase 1 grep step beyond these three files.
4. Edit `src/middleware/authMiddleware.ts`:
   - Read `src/middleware/authMiddleware.ts` first and verify: `loginUser` is called with callback pattern `loginUser(id, (err, result) => { ... })`; note all call sites and surrounding error-handling context   - Replace `loginUser(id, (err, result) => { ... })` with `const result = await loginUser(id)`
   - Add `try/catch` around each call site

5. Edit `src/api/gasClient.ts`:
   - Read `src/api/gasClient.ts` first and verify: auth import exists and `loginUser`/`logoutUser` are called with callback pattern; note call site context   - Update auth import and call sites to use `await`; add `try/catch` around async auth calls
6. Edit `src/api/gasAuthOperations.ts`:
   - Read `src/api/gasAuthOperations.ts` first and verify: `authenticate()` method calls `loginUser()` with callback pattern; note the full call context   - Update `authenticate()` method to use `await loginUser()`; add `try/catch` around the call
### Phase 3: Testing & Verification

> Intent: Verify the refactor is complete and correct — run existing tests to check for regressions, add async-specific test cases for both `loginUser` and `logoutUser`, confirm zero type errors, and commit the complete refactor.
7. Run existing test suite: `npm test`

8. Add/update async/await tests:   - In `src/auth/__tests__/login.test.ts`:     - Happy path: `loginUser()` resolves with `LoginResult`     - Error path: `loginUser()` rejects on bad credentials   - In `src/auth/__tests__/logout.test.ts` (create if not present):     - Happy path: `logoutUser()` resolves successfully     - Error path: `logoutUser()` rejects on invalid session   - Check for existing middleware or consumer tests mocking the callback-based auth interface — update any such mocks to return Promises instead
9. Run `tsc --noEmit` — confirm no type errors

10. Commit: `git add -A && git commit -m "refactor(auth): convert callbacks to async/await"`

11. Push branch and open PR: `git push origin refactor/auth-async-await` → open pull request for squash merge to main
## Git Strategy

- Branch: `refactor/auth-async-await`
- Squash merge to main after tests pass

## Verification

- `npm test` passes after Phase 3
- `tsc --noEmit` zero errors
- All consumers compile without type errors

## Post-Implementation Workflow1. `/review-fix --scope=branch` — loop until clean2. Run build: `tsc --noEmit`3. Run tests: `npm test`4. If build or tests fail: fix → re-run `/review-fix --scope=branch` → re-run build/tests — repeat until passing