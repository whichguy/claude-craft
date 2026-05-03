# Expectations: plan6-deep-cascading.md

## Topology summary
expected_chains: 2
expected_standalones: 4

## Chain detection rationale (cascade topology)
- Phase A (Auth Config): pred=0, succ=1(→B) → seed; B has pred=1, succ=2(→C,→D) → stop.
  Path=[A,B] → chain-1. A=head, B=tail. (B ends chain-1 because succ=2.)
- Phase C (JWT Middleware): pred=1(←B), succ=1(→E) → seed; E has pred=2 ≠ 1 → stop.
  Path=[C] length 1 → standalone.
- Phase D (Auth Routes): pred=1(←B), succ=1(→E) → seed; E has pred=2 → stop.
  Path=[D] length 1 → standalone.
- Phase E (Secured Profile Router): pred=2(←C,←D), succ=1(→F) → seed; F has pred=1,
  succ=2(→G,→H) → stop. Path=[E,F] → chain-2. E=head, F=tail. (F ends chain-2 because succ=2.)
- Phase G (Integration Tests): pred=1(←F), succ=1(→regression or succ=0) → seed or standalone.
  If regression is separate: succ=0 → not a seed → standalone (collected). 
  If regression counts as succ: same stop at regression (pred=2). Either way → standalone.
- Phase H (Metrics Endpoint): same as G → standalone.

## chain_specs

chain-1:
  members_in_order:
    - subject_keyword: "Auth Config"    role: head
    - subject_keyword: "User Store"     role: tail
  worktree: ".worktrees/chain-1"
  merge_point: "Phase B" delivery-agent (chain-1 tail)

chain-2:
  members_in_order:
    - subject_keyword: "Secured Profile"  role: head   (or "Profile Router")
    - subject_keyword: "Rate Limit"       role: tail   (or "Auth Rate Limit")
  worktree: ".worktrees/chain-2"
  merge_point: "Phase F" delivery-agent (chain-2 tail)

## standalone_specs
- "Phase C: JWT Auth Middleware"        (keyword: "JWT" or "requireJwt")
- "Phase D: User Registration"          (keyword: "Register" or "Login Routes")
- "Phase G: Auth Integration Tests"     (keyword: "Integration" or "authFlow")
- "Phase H: Auth Metrics Endpoint"      (keyword: "Metrics")

## special_assertions

A. Assert 3 — chain-2 create-wt fan-in wiring (CRITICAL):
   chain-2's create-wt must be blocked by:
     (a) chain-1 tail delivery-agent (Phase B — User Store)
     (b) Phase C standalone delivery-agent (JWT Middleware)
     (c) Phase D standalone delivery-agent (Auth Routes)
     (d) Setup .worktrees
   Fail if (a), (b), or (c) are missing from chain-2 create-wt's blocked-by list.
   This is the defining assertion for the cascade topology.

B. Assert 3 — Phase C create-wt wiring:
   Phase C's create-wt must be blocked by chain-1 tail delivery-agent (Phase B) AND Setup .worktrees.
   Fail if Phase B delivery-agent is missing as a blocker.

C. Assert 3 — Phase D create-wt wiring:
   Same as B — Phase D create-wt blocked by Phase B delivery-agent AND Setup .worktrees.

D. Assert 3 — Phase G create-wt wiring:
   Phase G's create-wt must be blocked by chain-2 tail delivery-agent (Phase F) AND Setup .worktrees.

E. Assert 3 — Phase H create-wt wiring:
   Phase H's create-wt must be blocked by chain-2 tail delivery-agent (Phase F) AND Setup .worktrees.

F. Regression Blocker Reduction (CRITICAL):
   The regression task's blocked-by list must contain:
     - Phase G delivery-agent  ✓ required
     - Phase H delivery-agent  ✓ required
     - Phase F delivery-agent  ✗ MUST NOT appear (Reduction removes this edge)
   Fail if Phase F (chain-2 tail) appears as a direct regression blocker.
   Fail if Phase G or Phase H are absent from the regression's blocked-by list.

G. Assert 7 (one create-wt per chain):
   Exactly ONE create-wt exists for chain-1. Phase B must not have its own create-wt.
   Exactly ONE create-wt exists for chain-2. Phase F must not have its own create-wt.
   Fail if chain-1 tail (B) or chain-2 tail (F) have their own create-wt.

H. Self-merge fields in ### Task Details:
   - Phase A (chain-1 head): Self-merge: no
   - Phase B (chain-1 tail): Self-merge: yes
   - Phase C (standalone): Self-merge: yes
   - Phase D (standalone): Self-merge: yes
   - Phase E (chain-2 head): Self-merge: no
   - Phase F (chain-2 tail): Self-merge: yes
   - Phase G (standalone): Self-merge: yes
   - Phase H (standalone): Self-merge: yes

I. Self-merge flag: only Phase B (chain-1 tail), Phase F (chain-2 tail), Phase C, Phase D,
   Phase G, and Phase H (all Chain: none or tail) must have Self-merge: yes in their
   Execution context. Phase A (chain-1 head) and Phase E (chain-2 head) must have Self-merge: no.
   Fail if any head has Self-merge: yes or any tail/standalone has Self-merge: no.
