# Plan: Add Persistent Job Queue for MCP Gas Exec Operations

## Context
The mcp_gas server currently executes GAS script operations synchronously — each `exec` call blocks until the Apps Script execution completes. For long-running operations (sheet rebuilds, batch email sends), this causes client timeouts and forces retry logic on the caller. We need an async job queue that accepts work, returns a job ID immediately, and allows polling for completion.

**Project:** mcp_gas (~/src/mcp_gas)

## Approach
PropertiesService is too slow for job state management — its read latency would add unacceptable overhead to the polling endpoint. We'll use an in-memory Map with periodic flush to a local SQLite database for persistence across server restarts. This gives us sub-millisecond reads for active jobs while maintaining durability.

## Implementation Steps

### Phase 1: Job Queue Core

**Pre-check:** None (new module)
**Outputs:** `src/queue/jobQueue.ts`, `src/queue/jobStore.ts`, queue types

1. Create `src/queue/jobStore.ts`:
   - SQLite-backed persistent store using `better-sqlite3`
   - `createJob(payload): JobId` — insert pending job, return UUID
   - `updateStatus(jobId, status, result?)` — update job state
   - `getJob(jobId): Job | null` — fetch current state
   - In-memory LRU cache (100 jobs) for active job lookups

2. Create `src/queue/jobQueue.ts`:
   - `enqueue(operation, args): JobId` — create job, spawn async worker
   - `poll(jobId): JobStatus` — return current status from store
   - Worker pool: max 3 concurrent GAS executions (prevent quota exhaustion)
   - Exponential backoff on GAS API failures

3. Add types to `src/types/queueTypes.ts`:
   - `Job { id: string, status: 'pending'|'running'|'complete'|'failed', payload: any, result?: any, createdAt: number }`
   - `JobQueueConfig { maxConcurrent: number, dbPath: string, cacheSizeLimit: number }`

### Phase 2: API Integration

**Pre-check:** Phase 1 outputs exist — `jobStore.ts` exports `createJob`, `getJob`, `updateStatus`
**Outputs:** Updated `gasClient.ts` facade, new endpoints

4. Add two new operation handlers in `gasClient.ts`:
   - `execAsync(operation, args)` → returns `{ jobId }` immediately
   - `pollJob(jobId)` → returns current job status and result if complete

5. Update `gasScriptOperations.ts` to support async mode:
   - When `async: true` flag is present, delegate to job queue instead of blocking

6. Add job cleanup: purge completed jobs older than 1 hour

### Phase 3: Testing & Deployment

**Pre-check:** Phase 2 integration complete
**Outputs:** Test files, updated package.json

7. Write unit tests for job lifecycle (create → run → complete/fail)
8. Write integration test: enqueue operation, poll until complete, verify result
9. Test concurrent execution limit (4th job should queue, not execute)
10. Add `better-sqlite3` to `package.json` dependencies
11. Build and verify: `npm run build && npm test`

## Git Strategy
- Branch: `feat/async-job-queue`
- Per-phase commits with descriptive messages
- Push to remote, create PR, squash merge to main

## Post-Implementation
1. `/review-suite:review-fix` — loop until clean
2. `npm run build`
3. `npm test`
4. If build/tests fail → fix → re-run `/review-suite:review-fix` → re-run build/tests

## Verification
- `tsc --noEmit` passes
- All tests pass including new queue tests
- Manual test: `execAsync` returns jobId, `pollJob` returns status progression
