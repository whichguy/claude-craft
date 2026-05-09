# Expectations (dry-run): plan8-cascade-fan-in.md

## Dry-run summary
expected_first_delivery_agents: ["Express"]   # or "skeleton" / "server skeleton"
validation_all_pass: true
expected_failures: none

## Cascade rationale
Two chained chains connected by two standalones — same fan-in shape as plan6 but
truncated (no second fan-out at the end):
- chain-1: A (Express skeleton, head) → B (Router factory, tail)
- chain-2: E (Supertest, head) → F (README, tail)
- Standalones: C (health route), D (version route)

Topology: A→B→{C,D}→E→F
chain-2's create-wt blocked by B delivery-agent + C delivery-agent + D delivery-agent (fan-in).

In Phase B (initial unblock): ONLY create-wt-chain-1 completes (blocked by Setup only).
All other create-wts blocked by delivery-agents → do not complete in Phase B.

Wave 1: A (chain-1 head) — sole delivery-agent unblocked after Phase B. This is the
critical assertion for the cascade topology.

After A completes → B unblocks. Wave 2: B (chain-1 tail).
After B completes → create-wt-C and create-wt-D unblock → C and D delivery-agents unblock.
Wave 3: C and D (parallel, both dispatched in same wave).
After C AND D both complete → create-wt-chain-2 unblocks → E unblocks. Wave 4: E (chain-2 head).
After E completes → F unblocks. Wave 5: F (chain-2 tail).
After F completes → Regression (if present). Wave 6: Regression.

Expected cascade depth: ≥ 5 delivery-agent waves (A, B, C+D, E, F). This is the cascade
depth validation for fan-in wiring.

## special_assertions

A. Wave 1 is singular: only A (Express skeleton) appears as the sole wave-1 delivery-agent.
   B, C, D, E, F, and Regression must NOT appear in wave 1.
   Fail if any agent other than A appears in wave 1.

B. Fan-in wiring confirmed: E (chain-2 head) is dispatched only after BOTH C AND D have
   returned RESULT: complete. Verify in the trace that E does not appear until wave 4 (or
   later), and that C and D both appear in wave 3 (or an earlier wave, but together).
   Fail if E appears before C or D completes.

C. C and D in parallel: C (health) and D (version) appear in the same wave (wave 3),
   both dispatched simultaneously after B completes.
   Fail if C and D are split across sequential single-agent waves without cause.

D. F serial after E: F (chain-2 tail) appears in the wave directly following E's wave.
   F must NOT be in the same wave as E (chain head must complete before tail).
   Fail if F appears in the same or earlier wave as E.

E. Cascade depth: the trace must show at least 5 distinct delivery-agent waves
   (A, B, C+D, E, F). Fail if the cascade depth is fewer than 5 waves.
   This directly validates the fan-in wiring: if create-wt-chain-2 were wired without the
   B+C+D fan-in constraint, E would appear earlier and the cascade would be shallower.

F. Assert 6 (target_branch): all 6 delivery-agents must have a non-empty, non-placeholder
   metadata.target_branch in the real task record (TaskGet).
   Fail if any delivery-agent shows a placeholder.

G. Worktree allocation: trace must show exactly 4 distinct worktree creations, one per
   chain/standalone group: chain-1 (A,B share), C (own), D (own), chain-2 (E,F share).
   Fail if more than 4 worktree paths are referenced.
