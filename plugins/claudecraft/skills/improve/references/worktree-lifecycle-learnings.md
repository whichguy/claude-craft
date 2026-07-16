# improve-worktree lifecycle — quality-review learnings

Banked during the 2026-07 lifecycle/status quality review of
`plugins/claudecraft/tools/improve-worktree.sh` (+ status / recover / destroy /
carry). Each row is one review **iteration** that either landed a fix commit or
was a clean re-audit. Prefer `tip_on_launch` over create-time `merge_to_launch`
for destroy/recover/status decisions.

## Invariants (graduated)

1. **Tip ancestry is truth.** `tip_on_launch_p(launch, tip, branch)` decides
   open-pr vs destroy vs reintegrate — not JSON `merge_to_launch` alone.
2. **Detached tips are the only copy** until S11b. Never destroy without
   `--force` when tip is not on launch (including `state=created`).
3. **`reintegrate_status=ok` ≠ tip on launch.** S11a-only
   (`merge_to_launch=false`) leaves tip off launch with status ok.
4. **CLI override must stick.** `recover|reintegrate --merge-to-launch` after
   create `--no-merge` runs S11b (S11b-only if S11a already ok) and persists
   `merge_to_launch=true`.
5. **Exclude writes need absolute git-dir.** `git rev-parse --git-path` is
   cwd-relative; side-effect files under `.git/` must use
   `--absolute-git-dir`.
6. **Clean carry ignores improve worktrees.** Create seeds
   `.claude/worktrees/` into local exclude; carry filters that path from
   untracked tar.
7. **S11b-only only when tip includes current launch tip.** After
   `reintegrate_status=ok` with tip still unmerged, skip S11a only if
   `merge-base --is-ancestor <launch_tip> <wt_tip>`. If launch advanced,
   re-run S11a so conflicts stay in the worktree (not S11b on launch).
8. **Operator UX (P2):** create exit 9 uses structured `status=` lines +
   `resume_hint`; status summary always emits `resume_hint` for
   `suggested_next`; destroy refuses uncommitted dirt without `--force`;
   recover `--keep-worktree` with unmerged tip reports `next=blocked:open-pr`
   (not `done`).

## Iteration log

| Iter | Verdict | Commit(s) | Thesis / finding | Learning |
|---|---|---|---|---|
| 1–2 | material | `206cda1` | Status lacked structured next=; false S11b claims | die_status/ok_status; S11b=skipped\|merged; status summary |
| 3–4 | clean (later refuted) | `0f92228`, `aaefcc7` | recover×no-merge data loss; phase=S11a+S11b when S11b skipped | keep tip + blocked:open-pr; phase_ok=S11a when skipped |
| 5–6 | clean (later refuted) | `d0f89c0`, `1ddd7ff` | recover `--merge-to-launch` after no-merge false not-on-launch | S11b-only path; persist merge; tip_on_launch_p; wording “still unmerged” |
| 7 | material | `4c59fd1`, `28d7494` | status suggested_next ignored tip; destroy pre-reint dropped tip | status tip_on_launch; destroy always tip-guarded |
| 8 | material | `531a65f` | carry “dirty” after every create; false WIP carried | absolute exclude; filter worktrees; honest nothing-to-carry |
| 9–10 | clean (pre-11) | `7c6ffe7` | Dual-path green; banked learnings | Clean still needs durable commit |
| 11 | material | `2e3f12a` | S11b-only skipped S11a after launch advanced → S11b conflict on launch | Ancestor gate for skip_s11a |
| 12 | **clean** | (docs) | Dual-path + concurrent re-S11a after 2e3f12a | No new P0/P1 |
| 13 | **clean** | (docs) | Second consecutive clean | Stop |

## Mandatory dual-path matrix (re-run every clean claim)

```text
A) create --no-merge → commit tip → recover (no flags)
   → next=blocked:open-pr, wt kept, tip NOT on launch, destroy exit 7

B) create --no-merge → commit tip → recover --merge-to-launch
   → S11b=merged, file on launch, wt destroyed, NO "tip … not on launch",
     JSON merge_to_launch=true

C) create → commit tip → destroy (no force) → exit 7, wt kept

D) create → carry (clean launch) → "launch was clean", porcelain empty

E) no-merge reintegrate → reintegrate --merge-to-launch (no concurrent launch)
   → S11b only / tip includes launch tip; file lands

F) after E setup but launch advanced + same-file edit → re-running S11a
   (not S11b only); mid_rebase / no launch MERGE_HEAD
```

## Deferred P2

- `improve-next-auto.js` optional `tip_on_launch` snapshot field (driver must
  still refresh JSON after override).
- create exit 9 → structured `die_status` lines.
- destroy warning when worktree has uncommitted dirt but tip SHA is on launch.

## Related tests

`test/plugins/claudecraft/improve-worktree.test.js` — recover no-merge keep,
recover merge override, destroy pre-reintegrate, status tip_on_launch,
clean carry exclude.

## Honest re-audit (post-skeptic)

| Iter | Verdict | Commit | Evidence |
|---|---|---|---|
| 12 | **clean** | (this) | dual-path-iter12.txt path A–F OK_*; iter12-mocha 25 pass |
| 13 | **clean** | (this) | dual-path-iter13.txt path A–F OK_*; iter13-mocha 25 EXIT=0 |

## Stop (2026-07 quality review — honest)

Two consecutive clean cycles after material `2e3f12a`:
- **12** → learnings `f4da660` — dual-path-iter12.txt + iter12-mocha.log
- **13** → this commit — dual-path-iter13.txt + iter13-mocha.log (MOCHA13_EXIT=0)

Mandatory dual-path matrix A–F exercised with live OK_/FAIL_ asserts both times.

## Goal re-audit (KISS/YAGNI, scratch d7f2f8d991e6)

| Iter | Verdict | Commit | Notes |
|---|---|---|---|
| 14 | **clean** | `d70f402` | survey+matrix A–F; YAGNI on truthy helper; dual-path-iter14.txt |
| 15 | **clean** | (this) | dual-path-iter15.txt; iter15-mocha 25 EXIT=0 |

## Stop (goal re-audit KISS/YAGNI)

Two consecutive independent clean cycles after survey at code baseline `2e3f12a`:
- **14** → `d70f402` — dual-path-iter14.txt + iter14-mocha.log; YAGNI on Truth/true helper
- **15** → this commit — dual-path-iter15.txt + iter15-mocha.log

No material P0/P1; key features S11a/S11b, open-pr, tip-on-launch destroy, merge override, mid-rebase retained.

## Goal re-audit P2 UX (scratch df4268dbd8d9)

| Iter | Verdict | Commit | Notes |
|---|---|---|---|
| 16 | material | `2e8a9bb` | resume_hint, create-9 structured, dirty destroy, keep open-pr |
| 17 | **clean** | `456983a` | dual-path-iter17.txt; 27 mocha |
| 18 | **clean** | (this) | dual-path-iter18.txt; 27 mocha |

## Stop (P2 UX goal df4268dbd8d9)

Material `2e8a9bb` then two independent cleans:
- **17** → `456983a` — dual-path-iter17 + iter17-mocha
- **18** → this commit — dual-path-iter18 + iter18-mocha

Features retained: S11a/S11b, open-pr, tip-on-launch destroy, merge override, mid-rebase.
