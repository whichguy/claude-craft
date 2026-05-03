# Expectations (dry-run): plan2-linear-chain.md

## Dry-run summary
expected_first_run_agents: ["Types"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
Single 4-node chain: Types (head) → Validator (link) → Route (link) → Integration (tail).
In dry-run, one create-wt for chain-1 is created and simulated in Phase B. Once it
completes, only the chain head (Types) is unblocked → wave 1 contains exactly one run-agent.

Each subsequent agent is dispatched only after its predecessor completes:
- Types completes → Validator unblocks (wave 2)
- Validator completes → Route unblocks (wave 3)
- Route completes → Integration unblocks (wave 4)
- Integration completes → Regression unblocks (wave 5)

Expected cascade depth: ≥ 4 run-agent waves (5 including regression).

## special_assertions

A. Wave 1 is singular: only Types (chain-1 head) appears in wave 1. Validator, Route,
   Integration, and Regression must NOT appear in wave 1.
   Fail if any link/tail/regression appears alongside Types in wave 1.

B. Sequential chain dispatch: each link is dispatched in its own wave (one per wave, not
   batched). Validator in wave 2, Route in wave 3, Integration in wave 4 — the DISPATCHED
   field of each preceding agent must name the next link/tail.
   Fail if Validator and Route appear in the same wave.

C. Regression is last: Regression is dispatched only after Integration (chain-1 tail)
   completes. The Integration agent's DISPATCHED field must reference the regression task ID.
   Fail if Regression is dispatched before Integration completes.

D. Assert 6 (target_branch): all 4 run-agents (Types, Validator, Route, Integration) must
   have a non-empty, non-placeholder metadata.target_branch in the real task record (TaskGet).
   Fail if any run-agent shows a placeholder target_branch.

E. Validation predicate 1: "Every chain head dispatched in wave 1" — Types is the only chain
   head and must appear in wave 1. The ### Validation section must show ✓ for this predicate.
