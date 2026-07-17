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

**Default continuous until** (when unset on disk):  
`no material P0/P1 for 2 consecutive cycles (green tests)` — tracked via ledger
`consecutive-non-material-cycles` (improve-loop Phase 2) and broken by improve S8 / Phase 3
when streak ≥ 2. Persist **Until** + **Max cycles** on the ledger so rehydrate does not re-prompt.

**State handoff:** improve S0 parse → write mode/until/max_cycles to header+Driver → each S8
cycle is one improve-loop invoke that reads **only disk** → S8 re-reads Status/streak → S11–S13.

## Claude Craft notes (adapter)

- Plugin invokes: `/claudecraft:improve-loop` (one cycle), `/claudecraft:improve` (continuous).  
- Clear target without “until …” → continuous + default until above (parse.md).  
- Multi-cycle without the driver: bind a **host goal** to the **same** until string on disk; each goal turn rehydrates from disk and runs one improve-loop cycle.

## Grok / Codex notes (adapter)

- Prefer host goal (`update_goal` / equivalent) or native `improve` driver loop in-process.  
- Worktree script is plain bash/git — callable from any harness.
