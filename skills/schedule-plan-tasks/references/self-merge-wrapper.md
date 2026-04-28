# Worktree Run-Agent Self-Merge Wrapper (verbatim)

This file holds the verbatim wrapper that the orchestrator appends to every isolated run-agent prompt in Step 4 of execute-plan. Orchestrator must `Read` this file, substitute `[TARGET_BRANCH]` with the `Target branch:` value from the task description, then append the wrapper (everything from the `---` below onward) verbatim to the Agent prompt. Do not paraphrase.

---

---
## Self-merge and completion (orchestrator-injected)

After committing your changes (## Before return: commit), run the self-merge below.
Do not skip — STATUS: success means the branch is already merged and the worktree removed.

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
TARGET_BRANCH="[TARGET_BRANCH]"
WORKTREE_PATH=$(pwd)
WORKTREE_BRANCH=$(git branch --show-current)
MAX_RETRIES=5

attempt=0
while [ $attempt -lt $MAX_RETRIES ]; do
  attempt=$((attempt + 1))

  git rebase "$TARGET_BRANCH"
  if [ $? -ne 0 ]; then
    git rebase --abort
    exit 2  # true conflict — not retryable
  fi

  cd "$REPO_ROOT"
  git merge --no-ff "$WORKTREE_BRANCH" -m "merge: $WORKTREE_BRANCH → $TARGET_BRANCH"
  if [ $? -eq 0 ]; then
    git worktree remove "$WORKTREE_PATH" --force
    git branch -d "$WORKTREE_BRANCH"
    exit 0
  fi

  git merge --abort
  cd "$WORKTREE_PATH"
  sleep $(( (attempt * 3) + (RANDOM % 3) ))
done
exit 1  # retries exhausted
```

**On exit 0 (success):** report:
```
STATUS: success
ACTION: none
NOTES: [files changed, what was accomplished; merge complete, worktree removed]
```

**On exit 1 or 2 (failure):** before reporting, the **orchestrator** (not this agent) must call TaskCreate with the following fields — this is a task-tool call for the orchestrator, not a bash command:

- subject: `"Investigate merge failure: <this task's subject>"`
- description (multiline):
  - `## Intention` — copy the ## Purpose section from your task description
  - `## What finished` — list every file changed and committed before the self-merge was attempted
  - `## What is incomplete` — list any work steps from ## What to do that did not complete, or "all work committed"
  - `## What failed` — Exit code: `1 = retries exhausted | 2 = rebase conflict`; Attempt count: N of MAX_RETRIES; Error output: paste the relevant git rebase / git merge error lines
  - `## Context` — Worktree: full absolute path (echo $WORKTREE_PATH); Branch: WORKTREE_BRANCH; Target branch: [TARGET_BRANCH]; Checkpoint SHA: from your task description's Checkpoint SHA field

Then report:
```
STATUS: failure
FAILURE_TYPE: conflict_needs_user
ACTION: preserve_worktree
WORKTREE: <full absolute path>
BRANCH: <worktree branch>
NOTES: [exit <code>; rebase conflict or retries exhausted; Target branch: [TARGET_BRANCH]]
```
---
