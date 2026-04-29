# Run-Agent Task Description Template (verbatim)

This file holds the verbatim description that the orchestrator inserts into every Run-agent task in Step 3 of the execute-plan skill. The orchestrator must `Read` this file in full and paste the description verbatim into `TaskCreate` — no paraphrasing.

Substitute placeholders per task:
- `[Why this task exists — …]` — the specific finding or proposal it addresses
- `[absolute worktree path]` — e.g. `/repo/.worktrees/chain-1`; use `"main workspace"` for trivial tasks
- `[current branch name]` — captured during git prep
- `[SHA from git prep checkpoint commit]` — populated by `Propagate checkpoint SHA` task; until then leave the literal string `[placeholder]` (Assert 4 catches it if propagation didn't run)
- `[branch this worktree was forked from — the merge destination]` — current branch name captured at Pass 1 time; never a placeholder
- `Isolation: native worktree` — for worktree tasks; for trivial tasks, replace with: `Isolation: none (trivial)`
- `Chain: none | head | link | tail` — from chain detection output; `none` for standalones and trivials
- `Chain ID: chain-N | none` — from chain detection output
- `[absolute paths to test data, fixtures, …]` — local paths symlinked in worktree creation step; for remote URIs, paste full URI/endpoint; `"none"` if not applicable
- `[Specific, actionable steps from the plan or reviewer's output]`
- `[Exact file paths to read and/or modify]`
- `[Concrete acceptance criteria]` — tests pass, file exists, output matches X, etc.
- `[Dependents list]` — task subjects unblocked on success; `"none — leaf node"` if last in chain

For trivial tasks: set `Isolation: none (trivial)`, `Chain: none`, `Chain ID: none`, `Working directory: main workspace`.
The self-merge wrapper is appended by the orchestrator ONLY for `Chain: none` and `Chain: tail` tasks.

---

```
## Purpose
[Why this task exists — the specific finding or proposal it addresses]

## Working directory
[Absolute path of worktree — e.g. /repo/.worktrees/chain-1 — or "main workspace" for trivial tasks]

## Execution context
Working branch: [current branch name]
Checkpoint SHA: [SHA from git prep checkpoint commit — use for rollback]
Target branch: [branch this worktree was forked from — the merge destination]
Isolation: native worktree | none (trivial)
Chain: none | head | link | tail
Chain ID: chain-N | none
External resources: [absolute paths to test data, fixtures, or large files outside the git repo — see ## External resources]

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

## Before return: commit
Stage and make exactly one `git commit` for all changes this task produces:

  git status                              ← verify which files you changed
  git add <files you modified>            ← stage only files this task intentionally changed
  git commit -m "task-N: [what was done]" ← exactly one commit to the worktree/working branch

Do NOT use `git add -A` — only stage files this task modified.
If this task made no file changes (e.g. read-only analysis), skip the commit and note it.

For `Isolation: none (trivial)` tasks — commit directly to the working branch; no self-merge wrapper follows. Proceed directly to ## On success.
For `Chain: head` or `Chain: link` tasks — stop here. The orchestrator's next task will continue on this chain branch.
For `Chain: tail` or `Chain: none` (non-trivial) tasks — the self-merge wrapper (injected below by the orchestrator) runs next.

## On success

STATUS: success
ACTION: none
NOTES: [files changed; merge complete if Chain: none or tail; what was accomplished]

## On failure

STATUS: failure
FAILURE_TYPE: no_change | partial_change | test_failures | conflict_needs_user | needs_split
ACTION: preserve_worktree | discard_worktree | none
  (no_change → discard; partial_change | test_failures → preserve; trivial task → none)
  (conflict_needs_user → preserve_worktree always; include "Target branch: <branch>" in NOTES)
  (needs_split → none; use when task scope cannot be completed atomically — it requires decomposition into sub-tasks before retrying; include suggested sub-task breakdown in NOTES)
WORKTREE: <your worktree path, or N/A if trivial task>
BRANCH: <your worktree branch, or N/A if trivial task>
NOTES: [what was attempted, what failed, relevant error messages or test output]

Orchestrator handles cleanup, halting, and dependent-task tracing on its own — only FAILURE_TYPE and ACTION are read.

## Dependents unblocked on success
[List of task subjects that will be unblocked when this task reaches STATUS: success.
 Write "none — this is a leaf node (regression runs next if present)" ONLY if this task has
 no downstream dependents in the DEPENDS ON graph. If other chains or tasks depend on this
 one, list their subjects here instead.
 Note: the task system automatically unblocks these; this section is informational only.
 Do NOT call any task tool to unblock dependents — completing the task is sufficient.]
```
