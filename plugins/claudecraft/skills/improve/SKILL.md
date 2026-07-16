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

Normative cycle law: `../improve-loop/SKILL.md` + its `references/`.  
Portable continuous objective: `../improve-loop/references/contracts/goal.md`.

## When to use which

| Intent | Skill |
|---|---|
| One tested cycle | `improve-loop` |
| Continuous until done / timebox / budget | **this skill (`improve`)** |

## Procedure (run in order)

### S0 — Parse

Read `references/parse.md`. Extract repo, target, tests, until, mode, worktree, caps.  
Echo parse card. Abort unattended if tests/target missing with no ledger to resume.

### S1 — Resolve repo

`git -C <repo> rev-parse --show-toplevel`. Note launch branch and whether the tree is dirty.

### S2–S3 — Worktree (default ON)

Read `references/lifecycle.md`. **Default:** use a worktree for both once and continuous runs.
Skip only with `--no-worktree` / “no worktree”.

```bash
bash <plugin>/tools/improve-worktree.sh create --repo <repo> --slug <slug> \
  [--keep-worktree] [--no-merge-to-launch]
# if launch dirty and carry:
bash <plugin>/tools/improve-worktree.sh carry --repo <repo> --slug <slug>
```

**Isolation:** detached HEAD at launch tip — **no permanent second branch**.  
**S11:** merges the worktree tip into the **launch/source branch** recorded at create
(`merge_to_launch=true` default). Pass `--no-merge-to-launch` only for PR-only tips.

Active cwd for cycles = worktree path from status/state JSON.  
With `--no-worktree`: work in launch tree (must satisfy improve-loop dirty guards).

### S4–S7 — Seed plan (first turn / new target)

- Ensure `IMPROVE_LOOP.md` exists in the **active** tree (worktree or launch) with target + tests.  
- Prefer improve-loop Phase 0 seed if absent.  
- Optional research/critique: seed only (`references/throttle.md`).  
- Do not expand scope outside `target`.

### S8 — Inner loop

Read `references/caps.md` and `../improve-loop/references/contracts/progress.md`.  
While Status active and under caps:

1. Cap check (cycles / elapsed / budget) → if over, break to S9.  
2. **Run one improve-loop cycle** in the active tree (load improve-loop skill; follow its phase index and Read phase references).  
3. Re-read `IMPROVE_LOOP.md` Status / counters.  
4. **Ensure a control-channel progress pulse** for this cycle (learnings, changes, backlog/caps progress). If the cycle did not emit one, synthesize JSON from the latest Log entry + `git status` / last commit and prefer  
   `node <plugin>/tools/improve-progress-format.js`  
   (see `../improve-loop/references/contracts/progress.md`), then emit via `goal.report` if available, else visible markdown.  
5. If terminal or until+complete, break.

**Goal host:** if the harness has a goal facility, bind it per `../improve-loop/references/contracts/goal.md` with the same stop predicate; use `goal.report` for pulses; still perform S11–S12 yourself. If no goal facility, this native S8 loop **is** the outer loop and pulses are user-visible markdown.

### S9–S10 — Stop + ledger

Record stop reason (complete / stall / max_cycles / max_elapsed / budget / blocked).  
If ledger needs a final Status commit and improve-loop did not land one, prefer a ledger-only improve-loop flush path when tree allows.

### S11 — Reintegrate (always if worktree was created)

```bash
bash <plugin>/tools/improve-worktree.sh reintegrate --repo <repo> --slug <slug>
# default: merge detached worktree tip → launch/source branch
# override: --no-merge-to-launch | --merge-to-launch
```

Launch must have **no tracked dirty files** for merge (untracked `.claude/worktrees` parent is OK).
Conflicts or launch_dirty → keep worktree; report; do not pretend success.  
**Pulse:** short `## Improve progress` (Phase: S11) with reintegrate ok|conflict|launch_dirty.

### S12 — Destroy

```bash
bash <plugin>/tools/improve-worktree.sh destroy --repo <repo> --slug <slug>
# or skip if keep_worktree / reintegrate failed (unless --force)
```

**Pulse (optional one-liner):** worktree removed vs kept for debug.

### S13 — Done

**Final progress pulse** (Phase: S13): final Status, backlog done/total, stop reason, branch,
PR/merge result, worktree path if kept, top learnings this run (≤5 bullets).

## Recovery

If the process dies mid-run:

```bash
bash <plugin>/tools/improve-worktree.sh recover --repo <repo> --slug <slug> \
  [--keep-worktree] [--no-merge-to-launch]
```

State: `<repo>/.git/improve-runs/<slug>.json`.

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
| Outer loop | `../improve-loop/references/contracts/outer-loop.md` |
| One cycle | `../improve-loop/SKILL.md` |
