# Expectations (dry-run): plan1-max-concurrency.md

## Dry-run summary
expected_first_run_agents: ["Prepare"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
All 6 proposals are standalones (fan-out + fan-in, no chains). In dry-run mode trivial
override is NOT active — tasks keep their actual isolation classification.

Prepare has no upstream run-agent deps → its create-wt unblocks immediately after Setup,
so Prepare is the sole wave-1 run-agent. After Prepare's simulated completion:
- 1a, 1b, 1c, 1d create-wts unblock (each blocked by Setup + Prepare run-agent)
- 1a, 1b, 1c, 1d run-agents unblock next (parallel)
- Wire create-wt unblocks after all 4 of 1a–1d run-agents complete
- Wire run-agent follows, then Regression

Expected cascade depth: ≥ 4 run-agent waves.

## special_assertions

A. Wave 1 is singular: only Prepare (or its equivalent "Global Prepare / Install Dependencies")
   appears as the first run-agent dispatched. 1a, 1b, 1c, 1d, and Wire must NOT appear in
   the same wave as Prepare.
   Fail if 1a, 1b, 1c, 1d, or Wire appear in wave 1 alongside Prepare.

B. Parallel mid-cascade: 1a, 1b, 1c, and 1d run-agents should appear in the same wave
   (dispatched simultaneously after Prepare completes). Verify the trace shows them together
   in one wave row, not sequentially.
   Fail if 1a–1d are split across multiple sequential single-agent waves without cause.

C. Regression is last: the regression task is the final dispatch in the cascade
   (appears after Wire run-agent). DISPATCHED for Wire's row must reference regression.
   Fail if regression is dispatched before Wire completes.

D. Validation predicate 1: "Every chain head dispatched in wave 1" — with 0 chains this is
   vacuously true. The Validation section must show ✓ for this predicate.

E. Assert 6 (target_branch): every run-agent task must have a non-empty, non-placeholder
   metadata.target_branch in its real task record. Fail if any run-agent shows a placeholder.
