# Create-Wt Task Description (verbatim)

This file holds the verbatim bash template that the orchestrator inserts as the `TaskCreate.description` for every create-wt task in Step 3 of execute-plan. Orchestrator must `Read` this file, substitute `[TARGET_BRANCH]` with the target branch value captured at Pass 1 start and `task-N` / `task-N-branch` with the actual task identifiers, then paste verbatim into `TaskCreate.description`. Do not paraphrase.

**Chain naming:** for a chain's create-wt, use `chain-K` (e.g. `chain-1`) instead of `task-N`. All chain members (head, links, tail) share the single `.worktrees/chain-K` worktree — do not remove it after this step; the chain's tail run-agent performs the final merge and cleanup.

Orchestrator reads only the `STATUS:` line from the agent's output. `success` → mark create-wt completed (unblocks its chain-head or standalone run-agent). `failure` → mark failed, halt dependent run-agent, report.

---

```
Run these commands exactly. Report STATUS at the end.

# Substitute task-N with the actual identifier:
#   - For standalone proposals: task-N  (e.g. task-3)
#   - For chain proposals:      chain-K (e.g. chain-1)
# All chain members (head, links, tail) share this single worktree.
# Do NOT remove it after this step — the chain tail run-agent merges and cleans up.

# 1. Create worktree forked from [TARGET_BRANCH] by name (not HEAD).
#    Forking by branch name guarantees this worktree starts from the exact tip of
#    [TARGET_BRANCH], including all changes merged by upstream run-agents before
#    this task was unblocked. Do not substitute HEAD here.
git worktree add .worktrees/task-N -b task-N-branch [TARGET_BRANCH]
if [ $? -ne 0 ]; then
  echo "STATUS: failure — could not create worktree .worktrees/task-N from [TARGET_BRANCH]"
  exit 1
fi

# 3. Symlink external resources (repeat both lines below for each resource)
[ -e /absolute/path/to/resource ] || { echo "STATUS: failure — resource not found: /absolute/path/to/resource"; exit 1; }
ln -s /absolute/path/to/resource .worktrees/task-N/resource-name

# 4. Verify
git worktree list | grep -q task-N && echo "STATUS: success — .worktrees/task-N" || echo "STATUS: failure — worktree not found after add"
```
