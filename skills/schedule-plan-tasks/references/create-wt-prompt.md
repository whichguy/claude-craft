# Create-Wt Task Description (verbatim)

This file holds the verbatim bash template that the orchestrator inserts as the `TaskCreate.description` for every create-wt task in Step 3 of execute-plan. Orchestrator must `Read` this file, make the substitutions below, then paste verbatim into `TaskCreate.description`. Do not paraphrase.

**Substitutions (all required before pasting):**
- `[TARGET_BRANCH]` → target branch value captured at Pass 1 start
- `task-N` / `task-N-branch` → actual task identifiers
- Section 3 (Symlink external resources): substitute each `/absolute/path/to/resource` and `resource-name` with the actual paths identified in Step 1's external-resource scan. **If the task has no external resources (`External resources: none` in its run-agent description), omit section 3 entirely** — do not emit a check or symlink for a placeholder path.

Orchestrator reads only the `STATUS:` line from the agent's output. `success` → mark create-wt completed (unblocks its run-agent). `failure` → mark failed, halt dependent run-agent, report.

---

```
Run these commands exactly. Report STATUS at the end.

# 1. Create worktree
git worktree add .worktrees/task-N -b task-N-branch HEAD

# 2. Apply latest commits from target branch into the worktree
#    (brings in any changes already merged since the worktree was forked)
git -C .worktrees/task-N rebase [TARGET_BRANCH]
if [ $? -ne 0 ]; then
  git -C .worktrees/task-N rebase --abort
  git worktree remove .worktrees/task-N --force 2>/dev/null || true
  echo "STATUS: failure — rebase from [TARGET_BRANCH] into .worktrees/task-N failed"
  exit 1
fi

# 3. Symlink external resources (repeat both lines below for each resource)
[ -e /absolute/path/to/resource ] || { echo "STATUS: failure — resource not found: /absolute/path/to/resource"; exit 1; }
ln -s /absolute/path/to/resource .worktrees/task-N/resource-name

# 4. Verify
git worktree list | grep -q task-N && echo "STATUS: success — .worktrees/task-N" || echo "STATUS: failure — worktree not found after add"
```
