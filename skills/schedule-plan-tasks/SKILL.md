---
name: schedule-plan-tasks
description: |
  Analyzes an approved plan and decomposes it into a dependency-ordered task graph using TaskCreate with inline blockedBy. Detects linear DEPENDS ON chains (shared worktree), identifies independent work streams (parallelized), and executes the full worktree-isolated run. Also handles Branch B (learnings from session context).

  **AUTOMATICALLY INVOKE** when:
  - ExitPlanMode hook triggers (PostToolUse)
  - User says "schedule tasks", "create task graph", "decompose plan into tasks", "execute plan"
  - /schedule-plan-tasks is invoked

  **References:** JIT-loaded from `${CLAUDE_SKILL_DIR}/references/`
allowed-tools: Bash, TaskCreate, TaskUpdate, TaskList, Agent, Read, Write, Edit, Glob, Grep
---

# schedule-plan-tasks

Two entry points, one execution engine. **Branch A** reads an approved plan file and extracts its steps as proposals — the plan was reviewed before `ExitPlanMode`, so it goes straight to task-graph execution. **Branch B** assesses session learnings, drafts proposals from session state, and runs them through the senior engineer reviewer. Both branches converge into the same task-graph executor with native worktree isolation. Every unit of work — git prep, worktree creation, agent execution, merge-back — is a Task with explicit dependencies. Each run-agent merges its own changes back to the target branch after completing, using optimistic concurrency with rebase + retry.

**References model:** Verbatim sub-agent prompts and bash templates live in `${CLAUDE_SKILL_DIR}/references/*.md` and are loaded just-in-time. Citation rule (binding): when a step says "Read references/X then dispatch", you MUST `Read` that file at its absolute path and paste its content verbatim into the Agent dispatch. Do not paraphrase, summarize, or "improve". Once Read in a session, the file content stays in context — re-Read only if it scrolls out.

---

## Modes

The skill runs in one of three modes, decided at the top of Step 0 by inspecting arguments:

| Mode               | Trigger flag           | Behavior                                                                                          |
|--------------------|------------------------|---------------------------------------------------------------------------------------------------|
| `live`             | (no flag)              | Default. Real TaskCreate, real git operations, real Agent dispatches. Current production path.    |
| `dry-run`          | `--dry-run`            | No side effects. Branch A: reads the real plan and builds the task graph in memory. Branch B: uses conversation context to generate learnings and craft proposals (skips git history). Both branches output an ordered task list + dependency graph — no real TaskCreate, no git mutations, no agent dispatch. **Trivial classification is overridden: every proposal generates a full `create-wt → run-agent → merge` chain so the complete worktree isolation structure is visible.** |
| `dry-run-analyze`  | `--dry-run-analyze`    | Same as `dry-run`, then dispatches an analyzer Agent on the Dry-Run Report to flag wiring errors, missing dependencies, mis-classified isolation, and anti-patterns. |

**`Mode` is set in Step 0 before any side-effecting action** and threaded through every TaskCreate / TaskUpdate / git / Agent verb downstream. Live mode is the default and is unaffected by the guards — the dry-run substitutions are no-ops when `Mode == live`.

**What dry-run does NOT skip** (read-only, kept real for fidelity):
- Branch A: reading the plan file and extracting proposals
- Branch B: generating learnings and drafting proposals from conversation context (real reasoning, no git scan)
- TaskList preflight (read-only)
- **Branch B senior reviewer Agent dispatch** — runs for real (no side effects beyond token cost; realism is the point)
- Wiring integrity check — runs in-memory against the task ledger

**What dry-run DOES skip:**

| Live verb                                                       | Dry-run behavior                                                                              |
|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `ExitPlanMode`                                                  | skipped — print `[DRY] would ExitPlanMode`; stay in plan mode                                |
| `TaskCreate`                                                    | skipped — append to in-memory task ledger with `blockedBy` inline; print `[DRY] would TaskCreate #DRY-N: <subject> (blockedBy: [DRY-M, …])` |
| `TaskUpdate` (Merge description fill-in)                        | skipped — mutate ledger entry; print `[DRY] would TaskUpdate #DRY-N description`             |
| Git-prep execution (all inline git commands in Step 4)         | skipped entirely — not simulated, not printed; git context prime in Step 1 still runs        |
| `git worktree add/remove`, `git merge`, `git branch -d`        | skipped entirely                                                                              |
| Agent dispatch — run-agent, merge, regression                  | skipped entirely — no simulated happy-path results                                            |
| Execution loop (Step 4 live loop)                               | skipped — replaced by Dry-Run Report                                                          |

**In-memory task ledger** — list of entries `{id: DRY-N, type, subject, description, blocked_by[], chain_id, chain_role}` built during the single topological pass with `blockedBy` set inline at creation. Source of truth for the wiring integrity check and the Dry-Run Report.

---

### Step 0 — Task API Preflight

**Mode detection (binding, runs FIRST — before any side-effecting action):** inspect the arguments.
- Args contain `--dry-run-analyze` → `Mode = dry-run-analyze`
- Args contain `--dry-run` → `Mode = dry-run`
- Otherwise → `Mode = live`

Print the active mode banner once:
```
## schedule-plan-tasks — Mode: <live|dry-run|dry-run-analyze>
```
For dry-run / dry-run-analyze, also print:
```
[DRY] No Tasks or git operations will be created. Output: task list + dependency graph.
      Branch A: reads plan file directly. Branch B: generates learnings from conversation context.
```

Initialize an empty in-memory task ledger when `Mode != live`. Assign IDs `DRY-1`, `DRY-2`, … in TaskCreate order.

`TaskList`. If errors:
- Print: `Task API unavailable: [error]`
- Print: `schedule-plan-tasks requires TaskCreate, TaskUpdate, TaskList. Halting before review agent dispatch.`
- STOP. No review dispatch. No tasks created.

If TaskList succeeds, continue. Narrate progress in plain prose — do not create phase-tracking tasks.

---

### Step 1 — Get the Plan

**Plan-mode preflight (binding):** if invoked while plan mode is active, call `ExitPlanMode` immediately after confirming the plan file is readable (Branch A) or as the first action of this step (Branch B). The plan is already approved — do not stall waiting for the user to exit. If `ExitPlanMode` is unavailable (host is not in plan mode), this is a no-op.

**Mode-aware ExitPlanMode guard:** when `Mode != live`, do NOT call `ExitPlanMode` — print `[DRY] would ExitPlanMode` and stay in plan mode (truly side-effect-free).

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

1. Read the approved plan file (path is in planning mode context, current session, or most recent `ls -t ~/.claude/plans/*.md | head -1`)
2. For each step, extract proposal: `What`=step title; `Why`=rationale/Context; `Scope`=small|medium|large
3. Note files listed under each step → include in proposal context
4. Note sequencing (step N requires step M) → record as logical DEPENDS ON hints; these drive chain detection and inline `blockedBy` wiring in the creation pass
5. Note plan's Verification section → seed for validation tasks
6. `{context}` = full plan file content

**Branch B — Learnings (no plan file):**

**Mode-aware Branch B guard:** when `Mode != live`, skip git commands entirely. Use conversation context alone — what the user was working on, what was just built or fixed, what was deferred or left to the user. Reason directly from that to produce proposals. `{context}` = concise narrative of what was learned from the conversation.

In live mode, scan recent work and draft proposals:
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

The execution mode (worktree vs serial main-workspace) is decided per-proposal, not as a global path: trivial proposals run inline in the main workspace; non-trivial proposals run in worktrees and self-merge on completion. The mechanism is the `Isolation:` line on each run-agent task (`native worktree` vs `none (trivial)`) — see the task-type contract in Step 4.

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
1. **FIRST: `Read ${CLAUDE_SKILL_DIR}/references/reviewer-full.md`** — load the verbatim prompt into context.
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

**Git repo guard** (before Pass 1): if no `.git`, halt with `No git repo — initialize one (git init + initial commit) and re-run /schedule-plan-tasks.` Plan execution does not bootstrap repos.

**Chain detection (runs after proposals are finalized, before the creation pass):**

1. Build directed graph from DEPENDS ON hints:
   - `succ[N]` = set of proposals whose run-agents must be blocked by N's run-agent (N's direct successors)
   - `pred[N]` = set of proposals N directly depends on (N's direct predecessors)
2. Identify **chain seeds** — any unassigned node where `|succ[N]| == 1`. These are potential chain heads or interior entry points.
3. From each unassigned chain seed, greedily extend a path forward:
   - Advance to the unique successor as long as that successor has `|pred| == 1` (still a linear run)
   - Stop when the current node has `|succ| != 1` (fan-out or leaf) — this node is the path tail
   - Mark all nodes in the path as assigned
4. A path with ≥ 2 nodes is a **chain**; a path with exactly 1 node is standalone (not a chain).
5. **Collect standalones (explicit step):** after the seed-extension loop, every node not yet marked assigned is `standalone` (chain: none). This includes nodes with succ==0 that were never seeds (e.g. a fan-in terminus: A→B, A→C, B→D, C→D — D has succ==0, never seeded, explicitly collected as standalone here).
6. Assign chain IDs in creation order: `chain-1`, `chain-2`, …
7. Assign roles: first node in each chain → `head`; middle nodes → `link`; last node → `tail`; all standalones → `chain: none`

**Examples (all correctly handled):**
- `A→B→C`: seed=A (succ==1); B has pred==1,succ==1 → extend; C has pred==1,succ==0 → stop. Path=[A,B,C] → chain-1. A=head, B=link, C=tail.
- `A→B` (2-node): seed=A (succ==1); B has pred==1,succ==0 → stop. Path=[A,B] → chain. A=head, B=tail. No links.
- `A→B, A→C` (fan-out): A has succ==2 → not a seed, never starts a forward path. B and C are never reached by extension → fall through to standalone.
- `A→C, B→C` (fan-in): seeds=A (succ==1), B (succ==1); path from A stops at C (pred==2) → path=[A] <2 → standalone. Same for B. C is standalone.

Print chain assignments after detection:
```
[chain] chain-1: Proposal-A (head) → Proposal-B (link) → Proposal-C (tail)
[chain] standalone: Proposal-D
```

**Mode-aware verb guards (binding):**
- `Mode == live` → call `TaskCreate` for real with inline `blockedBy`.
- `Mode != live` → DO NOT call `TaskCreate` or `TaskUpdate`. Instead:
  - For each TaskCreate: print `[DRY] would TaskCreate #DRY-N: <subject> (blockedBy: [DRY-M, …])`, append `{id: DRY-N, type, subject, description, blocked_by: [...], chain_id, chain_role}` to the task ledger. Use the same `description` text the live path would have written (run-agent description from `${CLAUDE_SKILL_DIR}/references/run-agent-description.md`, create-wt bash block from `${CLAUDE_SKILL_DIR}/references/create-wt-prompt.md`, Regression template).
  - For each Merge description fill-in: print `[DRY] would TaskUpdate #DRY-N description`, mutate the ledger entry.
- The creation ticker shows `#DRY-N` IDs in dry-run instead of real task IDs.

**Trivial override (dry-run only, binding):** when `Mode != live`, ignore any `Trivial: yes` classification from the reviewer. Treat every proposal as a full non-trivial task — generate the complete `create-wt → run-agent` chain per proposal (or per chain: one create-wt for the whole chain).

**Single topological pass — Create ALL tasks with inline `blockedBy`** (topological order: git-prep first, then chains and standalones ordered so all predecessors are created before dependents). Print ticker.

**Git-prep (4 tasks):**
```
[git-prep 1/4] Task: Pre-flight staging check               blockedBy: []               → capture ID_preflight
[git-prep 2/4] Task: Checkpoint commit                      blockedBy: [ID_preflight]   → capture ID_checkpoint
[git-prep 3/4] Task: Propagate checkpoint SHA               blockedBy: [ID_checkpoint]  → capture ID_propagate
[git-prep 4/4] Task: Setup .worktrees directory             blockedBy: [ID_propagate]   → capture ID_setup
```

**For each chain or standalone (topological order — predecessors before dependents):**

*Chain (chain-K, N members):*
```
[create-wt chain-K] Task: Create worktree chain-K           blockedBy: [ID_setup, <upstream tail IDs>]  → capture ID_cwt_K
[run-agent head]    Task: Run agent: <head proposal>        blockedBy: [ID_cwt_K]                        → capture ID_head_K
[run-agent link]    Task: Run agent: <link proposal>        blockedBy: [<previous run-agent ID>]         → capture ID_link_K
[run-agent tail]    Task: Run agent: <tail proposal>        blockedBy: [<previous run-agent ID>]         → capture ID_tail_K
```
One `create-wt` per chain; chain-link and chain-tail proposals share the chain's worktree and have no create-wt of their own.
`<upstream tail IDs>` = the tail or standalone run-agent IDs of any chains/standalones whose proposals this chain's head DEPENDS ON.

*Standalone (task-N):*
```
[create-wt task-N]  Task: Create worktree task-N            blockedBy: [ID_setup, <upstream tail IDs>]  → capture ID_cwt_N
[run-agent task-N]  Task: Run agent: <proposal>             blockedBy: [ID_cwt_N]                       → capture ID_sa_N
```
`<upstream tail IDs>` = tail/standalone run-agent IDs of any proposals this one DEPENDS ON.

**Regression (if present):**
```
[regression]        Task: Regression: <scope>               blockedBy: [all ID_tail_K…, all ID_sa_N…]
```
Regression is blocked by ALL chain-tail run-agents and ALL standalone run-agents. Chain-head and chain-link run-agents are NOT direct regression blockers.

**Trivial run-agents:** create only the run-agent task (no create-wt). In its Execution context set `Isolation: none (trivial)` and `Chain: none`. Chain tasks are never trivial.

**No post-creation dependency updates.** All `blockedBy` deps are wired inline at `TaskCreate` time. The wiring integrity check (Step 4) is the only post-creation validation and makes no `TaskUpdate` calls.

---

**`Target branch` capture (binding):** At the start of the creation pass, capture once:
- `Target branch` = output of `git branch --show-current` (the branch being worked on — the merge destination)

Substitute into every worktree run-agent task description and every create-wt description. This value is NEVER `[placeholder]`. Assert 6 catches any remaining placeholders before execution.

**Run-agent description (binding dispatch protocol):**
1. **FIRST: `Read ${CLAUDE_SKILL_DIR}/references/run-agent-description.md`** — load the verbatim template.
2. **THEN:** Substitute placeholders per task, paste verbatim into `TaskCreate.description`. Do not paraphrase.
   - Set `Chain:` to `none | head | link | tail` per the detection output.
   - Set `Chain ID:` to `chain-K` or `none`.
   - Set `## Working directory` to the absolute worktree path (e.g. `/repo/.worktrees/chain-1`) or `"main workspace"` for trivial tasks.
   - Set `## Definition of done` to the concrete acceptance criteria for this proposal.
   - Set `## Dependents unblocked on success` to the list of task subjects that will be unblocked.

**Create worktree task:** **FIRST: Read `${CLAUDE_SKILL_DIR}/references/create-wt-prompt.md`** — load the verbatim bash template. Before pasting, perform these substitutions in the bash code lines only (skip `#`-prefixed comment lines — those are instructional and use `task-N` as a label, not a substitution target):
- `[TARGET_BRANCH]` → the captured target branch value
- `task-N` → `chain-K` (e.g. `chain-1`) for chain create-wt tasks, or `task-N` (e.g. `task-3`) for standalone tasks
- `task-N-branch` → `chain-K-branch` (e.g. `chain-1-branch`) for chain tasks, or `task-N-branch` for standalones
Then paste verbatim as the TaskCreate description. Do not paraphrase any other content.

**Regression task description** (source: Branch A → plan's Verification section; Branch B → reviewer output):
```
## Purpose
Final regression suite — confirms no regressions across all merged changes.

## Working directory
main workspace

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

On Branch B, match reviewer-output titles to creation-pass IDs when wiring blockers.

**Print final task graph:**
```markdown
## Task Graph — N Tasks

| ID  | Type      | Subject                          | Blocked by      |
|-----|-----------|----------------------------------|-----------------|
| #80 | git-prep  | Pre-flight staging check         | —               |
| #81 | git-prep  | Checkpoint commit                | #80             |
| ... | ...       | ...                              | ...             |
| #87 | create-wt | Create worktree: Refactor auth   | #83 #85         |
| #88 | run-agent | Refactor auth                    | #87             |
| #89 | regression| Regression: suite                | #88             |
```

---

### Step 4 — Execute Task Graph

**Mode-aware execution guards (binding):**
- `Mode == live` → run the loop exactly as specified below.
- `Mode != live` → **skip the execution loop entirely**. Run the wiring integrity check against the in-memory task ledger, then print the Dry-Run Report.

**Task-type contract:**

| Task type           | Identity                    | Has create-wt? | Has Merge? | Asserts | Resume method                   | Dispatch lane         |
|---------------------|-----------------------------|----------------|------------|---------|---------------------------------|-----------------------|
| run-agent worktree  | `Isolation: native worktree`| yes            | self (built-in) | 4, 6 | branch in git log --merges → completed | parallel worktree     |
| run-agent trivial   | `Isolation: none (trivial)` | no             | no         | 4       | git log title vs checkpoint     | serial main-workspace |
| regression          | type=regression             | no             | no         | 5       | re-run agent                    | serial main-workspace |
| create-wt           | type=create-wt              | self           | n/a        | 3       | `git worktree list`             | parallel background   |
| git-prep            | type=git-prep               | n/a            | n/a        | —       | re-run command (idempotent)     | inline (orchestrator) |

**Wiring integrity check** (inline, runs once before resume check):

```
For every Create worktree task (chain or standalone):
  Assert 3: Its blockers include `Setup .worktrees` and, if this chain/standalone DEPENDS ON another, at least one upstream tail or standalone run-agent ID.
  → Exception: If the proposal has no upstream DEPENDS ON constraints, blocked only by Setup .worktrees — valid; skip the upstream-blocker part of Assert 3.
  → Violation: "Create worktree #N is missing expected upstream run-agent blocker from its DEPENDS ON chain."

For every run-agent task description:
  Assert 4: The description does not contain the literal string "[placeholder]" in the Checkpoint SHA field.
  → Violation: "Checkpoint SHA propagation incomplete — run-agent #N still has [placeholder]."

For every Regression task (zero or one in graph):
  Assert 5: It is blocked by ALL chain-tail run-agents and ALL standalone run-agents.
             Chain-head and chain-link run-agents are NOT direct regression blockers.
  → Violation: "Regression task #N is missing blockers: [list of missing tail/standalone IDs]"
               or "Regression task #N directly blocked by chain-head/link run-agent #M — must not be."

For every run-agent task with Isolation: native worktree:
  Assert 6: The description contains a literal `Target branch:` field with a non-empty, non-placeholder value.
  → Violation: "Run-agent #N is missing Target branch field or has [placeholder] value."

For each chain-K (any chain with ≥ 2 members):
  Assert 7: Exactly one create-wt task exists and it belongs to the chain-head. Chain-link and chain-tail
             tasks have no create-wt of their own.
  → Violation: "chain-link/tail task #N has its own create-wt — should share chain-K's create-wt."

For each run-agent task description:
  Assert 8: The description contains the phrase "exactly one `git commit`" in its ## Before return: commit section.
  → Violation: "Run-agent #N missing single-commit rule in ## Before return: commit."
```

If all pass: print `Wiring integrity: OK — N tasks verified` and continue.

**Resume check** (runs once before execution loop):

Query TaskList for `in_progress` tasks. None → skip to loop. Else execution was interrupted; recover per task type:

| Task type | Recovery |
|---|---|
| git-prep | Re-run the git command (all idempotent). Success → mark completed. |
| create-wt | `git worktree list`. If present → mark completed. If missing → re-run `git worktree add` then mark completed. |
| run-agent (trivial) | `git log <checkpoint-sha>..HEAD --oneline`. Commit matching task title present → completed. None → failed, FAILURE_TYPE: no_change. |
| run-agent (worktree, Chain: none or tail) | Check if self-merge completed: `git log --merges --oneline | grep <chain-K-branch or task-N-branch>`. Found → completed. Not found: commits present but not merged → re-run agent from the self-merge step. None → failed, FAILURE_TYPE: no_change. |
| run-agent (worktree, Chain: head or link) | No self-merge to check. `git -C .worktrees/<chain-K> log HEAD --oneline | grep <task subject>`. Commit present → completed. None → failed, FAILURE_TYPE: no_change. Re-run agent from scratch (not from self-merge step). |
| regression | Re-run agent with existing description. Success → completed. Failure → report NOTES, pause. |

---

**Execution loop** — repeat until all tasks complete:

```
1. Query: all tasks with no unsatisfied blockers (blocker satisfied = completed)
2. If no dispatchable tasks:
   2a. Incomplete tasks remain → halt (dependency cycle). Report stuck tasks + unsatisfied blocker IDs.
   2b. No incomplete tasks remain → done. Print completion report.
3a. Partition dispatchable tasks:
      inline tasks      = git-prep                    (orchestrator runs directly, sequential)
      async Tasks       = create-wt                   (background Tasks with embedded bash, parallel batch)
      isolated agents   = run-agent (Isolation: native worktree)
      trivial agents    = run-agent (Isolation: none (trivial))
      serial agents     = regression
3b. Inline (git-prep) immediately and sequentially.
3c. Dispatch all ready create-wt as background Tasks in one parallel batch (run_in_background=True).
      Poll TaskList until each create-wt reaches completed/failed.
      Any failure → halt, report; do not dispatch its run-agent.
3d. Dispatch agents:
      - Isolated agents (worktree run-agents) dispatch in parallel — each in its own worktree.
        Before dispatching each run-agent, read the `Chain:` value from its task description
        (TaskGet the task if not already in context — do not rely on session memory alone,
        especially after a resume). Then:
        For tasks where `Chain: none` or `Chain: tail`:
        **FIRST: Read `${CLAUDE_SKILL_DIR}/references/self-merge-wrapper.md`** — load the verbatim wrapper. Substitute
        `[TARGET_BRANCH]` with the task description's `Target branch:` value, then append the
        wrapper verbatim to the Agent prompt. Do not paraphrase.
        For tasks where `Chain: head` or `Chain: link`: do NOT append the self-merge wrapper — these tasks commit to the chain branch and pass off to the next link.
      - Trivial + serial agents share the main workspace and must serialize. Dispatch at most ONE per loop iteration (FIFO from ready queue).
4.  Wait for all agent tasks to complete
5.  Parse validation — before acting on ANY agent result:
      Scan from the LAST occurrence of "STATUS:" in the response.
      Validate structure:
        run-agent success (worktree):  STATUS: success + ACTION: none + NOTES
        run-agent success (trivial):   STATUS: success + ACTION: none + NOTES
        run-agent failure:             STATUS: failure + FAILURE_TYPE (no_change|partial_change|test_failures|conflict_needs_user|needs_split) + ACTION
        regression:                    STATUS: success|failure + NOTES
      Malformed/absent → FAILURE_TYPE: partial_change. Route as failure.
6.  For each result (after parse validation passes):
      Run agent result:
        - On success (ACTION: none): self-merge was performed inside the agent. Mark completed directly.
        - On failure: read FAILURE_TYPE and ACTION block.
          DRAIN FIRST: finish processing all other results in this batch before halting.
          After full batch processed: if any failure, print halt report and stop the loop. Act on the failed task's ACTION:
            preserve_worktree → leave the worktree at WORKTREE for user inspection
            discard_worktree  → git worktree remove <path> && git branch -d <branch>
            none              → trivial task, no worktree exists — skip cleanup
          For FAILURE_TYPE: needs_split → halt immediately; surface the agent's suggested sub-task
            breakdown from NOTES to the user and ask them to update the plan. Do NOT continue.
          Then surface post-failure state (successful co-dispatched agents, rollback options).
          Do NOT roll back automatically. Wait for user.
      Regression agent result:
        - On success: mark Regression completed — execution fully done
        - On failure: print the halt report, pause for user resolution
7.  Repeat
```

---

**Git prep task execution** (inline, step 3b):
- `Pre-flight staging check`: `git status`, stage relevant files (`git add <files>`, never `-A`)
- `Checkpoint commit`: if staged changes → `git commit -m "checkpoint: pre-execution state"` and capture SHA; if clean → use HEAD as SHA
- `Propagate checkpoint SHA`: `git log -1 --oneline` → `TaskUpdate` every run-agent task replacing `[placeholder]` with actual SHA. Confirm no `[placeholder]` remains.
- `Setup .worktrees`: use existing `.worktrees/` or create it, add to `.gitignore`, commit

**Create worktree task execution** (async background Task, step 3c):

Each create-wt is dispatched as a background Task (`run_in_background=True`). Description = exact bash from `${CLAUDE_SKILL_DIR}/references/create-wt-prompt.md` (loaded JIT). No prose form. Agent runs and reports a STATUS line. All ready create-wt dispatch in one parallel batch.

Orchestrator reads only the `STATUS:` line. `success` → mark create-wt completed (unblocks its run-agent). `failure` → mark failed, halt dependent run-agent, report.

---

**Dry-Run Report (printed at end of Step 4, dry-run / dry-run-analyze only):**

```
## Dry-Run Report
Mode: <dry-run|dry-run-analyze>
Branch: <A|B>
Plan file: <path|none>
Senior reviewer: <dispatched (Branch B)|skipped (Branch A)>

### Proposals (N)
<proposals table from Step 1 / reviewer output>

### Chains
Build from ledger: for each unique `chain_id`, emit one row — list members in creation order (arrow-separated IDs from `chain_role: head` → links → tail); worktree = `.worktrees/<chain_id>` for chains, `.worktrees/task-<N>` for standalones (use the DRY-N number); merge point = the `chain_role: tail` member's ID (or the standalone's own ID).

| Chain ID | Members (in order)            | Worktree              | Merge point |
|----------|-------------------------------|-----------------------|-------------|
| chain-1  | DRY-5 → DRY-8 → DRY-11      | .worktrees/chain-1    | DRY-11      |
| none     | DRY-14 (standalone)           | .worktrees/task-14    | DRY-14      |

### Task List — N tasks

| # | ID    | Type      | Subject                               | Blocked by          | Isolation         |
|---|-------|-----------|---------------------------------------|---------------------|-------------------|
| 1 | DRY-1 | git-prep  | Pre-flight staging check              | —                   | n/a               |
...

### Dependency Graph
<ASCII tree rooted at first task with no blockers>

### Task Details
For each ledger entry:
  --- DRY-N (<type>): <subject> ---
  Blocked by: <comma-separated DRY IDs, or "—">
  Unblocks:   <comma-separated DRY IDs, or "—">
  Description: <full description text>

### Wiring Integrity
<PASS — N tasks verified | violation list>
```

In `dry-run` mode, stop after printing the Dry-Run Report. In `dry-run-analyze` mode, continue:

**Analyzer dispatch (`dry-run-analyze` only):**

**FIRST: `Read ${CLAUDE_SKILL_DIR}/references/dry-run-analyzer.md`** — load the verbatim prompt into context.
**THEN:** Dispatch the Agent with that prompt verbatim, substituting `{report}` → the full Dry-Run Report text. Do not paraphrase.

**On agent return**, print under:
```
## Dry-Run Analyzer Findings
<table from analyzer output>
VERDICT: <READY-TO-EXECUTE | NEEDS-FIXES> — <summary>
```

Stop after printing findings. Do not auto-promote dry-run results to live mode — the user re-invokes `/schedule-plan-tasks` (no flag) when ready.

---

## Iron Law

**Mode discipline (binding):**
- **`dry-run-analyze` always loads `${CLAUDE_SKILL_DIR}/references/dry-run-analyzer.md` verbatim** before dispatching the analyzer Agent. Same reference-loading discipline as `reviewer-full.md` and `run-agent-description.md`.

**For mode-discipline rules, see Modes section and Steps 0–3.** The bullets above cover only dispatch and behavior rules not restated elsewhere.

**Reference loading (binding):**
- **Do NOT dispatch a sub-agent without first calling `Read` on its referenced prompt file. Paste verbatim into the Agent dispatch — paraphrasing is a correctness failure.**

**Pass / wiring discipline:**
- **No TaskCreate on Branch B before the senior review completes.** Branch A's plan was already reviewed before `ExitPlanMode`; TaskCreate may begin after Step 1.
- **All `blockedBy` deps are set inline at `TaskCreate` time — do not add `TaskUpdate addBlockedBy` calls after creation.**
- **Do NOT skip Step 4 — every approved task executes immediately after the single creation pass.**

**Dispatch discipline:**
- **Do NOT dispatch a Run agent task before its Create worktree is `completed`.** Exception: trivial run-agents (`Isolation: none (trivial)`) have no Create worktree and dispatch directly once their other blockers are satisfied.
- **Do NOT dispatch any Create worktree before `Propagate checkpoint SHA` is `completed`.**
- **Do NOT dispatch multiple worktree run-agents that touch the same file without a DEPENDS ON relationship** — their self-merges will race and likely conflict.
- **Do NOT use `run_in_background` for run-agent tasks. Create-wt is the only exception.**
- **Do NOT halt the entire execution loop on conflict_needs_user — only the merge chain stalls. Continue dispatching independent run-agent tasks.**

**Behavior:**
- **Agents MUST bias toward action:** diagnose obstacles, fix them, continue. Maximum 3 distinct attempts per obstacle. Stop only on genuine fatality or after 3 failed attempts.
- **Branch B: bias toward drafting proposals.** Recent commits, uncommitted changes, and conversation context together feed the scan — clean `git diff` alone is not a terminal state.
- **Do NOT skip the review agent on error — retry. A failed review is not an approved review.**
- **Do NOT use `git add -A` for the checkpoint — stage by name to avoid pulling unrelated state.**
- **When in doubt whether a task needs worktree isolation, create one.**
