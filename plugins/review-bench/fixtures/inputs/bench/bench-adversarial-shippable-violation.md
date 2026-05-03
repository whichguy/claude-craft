# Plan: Large-scale refactor of the "User Auth" system

## Context
The current authentication system is implemented as a monolithic `AuthService.js`. To support multi-factor authentication and external providers, we need to refactor this into a modular architecture with a base `AuthProvider` and specific implementations. This is a critical path change for the upcoming security audit.

## Git Setup
- Branch: `feat/modular-auth`
- Base: `main`

## Implementation Steps

### Phase 1: Cleanup of Legacy Monolith
- **Goal**: Remove the old monolithic implementation to make room for the new architecture.
- **Action**: Delete `src/services/AuthService.js` and remove all imports of `AuthService` from `src/app.js` and `src/middleware/auth.js`.
- **Commit**: `chore: remove legacy monolithic AuthService`

### Phase 2: Core Architecture Scaffolding
- **Goal**: Establish the new interface and base class.
- **Action**: Create `src/auth/AuthProvider.js` (abstract base class) and `src/auth/AuthFactory.js`.
- **Action**: Stub out `login()`, `logout()`, and `validateSession()` methods in `AuthProvider.js`.
- **Commit**: `feat: scaffold modular auth architecture`

### Phase 3: Migration to Modular Providers
- **Goal**: Implement the primary login logic in the new system.
- **Action**: Create `src/auth/providers/LocalProvider.js`.
- **Action**: Re-implement the JWT logic previously in `AuthService.js` inside `LocalProvider.js`.
- **Action**: Update `src/app.js` to use `AuthFactory.getProvider('local')`.
- **Commit**: `feat: implement LocalProvider and wire to application`

### Phase 4: Verification and Testing
- **Goal**: Ensure the system is functional and secure.
- **Action**: Create `tests/auth/LocalProvider.test.js`.
- **Action**: Run `npm test` to verify all auth flows.
- **Action**: Add integration tests for `AuthFactory`.
- **Commit**: `test: add tests for modular auth system`

## Verification
- [ ] `src/services/AuthService.js` is removed.
- [ ] `src/auth/` directory contains new providers.
- [ ] `npm test` passes after Phase 4.

## Risks
- Authentication will be completely unavailable from the start of Phase 1 until the end of Phase 3.
- Any emergency hotfixes during the migration will be impossible to test against the auth system.
- Potential for regression in JWT handling logic during re-implementation.
