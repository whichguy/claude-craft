# Expectations (dry-run): plan5-multi-chain.md

## Dry-run summary
expected_first_delivery_agents: ["API Router", "CORS", "Admin"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
Two independent chains plus two standalones:
- chain-1: A1 (API Router, head) → A2 (Pagination, tail)
- chain-2: B1 (CORS, head) → B2 (Rate Limit, tail)
- Standalone: Admin
- Standalone: Smoke (fan-in — depends on A2, B2, Admin)

In Phase B: create-wt-chain-1, create-wt-chain-2, create-wt-Admin all complete (blocked by
Setup only). create-wt-Smoke does NOT complete in Phase B (blocked by Setup + A2 + B2 + Admin
delivery-agents).

Wave 1: A1 (chain-1 head), B1 (chain-2 head), Admin standalone — all 3 dispatch in parallel.

After A1 completes: A2 (chain-1 tail) unblocks → dispatched by A1 agent.
After B1 completes: B2 (chain-2 tail) unblocks → dispatched by B1 agent.
Wave 2: A2 and B2 (both appear, potentially in different sub-waves but both in wave 2 tier).

After A2, B2, Admin all complete → create-wt-Smoke unblocks → Smoke delivery-agent unblocks.
Wave 3 (or 4): Smoke delivery-agent.

After Smoke → Regression.

Expected cascade depth: ≥ 4 delivery-agent waves.

## special_assertions

A. Wave 1 is a 3-agent batch: A1 (API Router), B1 (CORS), Admin all appear in wave 1.
   A2, B2, Smoke, and Regression must NOT appear in wave 1.
   Fail if any tail, Smoke, or Regression appears in wave 1.

B. Parallel chains: A1 and B1 have no cross-chain DISPATCHED dependency. A1's DISPATCHED
   dispatches A2 only (not B2); B1's DISPATCHED dispatches B2 only (not A2).
   Fail if A1 dispatches B2 or B1 dispatches A2.

C. Smoke after all upstream: Smoke delivery-agent appears only after A2, B2, AND Admin have all
   returned RESULT: complete. create-wt-Smoke must not appear in Phase B.
   Fail if Smoke appears before any of A2, B2, Admin completes.

D. Regression is last: Regression dispatched after Smoke completes. Smoke agent's DISPATCHED
   must reference the regression task ID.
   Fail if Regression is dispatched before Smoke completes, or Smoke is dispatched before
   A2/B2/Admin complete.

E. Assert 6 (target_branch): all 6 delivery-agents (A1, A2, B1, B2, Admin, Smoke) must have a
   non-empty, non-placeholder metadata.target_branch in the real task record.
   Fail if any delivery-agent shows a placeholder target_branch.
