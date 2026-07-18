---
name: improve
description: >-
  Continuous evidence-led improvement for any git repo (host-agnostic driver): NL parse,
  worktree lifecycle, native or host-goal outer loop, caps that always reintegrate.
  Each inner step is one improve-loop cycle. Plugin invoke "/claudecraft:improve …";
  one-shot only → improve-loop skill instead.
---

# Improve (continuous driver)

Multi-cycle driver. **Atomic unit:** improve-loop (one cycle).  
**This skill owns** parse, worktree, caps, reintegrate, destroy (S0–S13).

**Automation:** take the most appropriate **safe** path by default; stop only when unable to
progress. **Resume:** every turn rehydrate from `IMPROVE_LOOP.md` (`## Driver`) +
`.git/improve-runs/*.json` + git — never from chat alone (see Phase 0 rehydration).

Normative cycle law: `../improve-loop/SKILL.md` + its `references/`.  
Portable continuous objective: `../improve-loop/references/contracts/goal.md`.

## When to use which

| Intent | Skill |
|---|---|
| One tested cycle | `improve-loop` |
| Continuous until done / timebox / budget | **this skill (`improve`)** |

## Campaign shape (worktree default)

```text
S2 create (once)  →  detached-HEAD worktree at launch tip
                     (no permanent improve/* branch)
S3 carry          →  if launch dirty: WIP → WT, drain launch
S8 iterate        →  while until/caps allow:
                       improve-loop one cycle in worktree cwd
                       (commits accumulate on detached tip)
S11 reintegrate   →  once: rebase tip onto source, then merge tip → launch
S12 destroy       →  remove worktree when tip_on_launch
```

- **Not** merge after every cycle. **Not** a long-lived named feature branch.
- **`improve-loop`** = one cycle only; **`improve`** owns create → multi-cycle → reintegrate.
- Skip worktree only with `--no-worktree` / “no worktree” (then cycles run on launch).

## Procedure (run in order)

### S0 — Parse

Read `references/parse.md`. Extract repo, target, tests, until, mode, worktree, caps.  
**Defaults:** clear target → **continuous**; continuous until unset (no criteria specified) →  
`no material P0/P1 for 2 consecutive cycles (green tests)`; max_cycles 10.  
**No-criteria stop:** completion requires two consecutive non-material green cycles
(Phase 3 rule 3 / streak ≥ 2). Empty P0/P1 backlog after one cycle is **not** enough —
rule 4 empty-backlog complete is suppressed under this default.  
Echo parse card and **proceed** (do not wait for confirm). Abort unattended if tests/target
missing with no ledger to resume; ask once for tests if interactive and missing.

### S1 — Resolve repo

`git -C <repo> rev-parse --show-toplevel`. Note launch branch and whether the tree is dirty.

### S2–S3 — Worktree (default ON)

Read `references/lifecycle.md`. **Default:** use a worktree for both once and continuous runs.
Skip only with `--no-worktree` / “no worktree”.

```bash
bash <plugin>/tools/improve-worktree.sh create --repo <repo> --slug <slug> \
  [--keep-worktree] [--no-merge-to-launch]
# if launch dirty — carry patches WIP into WT, bootstrap-commits, drains launch clean:
bash <plugin>/tools/improve-worktree.sh carry --repo <repo> --slug <slug>
```

**Isolation:** detached HEAD at launch tip — **no permanent second branch**.  
**S11:** (a) **rebase** worktree onto latest source tip (conflicts stay in worktree);  
(b) **merge** worktree tip into the **launch/source branch** (`merge_to_launch=true` default).  
Pass `--no-merge-to-launch` only for PR-only tips.

Active cwd for cycles = worktree path from status/state JSON.  
With `--no-worktree`: work in launch tree (must satisfy improve-loop dirty guards).

**Driver write (S2):** set `## Driver` in active-tree `IMPROVE_LOOP.md` — mode, **until**,
**max_cycles**, cycle_index (0), slug, repo, launch_branch, worktree_path, run_json,
test_command, `next_auto: cycle`, resume_hint, updated. Mirror **Until** / **Max cycles**
in the ledger header (ledger-schema).

### S4–S7 — Seed plan (first turn / new target)

- Ensure `IMPROVE_LOOP.md` exists in the **active** tree (worktree or launch) with target + tests
  and a `## Driver` section (create stub if missing).  
- Prefer improve-loop Phase 0 seed if absent.  
- Optional research/critique: seed only (`references/throttle.md`).  
- Do not expand scope outside `target`.

### S8 — Inner loop

Read `references/caps.md` and `../improve-loop/references/contracts/progress.md`.  
While Status active and under caps (break order in caps.md):

1. Cap/until check from **disk** per `caps.md` S8 break order (including
   `cycle_index >= max_cycles` before starting another cycle) → if stop, break to S9.  
2. Increment Driver `cycle_index` (0→1 on first cycle); **run one improve-loop cycle** in the
   active tree (load improve-loop skill; follow its phase index and Read phase references).
   improve-loop reads **only disk** — it must not need the parse card from chat.  
3. Re-read `IMPROVE_LOOP.md` Status / Stop-condition / Driver.  
4. **Ensure a control-channel progress pulse** for this cycle (learnings, changes, backlog/caps progress). If the cycle did not emit one, synthesize JSON from the latest Log entry + `git status` / last commit and prefer  
   `node <plugin>/tools/improve-progress-format.js`  
   (see `../improve-loop/references/contracts/progress.md`), then emit via `goal.report` if available, else visible markdown.  
5. **Update `## Driver`:** recompute `next_auto` / `resume_hint` / `updated` from disk rules (Phase 0);
   prefer `node <plugin>/tools/improve-next-auto.js` with a fact snapshot when Node is available; keep until/max_cycles/mode.  
6. If terminal or until satisfied (default: streak ≥ 2 only — not single-cycle empty backlog;
   **or** custom until met per caps.md; or Status complete), break (then S9–S12 — do not skip
   reintegrate while a worktree exists).

**Goal host (preferred multi-cycle host):** if the harness has a goal facility, bind it per
`../improve-loop/references/contracts/goal.md` — the goal **iterates** (each turn runs one
improve-loop cycle) with the same stop predicate; use `goal.report` for pulses; still
perform S11–S12 yourself. If no goal facility, this native S8 loop **is** the outer loop and
pulses are user-visible markdown. Do not require a Stop-hook re-invoke plugin.

### S9–S10 — Stop + ledger

Record stop reason: `complete` | `until: no-P0/P1×2` | `until: <short>` (custom until met) |
stall | max_cycles | max_elapsed | budget | blocked. If until satisfied but Status still
active, set Status `complete` and ledger-flush if needed. Prefer a ledger-only improve-loop
flush when tree allows.

### S11 — Reintegrate (always if worktree was created)

If only `IMPROVE_LOOP.md` is dirty, auto-commit `improve-loop: driver — next_auto reintegrate`
first. Then:

```bash
bash <plugin>/tools/improve-worktree.sh reintegrate --repo <repo> --slug <slug>
# S11a: rebase worktree onto source tip (absorb concurrent source changes)
# S11b: merge tip → launch/source (default); override: --no-merge-to-launch
```

Launch must have **no tracked dirty files** for S11b (untracked `.claude/worktrees` parent is OK).
S11a rebase conflict or S11b conflict → keep worktree, exit 5; launch_dirty → exit 6.  
On block: set Driver `blocked:*`, print **resume template** (phase-5).  
**Pulse:** short `## Improve progress` (Phase: S11) with reintegrate ok|conflict|launch_dirty.

### S12 — Destroy (or open-pr)

After S11, run `improve-worktree.sh status` and read `tip_on_launch` / `suggested_next` /
`resume_hint` (or recompute via `improve-next-auto.js` with those facts).

| Condition | Action | Driver `next_auto` |
|---|---|---|
| Tip **on launch** (`tip_on_launch=yes` / S11b merged) and not `keep_worktree` | `destroy` (no `--force` unless discarding dirt) | `done` after success; `blocked:destroy-failed` / `blocked:worktree-dirty` on refuse |
| Tip **on launch** and `keep_worktree` | skip destroy | `done` |
| Tip **unmerged** (`merge_to_launch=false` or `tip_on_launch=no`) | **do not destroy**; do not claim launch updated | **`blocked:open-pr`** (even if `keep_worktree`) |
| S11 failed / mid-rebase | keep worktree | catalog `blocked:*` (e.g. `rebase-continue`); resume template |

```bash
bash <plugin>/tools/improve-worktree.sh status --repo <repo> --slug <slug>
# only when tip_on_launch=yes and not keep:
bash <plugin>/tools/improve-worktree.sh destroy --repo <repo> --slug <slug>
```

**Pulse (optional one-liner):** worktree removed vs kept vs open-pr tip.

### S13 — Done

**Final progress pulse** (Phase: S13): final Status, backlog done/total, stop reason, branch,
PR/merge result, worktree path if kept/open-pr, top learnings this run (≤5 bullets).  
Driver: `next_auto: done` **only** when nothing remains blocked and tip is on launch or
intentionally open-pr-handled. If still `blocked:open-pr` or other `blocked:*`, print the
resume template — **do not** claim done.

## Recovery

If the process dies mid-run, or Driver says `blocked:rebase-continue` /
reintegrate_status failed/conflict with worktree still present:

```bash
bash <plugin>/tools/improve-worktree.sh recover --repo <repo> --slug <slug> \
  [--keep-worktree] [--no-merge-to-launch]
```

(`recover` = reintegrate then destroy unless keep.) Mid-rebase: finish
`git rebase --continue` in the worktree first, then recover/reintegrate.  
State: `<repo>/.git/improve-runs/<slug>.json`. Print the phase-5 resume template when blocked.

## References

| Doc | Path |
|---|---|
| Parse | `references/parse.md` |
| Lifecycle | `references/lifecycle.md` |
| Caps | `references/caps.md` |
| Throttle | `references/throttle.md` |
| Goal contract | `../improve-loop/references/contracts/goal.md` |
| Progress pulses | `../improve-loop/references/contracts/progress.md` |
| Progress formatter | `../../tools/improve-progress-format.js` |
| Lint discover/run | `../../tools/improve-lint.sh` (+ `improve-lint-discover.js`) |
| Outer loop | `../improve-loop/references/contracts/outer-loop.md` |
| One cycle | `../improve-loop/SKILL.md` |
