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
S9  STOP_REASON    complete | stall | max_cycles | max_elapsed | budget | blocked
S10 FINAL_LEDGER   Status note if needed
S11 REINTEGRATE    improve-worktree.sh reintegrate  (ALWAYS if worktree created)
                     → short progress pulse
S12 WT_DESTROY     destroy unless keep_worktree or S11 failed
S13 DONE           → final progress pulse
```

Progress schema: `../../improve-loop/references/contracts/progress.md`.

## Worktree CLI

Resolve script relative to this plugin:

```bash
WT="<claudecraft-plugin-root>/tools/improve-worktree.sh"
# or: plugins/claudecraft/tools/improve-worktree.sh from repo root

bash "$WT" create --repo <path> --slug <slug> [--keep-worktree] [--no-merge-to-launch]
bash "$WT" carry --repo <path> --slug <slug>
bash "$WT" reintegrate --repo <path> --slug <slug>   # merges worktree tip → source branch
bash "$WT" destroy --repo <path> --slug <slug> [--force]
bash "$WT" recover --repo <path> --slug <slug> [--keep-worktree] [--no-merge-to-launch]
bash "$WT" status --repo <path> --slug <slug>
```

State: `<repo>/.git/improve-runs/<slug>.json`  
Exit codes: 0 ok · 5 conflict · 6 reintegrate fail · 7 destroy refused · 9 single-flight  

**Isolation model (default):**

1. `create` adds a **detached-HEAD worktree** at the launch tip (git cannot check out the same
   branch in two places). **No permanent `improve/*` branch** is created.  
2. Cycles commit on the detached tip only.  
3. **S11 reintegrate** merges that tip into the **launch/source branch** recorded at create
   (`merge_to_launch: true` by default). Durable history ends on the source branch.  
4. **S12 destroy** removes the worktree only.  

Opt out of merge with `--no-merge-to-launch` / “no merge” / “open a PR” (tip stays only in the
worktree until you branch/PR yourself). Opt out of worktree with `--no-worktree`.

## Invariants

1. Caps stop **S8 only** — still run S11 if a worktree exists.  
2. Never auto-destroy after failed reintegrate (unless `--force`).  
3. Default: **worktree on** + **merge tip into launch/source branch** at S11.  
4. No lasting second branch; source branch is the only branch that keeps improve commits.
