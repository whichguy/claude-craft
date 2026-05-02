<!-- expected-finding: Plan removes processQueueBatch() because grep shows no internal callers, but the function is registered as a scheduled trigger handler in appsscript.json (timeBasedTrigger every 10 minutes) — a live external entry point. Removal would silently break the queue drain. Should be flagged by Accidental Removal directive: live entry point removal without external-caller evidence. -->

# Plan: Remove Unused Queue-Batch Helper from GAS Project

## Context
The Apps Script project `mailroom-automation` (scriptId: `1abc...xyz`) has accumulated dead helpers as features migrated to the new `JobBus` module (`bus.gs`, added 2026-02). Quarterly tech-debt sweep flagged `processQueueBatch()` in `legacy/queue.gs` as a candidate for removal — it appears unreferenced in the codebase.

**Project:** mailroom-automation (GAS)

## Approach
Delete `processQueueBatch()` from `legacy/queue.gs` and any tests that exercise it. Confirm with grep evidence that no internal `.gs` files call it. The function is a holdover from the v1 queue implementation; v2 (`bus.gs:drainBus()`) supersedes it.

**Why full delete vs deprecation comment:** the function is 84 lines including its helpers — leaving it as dead code adds maintenance noise. The replacement (`drainBus`) has been live for 11 weeks without regressions per the ops dashboard.

## Implementation Steps

### Phase 1: Confirm Dead

**Pre-check:** `legacy/queue.gs` exists and contains `function processQueueBatch()` at line 12.
**Outputs:** Evidence file with grep results

1. Read `legacy/queue.gs` to confirm the function and its helpers (`buildBatchPayload_`, `flushBatch_`).
2. Run `grep -rn "processQueueBatch" .` from the project root. Expected output: only the definition site at `legacy/queue.gs:12`. (Verified: no other matches in `.gs` files.)
3. Run `grep -rn "buildBatchPayload_\|flushBatch_" .`. Expected: only references inside `legacy/queue.gs`.
4. Document evidence in commit message: "grep confirms no callers in repo".

### Phase 2: Delete

**Pre-check:** Phase 1 grep evidence captured.
**Outputs:** Updated `legacy/queue.gs`, removed test file

5. Edit `legacy/queue.gs`:
   - Delete `processQueueBatch` (lines 12–48).
   - Delete `buildBatchPayload_` (lines 50–71).
   - Delete `flushBatch_` (lines 73–96).
6. Delete `test/legacy/queue.test.gs` (covers only the removed functions — verified by reading the file).

### Phase 3: Push + Verify

**Pre-check:** Phase 2 deletions complete; `legacy/queue.gs` syntax valid.
**Outputs:** GAS push artifact, deploy log

7. `mcp_gas push` — upload changes to HEAD.
8. `mcp_gas exec` — run `JobBus.drainBus()` once to confirm v2 path still works.
9. Open the script editor and run the manual smoke test in `tests/manual/queue.gs` → expect "OK".

## Git Strategy
- Branch: `chore/remove-legacy-queue-batch`
- Single commit (deletion is atomic).
- Push, PR, squash merge.

## Post-Implementation
1. `/review-fix` — loop until clean.
2. `mcp_gas push` to HEAD.
3. Run `drainBus` smoke test.
4. If failure → revert commit → reinvestigate.

## Verification
- `grep -rn "processQueueBatch" .` returns no results after deletion.
- `JobBus.drainBus()` smoke test passes.
- Mailroom processing dashboard shows continued throughput at the next polling interval.
