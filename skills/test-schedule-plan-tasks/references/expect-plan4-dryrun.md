# Expectations (dry-run): plan4-trivial-mixed.md

## Dry-run summary
expected_first_delivery_agents: ["PORT", "nvmrc", "Logger"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
Three independent proposals: PORT (trivial), nvmrc (trivial), Logger (non-trivial).
In dry-run, trivial override is NOT active — PORT and nvmrc keep Isolation: none (trivial)
and have NO create-wt tasks. Only Logger gets a create-wt.

Phase B creates and simulates create-wt-Logger (blocked by Setup only). After Phase B:
- PORT delivery-agent: blocked by Setup only (already done) → unblocked
- nvmrc delivery-agent: blocked by Setup only → unblocked
- Logger delivery-agent: blocked by create-wt-Logger (just completed in Phase B) → unblocked

All 3 delivery-agents dispatch simultaneously in wave 1.

After all 3 complete → Regression. Wave 2: Regression.

Task count in dry-run: 3 git-prep + 1 create-wt (Logger only) + 3 delivery-agent + 1 regression
= 8 tasks (NOT 10 — trivial override is NOT active in dry-run mode, unlike plan-only).

## special_assertions

A. Trivial isolation preserved: PORT and nvmrc delivery-agents show Isolation: none (trivial)
   in the trace. No create-wt tasks exist for PORT or nvmrc.
   Fail if PORT or nvmrc shows Isolation: native worktree, or if the task graph has
   create-wt rows for PORT or nvmrc.

B. Task count is 8: the trace header shows Total tasks: 8 (not 10).
   Fail if total task count is 10 (that is the plan-only count with trivial override active).

C. Wave 1 is a 3-agent batch: PORT, nvmrc, and Logger delivery-agents all appear together in
   wave 1. No delivery-agent should appear before the others.
   Fail if Logger is in a later wave than PORT and nvmrc (or vice versa).

D. Regression is last: Regression dispatched after all 3 delivery-agents return RESULT: complete.
   Fail if Regression appears in wave 1 or is dispatched before any delivery-agent finishes.

E. Validation predicate 1: "Every chain head dispatched in wave 1" — with 0 chains this is
   vacuously true. The ### Validation section must show ✓ for this predicate.
