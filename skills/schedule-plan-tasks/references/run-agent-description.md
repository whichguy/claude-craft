# Run-Agent Task Description Template (verbatim)

This file holds the verbatim description that the orchestrator inserts into every Run-agent task in Step 3 of the execute-plan skill. The orchestrator must `Read` this file in full and paste the description verbatim into `TaskCreate` — no paraphrasing.

Substitute placeholders per task:
- `[TASK_ID]` — the TaskCreate-returned task ID for this task; used for TaskUpdate lifecycle calls and child cascade dispatch
- `[Why this task exists — …]` — the specific finding or proposal it addresses
- `[absolute worktree path]` — e.g. `/repo/.worktrees/chain-1`; use `"main workspace"` for trivial tasks
- `[current branch name]` — captured during git prep
- `[branch this worktree was forked from — the merge destination]` — current branch name captured at Pass 1 time; never a placeholder
- `[MERGE_TARGET value]` — equals Target branch for orchestrator-dispatched tasks; equals the parent agent's working branch for sub-tasks spawned within a run-agent
- `Isolation: native worktree` — for worktree tasks; for trivial tasks, replace with: `Isolation: none (trivial)`
- `Sub-tasks allowed: yes` — for non-trivial worktree tasks; replace with `no` for trivial tasks
- `Chain: none | head | link | tail` — from chain detection output; `none` for standalones and trivials
- `Chain ID: chain-N | none` — from chain detection output
- `[absolute paths to test data, fixtures, …]` — local paths symlinked in worktree creation step; for remote URIs, paste full URI/endpoint; `"none"` if not applicable
- `[Specific, actionable steps from the plan or reviewer's output]`
- `[Exact file paths to read and/or modify]`
- `[Concrete acceptance criteria]` — tests pass, file exists, output matches X, etc.
- `[Dependents list]` — for each dependent, one line: `- <task subject>  (needs: <concrete artifact this task must produce — file path, directory, function, schema, or env state>)`. Reason comes from the DEPENDS ON annotation in the reviewer output or plan's sequencing hints. Write `"none — leaf node (regression runs next if present)"` only if no downstream dependents exist.

For trivial tasks: set `Isolation: none (trivial)`, `Sub-tasks allowed: no`, `Chain: none`, `Chain ID: none`, `Working directory: main workspace`.
The self-merge wrapper is appended by the orchestrator ONLY for `Chain: none` and `Chain: tail` tasks.

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
Chain: none | head | link | tail
Chain ID: chain-N | none
External resources: [absolute paths to test data, fixtures, or large files outside the git repo — see ## External resources]

## Lifecycle: mark in-progress
**Your very first action — before reading any file or running any command:**

  TaskUpdate({ taskId: "[TASK_ID]", status: "in-progress" })

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

## Files
[Exact file paths to read and/or modify]

## External resources
[Absolute paths to symlinked resources, or "none"]

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
Then proceed to self-merge as normal.

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

For `Isolation: none (trivial)` tasks — commit directly to the working branch; no self-merge wrapper follows. Proceed directly to ## On success.
For `Chain: head` or `Chain: link` tasks — stop here. The orchestrator's next task will continue on this chain branch.
For `Chain: tail` or `Chain: none` (non-trivial) tasks — the self-merge wrapper (injected below by the orchestrator) runs next.

## On success

**Step 1 — mark completed:**

  TaskUpdate({ taskId: "[TASK_ID]", status: "completed" })

**Step 2 — cascade: find and dispatch unblocked children:**

  all_tasks = TaskList({})
  candidates = [t for t in all_tasks
                if "[TASK_ID]" in t.blockedBy and t.status == "pending"]

  For each candidate:
    details   = TaskGet({ taskId: candidate.id })
    blockers  = [TaskGet({ taskId: b }) for b in details.blockedBy]
    if all(b.status == "completed" for b in blockers):
      → ready to dispatch

  Dispatch ALL ready candidates in a SINGLE response as parallel Agent() calls,
  using details.description as the prompt for each.
  If no candidates are ready: this is a leaf — do nothing further.

STATUS: success
ACTION: none
NOTES: [files changed; merge complete if Chain: none or tail; what was accomplished;
        dispatched child task IDs, or "leaf — no children dispatched"]

## On failure

**Step 1 — mark failed:**

  TaskUpdate({ taskId: "[TASK_ID]", status: "failed" })

Do NOT cascade — failed tasks do not dispatch children. Blocked dependents
remain pending and will not run.

STATUS: failure
FAILURE_TYPE: no_change | partial_change | test_failures | conflict_needs_user | needs_split
ACTION: preserve_worktree | discard_worktree | none
  (no_change → discard; partial_change | test_failures → preserve; trivial task → none)
  (conflict_needs_user → preserve_worktree always; include "MERGE_TARGET: <branch>" in NOTES)
  (needs_split → none; use when task scope cannot be completed atomically — it requires decomposition into sub-tasks before retrying; include suggested sub-task breakdown in NOTES)
WORKTREE: <your worktree path, or N/A if trivial task>
BRANCH: <your worktree branch, or N/A if trivial task>
NOTES: [what was attempted, what failed, relevant error messages or test output]

## Dependents unblocked on success
[For each downstream task unblocked when this task reaches STATUS: success, one line:
 - <task subject>  (needs: <concrete artifact — file path, directory, function, schema, or env state>)
 Write "none — leaf node (regression runs next if present)" only if no downstream dependents exist.
 This section informs your definition-of-done verification: confirm each listed artifact exists
 before reporting success. YOU are responsible for dispatching these via the cascade in ## On success
 — do not assume anything else dispatches them.]
```
