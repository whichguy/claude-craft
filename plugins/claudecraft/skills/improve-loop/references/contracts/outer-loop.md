<!-- How continuous / quota hosts compose with one improve-loop cycle -->

# Contract: Outer loop

**improve-loop** is always **exactly one cycle** (or Phase 0 short-circuit / ledger-flush).

Continuous runs are owned by:

1. **`improve` driver skill** (preferred) — native S0–S13, worktree, caps, reintegrate; or  
2. **Host goal** per `goal.md`; or  
3. **Optional** re-invoke wrappers (e.g. ralph-style Stop hooks) with a **finite** max iterations.

## Ranking

| Priority | Mechanism |
|---|---|
| 1 | `improve` driver continuous loop |
| 2 | Host goal bound to the same stop predicate as `goal.md` |
| 3 | Finite re-invoke wrapper (completion promise only when terminal **and** landed) |

Never use an **unlimited** outer quota with improve-loop: dirty-tree stop-and-report cannot self-terminate without a finite cap or false promise.

## Claude Craft notes (adapter)

- Plugin invokes: `/claudecraft:improve`, `/claudecraft:improve-loop`.  
- Optional: `ralph-loop` with finite `--max-iterations` and promise `IMPROVE_LOOP_DONE` only when Phase 5 allows.  
- State file for ralph (if used): `<repo>/.claude/ralph-loop.local.md` — see phase-0 for driving predicate.

## Grok / Codex notes (adapter)

- Prefer host goal or native driver loop in-process.  
- Worktree script is plain bash/git — callable from any harness.
