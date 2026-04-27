---
name: execute-plan
description: Use after a plan is approved in planning mode, OR after learnings have been gathered in session — converts either into self-contained tasks and executes them as a dependency-ordered task graph with native worktree isolation
---

# Execute Plan

## Overview

Two entry points, one execution engine. **Branch A** reads an approved plan file and extracts its steps as proposals. **Branch B** assesses session learnings and drafts proposals — this is in-session planning, producing identical output. After proposals exist, both branches follow the same path: triage, senior engineer review, then task-graph execution with native worktree isolation. Every unit of work — git prep, worktree creation, agent execution, merge-back — is a Task with explicit dependencies. Ordering emerges from the dependency graph, not explicit wave phases. Neither path skips the review agent — it is the correctness guarantee.

## Workflow

```
Step 1 — Get the Plan
  Branch A: Read approved plan file → extract steps as proposals
  Branch B: Git prime → assess learnings → draft proposals
          ↓ (both produce: proposals table + context)
TRIAGE → Express (≤3 small, no schema/migration) or Standard (4+ or any medium/large)
          ↓ Express                                ↓ Standard
Lightweight reviewer                               Step 0: Phase tracking (3 tasks)
→ APPROVED or ESCALATE ───────────────────────→   Step 2: Full review agent
  ↓ APPROVED    ↓ ESCALATE (→ Standard)           Step 3: Create task graph
Checkpoint +                                         Git prep tasks (serial)
Create + Run                                         Per-task: Create worktree →
serially                                               Run agent (isolated) →
Done                                                   Merge (serial chain)
                                                    Step 4: Execute task graph
                                                      (dispatch all with no
                                                       unsatisfied blockers)
```

---

### Step 1 — Get the Plan

**Git context prime** (if `.git` exists — skip all git commands if no repo, note "no git repo"):
- `git log -1 --oneline` — last commit SHA + message
- `git diff HEAD --name-only` — files currently modified (in-flight scope)
- If commit message is ambiguous, optionally: `git show --stat HEAD`

**Call `TaskList`** — note all tasks in the backlog (completed, in_progress, and pending). These are off-limits for new proposals.

**Identify external resources** (non-git files agents may need):

Run these discovery steps actively:
1. `cat .gitignore | grep -iE '(data|fixtures|test-data|dataset|large|samples)'` — find explicitly excluded data directories
2. Check test configuration files (`pytest.ini`, `jest.config.*`, `.env.test`, `conftest.py`) for DATA_DIR, FIXTURES_PATH, TEST_DATA, or similar path variables
3. `find . -maxdepth 3 -name "*.env*" -not -path "*node_modules*"` — surface path-bearing environment files

**Local filesystem resources** (directories, network mounts): note the absolute path. These will be symlinked into each worktree so agents access them at the same relative path.

**Remote resources** (S3 URIs, HTTP endpoints, database connection strings): do NOT attempt `ln -s`. Include the full URI/endpoint in the task description's External resources field — the agent must fetch or connect directly using those credentials/endpoints.

---

**Branch A — Plan file** (invoked after planning mode approval):

1. Read the approved plan file (path is in the planning mode context or current session)
2. For each step in the plan, extract a proposal:
   - `What` → step title
   - `Why` → step rationale / the Context section of the plan
   - `Scope` → estimate from step description (small / medium / large)
3. Note any files listed under each step → include in proposal context
4. Note any sequencing stated in the plan (step N requires step M) → pass as ordering hints to the reviewer; the reviewer confirms DEPENDS ON vs. independent — do not wire them yet
5. Note the plan's Verification section → seed for validation task suggestions
6. Set `{context}` = full plan file content

---

**Branch B — Learnings in session** (no plan file / invoked after exploration):

Summarize the learnings already gathered. The scope of "what's in flight" is:
- Uncommitted working tree changes (from `git diff HEAD --name-only` above)
- Commits on this branch not yet merged to the base branch (`git log <base>..HEAD --oneline`)

Do not re-explore beyond this scope. If a specific named gap requires it, limit re-exploration to that gap only.

**Findings to document:**
- What is broken, missing, or suboptimal?
- What patterns or root causes did you find?
- What constraints exist?

Set `{context}` = full findings text

---

**Both branches produce a proposals table** (excluding anything already in the backlog):

| # | What | Why | Scope |
|---|------|-----|-------|
| 1 | Example improvement | Finding or plan step that motivates it | small |

Do NOT call TaskCreate here. This is a draft only.

**Triage — choose execution path:**

Express requires ALL of the following:
- ≤3 proposals
- All scope = small
- No proposal touches a database, schema, migration, or shared config
- No proposal touches more than 3 files
- No API contract changes

If Express → print `Express path — N proposals` and continue to **Express Lightweight Review**.
If Standard → continue to **Step 0** (phase tracking).

---

### Express Lightweight Review

Dispatch a **foreground** review agent. Substitute before dispatching:
- `{existing_backlog_filtered}` → ALL in_progress tasks + 20 most recent pending tasks only
- `{proposals}` → markdown table from Step 1

**Lightweight reviewer prompt:**
```
You are validating N small proposals before direct execution.

## Existing Backlog
{existing_backlog_filtered}

## Proposals
{proposals}

For EACH proposal answer three questions:
- Duplicate of existing task? yes/no
- Prep work required before this can safely execute? yes/no
- Logical dependency on another proposal in this list? (proposal B requires proposal A's output to function) yes/no

If ANY answer is yes → respond with: ESCALATE: [reason]
If all answers are no for every proposal → respond with: APPROVED FOR EXPRESS
```

**If ESCALATE:** print the reason. Switch to Standard path — continue at Step 0 using the proposals already drafted in Step 1. Do not re-run Step 1.
**If APPROVED FOR EXPRESS:** continue to Express Execution.

### Express Execution

1. **Pre-flight staging check** (if git repo):
   - Run `git status` to see all uncommitted changes (staged, unstaged, untracked)
   - If any unstaged or untracked files are relevant to the tasks about to run, stage them now: `git add <relevant files>`
   - This ensures the checkpoint and agents work from a complete picture of current state

2. **Checkpoint commit**:
   - If no `.git` or working tree is already clean: skip — no commit needed
   - Otherwise: `git commit -m "checkpoint: pre-execution state"` — note the SHA
   - If execution fails mid-way: `git reset --hard <checkpoint-SHA>` to restore

3. **For each proposal in order** (no wave structure, no phase tracking tasks, no worktrees — main workspace only):
   - Create the task with a fully self-contained description (same format as Run agent task descriptions in Step 3, without worktree fields — Express runs in the main workspace)
   - Mark it `in_progress`
   - Run as a foreground Agent in the main workspace
   - After agent completes: `git commit -m "task-N: [title]"` — keeps each task's changes isolated for rollback
   - If agent succeeds: mark `completed`, proceed to next proposal
   - If agent fails: immediately run `git reset --hard <checkpoint-SHA>` to restore
     pre-execution state, then print the Express Execution Halted report and stop

   This one-at-a-time create+run loop limits orphan exposure to at most one task if execution fails mid-way.

   No `addBlockedBy` wiring is needed — APPROVED guarantees no prep tasks and no logical dependencies between proposals.

**Express completion report** — print one of the following when the loop ends:

On success:
  ## Express Execution Complete
  Branch: <current branch>
  Proposals executed: N
    ✓ task-1: [title] — <commit sha>
    ✓ task-2: [title] — <commit sha>
  Checkpoint SHA: <sha> (safe to discard if no issues found)

On failure mid-loop:
  ## Express Execution Halted
  Failed at: task-N — [title]
    [error details from agent]
  Completed before failure:
    ✓ task-1: [title]
  Rolled back to checkpoint SHA: <sha>

---

### Step 0 — Phase Tracking (Standard path only)

Create 3 tasks before doing anything else on Standard path:

| Subject | activeForm |
|---------|------------|
| Phase 1: Get the plan | Reading plan or assessing learnings → drafting proposals... |
| Phase 2: Senior engineer review | Senior engineer reviewing proposals... |
| Phase 3: Git prep → task graph execution | Wiring task graph and executing via dependency order... |

Mark Phase 1 `completed` immediately — it corresponds to Step 1 (already done before this step runs). Mark each subsequent phase `in_progress` when its step begins, `completed` when it ends.

---

### Step 2 — Review Agent (Standard path)

Mark Phase 2 `in_progress`. Print a separator, then dispatch:

```
---
**Dispatching senior engineer review** (N proposals)
---
```

**Runs FOREGROUND — wait for output before proceeding.**

Set Agent `description` to: `"Senior engineer review — evaluating N improvement proposals"`

Substitute before dispatching:
- `{context}` → Branch A: full plan file content | Branch B: full findings text from Step 1
- `{proposals}` → markdown table from Step 1
- `{existing_backlog_filtered}` → ALL in_progress tasks + 20 most recent pending tasks (same filter as Express; not the full backlog)

**Review agent prompt:**
```
You are a senior engineer reviewing improvement proposals.

## Context (plan file or session findings)
{context}

## Existing Backlog (do not propose duplicates of anything already in the backlog)
{existing_backlog_filtered}

## Proposed Improvements
{proposals}

## Your task

Step A — Review each proposal:
- Remove proposals that duplicate anything already in the backlog (completed, in_progress, or pending)
- Remove proposals that are vague, redundant, or low-value
- Add missing proposals the findings clearly call for
- Reprioritize by impact/effort ratio (high impact, low effort first)
- Split proposals that are too large to be a single task
- Rewrite unclear proposals to be specific and actionable

Step B — For each approved proposal:

First: mark Trivial: yes ONLY for proposals that are text/comment changes, renames with no
functional impact, or single-value config updates requiring no migration. Trivial proposals
skip the remaining Step B questions — output "Prep tasks: none" and "Validation tasks: none".

For non-trivial proposals, answer in this order:

1. "Does this task require preparatory work before it can safely execute?"
   If yes, list prep tasks. These must complete before the main task starts.
   Examples: data migrations, flag creation, baseline capture, schema changes.
   Name each prep task: "Pre-[main task title]: [specific action]"

2. "What is the validation strategy for this proposal?"
   Mark ONE per proposal — this decision determines whether per-task validation tasks are generated:
   - `validation: per-task` — complex or risky change; isolated tests run inside the task's own agent
   - `validation: deferred` — confident, simple change; no per-task tests; covered by final regression

3. "If validation: per-task — what specific tests are needed?"
   (Skip this question entirely for `validation: deferred` proposals)
   Consider: unit tests, integration tests, regression checks, smoke tests.
   For each test area:
   - Cover both success paths AND failure/error paths — do not test only the happy path.
   - Mock external dependencies where relevant; verify the mock in both success and failure cases.
   - Note which test runner the validation task uses (e.g., jest, pytest, go test, rspec).
   Each validation task runs entirely inside the agent (write, run, fix, rerun until passing).
   Name each: "Post-[main task title]: [specific validation]"

4. "Is a final regression task needed?"
   - Yes if ANY proposal is `validation: deferred`, or if proposals interact
   - No if all proposals are `validation: per-task` and independent
   If yes: name it "Regression: [scope — e.g., full auth suite]"
   It runs in the main workspace after all merges (no worktree).

Step C — Identify logical dependencies only.

File collisions are not a concern — every task runs in its own git worktree. Worktrees provide full isolation; changes merge back to the branch when the task completes. Do NOT list file collision as an ordering constraint.

Identify only LOGICAL DEPENDENCIES:
- **DEPENDS ON**: Task B logically requires Task A's output to function — B calls A's new function, uses A's output file as input, or requires A's migration to have completed. These must serialize.

Apply within each set: prep, main, validation.

## Output format:

=== PROPOSAL N: [title] ===
Trivial: yes/no
Why: [reason]
Scope: [small/medium/large]
Validation strategy: per-task | deferred | none (trivial)

Prep tasks:
- [title] — [why needed] — [scope]
(or: none)

Validation tasks (only if validation strategy = per-task):
- [title] — [what it validates, including mocks] — [test runner] — [scope]
(or: none — deferred to final regression)

=== ORDERING CONSTRAINTS ===
Logical dependencies only — file collision is not listed (worktrees handle it):

Prep: [task B] DEPENDS ON [task A] — [reason: B needs A's migration output]
Main: [task F] DEPENDS ON [task E] — [reason: F calls function E creates]
Validation: [task J] DEPENDS ON [task I] — [reason: J needs I's seed data]
(or: none for any set with no logical dependencies)

=== FINAL REGRESSION ===
(or: none)
Scope: [full suite description]
Runner: [test command — e.g., npm test, pytest, go test ./...]
What to confirm: [regression areas — e.g., auth flow, payment processing]

```

**Immediately after the agent returns**, print the changelog:
```
**Review complete:**
  ✓ Kept N    — unchanged
  ✗ Removed N — #3 (too vague), #7 (duplicate of existing task #42)
  ↑ Promoted N — #11 → position 1
  + Added N   — "Add OpenTelemetry tracing"
  ~ Trivial N — #2 #5 (no prep/validation generated)
```

Use the reviewer's output as the sole source of truth. Mark Phase 2 `completed`.

---

### Step 3 — Build the Task Graph (Standard path)

Mark Phase 3 `in_progress`.

**Git repo initialization guard** (runs before task creation):

```
If no .git directory exists:
  git init
  Create README.md: "# [project-name]\nInitialized [date]"
  git add README.md
  git commit -m "Initial commit"
  Capture: current branch name + HEAD SHA — use these in all task descriptions below
  Print: "Git repo initialized"
```

This must run before Pass 1 so task descriptions contain valid branch names and SHAs.

**Pass 1 — Create ALL tasks** in this order: git prep tasks, then per-original-task chains. Print a ticker as each is created.

**Git prep tasks (serial chain — created first):**
```
  [git-prep 1/3] Task #80: Git prep: Pre-flight staging check
  [git-prep 2/3] Task #81: Git prep: Checkpoint commit
  [git-prep 3/3] Task #82: Git prep: Setup .worktrees directory
```

**Per-original-task chains** (3 tasks each — create worktree, run agent, merge):
```
  [create-wt 1/3] Task #83: Create worktree: Pre-Refactor auth session: Audit storage
  [run-agent 1/3] Task #84: Run agent: Pre-Refactor auth session: Audit storage
  [merge     1/3] Task #85: Merge: Pre-Refactor auth session: Audit storage
  [create-wt 2/3] Task #86: Create worktree: Refactor auth session storage
  [run-agent 2/3] Task #87: Run agent: Refactor auth session storage
  [merge     2/3] Task #88: Merge: Refactor auth session storage
  ... (repeat for every prep, main, and per-task validation task)
  (deferred validation proposals: no validation chain — final regression covers them)
```

Trivial main tasks: create only the run-agent task — no prep or validation chains.

**Run agent task description must be fully self-contained.** Assume context may be cleared before execution:

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
Isolation: native worktree (isolation: "worktree" on Agent dispatch)
External resources: [absolute paths to test data, fixtures, or large files outside the git repo — see below]

## Directive
Execute completely. Do not pause to ask for confirmation. Do not stop at the first
obstacle — diagnose it, fix it, continue. Only report failure if the problem is
genuinely unresolvable (missing credentials, broken environment, unrecoverable error).

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

## Before returning — commit your changes
You are running inside an isolated worktree. All changes must be committed to the worktree
branch so the merge step can pick them up. Without a commit, the merge will be a no-op
and your changes will be lost.

From your current working directory (the worktree root):

  git status                              ← verify which files you changed
  git add <files you modified>            ← stage only files this task intentionally changed
  git commit -m "task-N: [what was done]" ← commit to the worktree branch

Do NOT use `git add -A` — only stage files this task modified.
If this task made no file changes (e.g. read-only analysis), skip the commit and note it.

## Return when done

On SUCCESS, end your response with exactly this block (substitute real values):

```
STATUS: success
ACTION: Create a Task — Merge from <worktree-branch> to <current-branch>
  Source branch: <the branch you committed to, e.g. task-84-branch>
  Target branch: <the branch you were working on, e.g. feature/auth>
  Worktree path: <your worktree directory, e.g. .worktrees/task-84>
  IMPORTANT: Do not conduct this merge concurrently with other merge operations.
NOTES: [brief summary — files changed, what was accomplished]
```

On FAILURE, end your response with exactly this block (choose the FAILURE_TYPE that applies):

```
STATUS: failure
FAILURE_TYPE: no_change | partial_change | test_failures
ACTION:
  1. Do NOT proceed with any task that depends on this one — halt their execution
  2. [no_change]      Discard worktree: git worktree remove <path> --force && git branch -D <branch>
     [partial_change] Preserve worktree at <path> for inspection — do not discard
     [test_failures]  Preserve worktree at <path> — test output is inside for review
  3. Surface this failure to the user before continuing any further execution
  4. If a full rollback is needed: git reset --hard <checkpoint-SHA recorded at start>
WORKTREE: <your worktree path>
BRANCH: <your worktree branch>
BLOCKED_DEPENDENTS: [task IDs that were waiting on this task and must now be halted]
NOTES: [what was attempted, what failed, relevant error messages or test output]
```

The orchestrator reads only this final block. The ACTION steps tell it exactly what to clean up, what to halt, and what to show the user — no orchestrator judgment required.
```
```

**Create worktree task description:**
```
## What to do
Important: each worktree gets its own fresh index (staging area). Only committed
changes in HEAD are automatically visible. Staged-but-uncommitted changes must be
applied separately. The pre-flight checkpoint commit handles this for the normal
path — verify HEAD contains everything needed before proceeding.

1. Create worktree from current branch HEAD (NOT from main — HEAD = current branch tip):
   git worktree add .worktrees/task-N -b task-N-branch HEAD

2. Symlink any external resources identified in Step 1 so the agent can access them
   at the same relative path it would use in the main workspace:
   ln -s /absolute/path/to/test-fixtures .worktrees/task-N/test-fixtures
   ln -s /absolute/path/to/large-dataset .worktrees/task-N/large-dataset
   (Symlinks are read-only references — agents can read but not accidentally commit these)

3. If any relevant working tree state remains uncommitted (edge case — should be rare
   after the checkpoint commit), pipe it into the worktree:
   git diff HEAD > /tmp/task-N-state.patch
   git -C .worktrees/task-N apply /tmp/task-N-state.patch
   rm /tmp/task-N-state.patch

4. Verify: git worktree list confirms task-N is present
```

**Merge task description** (filled in after run-agent completes with its result):
```
## What to do
Source branch: <branch from run-agent result>
Worktree path: <path from run-agent result>
Target: <current branch>

1. git merge <branch>
2. If conflicts: additive merge for non-overlapping regions;
   surface to user if semantic judgment needed
3. git worktree remove <path>
4. git branch -d <branch>

SERIALIZE: this task is blocked until the previous Merge task completes.
Do not run merge operations in parallel.

## Return when done
End your response with exactly:
  STATUS: success | conflict_resolved | conflict_needs_user
  BRANCH_MERGED: <branch name>
  NOTES: [conflict details if any, otherwise "clean merge"]
```

---

**Pass 2 — Wire ALL dependencies** in one scan:

Wire in this order (use `TaskUpdate addBlockedBy`):

**Git prep chain:**
1. `Git prep: Checkpoint commit` blocked by `Git prep: Pre-flight staging check`
2. `Git prep: Setup .worktrees` blocked by `Git prep: Checkpoint commit`

**Create worktree tasks:**
3. All `Create worktree` tasks blocked by `Git prep: Setup .worktrees`
4. `Create worktree` for each main task also blocked by the last Merge task of its prep tasks (so worktrees branch from HEAD after prep merges). If the main task has no prep tasks, rule 4 does not apply — rule 3 is sufficient.
5. `Create worktree` for each validation task also blocked by the last Merge task of its main tasks.

**Run agent tasks:**
6. Each `Run agent: task-N` blocked by its `Create worktree: task-N`
7. Logical DEPENDS ON constraints from reviewer → applied to `Run agent` tasks

**Merge tasks — one global linear chain:**
8. Each `Merge: task-N` blocked by its `Run agent: task-N`
9. Form one global linear chain across all merges in this order: [prep merges in creation order] → [main merges in creation order] → [validation merges in creation order]. Each merge is blocked by exactly the one before it in this chain. This makes merges strictly serial across all categories.

**Final regression task (if present):**
10. The `Regression: [scope]` task is blocked by the very last Merge task in the global chain. It runs in the main workspace after all changes are merged — no worktree, no create-wt task needed. Wire it as: `Regression task` blocked by `last Merge task ID`.

Skip `addBlockedBy` for any task whose blockers list is empty.
Match reviewer-output task titles to IDs assigned in Pass 1.

**Print the final task graph:**

```markdown
## Task Graph — N Tasks

| ID  | Type      | Subject                          | Blocked by      |
|-----|-----------|----------------------------------|-----------------|
| #80 | git-prep  | Pre-flight staging check         | —               |
| #81 | git-prep  | Checkpoint commit                | #80             |
| #82 | git-prep  | Setup .worktrees directory       | #81             |
| #83 | create-wt | Create worktree: Audit storage   | #82             |
| #84 | run-agent | Run agent: Audit storage         | #83             |
| #85 | merge     | Merge: Audit storage             | #84             |
| #86 | create-wt | Create worktree: Refactor auth   | #82 #85         | ← #82=worktrees setup, #85=prep merge (branch from updated HEAD)
| #87 | run-agent | Run agent: Refactor auth         | #86             |
| #88 | merge     | Merge: Refactor auth             | #87 #85         | ← #87=agent done, #85=serial merge chain (prev merge)
| ... | ...       | ...                              | ...             |
```

---

### Step 4 — Execute Task Graph (Standard path)

**Execution loop** — repeat until all tasks are complete:

```
1. Query: all tasks with no unsatisfied blockers (blocker satisfied = status completed)
2. If none found but incomplete tasks remain → halt
   Report which tasks are stuck and the IDs of their unsatisfied blockers.
3a. Partition dispatchable tasks:
      inline tasks      = git-prep, create-wt   (orchestrator executes directly)
      isolated agents   = run-agent              (dispatched with isolation: "worktree")
      standard agents   = merge, regression      (dispatched as foreground Agent, main workspace)
3b. Execute each inline task immediately and sequentially:
      - Run the git command
      - If successful: mark task completed
      - If failed: halt, report error, do not mark completed
3c. Dispatch all isolated and standard agent tasks in one message (foreground, parallel)
4.  Wait for all agent tasks to complete
5.  For each returned agent result:
      Run agent result: read the final STATUS block
        - On success: extract the ACTION line — it contains the source branch, target
          branch, and worktree path. Call TaskUpdate on the corresponding Merge task to
          write these values into its description. Only THEN mark Run agent completed.
          Do NOT dispatch the Merge task until TaskUpdate has been called — the Merge
          task description is incomplete until this step runs.
          The ACTION line is the sole handoff — create no other merge tasks from this.
        - On failure: read the FAILURE_TYPE and ACTION block.
          Execute ACTION steps 1–4 in order: halt dependent tasks, clean up or
          preserve worktree per the instructions, then surface NOTES to the user.
          Mark this task failed. Do not continue the execution loop.
      Merge agent result: extract {status}
        - On success: mark Merge completed (unblocks next Merge in chain)
        - On failure: report conflict details, pause for user resolution
      Regression agent result: extract {status}
        - On success: mark Regression completed — execution is fully done
        - On failure: report which tests failed, pause for user resolution
6.  Repeat
```

**"Just in time" principle:** the main context holds only the task graph. Each agent receives exactly the context it needs in its task description. Agents return structured results that tell the orchestrator what to do next — the orchestrator does not need to plan ahead.

---

**Git prep task execution** (inline, step 3b):

`Git prep: Pre-flight staging check`:
- Run `git status` — show all uncommitted changes (staged, unstaged, untracked)
- Stage any relevant files: `git add <relevant files>` (not `git add -A`)
- Critical: worktrees get their own fresh index (staging area) — only files in HEAD
  are visible to agents. Staging here ensures the checkpoint commit puts them in HEAD.

`Git prep: Checkpoint commit`:
- If working tree has staged changes: `git commit -m "checkpoint: pre-execution state"` — capture the SHA
- If clean: use current HEAD as the SHA
- Rollback if needed: `git reset --hard <checkpoint-SHA>`
- **After marking complete:** call `TaskUpdate` on ALL run-agent task descriptions to replace
  the `Checkpoint SHA: [placeholder]` field with the actual SHA captured above.
  This must happen before any run-agent task is dispatched.

`Git prep: Setup .worktrees directory`:
- Check: `.worktrees/` or `worktrees/` exists → use it
- Neither → create `.worktrees/`, add to `.gitignore`, commit: `git commit -m "chore: add .worktrees to .gitignore"`
- Verify gitignored: `git check-ignore -q .worktrees`

**Create worktree task execution** (inline, step 3b):
- Run: `git worktree add .worktrees/task-N -b task-N-branch HEAD`
- For each local filesystem external resource identified in Step 1:
  `ln -s /absolute/path .worktrees/task-N/<relative-name>`
  (Skip remote resources — they go in the task description as URIs, not symlinks)
- Verify: `git worktree list` confirms task-N is present
- If successful: mark task completed (unblocks its Run agent task)

---

**Run agent task execution** (agent task, step 3c):

Each run-agent task is dispatched with `isolation: "worktree"`. The task description is fully self-contained — the agent needs nothing from the main context.

The agent's output format is defined in the task description's "Return when done" block: a STATUS/ACTION block on success, or a STATUS/FAILURE_TYPE/ACTION block on failure. The orchestrator reads this block and acts on the ACTION line.

**Do not use `run_in_background`** — no mechanism to trigger dependent tasks.

---

**Merge task execution** (agent task, step 3c — serial by dependency chain):

Each merge agent receives a self-contained description with the source branch, target branch, and conflict guidance. The agent is isolated and focused — its only job is merging one branch.

**Agent result format (merge):**
```
STATUS: success | conflict_resolved | conflict_needs_user
BRANCH_MERGED: <branch name>
NOTES: [conflict details if any]
```

On success or conflict_resolved: mark Merge task completed (unblocks next Merge in chain).
On conflict_needs_user: pause — surface NOTES to user, wait for resolution before continuing.

---

**Regression task execution** (standard agent, step 3c — runs in main workspace, no worktree):

The regression agent receives a self-contained task description built from the reviewer's `=== FINAL REGRESSION ===` output. It runs in the main workspace where all changes have already been merged.

**Regression task description:**
```
## Purpose
Final regression suite — confirms no regressions across all merged changes.

## What to do
Run: [runner from reviewer output]
Confirm: [regression areas from reviewer output]
All tests must pass. If any fail: investigate, attempt fix, rerun.
Do NOT return until suite passes or failure is confirmed unresolvable.

## Return when done
End your response with exactly:
  STATUS: success | failure
  NOTES: [list any failing tests and attempted fixes, or "all tests passed"]
```

**Agent result format (regression):**
```
STATUS: success | failure
NOTES: [failing tests, root cause if known]
```

On success: mark Regression completed — Phase 3 done.
On failure: report NOTES to user, pause for resolution.

---

**Completion reporting — print one of the following when execution ends:**

---

**On full success** (all tasks completed):

```
## Execution Complete ✓

Merged to branch: <current branch>
Tasks completed: N

  ✓ [type] #ID  Subject
  ✓ [type] #ID  Subject
  ... (all completed tasks in execution order)

Changes are fully merged. Checkpoint SHA: <sha> (safe to discard if no issues found)
```

---

**On failure** (loop halted):

```
## Execution Halted ✗

FAILED: [type] #ID  <subject>
  Reason: <FAILURE_TYPE> — <NOTES from the agent>
  Worktree: <path> (preserved for inspection | discarded)

Blocked by this failure:
  ✗ [type] #ID  <subject>  — halted (blocked by #<failed ID>)
  ✗ [type] #ID  <subject>  — halted (blocked by #<above ID>)
  ... (full dependency chain downstream of the failure)

Completed before failure:
  ✓ [type] #ID  <subject>
  ... (all tasks that did complete)

Not yet started:
  ○ [type] #ID  <subject>  — never reached

Options:
  • Inspect worktree: cd <preserved path>
  • Rollback all changes: git reset --hard <checkpoint-SHA>
  • Fix and retry: resolve the failure, then re-run the failed task
```

The "Blocked by this failure" section must trace the full dependency chain. Algorithm: starting from the failed task ID, recursively collect all tasks whose "Blocked by" field includes it or any already-collected ID. Report these in topological order (closest dependents first).

Mark Phase 3 `completed` when all tasks reach `completed` status.

---

## Iron Law

**Do NOT call TaskCreate before the review step completes (Express lightweight or Standard full).**
**Do NOT begin execution before Pass 2 wiring in Step 3 is complete.**
**Do NOT skip Step 4 (Standard path) — every approved task executes immediately after wiring is complete.**
**Do NOT dispatch a Run agent task before its Create worktree task has status `completed`.**
**Do NOT run Merge tasks in parallel — each must wait for the previous Merge to complete.**
**Do NOT halt execution on a stuck task without first checking: is its blocker actually completed?**
**Do NOT use Express path if any proposal involves DB, schema, migration, or shared config changes.**
**Do NOT skip the checkpoint commit on Express path.**
**Express path is NOT a shortcut past correctness — the lightweight reviewer can and will escalate.**

**Agents MUST bias toward action:** diagnose obstacles, fix them, continue. Stop only on genuine
fatality (missing credentials, broken environment, unrecoverable state). Do not pause, do not ask
permission, do not stop at the first difficulty.

No exceptions:
- Not for "obvious" tasks
- Not for "placeholder" tasks
- Not because the review agent feels like overhead
- Not because "I'll run the tasks later"
- Not because "these tasks clearly have no logical dependencies"
- Not because "I hit an error" — diagnose and fix it first

## Common Rationalizations — All Wrong

| Excuse | Reality |
|--------|---------|
| "These proposals are obviously correct" | Obvious to you ≠ reviewed. Run the agent. |
| "I'll add a placeholder task and fill it in later" | Wrong direction. Review first, then task. |
| "The user already approved this work" | Approving work ≠ approving these specific tasks. |
| "Spawning a review agent is overkill here" | If you have proposals, you have time for review. |
| "I'll just add one task quickly" | One unreviewed task is one too many. |
| "The review agent errored, I'll skip it" | Retry. A failed review is not an approved review. |
| "I'll use run_in_background for the first batch" | Background has no trigger for dependent tasks. All dispatch is foreground. |
| "These tasks clearly have no logical dependencies" | The reviewer checks this. Trust the output, not your intuition. |
| "I'll wire deps after the first round of tasks" | All wiring (Pass 2) must complete before the execution loop starts. |
| "Express means I skip the reviewer" | Express runs a lightweight reviewer that can escalate. |
| "ESCALATE just means retry Express" | ESCALATE means switch to Standard. Not negotiable. |

## Red Flags — STOP

- About to call TaskCreate before the review step returns
- About to start the execution loop before Pass 2 wiring is complete
- Using `run_in_background` for any agent task dispatch
- Treating your own draft as the approved list
- Skipping `addBlockedBy` because tasks "seem independent"
- Ignoring an Express reviewer ESCALATE and proceeding as Express anyway
- Using `git add -A` for the checkpoint commit without reviewing what's staged

**All of these mean: stop, follow the full workflow.**
