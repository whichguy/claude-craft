# Expectations (dry-run): plan3-diamond.md

## Dry-run summary
expected_first_run_agents: ["Auth", "Static"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
Three standalones with diamond dependency: 1a (Auth) and 1b (Static) are independent;
Dashboard depends on both. In dry-run, trivial override is NOT active (all three are already
non-trivial). Phase B creates and simulates create-wts for 1a and 1b (both blocked by Setup
only); create-wt-Dashboard is blocked by Setup + 1a run-agent + 1b run-agent, so it does
NOT complete in Phase B.

Wave 1: both 1a (Auth) and 1b (Static) run-agents dispatch simultaneously — their create-wts
finished in Phase B.

After 1a and 1b complete → create-wt-Dashboard unblocks → completes → Dashboard run-agent
unblocks. Wave 2: Dashboard run-agent (single agent).

After Dashboard → Regression. Wave 3: Regression.

Expected cascade depth: ≥ 3 waves (2 run-agent waves + regression).

## special_assertions

A. Wave 1 is a 2-agent batch: Auth (1a) and Static (1b) are dispatched simultaneously in
   wave 1. Dashboard must NOT appear in wave 1.
   Fail if Dashboard appears in wave 1 alongside 1a/1b.

B. Dashboard is wave 2 (serial): Dashboard run-agent appears alone in wave 2, dispatched
   only after BOTH 1a and 1b have returned RESULT: complete.
   Fail if Dashboard appears in wave 1, or if it is dispatched before either 1a or 1b finishes.

C. Regression is last: Regression appears after Dashboard completes. Dashboard agent's
   DISPATCHED field must reference the regression task ID.
   Fail if Regression is dispatched before Dashboard completes.

D. Independence: 1a and 1b agents have no DISPATCHED dependency on each other. Neither
   agent's DISPATCHED field should reference the other's task ID.
   Fail if 1a dispatches 1b or vice versa.

E. Validation predicate 1: "Every chain head dispatched in wave 1" — with 0 chains this is
   vacuously true. The ### Validation section must show ✓ for this predicate.
