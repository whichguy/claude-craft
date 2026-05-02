---
name: schedule-plan-tasks
description: |
  Analyzes an approved plan and decomposes it into a dependency-ordered task graph via a two-phase TaskCreate and TaskUpdate pass. Detects linear DEPENDS ON chains (shared worktree), identifies independent work streams (parallelized), and executes the full worktree-isolated run. Also handles Branch B (learnings from session context).

  **AUTOMATICALLY INVOKE** when:
  - ExitPlanMode hook triggers (PostToolUse)
  - User says "schedule tasks", "create task graph", "decompose plan into tasks", "execute plan"
  - /schedule-plan-tasks is invoked

  **References:** JIT-loaded from `${CLAUDE_SKILL_DIR}/references/`
allowed-tools: Bash, TaskCreate, TaskUpdate, TaskList, Agent, Read, Write, Edit, Glob, Grep
---

# schedule-plan-tasks

Two entry points, one execution engine. **Branch A** reads an approved plan file and extracts its steps as proposals — the plan was reviewed before `ExitPlanMode`, so it goes straight to task-graph execution. **Branch B** assesses session learnings, drafts proposals from session state, and runs them through the senior engineer reviewer. Both branches converge into the same task-graph executor with native worktree isolation. Every unit of work — git prep, worktree creation, agent execution, merge-back — is a Task with explicit dependencies. Each run-agent merges its own changes back to the target branch after completing, using optimistic concurrency with rebase + retry.

**References model:** Verbatim sub-agent prompts and bash templates live in `${CLAUDE_SKILL_DIR}/references/*.md` and are loaded just-in-time. Citation rule: when a step says "Read references/X then dispatch", you MUST `Read` that file at its absolute path and paste its content verbatim into the Agent dispatch. Do not paraphrase, summarize, or "improve". Once Read in a session, the file content stays in context — re-Read only if it scrolls out.

---

## Modes

The skill runs in one of three modes, decided at the top of Step 0 by inspecting arguments:

| Mode               | Trigger flag           | Behavior                                                                                          |
|--------------------|------------------------|---------------------------------------------------------------------------------------------------|
| `live`             | (no flag)              | Default. Real TaskCreate, real git operations, real Agent dispatches. Current production path.    |
| `dry-run`          | `--dry-run`            | No side effects. Branch A: reads the real plan and builds the task graph in memory. Branch B: uses conversation context to generate learnings and craft proposals (skips git history). Both branches output an ordered task list + dependency graph — no real TaskCreate, no git mutations, no agent dispatch. **Trivial classification is overridden: every proposal generates a full `create-wt → run-agent → merge` chain so the complete worktree isolation structure is visible.** |
| `dry-run-analyze`  | `--dry-run-analyze`    | Same as `dry-run`, then dispatches an analyzer Agent on the Dry-Run Report to flag wiring errors, missing dependencies, mis-classified isolation, and anti-patterns. |

**`Mode` is set in Step 0 before any side-effecting action** and threaded through every TaskCreate / TaskUpdate / git / Agent verb downstream. Live mode is the default and is unaffected by the guards — the dry-run substitutions are no-ops when `Mode == live`.

**dry-run / dry-run-analyze skip rules:**
- **Real (kept for fidelity):** plan-file read, proposal extraction, TaskList preflight, Branch B senior reviewer dispatch, in-memory wiring integrity check.
- **Skipped:** `ExitPlanMode`, `TaskCreate`, `TaskUpdate`, git-prep execution, `git worktree add/remove`, `git merge`, `git branch -d`, all agent dispatches (run-agent / merge / regression), Step 4 execution loop.
- **Substitution:** each skipped TaskCreate/TaskUpdate prints `[DRY] would <verb> #DRY-N: <subject>` and mutates the in-memory ledger; the Step 4 loop is replaced by the Dry-Run Report.

**In-memory task ledger** — list of entries `{id: DRY-N, type, subject, description, blocked_by[], chain_id, chain_role, metadata: {}}` built during the creation and wiring phases. Source of truth for the wiring integrity check and the Dry-Run Report. The `metadata` field is populated from the `metadata` argument of each dry-run TaskCreate verb, using the same schemas defined in the Phase 1 creation pass below.

---

### Step 0 — Task API Preflight

**Mode detection (runs FIRST — before any side-effecting action):** inspect the arguments.
- Args contain `--dry-run-analyze` → `Mode = dry-run-analyze`
- Args contain `--dry-run` → `Mode = dry-run`
- Otherwise → `Mode = live`

**Plan path detection:** if args contain `--plan <path>`, capture `PlanPath = <path>` (absolute or relative to cwd). Otherwise `PlanPath = nil` (auto-discovery runs in Step 1).

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

**Plan-mode preflight:** if invoked while plan mode is active, call `ExitPlanMode` immediately after confirming the plan file is readable (Branch A) or as the first action of this step (Branch B). The plan is already approved — do not stall waiting for the user to exit. If `ExitPlanMode` is unavailable (host is not in plan mode), this is a no-op.

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

1. Resolve the plan file path:
   - If `PlanPath` is set (from `--plan <path>`): use it directly. Verify the file is readable; halt with `Plan file not found: <path>` if not.
   - Otherwise: auto-discover — planning mode context, current session, or `ls -t ~/.claude/plans/*.md | head -1`.
2. For each step, extract proposal: `What`=step title; `Why`=rationale/Context; `Scope`=small|medium|large
3. Note sequencing (step N requires step M) → record as logical DEPENDS ON hints; these drive chain detection and the two-phase creation/wiring pass
4. **Output Mapping Pass (structural analysis):** For each proposal, note the files it expects to modify. Using the DEPENDS ON graph from step 3, identify parallel proposals (no dependency path between them) that touch the same file. For each overlap, reason through three cases — touching the same file is NOT automatically a conflict:

   **Case A — Independent contributions:** Each parallel task adds distinct, non-overlapping content to a shared file (e.g., each adds its own unique route mount line, a distinct config key, a separate function). **No structural problem.** Git rebase handles concurrent appends to different regions. Continue as-is.

   **Case B — Shared structural prerequisite:** Multiple parallel tasks all require a structural element in a shared file to already exist — e.g., a router object, a base schema, a config section, an import block. The element doesn't exist yet and each task would try to create it. **Extract it.** Add a parent prepare task (DEPENDS ON in step 3) that creates the prerequisite; the parallel tasks extend it. Key signal: "Does this shared-file overlap reveal a missing setup task that all children depend on?"

   **Case C — Overlapping functionality:** Two or more parallel tasks modify the same region with semantically overlapping logic (same function body, same config key, same variable). These cannot be merged cleanly and represent a logical conflict. **Restructure.** Add DEPENDS ON to serialize them, or extract the shared region into a dedicated task.

   Emit an advisory note for Case A, a structural suggestion for Case B, and a required restructuring notice for Case C. Do not abort for Cases A or B.
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

**Routing (decided silently — never ask the user):**
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

**Dispatch protocol:**
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
- `A→B, A→C` (fan-out): A has succ==2 → not a seed. B and C → standalone.
- `A→B, B→C, B→D, C→E, D→E, E→F` (cascade — chain tail fans out, standalones converge to new chain):
  - Seed A: succ==1 → extend; B has pred==1, succ==2 → stop. Path=[A,B] → chain-1. A=head, B=tail.
  - Seeds C, D: each has succ==1(→E), but E has pred==2 → stop. Paths [C], [D] → standalones.
  - Seed E: succ==1 → extend; F has pred==1, succ==0 → stop. Path=[E,F] → chain-2. E=head, F=tail.
  - Wiring: chain-2's create-wt is blocked by B (chain-1 tail run-agent) AND C AND D (upstream standalone run-agents).

Print chain assignments after detection:
```
[chain] chain-1: Proposal-A (head) → Proposal-B (link) → Proposal-C (tail)
[chain] standalone: Proposal-D
```

**Mode-aware verb guards:**
- `Mode == live` → call `TaskCreate` and `TaskUpdate` for real.
- `Mode != live` → DO NOT call `TaskCreate` or `TaskUpdate`. Instead:
  - **Reference files are still loaded in dry-run** — `run-agent-description.md` and `create-wt-prompt.md` must be Read before the creation pass using the same JIT protocol as live mode. All placeholder substitutions are performed: Target branch from `git branch --show-current`, Self-merge from chain role (yes for tail/none, no for head/link), working directory from worktree path, definition of done from proposal. `[TASK_ID]` is substituted with `DRY-N` in Phase 1.5. The description stored in each ledger entry is the fully-substituted text, identical to what live mode would write into `TaskCreate`. Note: Chain/Chain ID remain in task `metadata` for wiring integrity checks but are no longer substituted into task description text.
  - For each TaskCreate (Phase 1): print `[DRY] would TaskCreate #DRY-N: <subject>`, append `{id: DRY-N, type, subject, description, blocked_by: [], chain_id, chain_role, metadata: <metadata arg>}` to the task ledger.
  - For each TaskUpdate (Phase 2 wiring): print `[DRY] would TaskUpdate #DRY-N addBlockedBy=[DRY-M, ...]`, mutate the ledger entry.
  - For each Merge description fill-in: print `[DRY] would TaskUpdate #DRY-N description`, mutate the ledger entry.
  - The creation ticker shows `#DRY-N` IDs in dry-run instead of real task IDs.


**Trivial override (dry-run only):** when `Mode != live`, ignore any `Trivial: yes` classification from the reviewer. Treat every proposal as a full non-trivial task — generate the complete `create-wt → run-agent` chain per proposal (or per chain: one create-wt for the whole chain).

**Two-phase task creation:**

Phase 1 — Creation: Create ALL tasks in parallel via a single response with N TaskCreate calls. Do not embed upstream task_ids in the subject, description, or activeForm of any task. Capture the returned task_ids. Print creation ticker.

Phase 1 — Metadata: Every TaskCreate includes a `metadata` argument. Schemas by task type:

```
git-prep:    { task_type: "git-prep",   chain_id: null, chain_role: null, isolation: "none",
               step: "preflight | checkpoint | setup-worktrees" }
create-wt:   { task_type: "create-wt",  chain_id: "chain-K"|null, chain_role: null,
               isolation: "native worktree", worktree_path: ".worktrees/chain-K",
               target_branch: "<captured branch>" }
run-agent:   { task_type: "run-agent",  chain_id: "chain-K"|null,
               chain_role: "head|link|tail|none",   // "none" = standalone (chain_id=null)
               isolation: "native worktree|none (trivial)",
               worktree_path: ".worktrees/chain-K", proposal_index: N,
               scope: "trivial|small|medium|large", target_branch: "<captured branch>" }
regression:  { task_type: "regression", chain_id: null, chain_role: null, isolation: "none" }
```

Phase 2 — Wiring: Wire dependencies via a single response using both `addBlockedBy` (on the downstream task) AND `addBlocks` (on the upstream task) for every dependency edge, so the graph is traversable in both directions without extra lookups. Print wiring ticker.

Pattern for each dependency pair (upstream → downstream):
```
TaskUpdate({ taskId: downstream_id, addBlockedBy: [upstream_id] })
TaskUpdate({ taskId: upstream_id,   addBlocks:    [downstream_id] })
```

Sequential TaskCreate is only required when the dependent task's description must literally reference the prerequisite's task_id — which should be avoided. Carry the relationship in TaskUpdate instead.

**Git-prep (always exactly 3 tasks — never merge or collapse):**
```
[git-prep 1/3] Task: Pre-flight staging check               → capture ID_preflight
[git-prep 2/3] Task: Checkpoint commit                      → capture ID_checkpoint
[git-prep 3/3] Task: Setup .worktrees directory             → capture ID_setup
```
*Wire:* `ID_checkpoint` is blocked by `ID_preflight`; `ID_setup` is blocked by `ID_checkpoint`.

**For each chain or standalone (topological order — predecessors before dependents):**

*Chain (chain-K, N members):*
```
[create-wt chain-K] Task: Create worktree chain-K           → capture ID_cwt_K
[run-agent head]    Task: Run agent: <head proposal>        → capture ID_head_K
[run-agent link]    Task: Run agent: <link proposal>        → capture ID_link_K
[run-agent tail]    Task: Run agent: <tail proposal>        → capture ID_tail_K
```
*Wire (via TaskUpdate addBlockedBy):* `ID_cwt_K` is blocked by `ID_setup` AND all upstream run-agent IDs this chain depends on; `ID_head_K` is blocked by `ID_cwt_K`; `ID_link_K` is blocked by its preceding run-agent; `ID_tail_K` is blocked by its preceding run-agent.

*Standalone (task-N):*
```
[create-wt task-N]  Task: Create worktree task-N            → capture ID_cwt_N
[run-agent task-N]  Task: Run agent: <proposal>             → capture ID_sa_N
```
*Wire:* `ID_cwt_N` is blocked by `ID_setup` + upstream tails; `ID_sa_N` is blocked by `ID_cwt_N`.

**Regression (if present):**
```
[regression]        Task: Regression: <scope>               → capture ID_regression
```
*Wire:* `ID_regression` is blocked by ALL chain-tail and standalone run-agents.
**Regression Blocker Reduction:** When a tail/standalone node `R` has a downstream tail/standalone `S` (via DEPENDS ON), the direct `R → regression` edge may be redundant.

- **REMOVE** the direct edge if `S`'s tests exercise `R`'s output — e.g., `S` runs an integration test that calls `R`'s API, reads `R`'s store, or asserts on `R`'s behavior.
- **KEEP** the direct edge if `R` has tests that `S` does NOT cover — e.g., `R` has unit-level tests for isolated logic that `S`'s integration test bypasses.
- When in doubt: **KEEP**. Redundant blockers are cheap; missed coverage is not.

**Trivial run-agents:** create only the run-agent task (no create-wt). In its Execution context set `Isolation: none (trivial)` and `Self-merge: yes`. Chain tasks are never trivial.

---

**`Target branch` capture:**
 At the start of the creation pass, capture once:
- `Target branch` = output of `git branch --show-current` (the branch being worked on — the merge destination)
- **NEVER read Target branch from the plan file's Git Strategy section.** That section states the author's intended branch name; it has nothing to do with the current repo state. Even if the plan says `feat/xyz` or `chore/abc`, run `git branch --show-current` and use whatever branch is actually checked out.

This command runs in both live and dry-run modes — it is read-only and not subject to the dry-run verb guard. Substitute into every worktree run-agent task description and every create-wt description. This value is NEVER `[placeholder]`. Assert 6 catches any remaining placeholders before execution.

**Run-agent description (dispatch protocol):**
1. **FIRST: `Read ${CLAUDE_SKILL_DIR}/references/run-agent-description.md`** — load the verbatim template.
2. **THEN:** Substitute placeholders per task, paste verbatim into `TaskCreate.description`. Do not paraphrase.
   - Set `## Working directory` to the absolute worktree path (e.g. `/repo/.worktrees/chain-1`) or `"main workspace"` for trivial tasks.
   - Set `MERGE_TARGET:` to the Target branch value for all orchestrator-dispatched tasks.
   - Set `Isolation:` to `native worktree` or `none (trivial)`.
   - Set `Sub-tasks allowed:` to `yes` for `Isolation: native worktree` tasks; `no` for trivial tasks.
   - Set `Self-merge:` to `yes` for Chain: none and Chain: tail tasks; `no` for Chain: head and Chain: link tasks.
   - Set `## Definition of done` to the concrete acceptance criteria for this proposal.
   - Leave `Task ID:` as the literal placeholder `[TASK_ID]` — the orchestrator fills it in Phase 1.5 after TaskCreate returns real IDs.

**Phase 1.5 — Task ID embedding** (runs after Phase 1 returns all IDs, before Phase 2 wiring):

For each run-agent task created in Phase 1, replace `[TASK_ID]` in its description with the real task ID:

```
For each (task_id, description) from Phase 1 output:
  enriched = description with "[TASK_ID]" replaced by str(task_id)
  Mode == live  → TaskUpdate({ taskId: task_id, description: enriched })
  Mode != live  → print [DRY] would TaskUpdate #DRY-N description (embed Task ID: DRY-N)
                  mutate ledger entry: description = enriched
```

**Create worktree task:** **FIRST: Read `${CLAUDE_SKILL_DIR}/references/create-wt-prompt.md`** — load the verbatim bash template. Before pasting, perform these substitutions in the bash code lines only (skip `#`-prefixed comment lines — those are instructional and use `task-N` as a label, not a substitution target):
- `[TARGET_BRANCH]` → the captured target branch value (appears twice: once as the fork point for `git worktree add`, once in the failure message)
- `task-N` → `chain-K` (e.g. `chain-1`) for chain create-wt tasks, or `task-N` (e.g. `task-3`) for standalone tasks
- `task-N-branch` → `chain-K-branch` (e.g. `chain-1-branch`) for chain tasks, or `task-N-branch` for standalones
Then paste verbatim as the TaskCreate description. Do not paraphrase any other content.

**Regression task description** (source: Branch A → plan's Verification section; Branch B → reviewer output):
```
## Purpose
Final regression suite — confirms no regressions across all merged changes.

## Working directory
main workspace

## Execution context
Isolation: none (serial)
Sub-tasks allowed: no

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

**Mode-aware execution guards:**
- `Mode == live` → run the loop exactly as specified below.
- `Mode != live` → **skip the execution loop entirely**. Run the wiring integrity check against the in-memory task ledger, then print the Dry-Run Report.

**Task-type contract:**

| Task type           | Identity                    | Has create-wt? | Has Merge? | Asserts | Resume method                   | Dispatch lane         |
|---------------------|-----------------------------|----------------|------------|---------|---------------------------------|-----------------------|
| run-agent worktree  | `Isolation: native worktree`| yes            | self (built-in) | 6    | branch in git log --merges → completed | parallel worktree; may spawn sub-task agents internally |
| run-agent trivial   | `Isolation: none (trivial)` | no             | no         | —       | git log title vs checkpoint     | serial main-workspace |
| regression          | type=regression             | no             | no         | 5       | re-run agent                    | serial main-workspace |
| create-wt           | type=create-wt              | self           | n/a        | 3       | `git worktree list`             | parallel background   |
| git-prep            | type=git-prep               | n/a            | n/a        | —       | re-run command (idempotent)     | inline (orchestrator) |

**Wiring integrity check** (inline, runs once before resume check):

| Check    | Applies to                          | Condition                                                                                  | Violation message                                                                |
|----------|-------------------------------------|--------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| Assert 3 | every create-wt                     | blockers include `Setup .worktrees` AND (if DEPENDS ON exists) ≥1 upstream tail/standalone | "Create worktree #N missing expected upstream run-agent blocker"                |
| Assert 5 | every regression (0 or 1)           | blocked by ALL chain-tail and standalone run-agents; chain-head/link NOT direct blockers   | "Regression task #N missing blockers [...]" OR "directly blocked by head/link"  |
| Assert 6 | every native-worktree run-agent     | `metadata.target_branch` is non-empty and not a placeholder (dry-run: ledger; live: TaskGet) | "Run-agent #N metadata.target_branch is missing or placeholder"                 |
| Assert 7 | every chain (≥2 members)            | exactly one create-wt exists and belongs to the chain-head                                 | "chain-link/tail task #N has its own create-wt — should share chain-K's"        |
| Assert 8 | every run-agent description         | contains the phrase "exactly one `git commit`" in `## Before return: commit`               | "Run-agent #N missing single-commit rule in ## Before return: commit"           |

Assert 3 exception: if the proposal has no DEPENDS ON, only `Setup .worktrees` is required — skip the upstream-blocker check.

If all pass: print `Wiring integrity: OK — N tasks verified` and continue.

**Resume check** (runs once before Phase A dispatch):

Query TaskList for `in_progress` tasks. None → proceed to Phase A. Else execution was interrupted; recover per task type before re-entering the wave-1 dispatch:

| Task type | Recovery |
|---|---|
| git-prep | Re-run the git command (all idempotent). Mark completed. |
| create-wt | `git worktree list`. If present → mark completed. If missing → re-run `git worktree add` → mark completed. |
| run-agent (trivial) | `git log <checkpoint-sha>..HEAD --oneline`. Commit matching task title present → mark completed; run cascade (TaskList scan → dispatch unblocked tasks). None → mark failed; do not cascade. |
| run-agent (worktree, Self-merge: yes) | `git log --merges --oneline \| grep <branch>`. Found → mark completed; run cascade. Not found but commits present → re-dispatch agent from self-merge step. No commits → mark failed; do not cascade. |
| run-agent (worktree, Self-merge: no) | `git -C .worktrees/<chain-K> log HEAD --oneline \| grep <task subject>`. Commit present → mark completed; run cascade. None → mark failed; do not cascade. |
| regression | Re-dispatch agent with existing description. |

---

**Execution — wave-1 dispatch + self-orchestrating cascade:**

**Execution Guard:** Do not begin dispatch until ALL Phase 2 `TaskUpdate` wiring calls have returned successfully. Tasks are inert metadata until claimed; wiring must be complete before any agent starts so dependency constraints are fully established.

```
Phase A — git-prep (orchestrator-inline, sequential):
  Run each git-prep task directly:
    Pre-flight staging check → Checkpoint commit → Setup .worktrees
  Mark each completed after running. Capture checkpoint SHA into orchestrator context.

Phase B — create-wt (background Tasks, parallel batch):
  Dispatch all create-wt tasks in ONE parallel batch (run_in_background=True).
  Poll TaskList until every create-wt reaches completed or failed.
  Any create-wt failure → halt; report; do not dispatch its run-agent.

Phase C — wave-1 run-agents (parallel dispatch, self-orchestrating cascade):
  wave1 = [t for t in TaskList({}) where t.status == "pending" and t.blockedBy all completed]
  This is every chain-head and standalone run-agent (their only blocker was a create-wt, now done).

  Dispatch ALL wave-1 run-agents in a SINGLE response as parallel Agent() calls.
  Each agent receives its full task description (TaskGet(id).description) — self-merge and
  cascade logic are embedded in the template; no additional wrapping needed.

  Cascade self-manages from here:
    Each agent → does work → commits → self-merges if Self-merge: yes →
    calls TaskUpdate(completed) → scans TaskList for newly unblocked pending tasks →
    claims them via TaskUpdate(in-progress) → dispatches Agent() for each in parallel.
    The graph drains itself. The orchestrator does not loop.

  Failure: agents follow `## On failure` in run-agent-description.md (TaskUpdate(failed) +
  investigation TaskCreate; FAILURE_TYPE ∈ {no_change, partial_change, test_failures,
  conflict_needs_user, needs_split}). Failed tasks do not cascade — downstream dependents
  remain pending and visible via `TaskList({})`. Orchestrator does not poll.

  Trivial run-agents and regression tasks are claimed and dispatched by whichever upstream
  agent's TaskList scan finds them newly unblocked.
```

---

**Git prep task execution** (inline):
- `Pre-flight staging check`: `git status`, stage relevant files (`git add <files>`, never `-A`)
- `Checkpoint commit`: if staged changes → `git commit -m "checkpoint: pre-execution state"` and capture SHA into orchestrator context; if clean → capture HEAD SHA. This SHA is held by the orchestrator for trivial task resume checks — it is never written into task descriptions.
- `Setup .worktrees`: use existing `.worktrees/` or create it, add to `.gitignore`, commit

**Create worktree task execution** (async background Task):

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
Build from ledger: for each unique `chain_id`, emit one row — list members in creation order (arrow-separated run-agent DRY IDs from `chain_role: head` → links → tail); worktree = `.worktrees/<chain_id>` for chains, `.worktrees/task-<C>` for standalones where `<C>` is the **create-wt task's DRY-N** (always one before its run-agent in the creation pass); merge point = the `chain_role: tail` member's run-agent DRY-N (or the standalone's run-agent DRY-N).

| Chain ID | Members (in order)            | Worktree              | Merge point |
|----------|-------------------------------|-----------------------|-------------|
| chain-1  | DRY-6 → DRY-9 → DRY-12      | .worktrees/chain-1    | DRY-12      |
| none     | DRY-15 (standalone)           | .worktrees/task-14    | DRY-15      |

### Task List — N tasks

| # | ID    | Type      | Subject                               | Blocked by          | Isolation         |
|---|-------|-----------|---------------------------------------|---------------------|-------------------|
| 1 | DRY-1 | git-prep  | Pre-flight staging check              | —                   | n/a               |
...

### Dependency Graph
<ASCII tree rooted at first task with no blockers>

### Task Details
**Required — do not omit.** This section is the audit trail for the wiring integrity check and the dry-run-analyze agent. Every ledger entry must appear with its fully-substituted description.

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

## Invariants

Rules not stated inline elsewhere. For mode/reference/wiring discipline, see Modes, Steps 0–3, and the dispatch protocols.

- **Sub-task agents are internal to a parent run-agent.** No TaskCreate. They are invisible to the orchestrator's task graph.
- **Sub-task `MERGE_TARGET` = the parent run-agent's working branch.** Never TARGET_BRANCH.
- **`run_in_background=True` only on create-wt.** Never on run-agent.
- **`conflict_needs_user` does not halt the loop** — only the affected merge chain stalls. Independent run-agents continue.
- **`git add -A` is forbidden in checkpoints.** Stage by name to avoid pulling unrelated state.
- **Parallel same-file edits are not automatic conflicts.** Restructure only when edits overlap semantically (same region, function, or config key). See Step 1 Output Mapping Pass.
- **Agents bias toward action.** Diagnose, fix, continue. Max 3 distinct attempts per obstacle.
- **Branch B drafts proposals from any signal** — commits, uncommitted changes, conversation context. Clean `git diff` alone is not terminal.
- **Senior reviewer retries on error.** A failed review is not approval.
- **No TaskCreate on Branch B before senior review completes.** Branch A may TaskCreate after Step 1.
- **When in doubt about isolation, create a worktree.**
