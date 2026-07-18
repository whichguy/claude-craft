<!-- Host-agnostic contract for Phase 3 replan advisors -->

# Contract: Advisor (read-only replan input)

Phase 3 may consult zero or more **advisors** before surgically updating the Backlog.

## Required behavior

1. **Read-only:** no edits, no write commands; diagnose and recommend only.  
2. Input: target, path to `IMPROVE_LOOP.md` (including this cycle’s Log entry), prior-learnings digest, Phase 1 report (or empty-backlog thesis). Prefer open Backlog + last 3 Log + compact COMPLETED/DISPROVEN (not full ledger dump).  
3. Output: prefer structured **5-block** form (see `contracts/planning.md`): purpose fit; material recommendations (class must-fix|decision|simplify|defer + kind + six-clause or residual thin); Deferred P2; risks/stop; anti-reseed. Free prose acceptable if clauses are still recoverable.  
4. Must not recommend re-attempting a **disproven** thesis without a concrete re-open reason.  
5. Must not drop or uncheck already-`[x]` Backlog items (A continuous).  
6. Do not invent Decision/Preserve on residual items; do not invent new complete predicates.

## Defaults and throttle

- **Default when advisors unavailable or throttled:** native-only replan (orchestrator).  
- **Full multi-model panel** is optional and host-mapped; continuous driver may run full panel only every K cycles or on stall (see improve skill `throttle.md`).  
- Advisor failure/timeout must **not** stall the cycle — continue with usable subset or native fallback.

## Host mappings (optional)

| Host | Example advisors |
|---|---|
| Claude Craft | `codex:codex-rescue`, `grok-cc:grok-rescue` when installed |
| Grok | Second-opinion / read-only task |
| None | Skip panel; native Consolidation only |

## Resume

If the host supports resuming the **same** advisor transcript for a rebuttal round, do so; otherwise keep Round-1 positions only. Do not assume a Claude-only `SendMessage` API name in portable docs — use “resume advisor thread if host supports.”
