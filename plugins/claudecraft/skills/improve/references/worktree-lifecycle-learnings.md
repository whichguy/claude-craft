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

## Iteration log

| Iter | Verdict | Commit(s) | Thesis / finding | Learning |
|---|---|---|---|---|
| 1–2 | material | `206cda1` | Status lacked structured next=; false S11b claims | die_status/ok_status; S11b=skipped\|merged; status summary |
| 3–4 | clean (later refuted) | `0f92228`, `aaefcc7` | recover×no-merge data loss; phase=S11a+S11b when S11b skipped | keep tip + blocked:open-pr; phase_ok=S11a when skipped |
| 5–6 | clean (later refuted) | `d0f89c0`, `1ddd7ff` | recover `--merge-to-launch` after no-merge false not-on-launch | S11b-only path; persist merge; tip_on_launch_p; wording “still unmerged” |
| 7 | material | `4c59fd1`, `28d7494` | status suggested_next ignored tip; destroy pre-reint dropped tip | status tip_on_launch; destroy always tip-guarded |
| 8 | material | `531a65f` | carry “dirty” after every create; false WIP carried | absolute exclude; filter worktrees; honest nothing-to-carry |
| 9–10 | clean (pre-11) | `7c6ffe7` | Dual-path green; banked learnings | Clean still needs durable commit |
| 11 | material | (next) | S11b-only skipped S11a after launch advanced → S11b conflict on launch | Ancestor gate for skip_s11a |

## Mandatory dual-path matrix (re-run every clean claim)

```text
A) create --no-merge → commit tip → recover (no flags)
   → next=blocked:open-pr, wt kept, tip NOT on launch, destroy exit 7

B) create --no-merge → commit tip → recover --merge-to-launch
   → S11b=merged, file on launch, wt destroyed, NO "tip … not on launch",
     JSON merge_to_launch=true

C) create → commit tip → destroy (no force) → exit 7, wt kept

D) create → carry (clean launch) → "launch was clean", porcelain empty
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
