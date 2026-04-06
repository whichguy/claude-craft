# Plan: Add Webhook Retry System

## Context

Our platform sends webhooks to customer endpoints when events occur (order created,
payment received, subscription changed). Currently webhooks fire once with no retry —
if the customer endpoint is down, the event is lost. Customers have reported missed
webhooks causing data sync issues. We need automatic retries with exponential backoff.

## Current State

- Node.js 20, Express 4.18, TypeScript 5.3
- `src/webhooks/dispatcher.ts` — fires webhooks via `axios.post()`, no retry logic
- `src/webhooks/types.ts` — `WebhookEvent`, `WebhookSubscription` interfaces
- `src/models/webhookLog.ts` — Prisma model logging each attempt (status, response code)
- PostgreSQL with Prisma ORM, existing `WebhookLog` table
- ~500 webhook subscriptions, ~2000 events/day
- Current failure rate: ~5% (customer endpoints intermittently down)

## Approach

We will add a retry queue backed by the existing PostgreSQL database (no new infrastructure).
Failed webhook deliveries get queued with exponential backoff (1min, 5min, 30min, 2hr, 24hr).
A background worker polls the queue and retries pending deliveries. After 5 failed attempts,
the webhook is marked as permanently failed and the customer is notified via email.

## Files to Modify

- `src/webhooks/dispatcher.ts` — add retry-on-failure logic after dispatch
- `src/webhooks/retryQueue.ts` (new) — queue management: enqueue, dequeue, update status
- `src/webhooks/retryWorker.ts` (new) — background worker polling for pending retries
- `src/webhooks/backoff.ts` (new) — exponential backoff calculator
- `src/webhooks/types.ts` — add `RetryStatus`, `QueuedWebhook` types
- `prisma/schema.prisma` — add `WebhookRetry` model
- `prisma/migrations/` — new migration for retry table
- `src/notifications/webhookFailure.ts` (new) — email notification for permanent failures
- `src/app.ts` — start retry worker on app boot

## Implementation

### Phase 1: Database Schema

1. Add `WebhookRetry` model to Prisma schema:
   ```prisma
   model WebhookRetry {
     id            String   @id @default(uuid())
     webhookLogId  String
     subscriptionId String
     eventPayload  Json
     attempt       Int      @default(0)
     maxAttempts   Int      @default(5)
     nextRetryAt   DateTime
     status        String   @default("pending") // pending, processing, succeeded, failed
     lastError     String?
     createdAt     DateTime @default(now())
     updatedAt     DateTime @updatedAt
   }
   ```
2. Run `npx prisma migrate dev --name add-webhook-retry`
3. Verify migration applies cleanly

### Phase 2: Backoff Calculator & Queue

1. Create `backoff.ts`:
   - `calculateNextRetry(attempt: number): Date` — returns next retry time
   - Schedule: attempt 1 → +1min, 2 → +5min, 3 → +30min, 4 → +2hr, 5 → +24hr
   - Add jitter: ±10% randomization to prevent thundering herd

2. Create `retryQueue.ts`:
   - `enqueue(webhookLogId, subscriptionId, payload)` — create retry record
   - `dequeueReady(limit: number)` — fetch retries where `nextRetryAt <= now()`
   - `markProcessing(id)` — set status to processing (prevent double-pickup)
   - `markSucceeded(id)` — set status to succeeded
   - `markFailed(id, error)` — increment attempt, calculate next retry or mark permanent fail

### Phase 3: Retry Worker

1. Create `retryWorker.ts`:
   - `startWorker(intervalMs: number)` — sets up polling loop via `setInterval`
   - Every 30 seconds: call `dequeueReady(10)` to get batch of pending retries
   - For each retry: attempt delivery via `axios.post()`
   - On success (2xx): call `markSucceeded()`
   - On failure: call `markFailed()` which either schedules next retry or marks permanent
   - On permanent failure (attempt >= maxAttempts): trigger email notification

2. Create `webhookFailure.ts`:
   - `notifyPermanentFailure(subscriptionId, eventPayload, lastError)` — sends email
     to subscription owner about failed webhook delivery

### Phase 4: Integration

1. Update `dispatcher.ts`:
   - After a failed `axios.post()` (non-2xx or network error), call `retryQueue.enqueue()`
   - Log the initial failure in `WebhookLog` as before
   - Remove any existing basic retry logic (there is none, but guard against it)

2. Update `app.ts`:
   - Import `startWorker` from `retryWorker`
   - Call `startWorker(30000)` after Express app initialization
   - Add graceful shutdown: clear interval on SIGTERM

3. Add `RetryStatus` and `QueuedWebhook` types to `types.ts`

## Verification

1. Unit test `backoff.ts`: verify correct intervals for attempts 1-5, verify jitter range
2. Unit test `retryQueue.ts`: enqueue → dequeue → mark succeeded/failed flows
3. Integration test: dispatch webhook to mock server that returns 500 → verify retry created
4. Integration test: retry worker picks up pending retry → delivers to now-healthy endpoint
5. Test permanent failure: after 5 failed attempts, verify email notification sent
6. Test thundering herd: 100 simultaneous failures → retries spread across time window
7. Verify worker graceful shutdown on SIGTERM
