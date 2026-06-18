# Create-Wt Task Description (verbatim)

This file holds the verbatim bash template that the orchestrator inserts as the `TaskCreate.description` for every create-wt task in Step 3 of execute-plan. Orchestrator must `Read` this file, substitute `[REPO_ROOT]` (the absolute target-repo root), `[TARGET_BRANCH]` (target branch value captured at Pass 1 start), and `task-N` / `task-N-branch` with the actual task identifiers, then paste verbatim into `TaskCreate.description`. Do not paraphrase.

**Envelope-substitution note:** when this template is used to assemble a delivery-agent envelope downstream (after the worktree is created), the orchestrator threads `Sandbox-Refs:` as one of the envelope fields when Phase 0 provisioned a sandbox (see SKILL.md `Sandbox-Refs:` envelope construction rule). The worktree itself excludes `.sandbox-overlay/` from git via step 2.5 below so any sandbox-specific config the delivery-agent writes never leaks into commits.

`[REPO_ROOT]` is the absolute path to the target repo — which may differ from the orchestrator's CWD. All worktree operations are routed through it via `git -C "[REPO_ROOT]"`, and worktrees land at `[REPO_ROOT]/.worktrees/...` so they live inside the target repo, not the invoker's CWD.

**Chain naming:** for a chain's create-wt, use `chain-K` (e.g. `chain-1`) instead of `task-N`. All chain members (head, links, tail) share the single `[REPO_ROOT]/.worktrees/chain-K` worktree — do not remove it after this step; the chain's tail delivery-agent performs the final merge and cleanup.

Orchestrator reads only the `STATUS:` line from the agent's output. `success` → mark create-wt completed (unblocks its chain-head or standalone delivery-agent). `failure` → mark failed, halt dependent delivery-agent, report.

---

```
Run these commands exactly. Report STATUS at the end.

# Substitute task-N with the actual identifier:
#   - For standalone proposals: task-N  (e.g. task-3)
#   - For chain proposals:      chain-K (e.g. chain-1)
# All chain members (head, links, tail) share this single worktree.
# Do NOT remove it after this step — the chain tail delivery-agent merges and cleans up.

# 1. Create worktree forked from [TARGET_BRANCH] by name (not HEAD), inside [REPO_ROOT].
#    Forking by branch name guarantees this worktree starts from the exact tip of
#    [TARGET_BRANCH], including all changes merged by upstream delivery-agents before
#    this task was unblocked. Do not substitute HEAD here.
git -C "[REPO_ROOT]" worktree add "[REPO_ROOT]/.worktrees/task-N" -b task-N-branch [TARGET_BRANCH]
if [ $? -ne 0 ]; then
  echo "STATUS: failure — could not create worktree [REPO_ROOT]/.worktrees/task-N from [TARGET_BRANCH]"
  exit 1
fi

# 2. Apply pre-flight uncommitted-state patches (modified-not-staged + untracked +
#    staged) so the user's in-progress edits travel into this worktree. Idempotent on
#    empty patches (the -s test guards). Conflict with delivery-agent work fails the
#    create-wt task with STATUS: failure — only this worktree halts; siblings continue.
#    The staged patch is applied via a pipe with --index so it re-stages the changes
#    in this worktree's index, preserving the "staged" state the user had.
[ -s "[REPO_ROOT]/.worktrees/.preflight-tracked.patch" ] && \
  git -C "[REPO_ROOT]/.worktrees/task-N" apply --whitespace=nowarn \
      "[REPO_ROOT]/.worktrees/.preflight-tracked.patch" || true
[ -s "[REPO_ROOT]/.worktrees/.preflight-untracked.tgz" ] && \
  tar -xzf "[REPO_ROOT]/.worktrees/.preflight-untracked.tgz" \
      -C "[REPO_ROOT]/.worktrees/task-N" || true
[ -s "[REPO_ROOT]/.worktrees/.preflight-staged.patch" ] && \
  cat "[REPO_ROOT]/.worktrees/.preflight-staged.patch" \
    | git -C "[REPO_ROOT]/.worktrees/task-N" apply --index --whitespace=nowarn - || true

# 2.5. Exclude sandbox overlay directory from this worktree's git index. Sandbox-specific
#      config (e.g. .clasp.json with sandbox scriptId) lives under .sandbox-overlay/ so
#      it never leaks into commits. info/exclude is per-worktree and not committed.
#      Idempotent: only append the line if not already present, so re-runs against
#      existing worktrees don't accumulate.
EXCLUDE_FILE="[REPO_ROOT]/.worktrees/task-N/.git/info/exclude"
grep -qxF '.sandbox-overlay/' "$EXCLUDE_FILE" 2>/dev/null \
  || echo '.sandbox-overlay/' >> "$EXCLUDE_FILE"

# 3. Symlink external resources (repeat both lines below for each resource)
[ -e /absolute/path/to/resource ] || { echo "STATUS: failure — resource not found: /absolute/path/to/resource"; exit 1; }
ln -s /absolute/path/to/resource "[REPO_ROOT]/.worktrees/task-N/resource-name"

# 4. Verify
git -C "[REPO_ROOT]" worktree list | grep -q "[REPO_ROOT]/.worktrees/task-N" && echo "STATUS: success — [REPO_ROOT]/.worktrees/task-N" || echo "STATUS: failure — worktree not found after add"
```
