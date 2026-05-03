# Expectations: plan1-max-concurrency.md

## Topology summary
expected_chains: 0
expected_standalones: 6

## Chain detection rationale
- Global Prepare: pred=0, succ=4 → not a seed → standalone (collected in step 5)
- Phase 1a (Health): pred=1(←Prepare), succ=1(→Wire); Wire has pred=4 ≠ 1 → path=[1a] length 1 → standalone
- Phase 1b (Users): same → standalone
- Phase 1c (Posts): same → standalone
- Phase 1d (Status): same → standalone
- Phase 2 (Wire): pred=4, succ=0 → not a seed → standalone (collected in step 5)

## chain_specs
(none — 0 chains expected)

## standalone_specs
- "Global Prepare: Install Dependencies"  (or equivalent subject)
- "Phase 1a: Health Route"
- "Phase 1b: Users Route"
- "Phase 1c: Posts Route"
- "Phase 1d: Status Route"
- "Phase 2: Wire Routes"

Match by subject keywords, not exact string — e.g. "Health" is sufficient to match Phase 1a.

## special_assertions

A. Assert 5 (Regression): regression task must be blocked by ALL 6 standalone delivery-agents
   (Prepare, 1a, 1b, 1c, 1d, Wire). No chain tails exist to block it.
   Fail if regression is missing any of the 6 as direct blockers.

B. Assert 7 (one create-wt per chain): no chains exist, so Assert 7 is vacuously satisfied.
   Verify the Wiring Integrity section does not report an Assert 7 violation.

C. Parallel dispatch check: the ### Dependency Graph should show all 6 standalone delivery-agents
   unblocked simultaneously after git-prep + Setup .worktrees completes.
