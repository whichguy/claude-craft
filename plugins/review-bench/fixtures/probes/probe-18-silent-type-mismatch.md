<!-- expected-finding: Plan asserts findUserById returns User and downstream destructures result.email unconditionally, but the cited type definition at src/types/user.ts shows the function returns User | undefined. The undefined branch will throw at runtime. Should be flagged by Internal Consistency / Cross-boundary signature mismatch. -->

# Plan: Add Email-Verification Banner for Unverified Users

## Context
Our dashboard at `src/pages/Dashboard.tsx` does not surface email-verification state. Users who never confirmed their email after signup (~7% per `analytics/queries/unverified-7d.sql`) miss password-reset flows. Product wants a dismissible banner pointing them to `/verify` when `user.emailVerifiedAt == null`.

**Project:** dashboard-web (~/src/dashboard-web)

## Approach
Lookup the current user via the existing `findUserById(id: string): User | undefined` helper exported from `src/lib/userRepo.ts` (verified — read the file). Render `<VerificationBanner>` when `user.emailVerifiedAt` is null. The component is new at `src/components/VerificationBanner.tsx`. Wire it into `Dashboard.tsx` above the main content region.

**Why useEffect + state vs server-rendered prop:** the dashboard is a client-rendered SPA after auth bootstrap — `userId` becomes available only after the auth context resolves. A server-side prop would require restructuring routing.

## Implementation Steps

### Phase 1: Banner Component

**Pre-check:** `src/components/` exists; `src/types/user.ts` defines `User { id, email, name, emailVerifiedAt: Date | null }`.
**Outputs:** `src/components/VerificationBanner.tsx`, `test/components/VerificationBanner.test.tsx`

1. Read `src/types/user.ts` to confirm the `User` shape (confirmed: `emailVerifiedAt: Date | null`, `email: string`).
2. Read `src/lib/userRepo.ts` to confirm `findUserById` signature. (The function is defined at line 14: `export function findUserById(id: string): User | undefined`.)
3. Create `src/components/VerificationBanner.tsx`:
   - Props: `{ email: string; onDismiss: () => void }`.
   - Renders an alert with copy "Verify {email} to enable account recovery" and a link to `/verify`.
4. Add a test in `test/components/VerificationBanner.test.tsx`: render with a sample email, assert link target is `/verify` and dismiss triggers callback.

### Phase 2: Dashboard Integration

**Pre-check:** Phase 1 component renders in isolation (Storybook entry passes).
**Outputs:** Updated `src/pages/Dashboard.tsx`, integration test

5. Read `src/pages/Dashboard.tsx` (verified: receives `userId: string` from auth context at line 18, currently calls `findUserById(userId)` already at line 21 to obtain display name).
6. Update `src/pages/Dashboard.tsx` near line 22:
   - Existing line: `const user = findUserById(userId);`
   - Add: `const { email, emailVerifiedAt } = user;`
   - Below: `{!emailVerifiedAt && <VerificationBanner email={email} onDismiss={...} />}`.
7. Add integration test in `test/pages/Dashboard.test.tsx`: mount with a user whose `emailVerifiedAt` is null → asserts banner is visible.

### Phase 3: Tests + Deploy

**Pre-check:** Phase 2 typechecks.
**Outputs:** Test results, deploy artifact

8. `npm run build && npm test` — all tests pass.
9. Deploy via standard pipeline: PR → review → squash merge → CI deploy.

## Git Strategy
- Branch: `feat/verification-banner`
- Per-phase commits.
- Push, PR, squash merge.

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean.
2. `npm run build`.
3. `npm test`.
4. If build/tests fail → fix → re-run `/review-suite:review-fix` → re-run.

## Verification
- `tsc --noEmit` passes.
- Existing tests still pass.
- Manual: log in as a test user with `emailVerifiedAt = null` — banner appears. Log in as a verified user — banner does not appear.
