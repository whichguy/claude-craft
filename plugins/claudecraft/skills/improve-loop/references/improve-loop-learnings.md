# improve-loop quality-review learnings

Banked while auditing **improve-loop** + dependent tools (`improve-next-auto.js`,
`improve-worktree.sh`, improve driver lifecycle docs).

## Invariants

1. **One cycle per improve-loop invoke** (or Phase 0 short-circuit / ledger flush).
2. **Disk beats chat** for control flow (Phase 0 priority: git hard stops → run_json →
   header → Driver hints).
3. **`next_auto` catalog** is closed (`ledger-schema.md`); do not invent blocked synonyms.
4. **Tip not on launch ≠ done.** After reintegrate ok with `merge_to_launch=false` or
   `tip_on_launch=no`, use `blocked:open-pr` even if `keep_worktree` — match
   `improve-worktree` recover/status.
5. **Destroy/recover refuse uncommitted dirt** without `--force`; never FORCE-destroy from
   auto recover paths.
6. Prefer pure helpers: `improve-next-auto.js`, `improve-progress-format.js`,
   `improve-worktree.sh status` (`resume_hint`, `tip_on_launch`).

## Iteration log

| Iter | Verdict | Commit | Finding |
|---|---|---|---|
| 1 | material | `ac278b8` | next-auto keep→done + phase-5 “or done with PR” contradicted worktree open-pr |
| 2 | **clean** | `ce8258a` | contract CLI + mocha 33; no new P0/P1 |
| 3 | **clean** | (this) | contract-iter3b FAIL=0 + mocha 33 (honest re-run) |

## Related tools

- `tools/improve-next-auto.js` — deriveNextAuto snapshot (optional `tip_on_launch`)
- `tools/improve-worktree.sh` — S11a/S11b lifecycle (authoritative for tip ancestry)
- `skills/improve/` — continuous driver S0–S13

## Stop (improve-loop goal da393bbeb079)

Material `ac278b8` then two independent cleans:
- **2** → `ce8258a`
- **3** → this commit

Key fix: tip unmerged → `blocked:open-pr` in next-auto + phase docs (not done).


Note: cycle 3 uses terminal status=complete fixtures for teardown next_auto checks.

## Continuous driver S12 (skeptic follow-up)

| Iter | Verdict | Commit | Finding |
|---|---|---|---|
| 4 | material | `14fd07c` | improve SKILL S12 / lifecycle flowchart open-pr; open-pr hint tip-aware |
| 5 | **clean** | `89b79a5` | contract-iter5 + mocha 34 |
| 6 | **clean** | (this) | contract-iter6 + mocha 34 |

## Stop after continuous improve S12 skeptic fix

Material `14fd07c` then two cleans:
- **5** → `89b79a5`
- **6** → this commit

Continuous improve driver S12/S13 + lifecycle flowchart match tip-on-launch open-pr.
