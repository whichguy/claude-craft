# Expectations: plan2-linear-chain.md

## Topology summary
expected_chains: 1
expected_standalones: 0

## Chain detection rationale
- Phase 1 (Types): pred=0, succ=1(→Validator) → seed; Validator has pred=1, succ=1(→Route) → extend;
  Route has pred=1, succ=1(→Integration) → extend; Integration has pred=1, succ=0 → stop.
  Path=[Types, Validator, Route, Integration] → chain-1 (4 members).

## chain_specs

chain-1:
  members_in_order:
    - subject_keyword: "Types"   role: head
    - subject_keyword: "Validator"  role: link
    - subject_keyword: "Route"   role: link
    - subject_keyword: "Integration"  role: tail
  worktree: ".worktrees/chain-1"
  merge_point: "Integration Test" delivery-agent (chain-1 tail)

## standalone_specs
(none — 0 standalones expected)

## special_assertions

A. Assert 7 (one create-wt per chain): exactly ONE create-wt task for chain-1 exists.
   Validator, Route, and Integration do NOT have their own create-wt tasks.
   Fail if the ### Task List shows more than 1 create-wt for chain-1.

B. Assert 5 (Regression): regression must be blocked by the chain-1 tail delivery-agent (Integration Test) only.
   Fail if regression is directly blocked by Types, Validator, or Route delivery-agents.

C. Shared worktree: all 4 delivery-agent task descriptions must reference the same worktree path
   (`.worktrees/chain-1`). Verify in ### Task Details.

D. Chain role fields: verify in ### Task Details that:
   - Types delivery-agent: Chain: head, Chain ID: chain-1
   - Validator delivery-agent: Chain: link, Chain ID: chain-1
   - Route delivery-agent: Chain: link, Chain ID: chain-1
   - Integration delivery-agent: Chain: tail, Chain ID: chain-1

E. Self-merge: only the tail (Integration) delivery-agent description includes the self-merge block
   (Self-merge: yes). Head and links must have Self-merge: no. Verify in ### Task Details.
