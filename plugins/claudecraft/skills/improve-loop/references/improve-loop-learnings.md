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
| 2 | **clean** | (this) | contract CLI + mocha 33; no new P0/P1 |
| 3 | pending | — | second clean |

## Related tools

- `tools/improve-next-auto.js` — deriveNextAuto snapshot (optional `tip_on_launch`)
- `tools/improve-worktree.sh` — S11a/S11b lifecycle (authoritative for tip ancestry)
- `skills/improve/` — continuous driver S0–S13
