---
name: execute-plan
description: Use after a plan is approved in planning mode, OR after learnings have been gathered in session — converts either into self-contained tasks and executes them as a dependency-ordered task graph with native worktree isolation. Sub-agent prompts (full reviewer, run-agent description) are loaded just-in-time from references/.
---

# Execute Plan

## Overview

Two entry points, one execution engine. **Branch A** reads an approved plan file and extracts its steps as proposals — the plan was reviewed before `ExitPlanMode`, so it goes straight to task-graph execution. **Branch B** assesses session learnings, drafts proposals from session state, and runs them through the senior engineer reviewer (the correctness guarantee for freshly-drafted proposals). Both branches converge into the same task-graph executor with native worktree isolation. Every unit of work — git prep, worktree creation, agent execution, merge-back — is a Task with explicit dependencies. Ordering emerges from the dependency graph. The merge-back step explicitly removes the worktree and deletes its branch.

**References model:** Two of the longest sub-agent prompts live in `references/*.md` and are loaded just-in-time. Citation rule (binding): when a step says "Read references/X then dispatch", you MUST `Read` that file and paste its content verbatim into the Agent dispatch. Do not paraphrase, summarize, or "improve". Once Read in a session, the file content stays in context — re-Read only if it scrolls out.

---

## Modes

The skill runs in one of three modes, decided at the top of Step 0 by inspecting skill arguments:

| Mode               | Trigger flag           | Behavior                                                                                          |
|--------------------|------------------------|---------------------------------------------------------------------------------------------------|
| `live`             | (no flag)              | Default. Real TaskCreate, real git operations, real Agent dispatches. Current production path.    |
| `dry-run`          | `--dry-run`            | Read-only simulation. Every side-effecting verb is replaced with a print + ledger update. No real TaskCreate, no git mutations, no run-agent / merge / regression dispatch. |
| `dry-run-analyze`  | `--dry-run-analyze`    | Same as `dry-run`, then dispatches an analyzer Agent on the printed Dry-Run Report to flag wiring errors, missing dependencies, mis-classified isolation, and anti-patterns. |

**`Mode` is set in Step 0 before any side-effecting action** and threaded through every TaskCreate / TaskUpdate / git / Agent verb downstream. Live mode is the default and is unaffected by the guards — the dry-run substitutions are no-ops when `Mode == live`.

**What dry-run does NOT skip** (read-only, kept real for fidelity):
- Reading the plan file (Branch A) or scanning recent work (Branch B)
- TaskList preflight, git context prime (`git log`, `git diff`, `git status`)
- External resource scan
- **Branch B senior reviewer Agent dispatch** — runs for real (no side effects beyond token cost; realism is the point)
- Wiring integrity check — runs in-memory against the simulated ledger
- Execution-loop walk — fully simulated, iteration by iteration, against the in-memory ledger

**What dry-run DOES skip** (substituted with a print):

| Live verb                                          | Dry-run substitution                                                                                          |
|----------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| `ExitPlanMode`                                     | print `[DRY] would ExitPlanMode` (stay in plan mode if active)                                                |
| `TaskCreate`                                       | print `[DRY] would TaskCreate #DRY-N: <subject>`, append to **simulated backlog ledger** with full description |
| `TaskUpdate addBlockedBy`                          | print `[DRY] would addBlockedBy #DRY-N ← #DRY-M`, update ledger                                               |
| `TaskUpdate` (Merge description fill-in)           | print `[DRY] would TaskUpdate #DRY-N description: <text>`, update ledger                                      |
| Git-prep commands (`git status`, `git add`, `git commit`, etc.) | print `[DRY] would run: <cmd>`                                                                   |
| `git worktree add`                                 | print `[DRY] would create worktree: <path> from <SHA>`                                                        |
| `git worktree remove` + `git branch -d`            | print `[DRY] would remove worktree + delete branch`                                                           |
| `git merge`                                        | print `[DRY] would merge <branch> into <target>`                                                              |
| Agent dispatch — run-agent (worktree)              | print `[DRY] would dispatch worktree run-agent for #DRY-N` + simulated `STATUS: success ACTION: Create a Task BRANCH: task-N WORKTREE: .worktrees/task-N TARGET: <current>` |
| Agent dispatch — run-agent (trivial)               | print `[DRY] would dispatch trivial run-agent for #DRY-N` + simulated `STATUS: success ACTION: none`           |
| Agent dispatch — Merge                             | print `[DRY] would dispatch merge agent for #DRY-N` + simulated `STATUS: success BRANCH_MERGED: task-N NOTES: clean merge` |
| Agent dispatch — Regression                        | print `[DRY] would dispatch regression agent` + simulated `STATUS: success NOTES: all tests passed`            |

Simulated agent results are **happy-path only**. Dry-run validates the graph and ordering; it does NOT exercise drain-first / halt-report / pending_conflicts / resume — those paths can only be tested in live mode.

**Simulated backlog ledger** — an in-memory list of faux-Task entries `{id: DRY-N, type, subject, description, blocked_by[]}` accumulated by Pass 1 and mutated by Pass 2 + the simulated execution loop. The ledger is the source of truth for the wiring integrity check, the simulated execution trace, and the Dry-Run Report at end of Step 4.

---

### Step 0 — Task API Preflight

**Mode detection (binding, runs FIRST — before any side-effecting action):** inspect the skill arguments.
- Args contain `--dry-run-analyze` → `Mode = dry-run-analyze`
- Args contain `--dry-run` → `Mode = dry-run`
- Otherwise → `Mode = live`

Print the active mode banner once:
```
## execute-plan — Mode: <live|dry-run|dry-run-analyze>
```
For dry-run / dry-run-analyze, also print:
```
[DRY] Side-effecting verbs (TaskCreate, TaskUpdate, git mutations, run-agent / merge / regression dispatch) will be replaced with prints. Read-only operations (plan read, git context prime, Branch B reviewer) run normally.
```

Initialize an empty in-memory simulated backlog ledger when `Mode != live`. Assign IDs `DRY-1`, `DRY-2`, … in TaskCreate order.

`TaskList`. If errors:
- Print: `Task API unavailable: [error]`
- Print: `execute-plan requires TaskCreate, TaskUpdate, TaskList. Halting before review agent dispatch.`
- STOP. No review dispatch. No tasks created.

If TaskList succeeds, continue. Narrate progress in plain prose — do not create phase-tracking tasks.

---

### Step 1 — Get the Plan

**Plan-mode preflight (binding):** if invoked while plan mode is active, call `ExitPlanMode` immediately after confirming the plan file is readable (Branch A) or as the first action of this step (Branch B). The plan is already approved — do not stall waiting for the user to exit. If `ExitPlanMode` is unavailable (host is not in plan mode), this is a no-op.

**Git context prime** (skip all git commands if no `.git`, note "no git repo"):
- `git log -1 --oneline` — last commit SHA + message
- `git diff HEAD --name-only` — files currently modified
- If commit message is ambiguous: `git show --stat HEAD`

**Call `TaskList`** — note all tasks in the backlog (completed, in_progress, pending). These are off-limits for new proposals.

**Identify external resources** (non-git files agents may need):
1. `cat .gitignore | grep -iE '(data|fixtures|test-data|dataset|large|samples)'`
2. Check test config (`pytest.ini`, `jest.config.*`, `.env.test`, `conftest.py`) for DATA_DIR, FIXTURES_PATH, etc.
3. `find . -maxdepth 3 -name "*.env*" -not -path "*node_modules*"`

Local resources → note absolute path (will be symlinked into each worktree). Remote resources (S3, HTTP, DB strings) → include the full URI in the task's External resources field; do NOT `ln -s`.

---

**Branch A — Plan file:**

1. Read the approved plan file (path is in planning mode context or current session)
2. For each step, extract proposal: `What`=step title; `Why`=rationale/Context; `Scope`=small|medium|large
3. Note files listed under each step → include in proposal context
4. Note sequencing (step N requires step M) → record as logical DEPENDS ON hints; Pass 2 rule 8 wires these onto run-agent tasks
5. Note plan's Verification section → seed for validation tasks
6. `{context}` = full plan file content

**Branch B — Learnings (no plan file):**

Scan recent work and draft proposals:
1. `git log -10 --oneline` — what just shipped
2. `git diff HEAD --name-only` — uncommitted work
3. Conversation context — what the user was just working on, what was deferred or "left to user"

From those signals, draft 1–5 proposals. Bias toward drafting; the senior reviewer (Step 2) prunes the weak ones. If the scan finds nothing actionable (no recent commits, clean tree, no conversation signal), say so plainly and stop — no proposals, no Step 2 dispatch.

`{context}` = concise findings narrative covering points 1–3.

---

**Both branches produce a proposals table** (excluding anything already in backlog):

| # | What | Why | Scope |
|---|------|-----|-------|
| 1 | Example improvement | Finding or plan step that motivates it | small |

Draft only — no TaskCreate yet.

**Routing (binding, decided silently — never ask the user):**
- **Branch A (plan file present):** the plan was already reviewed and explicitly approved via `ExitPlanMode`. **Skip Step 2.** Proposals are the source of truth; sequencing comes from "step N requires step M" hints noted in Step 1; regression scope comes from the plan's Verification section. Trivial flag: any plan step the user/plan annotated as trivial (rename, comment, single-line config) — otherwise treat as full main task.
- **Branch B (no plan file):** proposals were freshly drafted from session state — proceed through Step 2 for vetting.

The execution mode (worktree vs serial main-workspace) is decided per-proposal, not as a global path: trivial proposals run inline in the main workspace; non-trivial proposals run in worktrees with a Merge task. The mechanism is the `Isolation:` line on each run-agent task (`native worktree` vs `none (trivial)`) — see the task-type contract in Step 4.

---

### Step 2 — Review Agent (Branch B only)

**Skip this step entirely on Branch A** (plan was already reviewed before `ExitPlanMode`). Branch A proceeds directly to Step 3 with proposals, plan-derived sequencing hints, and the plan's Verification section as the regression seed.

Print:
```
---
**Dispatching senior engineer review** (N proposals)
---
```

**Runs FOREGROUND — wait for output before proceeding.**

Agent `description`: `"Senior engineer review — evaluating N improvement proposals"`.

Substitutions:
- `{context}` → full findings text
- `{proposals}` → markdown table from Step 1
- `{existing_backlog_filtered}` → ALL in_progress + 20 most recent pending (NOT full backlog)

**Dispatch protocol (binding):**
1. **FIRST: `Read references/reviewer-full.md`** — load the verbatim prompt into context.
2. **THEN:** Dispatch the Agent with that prompt verbatim, substituting placeholders. Do not paraphrase, summarize, or rewrite.

**On agent return**, print changelog:
```
**Review complete:**
  ✓ Kept N    — unchanged
  ✗ Removed N — #3 (too vague), #7 (duplicate of existing task #42)
  ↑ Promoted N — #11 → position 1
  + Added N   — "Add OpenTelemetry tracing"
  ~ Trivial N — #2 #5 (no prep/validation generated)
```

Reviewer's output is the sole source of truth. Auto-continue to Step 3 — no confirmation gate.

---

### Step 3 — Build the Task Graph

**Git repo guard** (before Pass 1): if no `.git`, halt with `No git repo — initialize one (git init + initial commit) and re-run /execute-plan.` Plan execution does not bootstrap repos.

**Mode-aware verb guards (binding for both passes):**
- `Mode == live` → call `TaskCreate` / `TaskUpdate` for real, exactly as today.
- `Mode != live` → DO NOT call `TaskCreate` or `TaskUpdate`. Instead:
  - For each TaskCreate: print `[DRY] would TaskCreate #DRY-N: <subject>`, append `{id: DRY-N, type, subject, description, blocked_by: []}` to the simulated backlog ledger using the next sequential `DRY-N` id. Use the same `description` text the live path would have written (run-agent description from `references/run-agent-description.md`, create-wt bash block, Merge/Regression description templates).
  - For each TaskUpdate `addBlockedBy`: print `[DRY] would addBlockedBy #DRY-N ← #DRY-M`, mutate the ledger entry's `blocked_by` array.
  - For each TaskUpdate description fill-in: print `[DRY] would TaskUpdate #DRY-N description: <text>`, mutate the ledger entry's `description`.
- The Pass 1 ticker output is identical in both modes — it just shows `#DRY-N` instead of real `#80` IDs in dry-run.
- Substitute `#DRY-N` everywhere a real task ID would have appeared in subsequent print output (graph table, execution trace).

**Pass 1 — Create ALL tasks** (git-prep first, then per-original-task chains). Print ticker.

```
[git-prep 1/4] Task #80: Git prep: Pre-flight staging check
[git-prep 2/4] Task #81: Git prep: Checkpoint commit
[git-prep 3/4] Task #82: Git prep: Propagate checkpoint SHA
[git-prep 4/4] Task #83: Git prep: Setup .worktrees directory

[create-wt 1/3] Task #84: Create worktree: Pre-Refactor auth session: Audit storage
[run-agent 1/3] Task #85: Run agent: Pre-Refactor auth session: Audit storage
[merge     1/3] Task #86: Merge: Pre-Refactor auth session: Audit storage
... (repeat for every prep, main, and per-task validation task)
(deferred-validation proposals: no validation chain — final regression covers them)
```

**Trivial main tasks:** create only the run-agent task (no prep/validation chains). In its Execution context, replace the entire `Isolation` line with `Isolation: none (trivial)`.

**Run-agent description (binding dispatch protocol):**
1. **FIRST: `Read references/run-agent-description.md`** — load the verbatim template.
2. **THEN:** Substitute placeholders per task, paste verbatim into `TaskCreate.description`. Do not paraphrase.

**Create worktree task:** the description is the bash block in "Create worktree task prompt format" below — that bash block IS the description. No prose form.

**Merge task description** (filled in after run-agent completes):
```
## What to do
Source branch: <branch from run-agent result>
Worktree path: <path from run-agent result>
Target: <current branch>

1. git merge <branch>
2. If conflicts: additive merge for non-overlapping regions; surface to user if semantic judgment needed
3. git worktree remove <path>
4. git branch -d <branch>

SERIALIZE: this task is blocked until the previous Merge task completes. Do not run merge operations in parallel.

## Return when done
End with:
  STATUS: success | conflict_resolved | conflict_needs_user
  BRANCH_MERGED: <branch name>
  NOTES: [conflict details if any, otherwise "clean merge"]
```

---

**Pass 2 — Wire ALL dependencies** in one scan (use `TaskUpdate addBlockedBy`):

**Git prep chain:**
1. `Checkpoint commit` blocked by `Pre-flight staging check`
2. `Propagate checkpoint SHA` blocked by `Checkpoint commit`
3. `Setup .worktrees` blocked by `Propagate checkpoint SHA`

**Create worktree:**
4. All `Create worktree` tasks blocked by `Setup .worktrees`
5. `Create worktree` for each main task also blocked by the last Merge task of its prep tasks (so it branches from updated HEAD). If main task has no prep, rule 5 N/A — rule 4 sufficient.
6. `Create worktree` for each validation task also blocked by the last Merge task of its main tasks.

**Run agent:**
7. Each `Run agent: task-N` blocked by its `Create worktree: task-N` (trivial run-agents skip — per contract)
8. Logical DEPENDS ON constraints → applied to `Run agent` tasks. Source: Branch A — plan's "step N requires step M" sequencing hints from Step 1; Branch B — reviewer output.

**Merge — one global linear chain:**
9. Each `Merge: task-N` blocked by its `Run agent: task-N`
10. Form one global linear chain: [prep merges in creation order] → [main merges in creation order] → [validation merges in creation order]. Each merge blocked by exactly the prior one. Strictly serial.

**Final regression (if present):**
11. `Regression: [scope]` blocked by the last Merge in the global chain. Runs in main workspace after all merges (no worktree, no create-wt).
    → Fallback: if no Merge tasks exist (all-trivial plan), block by the last run-agent in creation order.

**Regression task description** (source: Branch A → plan's Verification section; Branch B → reviewer output):
```
## Purpose
Final regression suite — confirms no regressions across all merged changes.

## What to do
Run: [runner from plan Verification or reviewer output]
Confirm: [regression areas from plan Verification or reviewer output]
All tests must pass. If any fail: investigate, attempt fix, rerun.
Do NOT return until suite passes or failure is confirmed unresolvable.

## Return when done
End with:
  STATUS: success | failure
  NOTES: [list any failing tests and attempted fixes, or "all tests passed"]
```

Skip `addBlockedBy` for any task whose blockers list is empty. On Branch B, match reviewer-output titles to Pass 1 IDs.

**Print final task graph:**
```markdown
## Task Graph — N Tasks

| ID  | Type      | Subject                          | Blocked by      |
|-----|-----------|----------------------------------|-----------------|
| #80 | git-prep  | Pre-flight staging check         | —               |
| #81 | git-prep  | Checkpoint commit                | #80             |
| ... | ...       | ...                              | ...             |
| #87 | create-wt | Create worktree: Refactor auth   | #83 #86         | ← #83=worktrees setup, #86=prep merge
| #89 | merge     | Merge: Refactor auth             | #88 #86         | ← #88=agent done, #86=serial merge chain
```

---

### Step 4 — Execute Task Graph

**Mode-aware execution guards (binding):**
- `Mode == live` → run the loop exactly as specified below: real git-prep commands, real create-wt background Tasks, real run-agent / merge / regression Agent dispatches.
- `Mode != live` → run the **simulated execution loop** against the in-memory ledger from Step 3. Same partition logic, same parallelism rules; every dispatch is replaced with a print + a happy-path simulated result, and the loop marks ledger entries as virtually `completed`. The wiring integrity check below runs against the ledger. The resume check is **skipped** in dry-run (no real `in_progress` ever exists).

**Task-type contract** (authoritative — sections below cite this; do not duplicate inline):

| Task type           | Identity                    | Has create-wt? | Has Merge? | Asserts | Resume method                   | Dispatch lane         | Halt: show worktree? |
|---------------------|-----------------------------|----------------|------------|---------|---------------------------------|-----------------------|----------------------|
| run-agent worktree  | `Isolation: native worktree`| yes            | yes        | 1, 4    | branch commits since checkpoint | parallel worktree     | yes                  |
| run-agent trivial   | `Isolation: none (trivial)` | no             | no         | 4       | git log title vs checkpoint     | serial main-workspace | no                   |
| merge               | type=merge                  | n/a            | self       | 2       | check branch in HEAD merges     | serial main-workspace | no                   |
| regression          | type=regression             | no             | no         | 5       | re-run agent                    | serial main-workspace | no                   |
| create-wt           | type=create-wt              | self           | n/a        | 3       | `git worktree list`             | parallel background   | n/a                  |
| git-prep            | type=git-prep               | n/a            | n/a        | —       | re-run command (idempotent)     | inline (orchestrator) | n/a                  |

**Initialize session state** (once):
```
pending_conflicts = []   ← session-scoped; persists across loop iterations
```

**Wiring integrity check** (inline, runs once before resume check):

Scan task list and assert. On any failure: print violation and halt — do not proceed.

```
For every Run agent task:
  Assert 1: Exactly one Merge task exists whose blockers list includes this run-agent task ID. (trivial run-agents excluded — per contract)
  → Violation: "Run agent #N has no corresponding Merge task blocked by it. Pass 2 is incomplete."

For every Merge task:
  Assert 2: That Merge task is blocked by exactly one run-agent task (its own pairing).
  → Violation: "Merge #N is not blocked by any run-agent task. Pass 2 is incomplete."

For every Create worktree task for a main or validation proposal (not a prep-task worktree):
  Assert 3: Its blockers include at least one Merge task (last prep merge, or last main merge for validation).
  → Exception: If the proposal has no prep tasks, this worktree is blocked only by Setup .worktrees — valid; skip Assert 3.
  → Violation: "Create worktree #N for [main/validation] has no Merge blocker. It may branch from stale HEAD."

For every run-agent task description:
  Assert 4: The description does not contain the literal string "[placeholder]" in the Checkpoint SHA field.
  → Violation: "Checkpoint SHA propagation incomplete — run-agent #N still has [placeholder]. Re-run the Propagate checkpoint SHA task."

For every Regression task (zero or one in graph):
  Assert 5: It is blocked by exactly one task — the last Merge in the global chain, or (all-trivial fallback) the last run-agent in creation order.
  → Violation: "Regression task #N is not wired to the final task in the chain. Pass 2 Rule 11 is incomplete."
```

If all pass: print `Wiring integrity: OK — N tasks verified` and continue.

**Resume check** (runs once before execution loop):

Query TaskList for `in_progress` tasks. None → skip to loop. Else execution was interrupted; recover per task type:

| Task type | Recovery |
|---|---|
| git-prep | Re-run the git command (all idempotent). Success → mark completed. |
| create-wt | `git worktree list`. If present → mark completed. If missing → re-run `git worktree add` then mark completed. |
| run-agent (trivial — `Isolation: none (trivial)`) | `git log <checkpoint-sha>..HEAD --oneline`. Commit matching task title present → completed. None → failed, FAILURE_TYPE: no_change. |
| run-agent (worktree) | `git log <checkpoint-sha>..<task-N-branch> --oneline`. Commits → completed (orchestrator crashed after agent finished); populate Merge task with branch/path. None → failed, FAILURE_TYPE: no_change. |
| merge w/ "CONFLICT STATE" in description | Extract branch + conflict from description; add to `pending_conflicts`; do NOT mark completed; print "Recovered stalled conflict from task description: [branch]". |
| merge w/o "CONFLICT STATE" | `git log --merges --oneline \| grep <branch-name>`. Merged → completed. Else re-run merge agent with existing description. |
| regression | Re-run agent with existing description. Success → completed. Failure → report NOTES, pause. |

After recovery, enter execution loop normally.

---

**Execution loop** — repeat until all tasks complete:

```
1. Query: all tasks with no unsatisfied blockers (blocker satisfied = completed)
2. If no dispatchable tasks:
   2a. pending_conflicts non-empty → step 7 (surface conflicts). Do not halt.
   2b. pending_conflicts empty AND incomplete tasks remain → halt (dependency cycle). Report stuck tasks + unsatisfied blocker IDs.
   2c. No incomplete tasks remain → done. Print completion report.
3a. Partition dispatchable tasks:
      inline tasks      = git-prep                    (orchestrator runs directly, sequential)
      async Tasks       = create-wt                   (background Tasks with embedded bash, parallel batch)
      isolated agents   = run-agent (Isolation: native worktree)   (Agent dispatch with isolation: "worktree")
      trivial agents    = run-agent (Isolation: none (trivial))    (foreground Agent, main workspace, no isolation flag)
      serial agents     = merge, regression           (foreground Agent, main workspace)
3b. Inline (git-prep) immediately and sequentially:
      - Run the git command
      - Success → mark completed
      - Fail → halt, report error, do not mark completed
3c. Dispatch all ready create-wt as background Tasks in one parallel batch:
      - Each description is direct bash (see format below)
      - run_in_background=True — all ready worktrees spin up concurrently
      - Poll TaskList until each create-wt reaches completed/failed
      - Any failure → halt, report; do not dispatch its run-agent
3d. Dispatch agents:
      - Isolated agents (worktree run-agents) dispatch in parallel — each in its own worktree
      - Trivial + serial agents (merge, regression) share the main workspace and must serialize. Dispatch at most ONE main-workspace agent per loop iteration (FIFO from ready queue). Worktree dispatches above run in parallel alongside the single main-workspace agent.
4.  Wait for all agent tasks to complete
5.  Parse validation — before acting on ANY agent result:
      Scan from the LAST occurrence of "STATUS:" in the response — everything from there to end-of-response is the STATUS block. No "STATUS:" anywhere → treat as FAILURE_TYPE: partial_change.
      Validate structure:
        run-agent success (worktree):  STATUS: success + ACTION: Create a Task line + Source branch + Target branch + Worktree path
        run-agent success (trivial):   STATUS: success + ACTION: none + NOTES
        run-agent failure:             STATUS: failure + FAILURE_TYPE + ACTION
        merge:                         STATUS: success|conflict_resolved|conflict_needs_user + BRANCH_MERGED
        regression:                    STATUS: success|failure + NOTES
      Malformed/absent → FAILURE_TYPE: partial_change. Do not extract branch/path. Do not populate Merge task. Route as failure.

6.  For each result (after parse validation passes):
      Run agent result:
        - On success: branch on ACTION value.
          ACTION: Create a Task — extract source branch, target branch, worktree path. Call TaskUpdate on the corresponding Merge task to write these into its description. Mark completed only after TaskUpdate. Do NOT dispatch the Merge task until TaskUpdate has been called.
          ACTION: none — trivial task; no Merge task. Mark completed directly.
        - On failure: read FAILURE_TYPE and ACTION block.
          DRAIN FIRST: finish processing all other results in this batch before halting.
          For each successful co-dispatched agent: populate its Merge task (TaskUpdate), mark completed. Preserve their work — do not dispatch Merge tasks yet.
          For each failed co-dispatched agent: collect FAILURE_TYPE + NOTES.
          After full batch processed: if any failure, print halt report and stop the loop. Act on the failed task's ACTION:
            preserve_worktree → leave the worktree at WORKTREE for user inspection
            discard_worktree  → git worktree remove <path> && git branch -d <branch>
            none              → trivial task, no worktree exists — skip cleanup

          Then surface post-failure state:

          ## Execution Halted — Unmerged Successful Agents
          The following agents completed successfully but their Merge tasks were NOT dispatched:
            ✓ run-agent #ID  [title] — worktree preserved at <path>, branch <branch>
            (one line per successful co-dispatched agent, if any)

          Two paths forward:
            A. Full rollback: git reset --hard <checkpoint-SHA>
               → Discards ALL work, including successful agents.
            B. Partial recovery: resolve the failed task(s) and re-run them.
               → Once re-run succeeds, re-enter the execution loop. Successful agents' Merge tasks are already populated and will dispatch normally.

          Do NOT auto-dispatch successful Merges. Do NOT roll back automatically. Wait for user.
      Merge agent result:
        - STATUS: success or conflict_resolved → mark Merge completed (unblocks next in chain)
        - STATUS: failure or malformed (no recognized STATUS) → halt the merge chain, do NOT mark completed. Print the halt report (see "On failure" in Completion reporting) with Worktree: N/A and Reason: merge failure (NOTES from agent, or "malformed result"). The branch from the prior run-agent remains for inspection. Successful in-flight run-agents drain per the run-agent failure rule above before halting.
        - STATUS: conflict_needs_user →
            Call TaskUpdate on the stalled Merge task to append:
              ## CONFLICT STATE (pending resolution)
              Branch: <branch_name from BRANCH_MERGED>
              Conflict details: <NOTES from merge agent>
              Status: awaiting user resolution — re-run merge after resolving
            Add to pending_conflicts: {merge_task_id, branch, NOTES}
            Do NOT mark completed. Do NOT dispatch the next merge. Continue the loop — dispatch other ready run-agent tasks in parallel.
            Print: "Merge stalled — conflict queued and persisted to task. Continuing parallel work."
      Regression agent result:
        - On success: mark Regression completed — execution fully done
        - On failure: print the halt report (see "On failure" in Completion reporting; Worktree row omitted per contract), pause for user resolution

7.  If pending_conflicts non-empty AND no new tasks dispatched this iteration:
      Surface all stalled merges together:

      ## Merge Conflicts Requiring Resolution
      For each pending conflict:
        Branch: <branch_name>
        Conflict: <NOTES from merge agent>
        Resolve: git checkout <current-branch> && git merge <branch_name>
      Resolve all conflicts above, then re-run the affected merge agents to continue.

8.  Repeat
```

---

**Git prep task execution** (inline, step 3b):
- `Pre-flight staging check`: `git status`, stage relevant files (`git add <files>`, never `-A`)
- `Checkpoint commit`: if staged changes → `git commit -m "checkpoint: pre-execution state"` and capture SHA; if clean → use HEAD as SHA
- `Propagate checkpoint SHA`: `git log -1 --oneline` → `TaskUpdate` every run-agent task replacing `[placeholder]` with actual SHA. Confirm no `[placeholder]` remains. Halt if any update fails. Idempotent — re-run all updates if interrupted.
- `Setup .worktrees`: use existing `.worktrees/` or create it, add to `.gitignore`, commit

**Create worktree task execution** (async background Task, step 3c):

Each create-wt is dispatched as a background Task (`run_in_background=True`). Description = exact bash, no prose. Agent runs and reports a STATUS line. All ready create-wt dispatch in one parallel batch.

**Create worktree task prompt format (embedded bash):**
```
Run these commands exactly. Report STATUS at the end.

# 1. Base-SHA assertion (skip for prep-task worktrees with no prior merge blocker)
EXPECTED=$(git log --merges --oneline -10 | grep -F "<last-merge-task-title>" | awk '{print $1}')
ACTUAL=$(git rev-parse HEAD)
if [ -n "$EXPECTED" ] && [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "STATUS: failure — HEAD $ACTUAL does not include required merge $EXPECTED"
  exit 1
fi

# 2. Create worktree
git worktree add .worktrees/task-N -b task-N-branch HEAD

# 3. Symlink external resources (repeat for each)
ln -s /absolute/path/to/resource .worktrees/task-N/resource-name

# 4. Verify
git worktree list | grep -q task-N && echo "STATUS: success — .worktrees/task-N" || echo "STATUS: failure — worktree not found after add"
```

Orchestrator reads only the `STATUS:` line. `success` → mark create-wt completed (unblocks its run-agent). `failure` → mark failed, halt dependent run-agent, report.

---

**Completion reporting:**

**On full success** (all tasks completed):
```
## Execution Complete ✓
Merged to branch: <current branch>
Tasks completed: N
  ✓ [type] #ID  Subject
  ... (all completed tasks in execution order)
Checkpoint: <sha>
```

**On failure** (loop halted):
```
## Execution Halted ✗
FAILED: [type] #ID  <subject>
  Reason: <FAILURE_TYPE> — <NOTES from the agent>
  Worktree: <path> (preserved for inspection | discarded)   ← per contract: omit when not shown
Blocked by this failure:
  ✗ [type] #ID  <subject>  — halted (blocked by #<failed ID>)
  ✗ [type] #ID  <subject>  — halted (blocked by #<above ID>)
  ... (full dependency chain downstream of the failure)
Completed before failure:
  ✓ [type] #ID  <subject>
Not yet started:
  ○ [type] #ID  <subject>  — never reached
Options:
  • Inspect worktree: cd <preserved path>     ← per contract: omit when not shown
  • Rollback all changes: git reset --hard <checkpoint-SHA>
  • Fix and retry: resolve the failure, then re-run the failed task
```

"Blocked by this failure": from the failed task ID, recursively collect tasks whose `Blocked by` includes it or any already-collected ID. Topological order, closest dependents first.

---

**Simulated execution loop (dry-run / dry-run-analyze only)** — runs in place of the live execution loop above:

```
state = ledger from Step 3                  (every entry status = pending)
iteration = 0
while ledger has incomplete entries:
  iteration += 1
  ready = [entry for entry in ledger if all blocker IDs are completed]
  if not ready:
    print "[DRY] STUCK at iteration K — N entries with unsatisfied blockers:"
    for each stuck entry: print "  #DRY-N <subject> blocked by #DRY-X(<status>) ..."
    halt — this is a wiring violation. Do not continue past Step 4.
  partition ready into:
    inline           = git-prep
    async batch      = create-wt
    isolated agents  = run-agent (Isolation: native worktree)
    trivial agents   = run-agent (Isolation: none (trivial))
    serial agents    = merge, regression  (dispatch at most ONE per iteration, FIFO)
  print "Iteration K — would dispatch in parallel:"
    inline:           [DRY-A, DRY-B, ...] git-prep
    async batch:      [DRY-C, ...] create-wt
    isolated agents:  [DRY-D, ...] run-agent (worktree)
    trivial agents:   [DRY-E, ...] run-agent (trivial)
    serial agent:     [DRY-F]      merge|regression  (only one)
  for each dispatched entry, emit the per-verb [DRY] print line from the Modes
    substitution table, with the simulated happy-path result. For run-agent
    (worktree) results, populate the corresponding Merge entry's description
    via the Pass 2 ledger-mutation rule (print `[DRY] would TaskUpdate ...`).
  mark every dispatched entry status = completed in the ledger
  (serial agents: only the one dispatched is marked; the rest re-queue next iteration)
```

Track and emit at end:
- `Total iterations: K`
- `Peak parallel dispatches: M (in iteration X)` — total dispatched in the largest iteration
- `Peak parallel run-agents: P` — largest count of worktree+trivial run-agents in any iteration

---

**Dry-Run Report (printed at end of Step 4, dry-run / dry-run-analyze only):**

```
## Dry-Run Report
Mode: <dry-run|dry-run-analyze>
Branch: <A|B>
Plan file: <path|none>
Senior reviewer: <dispatched (Branch B)|skipped (Branch A)>

### Proposals (N)
<the proposals table from Step 1>

### Simulated Task Backlog (N entries)
| ID     | Type      | Subject                          | Blocked by | Isolation         |
|--------|-----------|----------------------------------|------------|-------------------|
| DRY-1  | git-prep  | Pre-flight staging check         | —          | n/a               |
| DRY-7  | run-agent | Refactor auth                    | DRY-6      | native worktree   |
| ...

#### Full faux-Task descriptions
For each ledger entry, print:
  --- #DRY-N (<type>): <subject> ---
  Blocked by: <comma-separated DRY IDs, or "—">
  Description:
  <full description text exactly as it would have been written to TaskCreate.description>

### Wiring Integrity
<PASS — N tasks verified | violation list from the Step 4 wiring integrity check>

### Simulated Execution Trace
Iteration 1 — inline: [DRY-1] git-prep (Pre-flight staging check)
Iteration 2 — inline: [DRY-2] git-prep (Checkpoint commit)
Iteration 3 — inline: [DRY-3] git-prep (Propagate checkpoint SHA)
Iteration 4 — inline: [DRY-4] git-prep (Setup .worktrees)
Iteration 5 — async batch: [DRY-5, DRY-6, DRY-7] create-wt (parallel)
Iteration 6 — isolated agents: [DRY-8, DRY-9, DRY-10] run-agent (parallel)
Iteration 7 — serial: [DRY-11] merge
Iteration 8 — serial: [DRY-12] merge
...
Total iterations: K
Peak parallel dispatches: M (in iteration X)
Peak parallel run-agents: P
```

In `dry-run` mode, stop after printing the Dry-Run Report. In `dry-run-analyze` mode, continue to the analyzer dispatch (next subsection).

---

## Iron Law

**Reference loading (binding):**
- **Do NOT dispatch a sub-agent without first calling `Read` on its referenced prompt file. Paste verbatim into the Agent dispatch — paraphrasing is a correctness failure.**

**Pass / wiring discipline:**
- **No TaskCreate on Branch B before the senior review completes.** Branch A's plan was already reviewed before `ExitPlanMode`; TaskCreate may begin after Step 1.
- **Do NOT begin execution before Pass 2 wiring is complete.**
- **Do NOT skip Step 4 — every approved task executes immediately after wiring.**
- **Do NOT skip `addBlockedBy` because tasks "seem independent" — Pass 2 wires all deps before execution.**

**Dispatch discipline:**
- **Do NOT dispatch a Run agent task before its Create worktree is `completed`.** Exception: trivial run-agents (`Isolation: none (trivial)`) have no Create worktree and dispatch directly once their other blockers are satisfied.
- **Do NOT dispatch any Create worktree before `Propagate checkpoint SHA` is `completed`.**
- **Do NOT run Merge tasks in parallel — each waits for the previous Merge.**
- **Do NOT use `run_in_background` for run-agent tasks. Create-wt is the only exception — it uses background dispatch deliberately so all ready worktrees spin up in parallel.**
- **Do NOT halt the entire execution loop on conflict_needs_user — only the merge chain stalls. Continue dispatching independent run-agent tasks.**
- **Do NOT halt on a stuck task without first checking: is its blocker actually completed?**

**Behavior:**
- **Agents MUST bias toward action:** diagnose obstacles, fix them, continue. Maximum 3 distinct attempts per obstacle. Stop only on genuine fatality or after 3 failed attempts.
- **Branch B: bias toward drafting proposals.** Recent commits, uncommitted changes, and conversation context together feed the scan — clean `git diff` alone is not a terminal state. Let the senior reviewer prune; do not pre-prune by being conservative.
- **Do NOT skip the review agent on error — retry. A failed review is not an approved review.**
- **Do NOT use `git add -A` for the checkpoint — stage by name to avoid pulling unrelated state.**
- **When in doubt whether a task needs worktree isolation, create one. An unnecessary worktree costs one git branch; missing isolation risks workspace corruption.**
