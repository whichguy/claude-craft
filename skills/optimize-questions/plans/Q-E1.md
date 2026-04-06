# Plan: Refactor Authentication Module

## Context

The authentication module has grown organically over 18 months. Token handling, session
management, password hashing, and OAuth logic are tangled together in three large files.
We need to decompose this into clean, single-responsibility modules. The refactoring must
preserve all existing behavior — no functional changes, only structural.

## Current State

- Node.js 20, Express 4.18, TypeScript 5.3
- `src/auth/auth.ts` (450 lines) — mixed token, session, and password logic
- `src/auth/oauth.ts` (280 lines) — OAuth providers + some token logic duplicated
- `src/auth/middleware.ts` (120 lines) — auth middleware, coupled to `auth.ts` internals
- 34 passing tests in `test/auth/` covering all public APIs
- No other modules import `auth.ts` internals directly (checked with `grep`)

## Approach

We will extract token handling, session management, password hashing, and OAuth into
four focused modules. The public API (`authenticate()`, `validateSession()`, `hashPassword()`,
`refreshToken()`, `oauthCallback()`) stays identical — only internal organization changes.
We'll re-export everything from a barrel `index.ts` so existing imports continue to work.

## Files to Modify

- `src/auth/auth.ts` — extract token logic, extract session logic, extract password logic
- `src/auth/oauth.ts` — consolidate duplicated token logic into shared module
- `src/auth/middleware.ts` — update imports to use new module paths
- `src/auth/tokenService.ts` (new) — JWT creation, validation, refresh
- `src/auth/sessionManager.ts` (new) — session creation, validation, cleanup
- `src/auth/passwordService.ts` (new) — hashing, comparison, strength validation
- `src/auth/oauthService.ts` (new) — OAuth flow handlers, provider configs
- `src/auth/index.ts` (new) — barrel file re-exporting public API
- `test/auth/*.test.ts` — update imports if needed

## Implementation

### Phase 1: Extract Token Service

1. Create `tokenService.ts` with functions extracted from `auth.ts`:
   - `createToken(payload, expiresIn)` — JWT signing
   - `validateToken(token)` — JWT verification + expiry check
   - `refreshToken(token)` — validate old token, issue new one
   - `decodeToken(token)` — decode without validation (for logging)
2. Remove token functions from `auth.ts`, replace with imports from `tokenService`
3. Remove duplicated `validateToken()` from `oauth.ts`, import from `tokenService`
4. Run existing tests — all 34 should pass

### Phase 2: Extract Session & Password Services

1. Create `sessionManager.ts` from `auth.ts`:
   - `createSession(userId, metadata)` — create session record
   - `validateSession(sessionId)` — check validity + expiry
   - `destroySession(sessionId)` — invalidate session
   - `cleanupExpiredSessions()` — batch cleanup
2. Create `passwordService.ts` from `auth.ts`:
   - `hashPassword(plaintext)` — bcrypt hashing
   - `comparePassword(plaintext, hash)` — bcrypt comparison
   - `validateStrength(password)` — policy enforcement
3. Update `auth.ts` to import from both new modules
4. Run existing tests — all 34 should pass

### Phase 3: Consolidate OAuth & Barrel Export

1. Create `oauthService.ts` by moving OAuth logic from `oauth.ts`:
   - `initiateOAuth(provider)` — generate OAuth URL
   - `handleCallback(provider, code)` — exchange code for tokens
   - `getProviderConfig(provider)` — provider-specific settings
2. Update `middleware.ts` to import from `tokenService` and `sessionManager`
3. Create `index.ts` barrel file:
   ```typescript
   export { createToken, validateToken, refreshToken } from './tokenService';
   export { createSession, validateSession, destroySession } from './sessionManager';
   export { hashPassword, comparePassword } from './passwordService';
   export { initiateOAuth, handleCallback } from './oauthService';
   ```
4. Update any test imports that reference `auth.ts` directly
5. Run all 34 tests — should pass with no changes to test logic

## Verification

1. Run full test suite: `npm test -- --grep auth` — all 34 tests pass
2. Run TypeScript compilation: `npx tsc --noEmit` — no type errors
3. Check no circular dependencies: `npx madge --circular src/auth/`
4. Verify barrel exports match previous public API surface
5. Run the app and test login/logout/OAuth flow manually
6. Confirm `auth.ts` and `oauth.ts` are now thin orchestration layers (<50 lines each)
