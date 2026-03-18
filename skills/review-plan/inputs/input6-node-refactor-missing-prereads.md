# Plan: Refactor Auth Module — Callbacks to Async/Await

## Context

The `auth` module in `mcp_gas` was written with Node callback-style functions before the team
standardized on async/await. This causes awkward interop at every call site and makes error
handling inconsistent. The goal is to convert `auth/login.ts` and `auth/logout.ts` to return
Promises, update all consumers, and ensure no regressions.

**Project:** mcp_gas (~/src/mcp_gas)

## Implementation Steps

### Phase 1: Convert Core Auth Functions

1. Edit `src/auth/login.ts`:
   - Change `loginUser(userId: string, callback: (err, result) => void)` to
     `async loginUser(userId: string): Promise<LoginResult>`
   - Wrap internal `bcrypt.compare` call with `await`
   - Replace `callback(null, result)` with `return result`
   - Replace `callback(err)` patterns with `throw err`

2. Edit `src/auth/logout.ts`:
   - Change `logoutUser(sessionId: string, callback: (err) => void)` to
     `async logoutUser(sessionId: string): Promise<void>`
   - Wrap `sessionStore.delete(sessionId)` with `await`
   - Replace `callback(null)` with `return`

3. Update `src/types/authTypes.ts`:
   - Remove `AuthCallback` type
   - Add `LoginResult { userId: string, token: string, expiresAt: Date }`

### Phase 2: Update Consumers

4. Edit `src/middleware/authMiddleware.ts`:
   - Replace `loginUser(id, (err, result) => { ... })` with `const result = await loginUser(id)`
   - Add `try/catch` around each call site

5. Edit `src/api/gasClient.ts`:
   - Update auth import and call sites to use `await`

6. Edit `src/api/gasAuthOperations.ts`:
   - Update `authenticate()` method to use `await loginUser()`

### Phase 3: Testing & Verification

7. Run existing test suite: `npm test`

8. Add new async/await tests to `src/auth/__tests__/login.test.ts`:
   - Happy path: `loginUser()` resolves with `LoginResult`
   - Error path: `loginUser()` rejects on bad credentials

9. Run `tsc --noEmit` — confirm no type errors

10. Commit: `git add -A && git commit -m "refactor(auth): convert callbacks to async/await"`

## Git Strategy

- Branch: `refactor/auth-async-await`
- Squash merge to main after tests pass

## Verification

- `npm test` passes after Phase 3
- `tsc --noEmit` zero errors
- All consumers compile without type errors
