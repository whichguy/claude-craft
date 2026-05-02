# Run-Agent Task Description Template (verbatim)

This file holds the verbatim description that the orchestrator inserts into every Run-agent task in Step 3 of the execute-plan skill. The orchestrator must `Read` this file in full and paste the description verbatim into `TaskCreate` — no paraphrasing.

Substitute placeholders per task:
- `[Why this task exists — …]` — the specific finding or proposal it addresses
- `[TASK_ID]` — the TaskCreate-returned task ID, embedded by the orchestrator in Phase 1.5
- `[absolute worktree path]` — e.g. `/repo/.worktrees/chain-1`; use `"main workspace"` for trivial tasks
- `[current branch name]` — captured during git prep
- `[branch this worktree was forked from — the merge destination]` — current branch name captured at Pass 1 time; never a placeholder
- `[MERGE_TARGET value]` — equals Target branch for orchestrator-dispatched tasks; equals the parent agent's working branch for sub-tasks spawned within a run-agent
- `Isolation: native worktree` — for worktree tasks; for trivial tasks, replace with: `Isolation: none (trivial)`
- `Sub-tasks allowed: yes` — for non-trivial worktree tasks; replace with `no` for trivial tasks
- `Self-merge: yes` — for Chain: none and Chain: tail tasks (this worktree owns its branch end-to-end); replace with `no` for Chain: head and Chain: link tasks (next chain member continues in same worktree)
- `[symlinked paths outside worktree, or "none"]` — only paths to files outside the git repo that were explicitly symlinked in; omit paths already present in the worktree
- `[Specific, actionable steps from the plan or reviewer's output]`
- `[Concrete acceptance criteria]` — tests pass, file exists, output matches X, etc.

For trivial tasks: set `Isolation: none (trivial)`, `Sub-tasks allowed: no`, `Self-merge: no`, `Working directory: main workspace`.

---

```
## Purpose
[Why this task exists — the specific finding or proposal it addresses]

## Working directory
[Absolute path of worktree — e.g. /repo/.worktrees/chain-1 — or "main workspace" for trivial tasks]

## Execution context
Task ID: [TASK_ID]
Working branch: [current branch name]
Target branch: [branch this worktree was forked from — the merge destination]
MERGE_TARGET: [MERGE_TARGET value]
Isolation: native worktree | none (trivial)
Sub-tasks allowed: yes | no
Self-merge: yes | no
External resources: [symlinked paths outside worktree, or "none"]

## Directive
Execute completely. Do not pause to ask for confirmation. Do not stop at the first
obstacle — diagnose it, fix it, continue.

Retry bound: make at most 3 distinct fix attempts on any single obstacle. A distinct
attempt means a meaningfully different approach — not re-running the same command.
After 3 attempts on the same problem, stop immediately and report STATUS: failure,
FAILURE_TYPE: partial_change. Include in NOTES a numbered list of each attempt and
its outcome.

Only report failure before 3 attempts if the obstacle is a genuine fatality: missing
credentials, broken tool, environment issue entirely outside your control.

## What to do
[Specific, actionable steps from the plan or reviewer's output]

## Definition of done
[Concrete acceptance criteria — tests pass, file exists, output matches X, etc.
Continue working until these criteria are met, or report failure.]

## Sub-task spawning (when Sub-tasks allowed: yes)

Use this only when you discover 2+ chunks of work that are genuinely independent —
neither needs the other's output to proceed. Prefer plan-time decomposition; this is
the runtime escape hatch for parallelism not anticipated in the plan.

**How to spawn:**
For each parallel chunk:
1. Create a sub-task worktree from your current working branch (not Target branch):
   `git worktree add .worktrees/<sub-id> -b <sub-branch> <your-working-branch>`
2. Construct a full agent prompt using this same template with:
   - Working directory: the sub-task worktree path
   - MERGE_TARGET: your working branch (not Target branch)
   - Target branch: same as yours (informational only)
   - Sub-tasks allowed: no (no recursive nesting)
3. Dispatch all sub-task agents in parallel (multiple Agent calls in one message).
4. Wait for all to report STATUS: success before continuing.

**After all sub-tasks complete:**
Your working branch now has their merge commits. Do any remaining work, then make
your single final commit covering only what you produced directly. Sub-task merge
commits are already part of your branch history — do not re-commit them.
Then proceed to self-merge as normal (if Self-merge: yes).

**If any sub-task fails:**
Halt immediately. Do not continue with remaining sub-tasks or your own work.
Report STATUS: failure, FAILURE_TYPE: partial_change, ACTION: preserve_worktree.
Include sub-task failure details (branch, worktree path, error) in NOTES.

## Before return: commit
Stage and make exactly one `git commit` for all changes this task produces directly. This commit must encapsulate the complete, logical, and substantial unit of work defined in this task (the "Goldilocks" unit).

  git status                                ← verify which files you changed
  git add <files you modified>              ← stage only files this task intentionally changed
  git commit -m "task-N: [subject] - [why]" ← encapsulate the logical substantial change

Do NOT use `git add -A` — only stage files this task modified.
If `## What to do` steps include inline `git add` or `git commit` instructions, skip those and consolidate all staging and committing here instead. The single commit here is the only commit this task produces.
If this task made no file changes (e.g. read-only analysis), skip the commit and note it.
A successful task results in a single, clean, and logical contribution to the codebase.
Sub-task merge commits already on your branch are not yours to re-commit — they are
already part of your branch history.

**After committing — choose path based on Isolation and Self-merge:**

For `Isolation: none (trivial)`:
  Commit directly to the working branch. Proceed to ## On success.

For `Self-merge: no` (chain head or link, native worktree):
  Commit to the worktree branch. Stop here. Proceed to ## On success.
  Do NOT remove the worktree — the next chain member continues in it.

For `Self-merge: yes` (standalone or chain tail, native worktree):
  Commit, then run the self-merge block below.

## Self-merge (Self-merge: yes only)

After committing, merge your worktree branch back to MERGE_TARGET with retry logic.
Do not skip — STATUS: success from this task means the branch is already merged and
the worktree removed.

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
    # true conflict — not retryable; fall through to ## On failure
    MERGE_FAILED=true
    break
  fi

  cd "$REPO_ROOT"
  git merge --no-ff "$WORKTREE_BRANCH" -m "merge: $WORKTREE_BRANCH → $MERGE_TARGET"
  if [ $? -eq 0 ]; then
    git worktree remove "$WORKTREE_PATH" --force
    git branch -d "$WORKTREE_BRANCH"
    break  # success — fall through to ## On success
  fi

  git merge --abort
  cd "$WORKTREE_PATH"
  sleep $((attempt * 3))
done

if [ $attempt -eq $MAX_RETRIES ] && [ "$MERGE_FAILED" != "true" ]; then
  # retries exhausted without conflict — fall through to ## On failure
  MERGE_FAILED=true
fi
```

If `MERGE_FAILED` is set, skip ## On success and go directly to ## On failure with
`FAILURE_TYPE: conflict_needs_user`.

## On success

1. Mark this task completed:
   TaskUpdate({ taskId: "[TASK_ID]", status: "completed" })

2. Find and dispatch newly unblocked tasks:

   Scan the backlog for pending tasks that reference this task as a blocker,
   then check whether ALL their blockers are now complete:

   ```
   all_tasks = TaskList({})

   // Step A — candidates: pending tasks that list [TASK_ID] as one of their blockers
   candidates = [t for t in all_tasks
                 if t.status == "pending" and "[TASK_ID]" in t.blockedBy]

   // Step B — filter to those where every blocker is now completed
   newly_unblocked = []
   for each task t in candidates:
     all_blockers = [TaskGet(b) for b in t.blockedBy]
     if all(b.status == "completed" for b in all_blockers):
       newly_unblocked.append(t)
   ```

   Claim each newly unblocked task before dispatching (prevents double-dispatch
   when two tasks complete concurrently and both scan the same candidate):
   ```
   for each task t in newly_unblocked:
     TaskUpdate({ taskId: t.id, status: "in-progress" })
   ```

   Dispatch all claimed tasks in a SINGLE response as parallel Agent() calls.
   Each agent's prompt = TaskGet(t.id).description (the full task description).

   If no tasks become newly unblocked, do nothing further.

STATUS: success
ACTION: none
NOTES: [files changed; self-merge complete and worktree removed if Self-merge: yes;
        list of unblocked task subjects dispatched, or "none unblocked"]

## On failure

1. Mark this task failed:
   TaskUpdate({ taskId: "[TASK_ID]", status: "failed" })

2. Create an investigation task so the failure is visible in the backlog:
   TaskCreate({
     subject: "Investigate failure: [subject of this task]",
     metadata: {
       task_type: "investigation",
       parent_task: "[TASK_ID]",
       failure_type: "<FAILURE_TYPE>",
       worktree: "<WORKTREE_PATH or N/A>",
       branch: "<WORKTREE_BRANCH or N/A>"
     },
     description: |
       ## What failed
       Parent task: [TASK_ID] — [subject of this task]
       FAILURE_TYPE: <type>
       Attempt count: <N> of 3
       Error output: <paste the relevant error lines>

       Worktree: <path>
       Branch: <branch>
       MERGE_TARGET: [MERGE_TARGET]

       ## What finished before failure
       <list files changed and committed before the failure point, or "none">

       ## What is incomplete
       <list steps from ## What to do that did not complete>

       ## Your job
       Analyze the failure. Determine whether new sub-tasks can resolve it.
       - If yes: TaskCreate each recovery sub-task with a clear description,
         dispatch Agent() for each in parallel, wait for STATUS: success from all,
         then mark this investigation task "completed".
       - If no: mark this investigation task "completed" with a clear explanation
         of why resolution requires human intervention.
   })

Do NOT dispatch children of the failed task — failed tasks do not cascade.

STATUS: failure
FAILURE_TYPE: no_change | partial_change | test_failures | conflict_needs_user | needs_split
ACTION: preserve_worktree | discard_worktree | none
  (no_change → discard; partial_change | test_failures → preserve; trivial task → none)
  (conflict_needs_user → preserve_worktree always)
  (needs_split → none; include suggested sub-task breakdown in NOTES)
WORKTREE: <your worktree path, or N/A if trivial task>
BRANCH: <your worktree branch, or N/A if trivial task>
NOTES: [what was attempted, what failed; the investigation task has been created in the backlog]
```
