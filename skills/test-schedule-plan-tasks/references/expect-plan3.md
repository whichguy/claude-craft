# Expectations: plan3-diamond.md

## Topology summary
expected_chains: 0
expected_standalones: 3

## Chain detection rationale
- Phase 1a (Auth Middleware): pred=0, succ=1(→Dashboard); Dashboard has pred=2 ≠ 1 → stop.
  Path=[1a] length 1 → standalone.
- Phase 1b (Static File Middleware): pred=0, succ=1(→Dashboard); same → standalone.
- Phase 2 (Dashboard Route): pred=2(←1a, ←1b), succ=0 → not a seed → standalone (collected step 5).

## chain_specs
(none — 0 chains expected)

## standalone_specs
- "Phase 1a: Auth Middleware"  (keyword: "Auth")
- "Phase 1b: Static File Middleware"  (keyword: "Static")
- "Phase 2: Protected Dashboard Route"  (keyword: "Dashboard")

## special_assertions

A. Assert 3 (create-wt upstream wiring): Dashboard's create-wt must be blocked by BOTH
   Phase 1a delivery-agent AND Phase 1b delivery-agent (in addition to Setup .worktrees).
   This is the fan-in wiring. Fail if either upstream delivery-agent is missing as a blocker.

B. Assert 5 (Regression): regression must be blocked by all 3 standalone delivery-agents
   (1a, 1b, Dashboard). Fail if any are missing.

   Regression Blocker Reduction check: the plan's Git Strategy states regression is
   "optimally blocked only by the Phase 2 delivery-agent (the fan-in node)". Validate whether
   the skill applied the Reduction (removed 1a and 1b direct edges) OR kept all 3.
   EITHER IS ACCEPTABLE for plan3 — the Reduction is optional and both are valid here.
   Document which was chosen in NOTES.

C. Independence: Phase 1a and Phase 1b delivery-agents must have NO blocker relationship to each
   other (neither blocks the other). Verify in ### Task List blocked-by column.

D. Fan-in wiring prose: the ### Dependency Graph should show 1a and 1b running in parallel
   before Dashboard's create-wt unblocks.
