<!-- How continuous / quota hosts compose with one improve-loop cycle -->

# Contract: Outer loop

**improve-loop L2** is always **exactly one cycle** (or Phase 0 short-circuit / ledger-flush).

**Campaign multi-cycle (primary):** improve-loop **B L1** autonomous driver
(`skills/improve-loop/SKILL.md` § Campaign architecture / Multi-cycle L1) — one invocation
loops L2 until residual×2 complete, hard stop, or `MAX_CYCLES` (**8**). Does **not** require
host goal re-drive.

## Ranking (product model 2026-07-21)

| Priority | Mechanism |
|---|---|
| 1 | **improve-loop B L1** autonomous campaign (script-backed; default `/improve`) |
| 2 | **`improve` skill** — thin continuous host (parse/worktree/S0–S13) running one L2 cycle per S8 iteration |
| 3 | Host **goal** — optional observability (`goal.report` / caps); not required for multi-cycle |

Never run continuous improve under an **unlimited** outer quota. Caps: B `MAX_CYCLES` /
`IMPROVE_LOOP_MAX_CYCLES`, or `improve` `max_cycles` (default **8**), or host max-turns/budget.

## Stop table (canonical)

**Single home:** `contracts/goal.md` stop predicate table. Outer hosts **cite** it — do not
restate a second complete table here.

**Default continuous until** (when unset on disk):  
`no material P0/P1 for 2 consecutive cycles (green tests)` — ledger
`consecutive-non-material-cycles`; Phase 3 rule 3 when zero open P0/P1 + streak ≥ 2 +
current-cycle suite PASS. Canonical detail: `goal.md`.

**Until evaluation:** after each L2 cycle, the outer host (B L1, improve S8, or goal turn)
applies `goal.md`. Custom non-empty until is outer-host-only; `none`/once may use Phase 3
rule 4 empty-backlog path. Under default and custom non-`none` until,
Phase 3 **rule 4 is suppressed** (streak ≥ 2 only) — see `goal.md`.

**State handoff:** write mode/until/max_cycles to header+Driver at campaign start → each outer
turn runs one L2 cycle (disk only) → outer host re-reads Status/streak/until → on stop,
merge-back/teardown (B L1) or S11–S13 (improve host).

## Claude Craft notes (adapter)

- Plugin: `/claudecraft:improve-loop` (B campaign or one-cycle packaging), `/claudecraft:improve`
  (worktree continuous host).  
- Clear target without “until …” → continuous + default until above.

## Grok / Codex notes (adapter)

- Prefer B L1 `/improve` for autonomous campaigns; or host goal + improve worktree host.  
- Worktree script is plain bash/git — callable from any harness.
