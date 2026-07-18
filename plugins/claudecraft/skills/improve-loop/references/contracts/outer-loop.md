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
`consecutive-non-material-cycles` (improve-loop Phase 2); default form auto-completes in
Phase 3 **rule 3 only** when **zero unchecked P0/P1** + streak ≥ 2 + **current-cycle**
suite PASS. Carried PASS alone → Confirm (stay active; verification cycle). Phase 3
**rule 4** (empty P0/P1 backlog → complete) is **suppressed** under this default **and**
under custom non-`none` until. Persist **Until** + **Max cycles** on the ledger so
rehydrate does not re-prompt. Canonical table: `goal.md`.

**Until evaluation (both continuous hosts):** After each improve-loop cycle, the **outer
host** (preferred: host **goal**; else improve S8) must apply `goal.md` stop table
and/or `improve/references/caps.md` step 4 — same rules:

| Until on disk | Who evaluates | When met |
|---|---|---|
| Default P0/P1×2 form | Phase 3 rule 3 **and** outer host re-check (rule 4 suppressed) | zero open P0/P1 + streak ≥ 2 + **current-cycle** green |
| Custom non-empty string | **Outer host only** (goal turn or S8) — not Phase 3 | until text vs disk + current-cycle PASS |
| `none` / absent (once) | Phase 3 rule 4 empty-backlog path | backlog empty + current-cycle green |

Host-goal campaigns **must not** skip custom-until evaluation; ignoring it until max_cycles
is the same defect class as S8-only evaluation (see quality-review learnings).

**State handoff:** improve S0 parse (or goal seed) → write mode/until/max_cycles to
header+Driver → each outer turn runs one improve-loop (disk only) → outer host re-reads
Status/streak/until → on stop, S11–S13 if worktree (improve driver) or equivalent teardown.

## Claude Craft notes (adapter)

- Plugin invokes: `/claudecraft:improve-loop` (one cycle), `/claudecraft:improve` (continuous).  
- Clear target without “until …” → continuous + default until above (parse.md).  
- Multi-cycle without the driver: bind a **host goal** to the **same** until string on disk;
  each goal turn rehydrates from disk, runs one improve-loop cycle, then evaluates until
  (default streak or custom text) per `goal.md`.

## Grok / Codex notes (adapter)

- Prefer host goal (`update_goal` / equivalent) or native `improve` driver loop in-process.  
- Worktree script is plain bash/git — callable from any harness.
