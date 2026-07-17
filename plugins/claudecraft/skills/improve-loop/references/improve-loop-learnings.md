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

## Status→snapshot field mapping (post-compaction audit)

| Iter | Verdict | Commit | Finding |
|---|---|---|---|
| 7 | material | `567bf37` | status emits `worktree_exists` + yes/no; next-auto used `worktree_present` + `!!` so `"no"`/`"false"` were truthy and wrong-key snapshots false-`done` |

**Fix:** `flag()` / `explicitFalse()` + `worktree_exists` alias; mocha pins status-style
snapshots; phase-0 documents the map. Invariants 4–6 unchanged.


## Clean after status-mapping

| Iter | Verdict | Commit | Finding |
|---|---|---|---|
| 8 | **clean** | `06266d4` | contract-iter8 FAIL=0; mocha 41; status-style + S12 laws hold |
| 9 | **clean** | pair after `06266d4` | contract-iter9 FAIL=0; mocha 41; second consecutive (subject: iter 9 clean) |

## Stop after status-mapping (goal da393bbeb079)

Material `567bf37` then two independent cleans:
- **8** → `06266d4`
- **9** → pair after `06266d4` (docs subject: quality-review iter 9 clean)

Agents may feed improve-worktree status keys into next-auto; flags must parse yes/no.


## open-pr resume_hint safety (goal efef0b908b27)

| Iter | Verdict | Commit | Finding |
|---|---|---|---|
| 10 | material | `149cedc` | worktree `resume_hint_for blocked:open-pr` peer-promoted `destroy --force` with open-PR; tip may be only copy |

**Fix:** align open-pr hint with next-auto (Tip not on launch + PR / --merge-to-launch); recover prints de-emphasize force; mocha pin no `resume_hint=.*destroy --force` after no-merge status.

## Clean after open-pr hint (efef0b908b27)

| Iter | Verdict | Commit | Finding |
|---|---|---|---|
| 11 | **clean** | `cf9e7aa` | contract-iter2 FAIL=0; mocha 70; open-pr hint + status flags hold |
| 12 | **clean** | pair after `cf9e7aa` | contract-iter3 FAIL=0; mocha 70; second consecutive |

## Stop after open-pr hint (goal efef0b908b27)

Material `149cedc` then two independent cleans:
- **11** → `cf9e7aa`
- **12** → pair after `cf9e7aa` (subject: quality-review iter 12 clean)  
Agents must not treat destroy --force as a peer next step on `blocked:open-pr`.

## Drop ralph; multi-cycle via host goal (historical)

**Thesis:** improve-loop must not require a Stop-hook re-invoke plugin; one cycle remains
atomic; multi-cycle is host **goal** iterating improve-loop (or `/improve` S8).

**Outcome:** stripped normative ralph / `IMPROVE_LOOP_DONE` / `ralph-loop.local.md` from
improve-loop + improve surface; outer-loop + goal contracts rank goal → improve; Phase 5
signals `goal.complete`/`goal.blocked` when terminal+landed.

**Key learnings:**
1. One cycle ≠ continuous campaign — goal iterates.
2. Finite host/improve caps replace re-invoke max_iterations.
3. Do not complete host goal over uncommitted ledger (same as old promise ban).

## Continuous defaults + disk until (state handoff)

Default continuous when target clear; until = no P0/P1 ×2 green on disk (header+Driver+streak). improve S0 writes until/mode/max_cycles; improve-loop never invents until.

## Custom until S8 evaluation

Custom until must be judged by improve S8 against disk; Phase 3 only auto-completes default P0/P1×2 form.

## Host-goal custom until + S9 catalog (goal 2124cb734ba1)

**Thesis:** Preferred continuous host is host **goal**, not only improve S8. Custom until
eval and S9 stop-reason catalog must work on that path.

**Findings (skeptic):**
1. After S8-only custom-until fix, host-goal campaigns could still ignore custom until
   until max_cycles — stop predicate #2 and outer-loop lacked goal-turn procedure.
2. S9 / lifecycle listed only `until: no-P0/P1×2` while caps allowed `until: <short>`.

**Fix:** goal.md #2 + outer-loop until table (outer host = goal or S8); lifecycle + improve
SKILL S9 include `until: <short>`; caps.md outer-host wording; structure pins.

| Iter | Verdict | Finding |
|---|---|---|
| material | host-goal custom until / S9 catalog | `0d50180` |
| clean | first after host-goal fix | contract-iter4 FAIL=0; mocha 75 |
| (pending) | second clean | next iter |

## Clean after custom-until S8 (goal 2124cb734ba1)

| Iter | Verdict | Finding |
|---|---|---|
| material | custom until ignored by S8 | caps S8 must evaluate custom until against disk |
| clean | first after fix | contract-iter2 FAIL=0; mocha 15 |
| clean | second consecutive | contract-iter3 FAIL=0; mocha 15 |


## Stop after custom-until S8 quality-review

Material `c7553c3` then two cleans (pair after). Residual skeptic (host goal + S9) → section above.
