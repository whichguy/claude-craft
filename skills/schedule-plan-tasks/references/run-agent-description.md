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
After 3 attempts on the same problem, stop immediately and emit the status block with
`RESULT: failed`, `FAILURE: partial_change`, and a numbered list of each attempt and
its outcome in the WORK or INCOMPLETE field.

Only emit `RESULT: failed` before 3 attempts if the obstacle is a genuine fatality:
missing credentials, broken tool, environment issue entirely outside your control.

## What to do
[Specific, actionable steps from the plan or reviewer's output]

## Definition of done
[Concrete acceptance criteria — tests pass, file exists, output matches X, etc.
Continue working until these criteria are met, or report failure.]

## Sub-task spawning (Sub-tasks allowed: yes only)

Use only for 2+ chunks of work that are genuinely independent — neither needs the other's
output. Prefer plan-time decomposition; this is the runtime escape hatch.

**Spawn:** for each chunk run `git worktree add .worktrees/<sub-id> -b <sub-branch> <your-working-branch>`,
then dispatch an Agent using this same template with: Working directory = sub-worktree path,
MERGE_TARGET = your working branch (not Target branch), Sub-tasks allowed: no (no nesting).
Dispatch all sub-tasks in parallel (one message, multiple Agent calls). Wait for all
to return `RESULT: complete` before continuing.

**After all succeed:** your branch now has their merge commits. Do remaining direct work,
make your single final commit (sub-task merge commits are already on your branch — do not
re-commit). Then self-merge as normal if Self-merge: yes.

**Any sub-task returns RESULT: failed or partial:** halt immediately. Emit your own status
block with `RESULT: failed`, `FAILURE: partial_change`, `ARTIFACT: <your worktree path>`.
Include the failing sub-task's branch, worktree, and FAILURE in your INCOMPLETE field.

## Before return: commit

Make exactly one `git commit` covering only the files this task produced directly:

```
git status                                # verify what changed
git add <files you modified>              # stage by name; never `-A`
git commit -m "task-N: [subject] - [why]"
```

Rules:
- One commit per task — consolidate any inline `git commit` calls from `## What to do` here.
- Skip the commit if this task made no file changes (e.g. read-only analysis); note in WORK.
- Sub-task merge commits already on your branch are NOT yours to re-commit.

**After committing — branch by Isolation and Self-merge:**

| Case                                       | Action                                                                |
|--------------------------------------------|-----------------------------------------------------------------------|
| `Isolation: none (trivial)`                | Commit lands on working branch. Proceed to status protocol.           |
| `Self-merge: no` (chain head or link)      | Commit lands on worktree branch. Do NOT remove the worktree — the next chain member continues in it. Proceed to status protocol. |
| `Self-merge: yes` (standalone / chain tail)| Commit, then run the self-merge block below before the status protocol. |

## Self-merge (Self-merge: yes only)

After committing, merge your worktree branch back to MERGE_TARGET with retry logic.
Do not skip — `RESULT: complete` from this task means the branch is already merged and
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
    # true conflict — not retryable; fall through to "On RESULT: failed"
    MERGE_FAILED=true
    break
  fi

  cd "$REPO_ROOT"
  git merge --no-ff "$WORKTREE_BRANCH" -m "merge: $WORKTREE_BRANCH → $MERGE_TARGET"
  if [ $? -eq 0 ]; then
    git worktree remove "$WORKTREE_PATH" --force
    git branch -d "$WORKTREE_BRANCH"
    break  # success — fall through to "On RESULT: complete"
  fi

  git merge --abort
  cd "$WORKTREE_PATH"
  sleep $((attempt * 3))
done

if [ $attempt -eq $MAX_RETRIES ] && [ "$MERGE_FAILED" != "true" ]; then
  # retries exhausted without conflict — fall through to "On RESULT: failed"
  MERGE_FAILED=true
fi
```

If `MERGE_FAILED` is set, skip "On RESULT: complete" and go directly to "On RESULT: failed" with
`FAILURE: conflict_needs_user`.

## Status protocol (every run emits this block as the final output)

```
RESULT:      complete | partial | failed
WORK:        <one-line summary of what this task produced or changed>
INCOMPLETE:  <what was NOT achieved; "none" when RESULT: complete>
FAILURE:     <FAILURE enum value when RESULT: failed; else "none">
ARTIFACT:    <preserved worktree path when relevant; else "none">
DISPATCHED:  <comma-separated task IDs newly dispatched as cascade children, or "none">
```

- `RESULT` is mutually exclusive: `complete` = met Definition of done; `partial` = did some
  work but stopped (retry-bound hit, sub-task halted); `failed` = no useful state-change
  made or merge could not complete.
- `WORK` always answers "what was achieved." For `failed` it may be "none."
- `INCOMPLETE` always answers "what was not achieved" for `partial` or `failed`.
- `FAILURE` ∈ `no_change | partial_change | test_failures | conflict_needs_user | needs_split`.
- `ARTIFACT`: see `references/investigation-task-template.md` FAILURE → ARTIFACT mapping.
- `DISPATCHED` is non-empty only when `RESULT: complete` and dependent tasks were unblocked.

## On RESULT: complete

1. Mark this task completed: `TaskUpdate({ taskId: "[TASK_ID]", status: "completed" })`

2. **Cascade-dispatch directive.** This task does not know its dependents in advance. At
   runtime, discover them and start any that are now unblocked:

   - Call `TaskList({})` to read the current backlog.
   - For each task `t` in the result, walk through these gates in order — skip on the first
     gate that fails:
       a. `t.status` must be `"pending"` (skip otherwise — already done or in flight).
       b. `[TASK_ID]` must appear in `t.blockedBy` (skip otherwise — `t` does not depend on this task).
       c. For every OTHER blocker ID `b` in `t.blockedBy`, call `TaskGet(b)`; every one must
          have `status == "completed"` (skip if any blocker is still pending/in-progress —
          more upstream work remains).
   - Any task `t` that passes all three gates is newly unblocked by this task's completion.
     Before dispatching, claim it to prevent concurrent double-dispatch when sibling tasks
     finish at the same time:
     `TaskUpdate({ taskId: t.id, status: "in-progress" })`
   - Dispatch ALL claimed tasks in a SINGLE response — multiple parallel `Agent` calls,
     each with `prompt = TaskGet(t.id).description` (the dependent task carries its own
     full instructions; this task does not need to know what they do).

3. Record the dispatched IDs in the `DISPATCHED:` field, or `none` if no task passed all gates.

4. Emit the status block.

## On RESULT: partial

1. `TaskUpdate({ taskId: "[TASK_ID]", status: "completed" })` is NOT called — the work is incomplete.
   Either re-claim with `status: "in-progress"` (default behavior; orchestrator may re-dispatch),
   or `TaskUpdate({ status: "failed" })` if the partial state is unrecoverable in this attempt.
2. NO cascade dispatch — `DISPATCHED: none`.
3. Emit the status block. Set `INCOMPLETE` to the unfinished checklist from `## What to do`.

## On RESULT: failed

1. `TaskUpdate({ taskId: "[TASK_ID]", status: "failed" })`
2. JIT-load `references/investigation-task-template.md`. Substitute `[PARENT_TASK_ID]`,
   `[PARENT_SUBJECT]`, `[FAILURE]`, `[WORK]`, `[INCOMPLETE]`, `[ARTIFACT]`. Run the TaskCreate
   verbatim to register a sibling investigation task.
3. NO cascade dispatch — failed tasks do not cascade. Downstream dependents stay pending and
   are visible via `TaskList({})`. `DISPATCHED: none`.
4. Emit the status block.

```
