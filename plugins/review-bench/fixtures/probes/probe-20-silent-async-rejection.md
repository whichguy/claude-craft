<!-- expected-finding: Plan adds a fire-and-forget `void fetch(webhookUrl, ...)` inside the request handler's after-response phase. The success path is described, but a fetch rejection (network error, DNS failure, non-2xx) is silently swallowed — there is no .catch() or try/catch around the awaited fire-and-forget. Should be flagged by Security & Error Handling: async operations without error handlers (fire-and-forget without annotation). -->

# Plan: Notify Slack on New User Signup (Background)

## Context
Product wants the team to see new sign-ups in `#signups` Slack channel without slowing the user-visible signup response. Current `routes/auth.ts:signup` returns 200 in ~120ms; adding a synchronous Slack POST would push p95 over the 250ms SLO (measured in `bench/results/2026-04-22-signup-latency.txt`). We will trigger a Slack webhook after the response is sent.

**Project:** auth-service (~/src/auth-service)

## Approach
Add a fire-and-forget Slack notification posted **after** the HTTP response is flushed. Use `res.on('finish', ...)` so the user response is not blocked. The webhook URL lives in `SLACK_SIGNUPS_WEBHOOK` (already configured in staging and prod per `infra/secrets/secrets.yaml:34`).

**Why fire-and-forget vs message queue:** the team has no existing message queue infrastructure; introducing one for a single notification doubles operational surface. Slack webhook posts are idempotent enough (duplicates would just produce duplicate channel messages — acceptable per product).

## Implementation Steps

### Phase 1: Webhook Helper

**Pre-check:** `src/lib/http.ts` exports a wrapped `fetch` with timeout. `SLACK_SIGNUPS_WEBHOOK` is loaded by `src/config/env.ts` at startup with fail-fast validation (verified at lines 28–34).
**Outputs:** `src/lib/slack.ts`, unit test

1. Read `src/lib/http.ts` to confirm `fetchWithTimeout(url, opts)` signature and 5s default timeout.
2. Read `src/config/env.ts:28-34` to confirm `SLACK_SIGNUPS_WEBHOOK` is validated at startup.
3. Create `src/lib/slack.ts`:
   - Export `notifySignup(email: string, userId: string): Promise<void>`.
   - Body: `await fetchWithTimeout(env.SLACK_SIGNUPS_WEBHOOK, { method: 'POST', body: JSON.stringify({ text: \`New signup: ${email} (id=${userId})\` }) })`.
4. Add unit test in `test/lib/slack.test.ts`: stub `fetchWithTimeout`, assert correct URL, body shape, and that a non-2xx response throws.

### Phase 2: Wire Into Signup Route

**Pre-check:** Phase 1 helper exists and tests pass.
**Outputs:** Updated `routes/auth.ts`

5. Read `routes/auth.ts:signup` (verified: handler lines 14–62, returns `res.json({ user })` at line 60).
6. Update the handler to schedule the Slack notification after response flush:
   ```ts
   res.on('finish', () => {
     void notifySignup(user.email, user.id);
   });
   ```
7. Place this before the existing `res.json(...)` call (so the listener is registered before the response flushes).

### Phase 3: Test + Deploy

**Pre-check:** Phase 2 changes typecheck.
**Outputs:** Updated tests, deploy log

8. Add integration test in `test/integration/signup-notify.test.ts`:
   - Stub the Slack webhook with a recording mock.
   - POST to `/signup` → assert response returns first → assert webhook was called once with the expected payload.
9. `npm run build && npm test`.
10. Deploy via PR → CI → staging → smoke test (sign up a test user, watch `#signups-staging`) → prod.

## Git Strategy
- Branch: `feat/signup-slack-notify`
- Per-phase commits.
- Push, PR, squash merge.

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean.
2. `npm run build`.
3. `npm test`.
4. If build/tests fail → fix → re-run.

## Verification
- `tsc --noEmit` passes.
- Integration test passes.
- Staging: sign up a test user → message appears in `#signups-staging` within 2s; signup response time p95 unchanged (compare to `bench/results/2026-04-22-signup-latency.txt`).
- Prod: monitor `#signups` for the first 50 prod signups post-deploy.
