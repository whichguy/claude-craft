# Expectations: plan5-multi-chain.md

## Topology summary
expected_chains: 2
expected_standalones: 2

## Chain detection rationale
- Chain A Phase 1 (API Router): pred=0, succ=1(→ChainAP2) → seed; ChainAP2 has pred=1,
  succ=1(→Smoke) → extend; Smoke has pred=3 ≠ 1 → stop. Path=[A1,A2] → chain-1.
- Chain B Phase 1 (CORS): pred=0, succ=1(→ChainBP2) → seed; ChainBP2 has pred=1,
  succ=1(→Smoke) → extend; Smoke has pred=3 → stop. Path=[B1,B2] → chain-2.
- Standalone (Admin Page): pred=0, succ=1(→Smoke) → seed; Smoke has pred=3 → stop.
  Path=[Admin] length 1 → standalone.
- Phase Final (Smoke Test): pred=3(←A2,←B2,←Admin), succ=0 → not a seed → standalone (collected).

## chain_specs

chain-1:
  members_in_order:
    - subject_keyword: "API Router"   role: head
    - subject_keyword: "Paginated"    role: tail
  worktree: ".worktrees/chain-1"
  merge_point: "Chain A Phase 2" delivery-agent (chain-1 tail)

chain-2:
  members_in_order:
    - subject_keyword: "CORS"         role: head
    - subject_keyword: "Rate Limit"   role: tail
  worktree: ".worktrees/chain-2"
  merge_point: "Chain B Phase 2" delivery-agent (chain-2 tail)

## standalone_specs
- "Standalone: Admin Page"   (keyword: "Admin")
- "Phase Final: Full Smoke Test"  (keyword: "Smoke" or "Final")

## special_assertions

A. Assert 7 (one create-wt per chain): exactly ONE create-wt for chain-1 and ONE for chain-2.
   Chain A Phase 2 and Chain B Phase 2 must NOT have their own create-wt tasks.
   Fail if any chain-link or chain-tail has a create-wt.

B. Assert 5 (Regression): regression must be blocked by:
   - chain-1 tail delivery-agent (Chain A Phase 2 / Pagination)
   - chain-2 tail delivery-agent (Chain B Phase 2 / Rate Limit)
   - Admin standalone delivery-agent
   - Smoke Test standalone delivery-agent
   Chain-1 head (API Router) and chain-2 head (CORS) must NOT be direct regression blockers.
   Fail if any head delivery-agent appears in regression's blocked-by list.

C. Assert 3 (create-wt wiring): Smoke Test's create-wt must be blocked by chain-1 tail,
   chain-2 tail, AND Admin delivery-agent. Fail if any of the three are missing.
   Chain heads must NOT appear as create-wt blockers for Smoke Test's create-wt.

D. Parallel chains: chain-1 and chain-2 delivery-agents must have NO blocker relationship to each
   other. Their create-wt tasks are each only blocked by Setup .worktrees (no cross-chain deps).
   Fail if chain-1 and chain-2 create-wts are blocked by each other.

E. Chain role fields in ### Task Details:
   - Chain A Phase 1: Self-merge: no (head)
   - Chain A Phase 2: Self-merge: yes (tail)
   - Chain B Phase 1: Self-merge: no (head)
   - Chain B Phase 2: Self-merge: yes (tail)
   - Admin: Self-merge: yes (standalone, Chain: none)
   - Smoke Test: Self-merge: yes (standalone, Chain: none)
   Fail if any chain head shows Self-merge: yes or any tail/standalone shows Self-merge: no.
