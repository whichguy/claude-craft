# Cost throttle (defaults)

Avoid full cost every cycle.

| Activity | Default cadence |
|---|---|
| History digest | Every cycle (bounded; improve-loop Phase 0) |
| Research gate | **Seed only** (S5); refresh only if new FETCH unknowns |
| Plan critique auto-apply | **Seed only** (S7); on replan only if backlog materially rewritten |
| Multi-model advisors | **Native replan by default**; full panel every 3rd cycle **or** on stall |
| Advisor Round 2 | Only on material disagreement |
| Lint + tests | Every code-bearing cycle (when implemented in cycle law) |
| Progress pulses | **1 finalized pulse per cycle** + S11/S13 lifecycle; optional 1 mid-Phase-1 if slow |
| Progress anti-spam | No pulse per advisor msg, per file edit, or full test log dump |

Never let advisor/research infrastructure stall a cycle — fall back native.

## Validate-fix cycle exception (package A continuous — authoritative)

**Owner:** this file (package A continuous driver). Planning contract defines the term only —
see `../../law/improve-loop/contracts/planning.md` § Validate-fix cycle.

When the **starting** open P0/P1 queue for this cycle is **only** Phase 3v-seeded work
(`validate V<k>:` title token and/or write-section Spec item), product residual survey is
**not** pending, and no other material plan work is open:

| Activity | Cadence for this cycle |
|---|---|
| Multi-model advisors | **Native 5-block surgical replan only** — do **not** count toward / fire “full panel every 3rd cycle” solely because a narrow Proof failed |
| Advisor Round 2 | Only on material disagreement (unchanged) |
| Phase machinery | Full L2: Phase 1 executes the seeded item; Phase 2 counters; Phase 4 one commit; 3v re-proves — **no** same-cycle fix inside the prove gate |

**Fall-through (restore default table above):** any non-validation open P0/P1; promote-class
discovery; pending product residual survey; stall / same-error / no-progress path; or
operator-requested deep plan.
