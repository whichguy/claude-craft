# Expectations (dry-run): plan6-deep-cascading.md

## Dry-run summary
expected_first_delivery_agents: ["Auth Config"]
validation_all_pass: true
expected_failures: none

## Cascade rationale
Two chained chains connected by two standalones, plus a second fan-out at the end:
- chain-1: A (Auth Config, head) → B (User Store, tail)
- chain-2: E (Secured Profile, head) → F (Auth Rate Limit, tail)
- Standalones: C (JWT), D (Auth Routes), G (Integration Tests), H (Metrics)

Topology: A→B→{C,D}→E→F→{G,H}
Chain-2's create-wt blocked by B delivery-agent + C delivery-agent + D delivery-agent (fan-in).

In Phase B: ONLY create-wt-chain-1 completes (blocked by Setup only). All other create-wts
blocked by delivery-agents → do not complete in Phase B.

Wave 1: A (chain-1 head) — sole delivery-agent unblocked after Phase B. This is the critical
assertion for the cascade topology.

After A completes → B unblocks. Wave 2: B (chain-1 tail).
After B completes → create-wt-C and create-wt-D unblock → C and D delivery-agents unblock.
Wave 3: C and D (parallel, both dispatched in same wave).
After C AND D both complete → create-wt-chain-2 unblocks → E unblocks. Wave 4: E (chain-2 head).
After E completes → F unblocks. Wave 5: F (chain-2 tail).
After F completes → create-wt-G and create-wt-H unblock → G and H delivery-agents unblock.
Wave 6: G and H (parallel).
After G and H complete → Regression. Wave 7: Regression.

Expected cascade depth: ≥ 6 delivery-agent waves. This is the cascade depth validation for fan-in wiring.

## special_assertions

A. Wave 1 is singular: only A (Auth Config) appears as the sole wave-1 delivery-agent. B, C, D,
   E, F, G, H, and Regression must NOT appear in wave 1.
   Fail if any agent other than A appears in wave 1.

B. Fan-in wiring confirmed: E (chain-2 head) is dispatched only after BOTH C AND D have
   returned RESULT: complete. Verify in the trace that E does not appear until wave 4 (or
   later), and that C and D both appear in wave 3 (or an earlier wave, but together).
   Fail if E appears before C or D completes.

C. C and D in parallel: C (JWT) and D (Auth Routes) appear in the same wave (wave 3), both
   dispatched simultaneously after B completes.
   Fail if C and D are split across sequential single-agent waves without cause.

D. G and H in parallel: G (Integration Tests) and H (Metrics) appear in the same wave (wave
   6), both dispatched simultaneously after F completes.
   Fail if G and H are split across sequential single-agent waves.

E. Cascade depth: the trace must show at least 6 distinct delivery-agent waves (A, B, C+D, E, F,
   G+H). Fail if the cascade depth is fewer than 6 waves.
   This directly validates the fan-in wiring: if create-wt-chain-2 were wired without the
   B+C+D fan-in constraint, E would appear earlier and the cascade would be shallower.

F. Assert 6 (target_branch): all 8 delivery-agents must have a non-empty, non-placeholder
   metadata.target_branch in the real task record (TaskGet).
   Fail if any delivery-agent shows a placeholder.
