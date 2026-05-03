# Expectations (dry-run): plan1-max-concurrency.md

## Dry-run summary
expected_first_delivery_agents: ["Prepare"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
All 6 proposals are standalones (fan-out + fan-in, no chains). In dry-run mode trivial
override is NOT active — tasks keep their actual isolation classification.

Prepare has no upstream delivery-agent deps → its create-wt unblocks immediately after Setup,
so Prepare is the sole wave-1 delivery-agent. After Prepare's simulated completion:
- 1a, 1b, 1c, 1d create-wts unblock (each blocked by Setup + Prepare delivery-agent)
- 1a, 1b, 1c, 1d delivery-agents unblock next (parallel)
- Wire create-wt unblocks after all 4 of 1a–1d delivery-agents complete
- Wire delivery-agent follows, then Regression

Expected cascade depth: ≥ 4 delivery-agent waves.

## special_assertions

A. Wave 1 is singular: only Prepare (or its equivalent "Global Prepare / Install Dependencies")
   appears as the first delivery-agent dispatched. 1a, 1b, 1c, 1d, and Wire must NOT appear in
   the same wave as Prepare.
   Fail if 1a, 1b, 1c, 1d, or Wire appear in wave 1 alongside Prepare.

B. Parallel mid-cascade: 1a, 1b, 1c, and 1d delivery-agents should appear in the same wave
   (dispatched simultaneously after Prepare completes). Verify the trace shows them together
   in one wave row, not sequentially.
   Fail if 1a–1d are split across multiple sequential single-agent waves without cause.

C. Regression is last: the regression task is the final dispatch in the cascade
   (appears after Wire delivery-agent). DISPATCHED for Wire's row must reference regression.
   Fail if regression is dispatched before Wire completes.

D. Validation predicate 1: "Every chain head dispatched in wave 1" — with 0 chains this is
   vacuously true. The Validation section must show ✓ for this predicate.

E. Assert 6 (target_branch): every delivery-agent task must have a non-empty, non-placeholder
   metadata.target_branch in its real task record. Fail if any delivery-agent shows a placeholder.
