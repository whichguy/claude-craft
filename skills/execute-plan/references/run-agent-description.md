# Run-Agent Task Description Template (verbatim)

This file holds the verbatim description that the orchestrator inserts into every Run-agent task in Step 3 of the execute-plan skill. The orchestrator must `Read` this file in full and paste the description verbatim into `TaskCreate` — no paraphrasing.

Substitute placeholders per task:
- `[Why this task exists — …]` — the specific finding or proposal it addresses
- `[task IDs — …]` — IDs from Pass 1
- `[current branch name]` — captured during git prep
- `[SHA from git prep checkpoint commit]` — populated by `Propagate checkpoint SHA` task; until then leave the literal string `[placeholder]` (Assert 4 catches it if propagation didn't run)
- `[branch this worktree was forked from — the merge destination]` — current branch name captured at Pass 1 time; never a placeholder
- `[absolute path to main-repo-root]/.git/claude-merge.lock` — computed from `git rev-parse --show-toplevel` at Pass 1 time; never a placeholder
- `Isolation: native worktree` — for normal worktree tasks; for trivial main tasks, replace this entire line with: `Isolation: none (trivial)`
- `[absolute paths to test data, fixtures, …]` — local paths to symlink in worktree creation step; for remote URIs, paste full URI/endpoint
- `[Specific, actionable steps from the reviewer's output]`
- `[Exact file paths to read and/or modify]`

For trivial tasks: same template, except the `Isolation` line says `none (trivial)` and the agent will follow the trivial branch in `## Before return: commit` and `## Return when done`.

---

```
## Purpose
[Why this task exists — the specific finding or proposal it addresses]

## Type & relationships
Type: prep | main | validation
Parent proposal: [title]
Blocked by: [task IDs — must be completed first; "none" if no deps]
Unblocks: [task IDs — will be cleared when this completes; "none" if leaf]

## Execution context
Working branch: [current branch name]
Checkpoint SHA: [SHA from git prep checkpoint commit — use for rollback]
Target branch: [branch this worktree was forked from — the merge destination]
Merge lock:    [absolute path to main-repo-root]/.git/claude-merge.lock
Isolation: native worktree (isolation: "worktree" on Agent dispatch)
External resources: [absolute paths to test data, fixtures, or large files outside the git repo — see below]

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
[Specific, actionable steps from the reviewer's output]

For validation tasks — ALL of the following happen inside this agent:
  - Write the test (success path AND failure/error path)
  - Set up mocks: [which dependencies, what mock behavior]
  - Run: [test command]
  - If tests fail: read the error, fix the implementation or test, rerun
  - Keep fixing and retesting until the suite passes
  - Only stop and report failure if the error is unresolvable (missing dependency,
    broken tool, environment issue outside your control)

## Files
[Exact file paths to read and/or modify]

## Before return: commit
(isolated worktree) All changes must be committed so the merge step can pick them up. Without a commit, the merge will be a no-op.

From your current working directory (the worktree root):

  git status                              ← verify which files you changed
  git add <files you modified>            ← stage only files this task intentionally changed
  git commit -m "task-N: [what was done]" ← commit to the worktree branch

(trivial / main workspace) Same `git add` / `git commit` pattern, but you are in the main repo working tree and committing directly to the current working branch — there is no separate worktree branch and no merge step. The orchestrator serializes trivial / regression dispatch (one main-workspace agent in flight at a time), so there is no race.

Do NOT use `git add -A` — only stage files this task modified.
If this task made no file changes (e.g. read-only analysis), skip the commit and note it.

## Self-merge

After the commit succeeds, execute the self-merge. Do not skip this — the orchestrator expects STATUS: success to mean the branch is already merged and the worktree removed.

Substitute before running:
- `[Target branch]` → the value from `Target branch:` in Execution context
- `[Worktree path]` → absolute path to this worktree directory
- `[Worktree branch]` → the branch you committed to (e.g. task-6-branch)
- `[Merge lock]` → the value from `Merge lock:` in Execution context

```bash
REPO_ROOT=$(git -C "[Worktree path]" rev-parse --show-toplevel)
TARGET_BRANCH="[Target branch]"
WORKTREE_PATH="[Worktree path]"
WORKTREE_BRANCH="[Worktree branch]"
MERGE_LOCK="[Merge lock]"
MAX_RETRIES=5

attempt=0
while [ $attempt -lt $MAX_RETRIES ]; do
  attempt=$((attempt + 1))

  # Step 1 — Rebase onto latest target
  cd "$WORKTREE_PATH"
  git rebase "$TARGET_BRANCH"
  if [ $? -ne 0 ]; then
    git rebase --abort
    echo "STATUS: failure"
    echo "FAILURE_TYPE: conflict_needs_user"
    echo "ACTION: preserve_worktree"
    echo "WORKTREE: $WORKTREE_PATH"
    echo "BRANCH: $WORKTREE_BRANCH"
    echo "NOTES: Rebase onto $TARGET_BRANCH failed at attempt $attempt — true code conflict. Target branch: $TARGET_BRANCH"
    exit 1
  fi

  # Step 2 — Lock + merge
  RESULT=$(
    flock -x -w 120 9 || { echo "retry (lock timeout)"; exit 0; }
    cd "$REPO_ROOT"
    git merge --no-ff "$WORKTREE_BRANCH" -m "merge: $WORKTREE_BRANCH → $TARGET_BRANCH"
    if [ $? -eq 0 ]; then
      git worktree remove "$WORKTREE_PATH" --force
      git branch -d "$WORKTREE_BRANCH"
      echo "success"
    else
      git merge --abort
      echo "retry (merge conflict after rebase)"
    fi
  ) 9>"$MERGE_LOCK"

  case "$RESULT" in
    success*) break ;;
    retry*)   sleep $((attempt * 3)); continue ;;
  esac
done

if [ $attempt -ge $MAX_RETRIES ]; then
  echo "STATUS: failure"
  echo "FAILURE_TYPE: conflict_needs_user"
  echo "ACTION: preserve_worktree"
  echo "WORKTREE: $WORKTREE_PATH"
  echo "BRANCH: $WORKTREE_BRANCH"
  echo "NOTES: Exceeded $MAX_RETRIES rebase+merge attempts. Target branch: $TARGET_BRANCH"
  exit 1
fi
```

## Return when done

On SUCCESS (worktree tasks), end with:

```
STATUS: success
ACTION: none
NOTES: [files changed, what was accomplished; merge complete, worktree removed]
```

On SUCCESS for trivial tasks (Isolation: none), end with:

```
STATUS: success
ACTION: none
NOTES: [brief summary — files changed in main workspace, what was accomplished]
```

On FAILURE, end with:

```
STATUS: failure
FAILURE_TYPE: no_change | partial_change | test_failures | conflict_needs_user
ACTION: preserve_worktree | discard_worktree | none
  (no_change → discard; partial_change | test_failures → preserve; trivial task → none)
  (conflict_needs_user → preserve_worktree always; include "Target branch: <branch>" in NOTES)
WORKTREE: <your worktree path, or N/A if trivial task>
BRANCH: <your worktree branch, or N/A if trivial task>
NOTES: [what was attempted, what failed, relevant error messages or test output]
```

Orchestrator handles cleanup, halting, and dependent-task tracing on its own — only FAILURE_TYPE and ACTION are read.
```
