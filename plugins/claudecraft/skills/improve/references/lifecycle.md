<!-- S0–S13 continuous lifecycle -->

# Lifecycle S0–S13

```text
S0  PARSE          → references/parse.md
S1  RESOLVE_REPO   git root; note dirty launch
S2  WT_CREATE      improve-worktree.sh create   (default ON; skip only with --no-worktree)
S3  WIP_BOOTSTRAP  improve-worktree.sh carry    (if dirty and carry)
S4  HISTORY        plan digest (MVP: improve-loop Phase 0 digests)
S5  RESEARCH       optional seed gate (throttle: seed only)
S6  PLAN_SEED      IMPROVE_LOOP.md backlog in active tree (worktree if any)
S7  CRITIQUE       optional seed only (throttle)
S8  INNER_LOOP     while active && under caps:
                     run improve-loop one cycle (cwd = worktree if used)
                     → control-channel progress pulse (required)
S9  STOP_REASON    complete | until: no-P0/P1×2 | until: <short> | stall | max_cycles | max_elapsed | budget | blocked
S10 FINAL_LEDGER   Status note if needed
S11 REINTEGRATE    improve-worktree.sh reintegrate  (ALWAYS if worktree created)
                     S11a: rebase worktree onto source tip (conflicts in worktree)
                     S11b: merge tip → source branch (default; skip with --no-merge-to-launch)
                     → short progress pulse; read status tip_on_launch=
S12 WT_DESTROY     if tip_on_launch=yes: destroy unless keep_worktree
                     if tip unmerged (no-merge / tip_on_launch=no): blocked:open-pr — no destroy
                     if S11 failed / mid-rebase: keep worktree + blocked:*
S13 DONE           final pulse; next_auto=done only when not still blocked:open-pr / blocked:*
```

Progress schema: `../../improve-loop/references/contracts/progress.md`.

## Driver + resume (no second state file)

Durable product state is **one** `IMPROVE_LOOP.md` in the **active** tree (includes `## Driver`).
Machine lifecycle: `.git/improve-runs/<slug>.json`. Chat is untrusted after compaction.

**Cold resume prompt** (fill and paste when blocked or session lost):

```text
Resume improve from disk (ignore chat history).

repo: <repo>
slug: <slug>
worktree_path: <path|none>
run_json: <path|none>
next_auto: <value>
blocked_detail: <or none>

Steps:
1. cd worktree_path if set, else repo
2. Read IMPROVE_LOOP.md header + ## Driver + last Log entries
3. Prefer run_json for paths if file exists; run improve-worktree.sh status for tip_on_launch/resume_hint
4. Execute next_auto only (cycle | reintegrate | destroy | blocked:open-pr | fix blocked:*)
5. Use test_command from ledger; never invent tests
6. Update ## Driver after the step
```

**Edges (short):** Status complete ≠ teardown done while worktree needs reintegrate; mid-rebase
beats Driver; only-ledger dirty may auto-commit `improve-loop: driver — next_auto …` before
reintegrate; ambiguous multi-run JSON → `blocked:ambiguous-run`; `merge_to_launch=false` →
`blocked:open-pr` (not “merged to main”); **recover/destroy must not drop the worktree tip**
when merge_to_launch=false unless `--force` (tip may be the only copy); reintegrate conflict →
prefer `recover` or rebase-continue; continuous driver owns S11–S12 (no double teardown).

## Worktree CLI

Resolve script relative to this plugin:

```bash
WT="<claudecraft-plugin-root>/tools/improve-worktree.sh"
# or: plugins/claudecraft/tools/improve-worktree.sh from repo root

bash "$WT" create --repo <path> --slug <slug> [--keep-worktree] [--no-merge-to-launch]
bash "$WT" carry --repo <path> --slug <slug>
bash "$WT" reintegrate --repo <path> --slug <slug>   # rebase onto source, then merge tip → source
bash "$WT" destroy --repo <path> --slug <slug> [--force]
bash "$WT" recover --repo <path> --slug <slug> [--keep-worktree] [--merge-to-launch|--no-merge-to-launch]
bash "$WT" status --repo <path> --slug <slug>
```

State: `<repo>/.git/improve-runs/<slug>.json`  

**`state`:** `created` → `bootstrapped` → `reintegrating` → `reintegrated` \| `reintegrate_failed` → `destroyed`  
**`reintegrate_status`:** `null` \| `conflict` \| `worktree_dirty` \| `launch_dirty` \| `ok`  

`status` prints JSON then `--- summary ---` (`suggested_next`, `resume_hint`, `mid_rebase`,
`tip_on_launch`, `launch_tracked_dirty`, …). `suggested_next` and destroy/recover decisions use
**tip ancestry** (whether worktree HEAD is reachable from the launch branch), not create-time
`merge_to_launch` alone. After a successful `--merge-to-launch` override, JSON persists
`merge_to_launch=true`.  
Errors print multi-line `status=error` / `command=` / `next=` / `exit_class=` (including create
single-flight exit 9). Destroy refuses uncommitted worktree dirt without `--force` (not only
failed reintegrate).  

Exit codes: 0 ok (incl. already-complete/destroyed) · 5 conflict · 6 reintegrate fail · 7 destroy refused · 9 single-flight  

**Isolation model (default):**

1. `create` adds a **detached-HEAD worktree** at the launch tip (git cannot check out the same
   branch in two places). **No permanent `improve/*` branch** is created.  
2. **`carry`** (when launch dirty): apply tracked patch + non-ignored untracked into the
   worktree, bootstrap-commit, then **drain launch** to clean HEAD so S11b is not blocked by
   `launch_dirty`. Never drain launch if the bootstrap commit failed.  
3. Cycles commit on the detached tip only.  
4. **S11 reintegrate:**  
   - **S11a** — `git rebase <source-tip>` in the worktree so concurrent source changes are
     absorbed and conflicts are organized **in the worktree** (leave mid-rebase + exit 5;
     operator `rebase --continue` then re-run reintegrate). Dirty worktree → exit 6.  
   - **S11b** — merge **post-rebase worktree tip** into the **launch/source branch**
     (`merge_to_launch: true` by default; often a fast-forward). Durable history ends on source.  
     If prior S11a left `reintegrate_status=ok` with tip still unmerged, a later
     `--merge-to-launch` runs **S11b only** when the tip already includes the
     current launch tip; otherwise **re-runs S11a** (launch may have advanced)
     then S11b so conflicts stay in the worktree.  
5. **S12 destroy** removes the worktree only; refuses without `--force` whenever the worktree
     tip is not on launch (including **before** reintegrate — detached commits are the only copy).  

Opt out of S11b with `--no-merge-to-launch` / “no merge” / “open a PR”. Opt out of worktree with
`--no-worktree`. Never rebase the source branch onto the worktree.

**Invariant:** successful `carry` empties transferable launch WIP into the worktree; launch is
clean afterward (gitignored files may remain).

Quality-review bank (invariants + dual-path matrix): [`worktree-lifecycle-learnings.md`](worktree-lifecycle-learnings.md).

## Invariants

1. Caps stop **S8 only** — still run S11 if a worktree exists.  
2. Never auto-destroy after failed reintegrate (unless `--force`).  
3. Never auto-destroy an unmerged tip (`merge_to_launch=false` / tip not on launch) unless `--force`.  
4. Default: **worktree on** + **S11a rebase onto source** + **S11b merge tip → source**.  
5. No lasting second branch; source branch is the only branch that keeps improve commits.
