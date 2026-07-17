<!-- How continuous / quota hosts compose with one improve-loop cycle -->

# Contract: Outer loop

**improve-loop** is always **exactly one cycle** (or Phase 0 short-circuit / ledger-flush).

**One cycle is not a full continuous campaign.** Multi-cycle continuity is owned by:

1. **Host goal** (preferred continuous host) — iterates: each turn runs one improve-loop cycle, then `goal.report`; stops on the shared stop predicate in `goal.md` with **finite** host caps (max-turns / budget); or  
2. **`improve` driver skill** — native S0–S13 in-process loop (worktree, caps, reintegrate) with the same stop semantics when no goal UI is present.

## Ranking

| Priority | Mechanism |
|---|---|
| 1 | Host **goal** iterating improve-loop (see `goal.md`) |
| 2 | **`improve` driver** continuous S8 loop |

Never run continuous improve-loop under an **unlimited** outer quota: dirty-tree stop-and-report cannot self-terminate without a finite cap or a false “done.” Caps live on the host goal and/or `improve` driver (`max_cycles` / elapsed / budget).

## Claude Craft notes (adapter)

- Plugin invokes: `/claudecraft:improve-loop` (one cycle), `/claudecraft:improve` (continuous).  
- Multi-cycle without the driver: bind a **host goal** to the objective and stop predicate; each goal turn rehydrates from disk and runs one improve-loop cycle.

## Grok / Codex notes (adapter)

- Prefer host goal (`update_goal` / equivalent) or native `improve` driver loop in-process.  
- Worktree script is plain bash/git — callable from any harness.
