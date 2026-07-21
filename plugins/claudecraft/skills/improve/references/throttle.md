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
