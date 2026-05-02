# Worktree Run-Agent Self-Merge Wrapper (verbatim)

**Appended only to Chain: none and Chain: tail tasks.** Do NOT append to Chain: head or Chain: link tasks — those commit to the chain branch and pass off to the next link.

This file holds the verbatim wrapper that the orchestrator appends to isolated run-agent prompts where `Chain: none` or `Chain: tail` in Step 4. Orchestrator must `Read` this file, substitute `[MERGE_TARGET]` with the task description's `MERGE_TARGET:` field value (equals `Target branch` for orchestrator-dispatched tasks; equals the parent agent's working branch for sub-tasks spawned within a run-agent), then append everything below the `---` separator verbatim to the Agent prompt. Do not paraphrase.

---
## Self-merge and completion (orchestrator-injected)

After committing your changes (## Before return: commit), run the self-merge below.
Do not skip — STATUS: success means the branch is already merged and the worktree removed.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
MERGE_TARGET="[MERGE_TARGET]"
WORKTREE_PATH=$(pwd)
WORKTREE_BRANCH=$(git branch --show-current)
MAX_RETRIES=5

attempt=0
while [ $attempt -lt $MAX_RETRIES ]; do
  attempt=$((attempt + 1))

  git rebase "$MERGE_TARGET"
  if [ $? -ne 0 ]; then
    git rebase --abort
    exit 2  # true conflict — not retryable
  fi

  cd "$REPO_ROOT"
  git merge --no-ff "$WORKTREE_BRANCH" -m "merge: $WORKTREE_BRANCH → $MERGE_TARGET"
  if [ $? -eq 0 ]; then
    git worktree remove "$WORKTREE_PATH" --force
    git branch -d "$WORKTREE_BRANCH"
    exit 0
  fi

  git merge --abort
  cd "$WORKTREE_PATH"
  sleep $((attempt * 3))
done
exit 1  # retries exhausted
```

**On exit 0 (success):** mark completed, cascade, then report:
```
TaskUpdate({ taskId: "[TASK_ID]", status: "completed",
  metadata: { outcome: "success", worktree_status: "merged", branch: "merged" } })

// Cascade: find and dispatch unblocked children (see ## On success in run-agent-description)
all_tasks = TaskList({})
candidates = [t for t in all_tasks if "[TASK_ID]" in t.blockedBy and t.status == "pending"]
For each candidate where all its blockedBy are completed → dispatch Agent(details.description) in parallel.

STATUS: success
ACTION: none
NOTES: [files changed, what was accomplished; merge complete, worktree removed;
        dispatched child task IDs, or "leaf — no children dispatched"]
```

**On exit 1 or 2 (failure):** before reporting, mark yourself failed and create an investigation task:
```
TaskUpdate({ taskId: "[TASK_ID]", status: "failed",
  metadata: { outcome: "failure", failure_type: "conflict_needs_user",
              worktree: "<WORKTREE_PATH>", branch: "<WORKTREE_BRANCH>" } })

TaskCreate(
  subject: "Investigate merge failure: <this task's subject>",
  metadata: {
    task_type: "investigation",
    parent_task: "[TASK_ID]",
    failure_type: "conflict_needs_user",
    worktree: "<WORKTREE_PATH>",
    branch: "<WORKTREE_BRANCH>"
  },
  description: |
    ## Intention
    <copy the ## Purpose section from your task description>

    ## What finished
    <list every file changed and committed before the self-merge was attempted>

    ## What is incomplete
    <list any work steps from ## What to do that did not complete, or "all work committed">

    ## What failed
    Exit code: <1 = retries exhausted | 2 = rebase conflict>
    Attempt count: <N of MAX_RETRIES>
    Error output: <paste the relevant git rebase / git merge error lines>

    ## Context
    Worktree: <full absolute path — output of: echo $WORKTREE_PATH>
    Branch: <WORKTREE_BRANCH>
    MERGE_TARGET: [MERGE_TARGET]
)
```

Then report:
```
STATUS: failure
FAILURE_TYPE: conflict_needs_user
ACTION: preserve_worktree
WORKTREE: <full absolute path>
BRANCH: <worktree branch>
NOTES: [exit <code>; rebase conflict or retries exhausted; MERGE_TARGET: [MERGE_TARGET]]
```
