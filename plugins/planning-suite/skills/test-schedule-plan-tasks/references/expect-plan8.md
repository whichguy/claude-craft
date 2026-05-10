# Expectations: plan8-cascade-fan-in.md

## Topology summary
expected_chains: 2
expected_standalones: 2

Edges (DEPENDS ON, downstream→upstream): A→B, B→C, B→D, C→E, D→E, E→F.

## Chain detection rationale (cascade fan-in)
- Step A (Express skeleton): pred=0, succ=1(→B) → seed; B has pred=1, succ=2(→C,→D) → stop.
  Path=[A,B] → chain-1. A=head, B=tail. (B ends chain-1 because succ=2.)
- Step C (GET /api/health): pred=1(←B), succ=1(→E) → seed; E has pred=2(←C,←D) ≠ 1 → stop.
  Path=[C] length 1 → standalone.
- Step D (GET /api/version): pred=1(←B), succ=1(→E) → seed; E has pred=2 → stop.
  Path=[D] length 1 → standalone.
- Step E (Supertest integration): pred=2(←C,←D), succ=1(→F) → seed; F has pred=1,
  succ=0 → extend; F has no further successors → stop. Path=[E,F] → chain-2.
  E=head, F=tail.
- Step F (README + npm test): consumed by chain-2 detection above; not seeded separately.

## chain_specs

chain-1:
  members_in_order:
    - subject_keyword: "Express"      role: head    (or "skeleton" / "server skeleton")
    - subject_keyword: "Router"       role: tail    (or "factory" / "/api")
  worktree: ".worktrees/chain-1"
  merge_point: "Step B" delivery-agent (chain-1 tail)

chain-2:
  members_in_order:
    - subject_keyword: "Supertest"    role: head    (or "integration tests")
    - subject_keyword: "README"       role: tail    (or "npm test wiring")
  worktree: ".worktrees/chain-2"
  merge_point: "Step F" delivery-agent (chain-2 tail)

## standalone_specs
- "Step C: GET /api/health"      (keyword: "health")
- "Step D: GET /api/version"     (keyword: "version")

## special_assertions

A. Assert 3 — chain-2 create-wt fan-in wiring (CRITICAL):
   chain-2's create-wt must be blocked by:
     (a) chain-1 tail delivery-agent (Step B — Router factory)
     (b) Step C standalone delivery-agent (health route)
     (c) Step D standalone delivery-agent (version route)
     (d) Setup .worktrees
   Fail if (a), (b), or (c) are missing from chain-2 create-wt's blocked-by list.
   This is the defining assertion for cascade fan-in topology.

B. Assert 3 — Step C create-wt wiring:
   Step C's create-wt must be blocked by chain-1 tail delivery-agent (Step B)
   AND Setup .worktrees.
   Fail if Step B delivery-agent is missing as a blocker.

C. Assert 3 — Step D create-wt wiring:
   Same as B — Step D create-wt blocked by Step B delivery-agent AND Setup .worktrees.

D. Assert 3 — chain-1 create-wt wiring:
   chain-1's create-wt blocked by Setup .worktrees only (no upstream delivery-agent).
   Fail if any delivery-agent appears as a chain-1 create-wt blocker.

E. Bidirectional wiring — fan-in at Step E delivery-agent:
   Step E's delivery-agent.blocked_by must contain BOTH Step C delivery-agent ID
   AND Step D delivery-agent ID. Step C.blocks AND Step D.blocks must both contain
   Step E. Fail if either direction is missing.

F. Regression Blocker Reduction (if regression task is present):
   The regression task's blocked-by list, after Reduction, must contain:
     - Step F delivery-agent  ✓ required (sole terminal)
     - Step B delivery-agent  ✗ MUST NOT appear (covered transitively via C/D/E/F)
     - Step C delivery-agent  ✗ MUST NOT appear (covered via E/F)
     - Step D delivery-agent  ✗ MUST NOT appear (covered via E/F)
     - Step E delivery-agent  ✗ MUST NOT appear (covered via F)
   Fail if any non-leaf delivery-agent appears in regression's blocked-by list.
   If regression is absent (per SKILL.md:336 "if present"), skip this assertion.

G. Assert 7 (one create-wt per chain):
   Exactly ONE create-wt exists for chain-1. Step B must not have its own create-wt
   (chain-1 link/tail).
   Exactly ONE create-wt exists for chain-2. Step F must not have its own create-wt
   (chain-2 tail).
   Fail if chain-1 tail (B) or chain-2 tail (F) have their own create-wt.

H. Orchestrator merge: the orchestrator merges every chain-tail and standalone agent branch into INTEGRATION_BRANCH after receiving the agent's completion notification. Verify by checking that `git log --merges --first-parent INTEGRATION_BRANCH` contains merge commits for:
   - Step B (chain-1 tail) branch
   - Step C (standalone) branch
   - Step D (standalone) branch
   - Step F (chain-2 tail) branch
   Chain heads (Step A, Step E) must NOT have merge commits on INTEGRATION_BRANCH. No `.selfmerge-status` files should exist in any worktree.

I. Worktree count:
   Exactly 4 worktree paths appear across all delivery-agent metadata:
     - .worktrees/chain-1 (shared by A and B)
     - .worktrees/<C-task-id> (standalone)
     - .worktrees/<D-task-id> (standalone)
     - .worktrees/chain-2 (shared by E and F)
   Fail if more than 4 distinct worktree_path values are emitted.
