---
name: schedule-plan-tasks
description: |
  Analyzes an approved plan and decomposes it into a dependency-ordered task graph via a two-phase TaskCreate and TaskUpdate pass. Detects linear DEPENDS ON chains (shared worktree), identifies independent work streams (parallelized), and executes the full worktree-isolated run. Also handles Branch B (learnings from session context).

  **AUTOMATICALLY INVOKE** only when:
  - The PostToolUse(ExitPlanMode) hook has injected its schedule-tasks nudge in this turn (i.e., the user just approved a plan), AND the user has not signaled they want to defer execution.
  - /schedule-plan-tasks is invoked explicitly.
  - The user explicitly says "schedule tasks", "execute the plan", "decompose plan into tasks" — only when a plan exists at ~/.claude/plans/*.md AND ExitPlanMode has already been approved in this session.

  **DO NOT auto-invoke** while plan mode is active, while review-plan is iterating, or before the user has approved ExitPlanMode.

  **References:** JIT-loaded from `${CLAUDE_SKILL_DIR}/references/`
allowed-tools: Bash, TaskCreate, TaskUpdate, TaskList, Agent, Read, Write, Edit, Glob, Grep
---

# schedule-plan-tasks

Two entry points, one execution engine. **Branch A** reads an approved plan file and extracts its steps as proposals — the plan was reviewed before `ExitPlanMode`, so it goes straight to task-graph execution. **Branch B** assesses session learnings, drafts proposals from session state, and runs them through the senior engineer reviewer. Both branches converge into the same task-graph executor with native worktree isolation. Every unit of work — git prep, worktree creation, agent execution, merge-back — is a Task with explicit dependencies. Each delivery-agent merges its own changes back to the target branch after completing, using optimistic concurrency with rebase + retry.

**References model:** Verbatim sub-agent prompts and bash templates live in `${CLAUDE_SKILL_DIR}/references/*.md` and are loaded just-in-time. Citation rule: when a step says "Read references/X then dispatch", you MUST `Read` that file at its absolute path and paste its content verbatim into the Agent dispatch. Do not paraphrase, summarize, or "improve". Once Read in a session, the file content stays in context — re-Read only if it scrolls out.

---

## Modes

The skill runs in one of five modes, decided at the top of Step 0 by inspecting arguments:

| Mode               | Trigger flag           | TaskCreate/Update | Agent dispatch              | Use case                              |
|--------------------|------------------------|-------------------|-----------------------------|---------------------------------------|
| `live`             | (no flag)              | real              | real (real work)            | production execution                  |
| `dry-run`          | `--dry-run`            | real              | real (simulate-prefix mode) | end-to-end protocol validation        |
| `plan-only`        | `--plan-only`          | skipped (ledger)  | skipped                     | static topology report (no side effects) |
| `dry-run-analyze`  | `--dry-run-analyze`    | skipped (ledger)  | skipped + analyzer Agent    | static report + LLM critique          |
| `status-check`     | `--status`             | none              | none                        | short-circuit status snapshot         |

**`Mode` is set in Step 0 before any side-effecting action** and threaded through every TaskCreate / TaskUpdate / git / Agent verb downstream.

**Mode behaviors:**

- **`live`** — Real Task API ceremony, real git, real Agent dispatch with real work. Production path.

- **`dry-run`** — Real TaskCreate/TaskUpdate/TaskList ceremony AND real Agent dispatch, but each
  agent receives the contents of `references/simulate-prefix.md` PREPENDED to its task description.
  The prefix instructs the agent to: simulate work (no git, no file changes), run the cascade-identification
  directive read-only (TaskList/TaskGet only, no Agent or claim TaskUpdate), emit the standard
  RESULT/WORK/INCOMPLETE/FAILURE/ARTIFACT/DISPATCHED status block listing would-be-dispatched IDs.
  The orchestrator collects status blocks, dispatches the next wave (also with simulate prefix),
  iterates until the graph drains. Validates the agent ↔ orchestrator exchange end-to-end.

- **`plan-only`** — No real Task API ceremony, no Agent dispatch. Skipped TaskCreate/TaskUpdate
  print `[DRY] would <verb> #DRY-N: <subject>` and mutate an in-memory ledger. Step 4 execution
  loop is replaced by the Dry-Run Report. Static topology analysis only.

- **`dry-run-analyze`** — Same skip rules as `plan-only`, then dispatches one analyzer Agent on
  the Dry-Run Report to flag wiring errors, missing dependencies, mis-classified isolation,
  and anti-patterns.

- **`status-check`** — Short-circuit mode. Run `TaskList` + `git -C "$REPO_ROOT" log -1 --oneline "$INTEGRATION_BRANCH"` (if branch exists) + `git -C "$REPO_ROOT" worktree list`. Print the results in ≤ 50 lines. Exit before any side-effecting verb. No TaskCreate, no Agent dispatch, no git mutations.

**Trivial-task override:** in `plan-only` and `dry-run-analyze` modes, trivial proposals get the
full `create-wt → delivery-agent → merge` chain so the complete worktree isolation structure is
visible in the static report. (Live + dry-run skip the create-wt for trivial tasks.)

**In-memory task ledger** (used by `plan-only` and `dry-run-analyze`) — list of entries
`{id: DRY-N, type, subject, description, blocked_by[], chain_id, chain_role, metadata: {}}`
built during the creation and wiring phases. Source of truth for the wiring integrity check
and the Dry-Run Report. The `metadata` field is populated from the `metadata` argument of each
ledger TaskCreate verb, using the same schemas defined in the Phase 1 creation pass below.

---

### Step 0 — Task API Preflight

**Mode detection (runs FIRST — before any side-effecting action):** inspect the arguments.
- Args contain `--dry-run-analyze` → `Mode = dry-run-analyze`
- Args contain `--plan-only` → `Mode = plan-only`
- Args contain `--dry-run` → `Mode = dry-run`
- Args contain `--status` → `Mode = status-check`
- Otherwise → `Mode = live`

**Plan path detection:** if args contain `--plan <path>`, capture `PlanPath = <path>` (absolute or relative to cwd). Otherwise `PlanPath = nil` (auto-discovery runs in Step 1).

**`REPO_ROOT` resolution (runs after mode + plan-path detection, before any git/Agent action):**

Resolution order:
1. CLI flag `--repo <path>` → `REPO_ROOT_RAW = <path>` (highest precedence)
2. Plan front-matter (Branch A only, when `PlanPath` is set and readable): scan the first 30 lines of the plan file for a single line matching `^Repo:\s*(.+)$`. If found → `REPO_ROOT_RAW = <captured value>`. If multiple matching lines exist, halt with `Multiple Repo: declarations in plan front-matter — keep one`.
3. Otherwise → `REPO_ROOT_RAW = $(pwd)`

If `--repo` AND a `Repo:` header are both present, `--repo` wins; print `[REPO_ROOT] CLI flag overrides plan front-matter (was: <header value>)`.

Validation + normalization (applied to `REPO_ROOT_RAW`):
- Reject empty strings.
- Expand a leading `~` to `$HOME`.
- Resolve to absolute via `realpath -m "$REPO_ROOT_RAW"` (the `-m` flag accepts nonexistent paths for the bootstrap case). If `realpath -m` is unavailable on the host, fall back to `python3 -c "import os,sys; print(os.path.abspath(sys.argv[1]))" "$REPO_ROOT_RAW"`.
- After resolution, the path must be absolute. Reject any result that is not absolute.

The validated absolute path becomes `REPO_ROOT` for the rest of the run.

**Bootstrap detection (runs immediately after `REPO_ROOT` is resolved):**

Inspect the state of `REPO_ROOT`:

| State                                       | Action                                                                                                                                                                                                              |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Exists and contains `.git`                  | `BootstrapNeeded = no`. Continue normally.                                                                                                                                                                          |
| Doesn't exist OR exists without `.git`      | If args contain `--bootstrap`, OR the plan front-matter (first 30 lines) contains `^Bootstrap:\s*yes\s*$`, OR the plan's Context section literally contains `greenfield` or `new project` (auto-detect with banner notice `[bootstrap] auto-detected from plan Context (\"greenfield\"/\"new project\")`) → `BootstrapNeeded = yes`. Otherwise prompt the user via `AskUserQuestion`: "Bootstrap (recommended) / Skip / Cancel". Bootstrap → `BootstrapNeeded = yes`. Skip → halt with `REPO_ROOT <REPO_ROOT> is not a git repo. Pre-init manually and re-run.` Cancel → halt with `User canceled before bootstrap.` |

When `BootstrapNeeded = yes`, the orchestrator runs the bootstrap bash body **inline-before-creation** (a documented "Phase −1") so that by the time Step 3's branch-capture executes (`git -C "$REPO_ROOT" branch --show-current` and `rev-parse --short HEAD`), the repo exists with a HEAD commit on `init.defaultBranch`. The bootstrap git-prep task is therefore NOT emitted in cold-start runs (its work is already done); the existing per-step skip condition for `bootstrap` keys off `BootstrapNeeded` having been resolved inline. After bootstrap, surface to the user:
```
[bootstrap] init.defaultBranch=<branch> sha=<short-sha>
```
This closes the spec circular dependency where Step 3's branch capture was specified to run before any task body.

In `dry-run`, `plan-only`, and `dry-run-analyze` modes the inline bootstrap bash is NOT executed (consistent with the verb-guard table); a `[DRY] would bootstrap at $REPO_ROOT` notice is printed and `BootstrapNeeded` is treated as already-resolved for downstream branch-capture (which itself is read-only and continues to run).

Print the active mode + repo banner once:
```
## schedule-plan-tasks — Mode: <live|dry-run|plan-only|dry-run-analyze>
## schedule-plan-tasks — Repo: <REPO_ROOT>[ (bootstrap pending)]
```

Per-mode banner notes:
- `dry-run`: print `[DRY-RUN] Real Task API + real Agent dispatch with simulate-prefix. No git or file side effects. End-to-end protocol validation.`
- `plan-only`: print `[PLAN-ONLY] No Tasks or git operations will be created. Output: static task list + dependency graph.`
- `dry-run-analyze`: print `[ANALYZE] Same as plan-only, plus analyzer Agent on the report.`

Initialize an empty in-memory task ledger when `Mode == plan-only or dry-run-analyze`. Assign IDs `DRY-1`, `DRY-2`, … in (would-be) TaskCreate order. (`live` and `dry-run` use real task IDs from real TaskCreate.)

`TaskList`. If errors:
- Print: `Task API unavailable: [error]`
- Print: `schedule-plan-tasks requires TaskCreate, TaskUpdate, TaskList. Halting before review agent dispatch.`
- STOP. No review dispatch. No tasks created.

If TaskList succeeds, continue. Narrate progress in plain prose — do not create phase-tracking tasks.

---

### Step 1 — Get the Plan

**Plan-mode preflight:** if invoked while plan mode is active, call `ExitPlanMode` immediately after confirming the plan file is readable (Branch A) or as the first action of this step (Branch B). The plan is already approved — do not stall waiting for the user to exit. If `ExitPlanMode` is unavailable (host is not in plan mode), this is a no-op.

**Mode-aware ExitPlanMode guard:** when `Mode != live`, do NOT call `ExitPlanMode` — print `[DRY] would ExitPlanMode` and stay in plan mode (truly side-effect-free).

**Git context prime** (operates on `$REPO_ROOT`; skip all git commands if `[ ! -d "$REPO_ROOT/.git" ]`, note "no git repo"):
- `git -C "$REPO_ROOT" log -1 --oneline` — last commit SHA + message
- `git -C "$REPO_ROOT" diff HEAD --name-only` — files currently modified
- If commit message is ambiguous: `git -C "$REPO_ROOT" show --stat HEAD`

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

   **Stale-state warning (runs immediately after proposals are extracted — step 2 output):** Run `git -C "$REPO_ROOT" log -10 --oneline "$UPSTREAM_BRANCH"` and for each proposal title T just extracted, check whether T appears as a contiguous case-insensitive substring of any commit subject in that log. If any match is found, print:
   ```
   [WARNING] Possible re-run on already-executed plan.
     The following proposal titles match recent commits on $UPSTREAM_BRANCH:
       - "<title>" matches commit <sha> "<commit subject>"
     You may be re-running a previously-executed plan. Verify intent before proceeding.
   ```
   Print the warning but do not halt. Use case-insensitive substring match only (no Levenshtein or word-overlap). This check runs only in `live` mode; skip in `dry-run`, `plan-only`, `dry-run-analyze`, and `status-check` modes.
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

In live mode, scan recent work and draft proposals (all git commands operate on `$REPO_ROOT`):
1. `git -C "$REPO_ROOT" log -10 --oneline` — what just shipped
2. `git -C "$REPO_ROOT" diff HEAD --name-only` — uncommitted work
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

The execution mode (worktree vs serial main-workspace) is decided per-proposal, not as a global path: trivial proposals run inline in the main workspace; non-trivial proposals run in worktrees — the orchestrator merges the agent's branch into INTEGRATION_BRANCH after receiving the agent's completion notification. The mechanism is the `Isolation:` line on each delivery-agent task (`native worktree` vs `none (trivial)`) — see the task-type contract in Step 4.

---

### Step 2 — Review Agent

**Branch B:** runs the senior-engineer de-duplication review (the existing `reviewer-full.md` prompt) — see protocol below.

**Branch A:** runs an internal-consistency review using `reviewer-branch-a.md` (different goals from Branch B's de-duplication pass — targets contradictions, missing prerequisites, scope mismatches, verification gaps). **Default: ON.** The review is skipped on Branch A iff:
- the plan front-matter (first 30 lines) contains `^Skip-review:\s*yes\s*$`, OR
- the user passed `--no-review`.

When skipped, print `[review] Branch-A consistency review skipped (front-matter/flag)` and proceed to Step 3.

When the Branch-A review runs and emits FLAG findings (verdict `FLAG`), the orchestrator presents each finding via a single `AskUserQuestion`: "Accept and proceed / Halt for plan revision / Skip this finding". Accept → continue. Halt → stop and ask the user to re-run after editing the plan. Skip → record the dismissal in the run log and continue. The reviewer is advisory — it does not block on `PASS` and does not auto-halt on `FLAG`.

For the Branch-B path the rest of this step (the de-duplication review) is identical to the prior contract:

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

**Dispatch protocol (Branch B):**
1. **FIRST: `Read ${CLAUDE_SKILL_DIR}/references/reviewer-full.md`** — load the verbatim prompt into context.
2. **THEN:** Dispatch the Agent with that prompt verbatim, substituting placeholders. Do not paraphrase, summarize, or rewrite.

**Dispatch protocol (Branch A — internal-consistency review):**
1. **FIRST: `Read ${CLAUDE_SKILL_DIR}/references/reviewer-branch-a.md`** — load the verbatim prompt into context.
2. **THEN:** Dispatch the Agent with `{plan_text}` substituted = full plan file content. Do not paraphrase. The reviewer returns `PASS` (proceed) or `FLAG` with a list of `category | task-id | quote | why-it-matters | resolution` findings. Surface each finding via a single AskUserQuestion (Accept / Halt / Skip) per the gating rule above.

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

**Git repo guard** (before Pass 1): inspect `BootstrapNeeded` from Step 0.

- `BootstrapNeeded == no` (existing repo at `$REPO_ROOT`) → continue.
- `BootstrapNeeded == yes` → emit an extra git-prep task `bootstrap` ahead of `preflight` (see "Git-prep tasks" below). The bootstrap task creates `$REPO_ROOT`, runs `git init`, writes `README.md`, and lands an initial commit. The existing `preflight` task is wired to be blocked by `bootstrap`.

Bootstrap task body (live mode runs the bash; ledger-only modes record the description):

```bash
mkdir -p "$REPO_ROOT"
git -C "$REPO_ROOT" init
touch "$REPO_ROOT/README.md"
git -C "$REPO_ROOT" add README.md
git -C "$REPO_ROOT" commit -m "init"
```

Precondition: relies on the user's global git identity (`user.name`/`user.email`). If absent, `git commit` fails with git's standard error — surface verbatim and halt; do not auto-configure identity. After the initial commit `git -C "$REPO_ROOT" branch --show-current` returns the user's `init.defaultBranch` (commonly `main` or `master`); the existing `Target branch` capture (Step 3) picks it up unchanged.

In `dry-run`, `plan-only`, and `dry-run-analyze` modes the bootstrap task is created/recorded but its bash body is NOT executed (consistent with the git-prep verb-guard table).

**Chain detection (runs after proposals are finalized, before the creation pass):**

1. Build directed graph from DEPENDS ON hints:
   - `succ[N]` = set of proposals whose delivery-agents must be blocked by N's delivery-agent (N's direct successors)
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
  - Wiring: chain-2's create-wt is blocked by B (chain-1 tail delivery-agent) AND C AND D (upstream standalone delivery-agents).

Print chain assignments after detection:
```
[chain] chain-1: Proposal-A (head) → Proposal-B (link) → Proposal-C (tail)
[chain] standalone: Proposal-D
```

**Concurrency Audit Pass** (runs immediately after chain detection, before the creation pass):

Apply three rules to potentially refine the task graph. All rules fail closed — when uncertain, keep the existing topology.

**Split rule.** For each delivery-agent task whose envelope lists ≥ 2 source files: if every listed file (a) has exactly one author task in the plan AND (b) each file's only cross-task interaction is appending to a shared mountpoint/registration file (Case A semantics from the Output Mapping Pass in Step 1) AND (c) no listed file imports another listed file in the same task — then split into N parallel sibling tasks (one per file). Each sibling is blocked on the original task's blockers. The shared mountpoint file is appended to in each sibling and rebases cleanly via Case-A semantics. If any condition is uncertain, do NOT split.

**Worked split example:** A task writing `src/routes/{scenarios,project,simulate,tax}.ts` + `src/server.ts` mountpoints: each route file has one author, shared file is `src/server.ts` (append-only register lines), no route imports another → split into 4 parallel siblings, each blocked on the same upstream tasks.

**Refusal example (when NOT to split):** A task writing `src/db/schema.ts` + `src/db/migrations/001_init.ts` + `src/db/client.ts`: schema is imported by both migration and client → fails rule (c) → keep bundled.

**De-chain rule (regex-bounded).** A tail task T is reclassified from `Chain: tail` to `Chain: none` (standalone) ONLY IF:
- T's envelope guidance matches `/(import|reads?|consumes?|uses?)\s+\S+\s+from\s+\S*\.(types|schema|contract|interface)\b/i`
- AND T's envelope guidance does NOT match `/(import|requires?)\s+\S+\s+from\s+\S*\.(impl|service|handler)\b/i`
- AND manual override is absent: plan author can pin `Chain: tail` with a `<!-- pin-chain -->` HTML comment in the proposal to suppress this rule.
If either condition is uncertain, keep the chain edge. When reclassified, T's blocker becomes the original upstream chain's tail.

**Regression Blocker Reduction enhancement (regex-bounded).** Augments the existing Regression Blocker Reduction (see Step 3 creation pass): when tail/standalone R has a downstream tail/standalone S, drop the direct R → regression edge only if BOTH:
- S's verification text matches `/(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/`
- AND S's envelope guidance matches `/from\s+['"][^'"]*<R-module-name>[^'"]*['"]/` where `<R-module-name>` is derived from R's primary file (e.g. `src/engine/tax.ts` → `tax`).
Otherwise keep the edge.

**Linear-chain serial shortcut (auto-take when topology is single-chain-no-standalones):**

When chain detection produces **exactly 1 chain with ≥1 nodes and 0 standalones**, take the
serial-on-feature-branch path automatically (no AskUserQuestion). Print:
```
[topology] single-chain-no-standalones — taking linear shortcut (no .worktrees/, no integration branch)
```

Behavior:
1. Skip create-wt entirely. No `.worktrees/` directory is created.
2. Skip the `integration-branch` git-prep task. Instead, capture `ORIGIN_BRANCH = git -C "$REPO_ROOT" branch --show-current` (the user's working branch), then create `feat/<plan-slug>-<short-sha>` directly on the user's repo and check it out.
3. For each chain member, dispatch the delivery-agent with envelope `Working directory: $REPO_ROOT` (main repo, not a worktree). The orchestrator merges the tail's branch into `ORIGIN_BRANCH` after receiving the tail's completion notification — if the user was on `main`, this ff's main; if on a topic branch, that topic branch advances. The merge target is therefore `ORIGIN_BRANCH`, not `INTEGRATION_BRANCH`.
4. The envelope's `MERGE_TARGET:` field is set to `ORIGIN_BRANCH` for tail members, and to `feat/<plan-slug>-<short-sha>` for head and links (so each link commits onto the feature branch). The orchestrator merge algorithm at Step 4 `ORCHESTRATOR_MERGE_ALGORITHM` is applied — only the merge-target ref differs.
5. `open-pr` proceeds against `feat/<plan-slug>-<short-sha> → ORIGIN_BRANCH` (or no-op + summary file when no remote — see Step 5).
6. **Dirty working tree at start:** if `git -C "$REPO_ROOT" status --porcelain` is non-empty when the shortcut path is selected, AskUserQuestion: "Cancel". (Cancel only — no auto-stash; the user resolves manually.)

Parallel-chain topology (≥2 chains OR ≥1 standalone) keeps the existing worktree machinery
unchanged — `.worktrees/`, `integration-branch`, `INTEGRATION_BRANCH` as `MERGE_TARGET`.

**Mode-aware verb guards (4-tier):**

| Verb / op                      | live | dry-run                      | plan-only          | dry-run-analyze    | Backgrounded? |
|--------------------------------|------|------------------------------|--------------------|--------------------|---------------|
| `TaskCreate`                   | real | real                         | ledger only        | ledger only        | no            |
| `TaskUpdate`                   | real | real                         | ledger only        | ledger only        | no            |
| `TaskList` / `TaskGet`         | real | real                         | n/a (ledger)       | n/a (ledger)       | no            |
| Git operations (worktree etc.) | real | skipped                      | skipped            | skipped            | live: heavy bash backgrounded (preflight-patch capture, integration-branch, setup-worktrees); cheap (`rev-parse`) inline |
| Agent (delivery-agent)         | real | real, simulate-prefix prepended | skipped         | skipped            | live: yes (`run_in_background: true`); dry-run: no (synchronous so simulate-prefix path works) |
| Agent (regression)             | real | real, simulate-prefix prepended | skipped         | skipped            | live: yes; dry-run: no |
| Bash (open-pr body)            | real | replaced by [DRY] notice     | skipped            | skipped            | live: yes |
| Agent (analyzer)               | n/a  | n/a                          | n/a                | real (audits report) | no |

**Reference files are loaded in all modes** — `delivery-agent-description.md` and `create-wt-prompt.md`
must be Read before the creation pass using the same JIT protocol regardless of mode. All
placeholder substitutions are performed: `UPSTREAM_BRANCH` from `git branch --show-current`,
`INTEGRATION_BRANCH` synthesized as `schedule/<slug>-<short-sha>` (used as the create-wt fork point
and every delivery-agent's `MERGE_TARGET`), working directory from worktree path, definition of done from proposal. In `live` and
`dry-run` modes `[TASK_ID]` is substituted with the real task ID returned by TaskCreate (Phase 1.5);
in `plan-only` and `dry-run-analyze` it's substituted with `DRY-N`. The envelope's `Chain:` line is
substituted from `metadata.chain_id` (or `none` when `metadata.chain_role == "none"`); the chain
metadata stays in task `metadata` for wiring integrity checks.

**Ledger-only behavior (plan-only, dry-run-analyze):**
- For each would-be TaskCreate (Phase 1): print `[DRY] would TaskCreate #DRY-N: <subject>`,
  append `{id: DRY-N, type, subject, description, blocked_by: [], chain_id, chain_role,
  metadata: <metadata arg>}` to the task ledger.
- For each would-be TaskUpdate (Phase 2 wiring): print `[DRY] would TaskUpdate #DRY-N
  addBlockedBy=[DRY-M, ...]`, mutate the ledger entry.
- For each would-be Merge description fill-in: print `[DRY] would TaskUpdate #DRY-N description`,
  mutate the ledger entry.

**Trivial override (plan-only and dry-run-analyze):** when `Mode in {plan-only, dry-run-analyze}`,
ignore any `Trivial: yes` classification from the reviewer. Treat every proposal as a full
non-trivial task — generate the complete `create-wt → delivery-agent` chain per proposal (or per
chain: one create-wt for the whole chain). This makes the static report show the full worktree
isolation structure. In `live` and `dry-run` modes, trivial proposals keep `Isolation: none
(trivial)` and run inline without their own create-wt.

**Two-phase task creation:**

Phase 1 — Creation: Create ALL tasks in parallel via a single response with N TaskCreate calls. Do not embed upstream task_ids in the subject, description, or activeForm of any task. Capture the returned task_ids. Print creation ticker.

Phase 1 — Metadata: Every TaskCreate includes a `metadata` argument. Schemas by task type:

```
git-prep:    { task_type: "git-prep",   chain_id: null, chain_role: null, isolation: "none",
               step: "bootstrap | preflight | checkpoint | integration-branch | setup-worktrees",
               repo_root: "<absolute REPO_ROOT>" }
create-wt:   { task_type: "create-wt",  chain_id: "chain-K"|null, chain_role: null,
               isolation: "native worktree",
               worktree_path: "<REPO_ROOT>/.worktrees/chain-K",
               target_branch: "<INTEGRATION_BRANCH>",
               upstream_branch: "<UPSTREAM_BRANCH>",
               integration_branch: "<INTEGRATION_BRANCH>",
               repo_root: "<absolute REPO_ROOT>" }
delivery-agent:   { task_type: "delivery-agent",  chain_id: "chain-K"|null,
               chain_role: "head|link|tail|none",   // "none" = standalone (chain_id=null)
               isolation: "native worktree|none (trivial)",
               worktree_path: "<REPO_ROOT>/.worktrees/chain-K", proposal_index: N,
               scope: "trivial|small|medium|large", target_branch: "<INTEGRATION_BRANCH>",
               upstream_branch: "<UPSTREAM_BRANCH>",
               integration_branch: "<INTEGRATION_BRANCH>",
               repo_root: "<absolute REPO_ROOT>" }
regression:  { task_type: "regression", chain_id: null, chain_role: null, isolation: "none",
               execution_lane: "agent | inline",   // default "agent"; see lane-selection rule below
               repo_root: "<absolute REPO_ROOT>" }
open-pr:     { task_type: "open-pr",    chain_id: null, chain_role: null, isolation: "none",
               execution_lane: "agent | inline",   // default "agent"; see lane-selection rule below
               repo_root: "<absolute REPO_ROOT>",
               upstream_branch: "<UPSTREAM_BRANCH>",
               integration_branch: "<INTEGRATION_BRANCH>" }
recap:       { task_type: "recap",      chain_id: null, chain_role: null, isolation: "none",
               repo_root: "<absolute REPO_ROOT>",
               upstream_branch: "<UPSTREAM_BRANCH>",
               integration_branch: "<INTEGRATION_BRANCH>" }
```

**`execution_lane` selection rule (set at TaskCreate time, never mid-run):**

Default `execution_lane = "agent"` for both regression and open-pr (preserves existing contract). Set `execution_lane = "inline"` only when ALL conditions hold:

- **regression:** the verification command set is fully scriptable (curl + test runner + grep — no manual UI step, no human-in-the-loop checks).
- **open-pr:** there is no remote (`git -C "$REPO_ROOT" remote` is empty) OR every sub-action of the open-pr body is deterministic bookkeeping (assemble PR body, write file, close out — no interactive `gh pr create`).

When `execution_lane: "inline"`, the orchestrator runs the task body directly in-loop and MUST still emit a synthetic status block into the task metadata: `{result, work, incomplete, failure, artifact}`. If the synthetic regression status is `failed`, the orchestrator MUST follow `${CLAUDE_SKILL_DIR}/references/investigation-task-template.md` itself (TaskCreate the sibling investigation task) — no improvising to ISSUES.md. Failed inline-lane tasks cascade exactly the same way agent-lane failures do.

Phase 2 — Wiring: Wire dependencies via a single response using both `addBlockedBy` (on the downstream task) AND `addBlocks` (on the upstream task) for every dependency edge, so the graph is traversable in both directions without extra lookups. Print wiring ticker.

Pattern for each dependency pair (upstream → downstream):
```
TaskUpdate({ taskId: downstream_id, addBlockedBy: [upstream_id] })
TaskUpdate({ taskId: upstream_id,   addBlocks:    [downstream_id] })
```

Sequential TaskCreate is only required when the dependent task's description must literally reference the prerequisite's task_id — which should be avoided. Carry the relationship in TaskUpdate instead.

**Git-prep (4 tasks normally, 5 when `BootstrapNeeded == yes` — never merge or collapse):**
```
[git-prep 0/5] Task: Bootstrap repo at $REPO_ROOT            → capture ID_bootstrap     (emitted only when BootstrapNeeded == yes)
[git-prep 1/N] Task: Pre-flight staging check               → capture ID_preflight
[git-prep 2/N] Task: Checkpoint commit                      → capture ID_checkpoint
[git-prep 3/N] Task: Create integration branch              → capture ID_integration
[git-prep 4/N] Task: Setup .worktrees directory             → capture ID_setup
```
*Wire:* when `BootstrapNeeded == yes`, `ID_preflight` is blocked by `ID_bootstrap`.
Always: `ID_checkpoint` is blocked by `ID_preflight`; `ID_integration` is blocked by
`ID_checkpoint`; `ID_setup` is blocked by `ID_integration`.

**Ordering rationale for `Create integration branch`:** `ID_checkpoint` commits any
staged-but-uncommitted work onto `UPSTREAM_BRANCH`. The integration branch must fork
*after* that so it inherits the checkpoint; every worktree subsequently forks from
`INTEGRATION_BRANCH` and inherits it transitively. Worktrees never directly fork from
`UPSTREAM_BRANCH` in the new flow.

`Create integration branch` task body (live mode runs the bash; ledger-only modes
record the description):
```bash
git -C "$REPO_ROOT" checkout -b "$INTEGRATION_BRANCH" "$UPSTREAM_BRANCH"
git -C "$REPO_ROOT" checkout "$UPSTREAM_BRANCH"   # leave user on their branch
```

In `dry-run`, `plan-only`, and `dry-run-analyze` modes the integration-branch task is
created/recorded but its bash body is NOT executed (consistent with the git-prep
verb-guard table). The orchestrator merges delivery-agent branches into `$INTEGRATION_BRANCH` after receiving each agent's completion notification; the final
`open-pr` task PRs `INTEGRATION_BRANCH → UPSTREAM_BRANCH`.

**For each chain or standalone (topological order — predecessors before dependents):**

*Chain (chain-K, N members):*
```
[create-wt chain-K] Task: Create worktree chain-K           → capture ID_cwt_K
[delivery-agent head]    Task: Delivery agent: <head proposal>        → capture ID_head_K
[delivery-agent link]    Task: Delivery agent: <link proposal>        → capture ID_link_K
[delivery-agent tail]    Task: Delivery agent: <tail proposal>        → capture ID_tail_K
```
*Wire (via TaskUpdate addBlockedBy):* `ID_cwt_K` is blocked by `ID_setup` AND all upstream delivery-agent IDs this chain depends on; `ID_head_K` is blocked by `ID_cwt_K`; `ID_link_K` is blocked by its preceding delivery-agent; `ID_tail_K` is blocked by its preceding delivery-agent.

*Standalone (task-N):*
```
[create-wt task-N]  Task: Create worktree task-N            → capture ID_cwt_N
[delivery-agent task-N]  Task: Delivery agent: <proposal>             → capture ID_sa_N
```
*Wire:* `ID_cwt_N` is blocked by `ID_setup` + upstream tails; `ID_sa_N` is blocked by `ID_cwt_N`.

**Regression (if present):**
```
[regression]        Task: Regression: <scope>               → capture ID_regression
```
*Wire:* `ID_regression` is blocked by ALL chain-tail and standalone delivery-agents.
**Regression Blocker Reduction:** When a tail/standalone node `R` has a downstream tail/standalone `S` (via DEPENDS ON), the direct `R → regression` edge may be redundant.

- **REMOVE** the direct edge if `S`'s tests exercise `R`'s output — e.g., `S` runs an integration test that calls `R`'s API, reads `R`'s store, or asserts on `R`'s behavior.
- **KEEP** the direct edge if `R` has tests that `S` does NOT cover — e.g., `R` has unit-level tests for isolated logic that `S`'s integration test bypasses.
- When in doubt: **KEEP**. Redundant blockers are cheap; missed coverage is not.

**Open-PR (always present — graph terminus for PR-open):**
```
[open-pr]           Task: Open PR: $INTEGRATION_BRANCH → $UPSTREAM_BRANCH  → capture ID_open_pr
```
*Wire:* `ID_open_pr` is blocked by `ID_regression` if a regression task exists,
otherwise by ALL chain-tail and standalone delivery-agents (same blocker shape as
regression). `ID_open_pr` is one of two parallel terminus tasks (the other is
Recap & Review below).

**Recap & Review (always present — parallel graph terminus for human reporting):**
```
[recap]             Task: Recap & Review: $PLAN_TITLE          → capture ID_recap
```
*Wire:* `ID_recap` is blocked by `ID_regression` if a regression task exists, AND by
ALL chain-tail and standalone delivery-agents. This is the same blocker shape as
`ID_open_pr` plus the explicit regression edge — recap should run after regression so
the regression outcome (pass/fail) appears in the recap. Recap does NOT block `ID_open_pr`
and `ID_open_pr` does NOT block recap; they are sibling terminuses. Recap runs in
foreground when dispatched; open-pr runs backgrounded.

*TaskCreate shape:*
```
TaskCreate({
  subject: "Recap & Review: <PLAN_TITLE>",
  description: <rendered template — see below>,
  activeForm: "Generating run recap",
  metadata: {
    task_type: "recap",
    repo_root: "<absolute REPO_ROOT>",
    upstream_branch: "<UPSTREAM_BRANCH>",
    integration_branch: "<INTEGRATION_BRANCH>"
  }
})
```

### Recap description rendering

**FIRST: `Read ${CLAUDE_SKILL_DIR}/references/recap-task-template.md`** — load the verbatim
template. Then substitute the five placeholders below in two passes (use replace-all for
each, since `[REPO_ROOT]` appears more than once in the template):

| Placeholder            | Value                                                                                                                       | Substituted at                              |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
| `[REPO_ROOT]`          | absolute `$REPO_ROOT`                                                                                                       | Pass 1 — Step 3 TaskCreate                  |
| `[INTEGRATION_BRANCH]` | captured `$INTEGRATION_BRANCH`                                                                                              | Pass 1 — Step 3 TaskCreate                  |
| `[TASK_IDS]`           | comma-separated delivery-agent task IDs (heads, links, tails, standalones — NOT regression/open-pr/git-prep/create-wt/recap) | Pass 1 — Step 3, after Phase 1 returns IDs  |
| `[PLAN_TITLE]`         | first `# Heading` of the plan file (Branch A) or `Branch B (session learnings)` (Branch B)                                  | Pass 1 — Step 3 TaskCreate                  |
| `[RUN_START_SHA]`      | `git rev-parse "$INTEGRATION_BRANCH"` after integration-branch creation                                                     | Pass 2 — Step 4 Phase A TaskUpdate          |

`[RUN_START_SHA]` stays literal at TaskCreate time (the integration branch doesn't exist
yet). In `dry-run`/`plan-only`/`dry-run-analyze` modes Pass 2 substitutes the literal
string `dry-run-no-sha` so the ledger description stays internally consistent; cascade
dispatch in Step 4 skips the actual recap agent in those modes (consistent with the
verb-guard table).

Paste the Pass-1 partially-substituted template verbatim as the TaskCreate description.

**Trivial delivery-agents:** create only the delivery-agent task (no create-wt). In its Execution context set `Isolation: none (trivial)`. Chain tasks are never trivial. (Sub-task spawning is always available — no field controls it; the agent decides at runtime.)

---

**`UPSTREAM_BRANCH` and `INTEGRATION_BRANCH` capture:**

At the start of the creation pass, capture two distinct branches — these replace the
single `Target branch` of older revisions of this skill:

- `UPSTREAM_BRANCH` = output of `git -C "$REPO_ROOT" branch --show-current` — the branch
  the user was on when they invoked the skill (typically `main` or a feature branch).
  This is the **PR target** at the end of the run.
- `INTEGRATION_BRANCH` = `schedule/<slug>-<short-sha>` where:
  - `<slug>` = basename of the plan file (Branch A) with `.md` stripped, or
    `branch-b-<unix-epoch>` for Branch B (epoch suffix prevents collision when two
    Branch-B runs land at the same `HEAD` SHA in quick succession).
  - `<short-sha>` = `git -C "$REPO_ROOT" rev-parse --short HEAD` of `UPSTREAM_BRANCH`.

  Pre-flight: if `git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$INTEGRATION_BRANCH"`
  succeeds (branch already exists from a prior aborted run), halt with a clear message
  asking the user to delete the stale branch (`git branch -D <name>`) or re-run after
  cleanup. Do not silently reuse — a stale integration branch may carry unmerged work.

  This is the **`MERGE_TARGET`** for every delivery-agent. The integration branch is
  cut off `UPSTREAM_BRANCH` *after* the checkpoint commit (see `[git-prep N] Create
  integration branch` below) so it inherits any staged-but-uncommitted state captured
  by the checkpoint, and every worktree forks from `INTEGRATION_BRANCH` (not from
  `UPSTREAM_BRANCH`) — inheriting the checkpoint transitively.

- **NEVER read either branch from the plan file's Git Strategy section.** That section
  states the author's intended branch name; it has nothing to do with the current repo
  state. Even if the plan says `feat/xyz` or `chore/abc`, capture from `git -C
  "$REPO_ROOT" branch --show-current` for `UPSTREAM_BRANCH` and synthesize
  `INTEGRATION_BRANCH` from the rule above.

The `git -C "$REPO_ROOT" branch --show-current` and `rev-parse --short HEAD` commands
run in both live and dry-run modes — they are read-only and not subject to the dry-run
verb guard. The actual `git checkout -b "$INTEGRATION_BRANCH"` is gated by the
verb guard via the `[git-prep N] Create integration branch` task body — skipped in
dry-run/plan-only/dry-run-analyze modes.

`UPSTREAM_BRANCH` and `INTEGRATION_BRANCH` are substituted into every worktree
delivery-agent task description and every create-wt description (the create-wt template's
`[TARGET_BRANCH]` placeholder is now replaced with `INTEGRATION_BRANCH` since that's
what each worktree forks from). These values are NEVER `[placeholder]`. Assert 6
catches any remaining placeholders before execution.

**Backwards naming:** older sections of this skill still refer to the single capture
as `Target branch`; treat any such reference as `INTEGRATION_BRANCH` for substitution
purposes (the merge destination). `UPSTREAM_BRANCH` is the PR target only.

**Delivery-agent description (dispatch protocol):**
1. **FIRST: `Read ${CLAUDE_SKILL_DIR}/references/delivery-agent-description.md`** — load the verbatim envelope template. The agent's behavior contract (lifecycle, merge protocol, status protocol, specialist catalog, sub-task spawning) lives in `agents/delivery-agent.md` and is loaded by the harness — do NOT paste any of that into the description.
2. **THEN:** Substitute placeholders per task, paste verbatim into `TaskCreate.description`, and dispatch with `subagent_type: "delivery-agent"`. Do not paraphrase.
   - Set `Working directory:` to the absolute worktree path `$REPO_ROOT/.worktrees/<id>` (e.g. `/Users/x/projectB/.worktrees/chain-1`) or `main workspace` for trivial tasks. Always absolute — never relative — because the agent's host CWD may differ from `$REPO_ROOT`.
   - Set `MAIN_REPO_ROOT:` to `$REPO_ROOT` (absolute) for every orchestrator-dispatched delivery-agent task. The orchestrator's merge algorithm reads this header to locate the main repo (a worktree's `git rev-parse --show-toplevel` returns the worktree itself, not the main repo).
   - Set `MERGE_TARGET:` to the `INTEGRATION_BRANCH` value for all orchestrator-dispatched tasks.
   - Set `Isolation:` to `native worktree` or `none (trivial)`.
   - Set `Chain:` to the task's `metadata.chain_id` (e.g. `chain-1`) when `metadata.chain_role != "none"`, or the literal string `none` for standalones.
   - Set `Cascade:` to the literal `orchestrator-owned (set DISPATCHED: none — orchestrator rescans TaskList after your notification)` for every delivery-agent task — this reinforces the contract from `agents/delivery-agent.md` `## Cascade-identification precondition`: the agent does NOT scan TaskList; always sets `DISPATCHED: none`.
   - Set `Prior chain commits:` ONLY for chain `link` and `tail` tasks (`metadata.chain_role in {"link","tail"}`); omit the line entirely for `head` and standalones. Substitute the per-task value: `read \`git -C $WORKTREE_PATH log --format='%n--- %s ---%n%b' $MERGE_TARGET..HEAD\` and ingest each commit's "## Key learnings" section before starting work — these are gotchas already discovered by earlier members of this chain.` (Substitute `$WORKTREE_PATH` and `$MERGE_TARGET` with the literal absolute path / branch name for this task; the agent runs the bash directly.)
   - Replace `[one-paragraph guidance]` with **a single paragraph (≤ ~120 words) of plan-level guidance** distilled from the proposal — see "Task definition rules" below.
   - Leave `Task ID:` as the literal placeholder `[TASK_ID]` — the orchestrator fills it in Phase 1.5 after TaskCreate returns real IDs.

**Task definition rules — the one-paragraph guidance:**

The envelope guidance is a single paragraph that the delivery-agent reads to infer purpose, what-to-do, and Definition-of-done. It MUST be plan-level, not implementation-level. The agent writes the code; the paragraph tells it what to build, where, and how success will be observable.

**The paragraph should weave in:**
- The goal in one sentence (why this task exists, what observable outcome it produces)
- File paths involved (e.g. `src/db/userStore.js`, `test/middleware/requireJwt.test.js`)
- Exports / functions / endpoints by name and signature shape (e.g. `createUser({email, password, name}) → {id, email, name, createdAt}`)
- Key behaviors in prose (e.g. "passwords HMAC-hashed using JWT_SECRET"; "returns 429 when count exceeds RATE_LIMIT_MAX")
- Integration points (which existing files to read for context, where to mount routes, what env vars to honor)
- Observable success — file-existence, named test labels, behavioral assertions, commit landing — woven into the same paragraph, not split into a separate Definition-of-done section

**The paragraph MUST NOT contain:**
- Verbatim code blocks (`` ```js ... ``` ``) — even if the plan has them. Distill the contract; the agent writes the body.
- Step-by-step typing instructions or numbered procedure (e.g. "type `const crypto = require('crypto')`")
- Implementation details the agent should derive: variable names, helper function structure, exact JSON literals (unless the literal IS the contract)
- Multi-section structure (Purpose / What to do / Definition of done as separate headings) — collapse all of it to prose

**Rule of thumb:** if a competent agent could not figure out what to build and how to verify it from the paragraph alone, the paragraph is missing detail. If the paragraph reads like an implementation script (numbered typing steps, code blocks, line-by-line instructions), it has too much detail.

Example transformation (from a plan that embeds code):

PLAN INPUT (verbatim):
```
3. Read `src/config/auth.js` — confirm `JWT_SECRET` export before implementing.
4. Create `src/db/userStore.js`:
   ```js
   const crypto = require('crypto');
   const { JWT_SECRET } = require('../config/auth');
   const users = new Map();
   let nextId = 1;
   function hashPassword(pw) { ... }
   function createUser({ email, password, name }) { ... }
   ...
   module.exports = { createUser, getUserById, getUserByEmail, verifyPassword };
   ```
```

CORRECT one-paragraph guidance:
```
Build the in-memory user store at src/db/userStore.js consumed by the auth router.
After confirming JWT_SECRET is exported from src/config/auth.js, create src/db/userStore.js
exporting createUser({email, password, name}) → {id, email, name, createdAt} (rejects
duplicate emails with a 409 error), getUserById(id) → user|null, getUserByEmail(email) →
user|null, and verifyPassword(user, password) → boolean. Passwords must be HMAC-hashed
(sha256) using JWT_SECRET as the key; IDs are assigned monotonically as strings. Done
when the four named exports exist, duplicate-email registration throws, the hash uses
crypto.createHmac('sha256', JWT_SECRET) (verifiable by reading the file), and a single
commit lands on chain-1-branch.
```

**Phase 1.5 — Task ID embedding** (runs after Phase 1 returns all IDs, before Phase 2 wiring):

For each delivery-agent task created in Phase 1, replace `[TASK_ID]` in its description with the real task ID:

```
For each (task_id, description) from Phase 1 output:
  enriched = description with "[TASK_ID]" replaced by str(task_id)
  Mode == live  → TaskUpdate({ taskId: task_id, description: enriched })
  Mode != live  → print [DRY] would TaskUpdate #DRY-N description (embed Task ID: DRY-N)
                  mutate ledger entry: description = enriched
```

**Create worktree task:** **FIRST: Read `${CLAUDE_SKILL_DIR}/references/create-wt-prompt.md`** — load the verbatim bash template. Before pasting, perform these substitutions in the bash code lines only (skip `#`-prefixed comment lines — those are instructional and use `task-N` as a label, not a substitution target):
- `[REPO_ROOT]` → the absolute `$REPO_ROOT` (the target repo — may differ from the orchestrator's CWD)
- `[TARGET_BRANCH]` → the captured `INTEGRATION_BRANCH` value (every worktree forks from `INTEGRATION_BRANCH`, not from `UPSTREAM_BRANCH`; appears twice: once as the fork point for `git worktree add`, once in the failure message)
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
| #88 | delivery-agent | Refactor auth                    | #87             |
| #89 | regression| Regression: suite                | #88             |
```

---

### Step 4 — Execute Task Graph

**Mode-aware execution guards (4-tier):**
- `Mode == live` → run the loop exactly as specified below.
- `Mode == dry-run` → run the loop, but every dispatched Agent gets `references/simulate-prefix.md`
  PREPENDED to its task description. Git operations are skipped (git-prep tasks are TaskCreate'd
  and immediately marked completed so create-wt tasks unblock; create-wt itself is dispatched as
  an Agent that simulates the worktree creation per the simulate prefix). The orchestrator
  collects each agent's status block, parses DISPATCHED, dispatches the next wave (also with
  simulate prefix) until the graph drains. Produces a Simulated Execution Trace at the end.
- `Mode in {plan-only, dry-run-analyze}` → **skip the execution loop entirely**. Run the wiring
  integrity check against the in-memory task ledger, then print the Dry-Run Report.

**Task-type contract:**

| Task type           | Identity                    | Has create-wt? | Has Merge? | Asserts | Resume method                   | Dispatch lane         |
|---------------------|-----------------------------|----------------|------------|---------|---------------------------------|-----------------------|
| delivery-agent worktree  | `Isolation: native worktree`| yes            | orchestrator (post-notification) | 6    | branch in git log --merges → completed | parallel worktree; may spawn sub-task agents internally |
| delivery-agent trivial   | `Isolation: none (trivial)` | no             | no         | —       | git log title vs checkpoint     | serial main-workspace |
| regression          | type=regression             | no             | no         | 5       | re-run agent                    | serial main-workspace |
| create-wt           | type=create-wt              | self           | n/a        | 3       | `git worktree list`             | parallel background   |
| git-prep            | type=git-prep               | n/a            | n/a        | —       | re-run command (idempotent)     | inline (orchestrator) |
| open-pr             | type=open-pr                | n/a            | n/a        | 9       | re-run gh pr create (idempotent on existing PR) | inline (orchestrator) |
| recap               | type=recap                  | n/a            | n/a        | —       | re-dispatch general-purpose Agent | inline foreground (orchestrator); dispatched as `subagent_type: "general-purpose"`; agent output is the user-facing run summary |

**Wiring integrity check** (inline, runs once before resume check):

| Check    | Applies to                          | Condition                                                                                  | Violation message                                                                |
|----------|-------------------------------------|--------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| Assert 3 | every create-wt                     | blockers include `Setup .worktrees` AND (if DEPENDS ON exists) ≥1 upstream tail/standalone | "Create worktree #N missing expected upstream delivery-agent blocker"                |
| Assert 5 | every regression (0 or 1)           | blocked by ALL chain-tail and standalone delivery-agents; chain-head/link NOT direct blockers   | "Regression task #N missing blockers [...]" OR "directly blocked by head/link"  |
| Assert 6 | every native-worktree delivery-agent     | `metadata.target_branch` is non-empty and not a placeholder (dry-run: ledger; live: TaskGet) | "Delivery-agent #N metadata.target_branch is missing or placeholder"                 |
| Assert 7 | every chain (≥2 members)            | exactly one create-wt exists and belongs to the chain-head                                 | "chain-link/tail task #N has its own create-wt — should share chain-K's"        |
| Assert 8 | every create-wt and delivery-agent task | `metadata.repo_root` is non-empty, absolute (starts with `/`), and identical across all create-wt and delivery-agent tasks in this run | "Task #N metadata.repo_root missing/non-absolute" OR "metadata.repo_root drift across run: tasks #X=<a> vs #Y=<b>" |
| Assert 9 | every create-wt and delivery-agent task | `metadata.upstream_branch` and `metadata.integration_branch` are both non-empty, distinct from each other (`upstream_branch != integration_branch`), and identical across the run; `metadata.integration_branch` matches the captured `INTEGRATION_BRANCH` (`schedule/<slug>-<short-sha>` shape). Additionally, the single `open-pr` task is the graph terminus (no other task lists it as a blocker) and is blocked by the regression task if present, else by ALL chain-tail and standalone delivery-agents. | "Task #N missing upstream_branch / integration_branch metadata" OR "open-pr blockers do not match regression / tail+standalone shape" |

**Envelope-size guidance (no hard limit).** Earlier revisions enforced a 3 KB envelope cap as Assert 8; that cap has been removed. The envelope shape rule still stands as a soft guideline: keep the runtime header followed by ONE paragraph of plan-level guidance, and do not paste `## What to do`, `## Definition of done`, `## Execution lifecycle`, `MAX_RETRIES`, or `## Status protocol` content into the description — those live in `agents/delivery-agent.md`. Allowed runtime-header fields: `Task ID:`, `Working directory:`, `MAIN_REPO_ROOT:`, `MERGE_TARGET:`, `Isolation:`, `Chain:`, `Cascade:`, `Prior chain commits:`, `External resources:`. Bloated envelopes slow agents without improving outcomes, but there is no hard byte limit — agents operate unbounded on legitimately large tasks.

Assert 3 exception: if the proposal has no DEPENDS ON, only `Setup .worktrees` is required — skip the upstream-blocker check.

If all pass: print `Wiring integrity: OK — N tasks verified` and continue.

**Resume check** (runs once before Phase A dispatch):

Query TaskList for `in_progress` tasks. None → proceed to Phase A. Else execution was interrupted; recover per task type before re-entering the wave-1 dispatch:

| Task type | Recovery |
|---|---|
| git-prep | Re-run the git command (all idempotent — including `bootstrap` when present). Mark completed. |
| create-wt | `git -C "$REPO_ROOT" worktree list`. If present → mark completed. If missing → re-run `git -C "$REPO_ROOT" worktree add` → mark completed. |
| delivery-agent (trivial) | `git -C "$REPO_ROOT" log <checkpoint-sha>..HEAD --oneline`. Commit matching task title present → mark completed; orchestrator runs cascade (TaskList scan → for each pending unblocked task: TaskGet re-check, TaskUpdate(in-progress), then dispatch `Agent(..., run_in_background: true)`). None → mark failed; do not cascade. |
| delivery-agent (worktree) | Detect by commit-on-branch: for chain-tail or standalone, `git -C "$REPO_ROOT" log --merges --oneline \| grep <branch>`. Found → merge already completed → mark completed; orchestrator runs cascade (as above). For chain-head or link, `git -C "$REPO_ROOT/.worktrees/<chain-K>" log HEAD --oneline \| grep <task subject>`. Commit present → mark completed; orchestrator runs cascade. No commits in either case → mark failed; do not cascade. |
| regression | Re-dispatch agent with existing description. |
| open-pr | `gh pr list --head "$INTEGRATION_BRANCH" --base "$UPSTREAM_BRANCH" --json url,state`. PR exists → mark completed (idempotent — no double-create). PR missing → re-run the open-pr body from Step 5 from step 1. |
| recap | Always safe to re-dispatch — the recap agent makes no file changes / git mutations / TaskCreate calls. Re-dispatch the general-purpose Agent with the existing description (which already has `[RUN_START_SHA]` substituted from Phase A Pass 2). The new output supersedes any prior partial output. |

---

**Execution — wave-1 dispatch + orchestrator-owned cascade:**

**Execution Guard:** Do not begin dispatch until ALL Phase 2 `TaskUpdate` wiring calls have returned successfully. Tasks are inert metadata until claimed; wiring must be complete before any agent starts so dependency constraints are fully established.

```
Phase A — git-prep (orchestrator-inline, sequential):
  Run each git-prep task directly:
    Pre-flight staging check → Checkpoint commit → Setup .worktrees
  Mark each completed after running. Capture checkpoint SHA into orchestrator context.

  **Capture `RUN_START_SHA`** immediately after `Create integration branch` git-prep runs (and
  before dispatching any delivery-agent): `RUN_START_SHA=$(git -C "$REPO_ROOT" rev-parse
  "$INTEGRATION_BRANCH")`. This is the tip of `INTEGRATION_BRANCH` at the moment the run
  started — used later by the Recap & Review task to enumerate merges produced by this run
  via `git log $RUN_START_SHA..$INTEGRATION_BRANCH`. Hold `RUN_START_SHA` in orchestrator
  context alongside the checkpoint SHA. In `dry-run`, `plan-only`, and `dry-run-analyze`
  modes (where the integration branch is not actually created), set `RUN_START_SHA` to the
  string literal `dry-run-no-sha` — the recap dispatch is skipped in those modes anyway.

  **Substitute `[RUN_START_SHA]` in the recap task description (Pass 2):** immediately
  after capturing `RUN_START_SHA`, do `TaskUpdate({ taskId: ID_recap, description:
  <Step-3 description with [RUN_START_SHA] replaced by $RUN_START_SHA> })` — see Step 3
  `### Recap description rendering` for the full placeholder/timing table.

Phase B — create-wt (lazy dispatch, notification-driven):
  Do NOT dispatch all create-wt tasks in one up-front parallel batch.
  Instead, create-wt tasks are dispatched lazily via the same notification-driven
  cascade as delivery-agents — a create-wt task becomes eligible only when all its
  blockers (Setup .worktrees + any upstream delivery-agent tails/standalones) have
  completed. The wiring graph encodes the order; dispatch each create-wt when its
  blocked-by set transitions to all-completed (same cascade logic as wave-1 delivery-agents).
  Worktrees forked from a stale integration-branch tip will miss every subsequent merge
  from parallel lanes — lazy dispatch ensures each worktree forks from the current tip.
  On create-wt failure → halt; report; do not dispatch its delivery-agent.

Phase C — wave-1 delivery-agents (parallel dispatch, orchestrator-owned cascade):

  **Cost-confirmation gate (runs ONCE, before any wave-1 dispatch):**

  Compute from the freshly-built TaskList:
    - mediumLargeCount = count(t in TaskList where t.metadata.task_type == "delivery-agent" and t.metadata.scope in {"medium","large"})
    - daCount          = count(t in TaskList where t.metadata.task_type == "delivery-agent")

  If `mediumLargeCount >= 4` OR `daCount >= 6`, AND args do NOT contain `--no-confirm`,
  insert ONE AskUserQuestion: "Dispatch full cascade now / Dispatch only the head and pause / Cancel."
    - Dispatch full cascade now → continue.
    - Dispatch only the head and pause → dispatch only the FIRST member of wave-1 (chain-1 head, in TaskList ID order); after that single agent's notification, halt cleanly with `[gate] head-only paused — re-run with --no-confirm to continue cascade`. Downstream tasks remain pending.
    - Cancel → halt; downstream tasks remain pending.

  Below the threshold (mediumLargeCount < 4 AND daCount < 6), or with `--no-confirm`, dispatch immediately without prompting.

  wave1 = [t for t in TaskList({}) where t.status == "pending" and t.blockedBy all completed]
  This is every chain-head and standalone delivery-agent (their only blocker was a create-wt, now done).

  **Mode == live (dispatch shape — backgrounded, orchestrator-owned cascade):**
  Dispatch ALL wave-1 delivery-agents in a SINGLE response as parallel Agent() calls,
  each with `subagent_type: "delivery-agent"` AND `run_in_background: true`. Each agent
  receives its task envelope (TaskGet(id).description = runtime header + one-paragraph
  guidance). The behavior contract (lifecycle, cascade-identification) lives
  in `agents/delivery-agent.md` and is loaded by the harness — no additional wrapping
  needed in the prompt.

  Each backgrounded agent emits a final status block; the harness delivers it to this
  orchestrator session via `<task-notification>` (with `<status>`, `<result>`, `<usage>`
  fields). Treat the agent's full transcript as opaque — only the `<result>` (its STATUS
  block) is parseable in this session.

  **Status timer (live mode only — after the wave-1 dispatch above):**

  Long runs (15–45 min wall-clock) have no ambient progress signal. After the wave-1 batch
  (live mode only — skipped in `dry-run`/`plan-only`/`dry-run-analyze`/`status-check`),
  emit one `ScheduleWakeup` whose self-contained prompt re-emits another `ScheduleWakeup`
  while work remains in flight. (Pre-flight: verify `ScheduleWakeup` fires from a
  non-`/loop` session before relying on this — call once with `delaySeconds: 60` and a
  trivial prompt, confirm it fires; see *Fallback* below if not.)

  Construct the prompt by interpolating `[REPO_ROOT]` and `[INTEGRATION_BRANCH]` into:

  ```
  Call TaskList({}). Count tasks by status (completed / in_progress / pending / failed).
  Run: git -C "[REPO_ROOT]" log --oneline --merges -10 "[INTEGRATION_BRANCH]"
  Print a ≤ 20-line summary:
    ⏱ [HH:MM] Status: N complete, M in-progress, P pending, F failed
    Recent merges: [last 3 --oneline entries, or 'none yet']
  If any tasks are still in_progress or pending, call ScheduleWakeup again with the same
  delaySeconds=180 and this exact prompt verbatim, reason='periodic schedule-plan-tasks status'.
  If all tasks are terminal (completed or failed): print '✅ Run complete. No further status ticks.'
  and stop (do not reschedule).
  ```

  Then dispatch:

  ```
  ScheduleWakeup({
    delaySeconds: 180,
    reason: "periodic progress check during live schedule-plan-tasks run",
    prompt: <interpolated prompt body>
  })
  ```

  (Self-terminates: the embedded instructions reschedule only while pending/in-progress
  tasks remain.)

  *Fallback if `ScheduleWakeup` is `/loop`-only.* If pre-flight shows it does not fire from
  non-`/loop` sessions, drop the call and substitute: (1) the orchestrator prints a one-line
  `[orchestrator] T+MM:SS — N complete, M in-progress, P pending` after each cascade-wave
  dispatch and notification; (2) the user runs `/planning-suite:schedule-plan-tasks
  --status` (the `status-check` mode) on demand from a separate session.

  This degrades gracefully without shipping a non-functional `ScheduleWakeup` call.

  **Mode == dry-run:** dispatch synchronously (foreground — NO `run_in_background`). Before
  each Agent() call, JIT-load `references/simulate-prefix.md` and PREPEND its content to
  the task envelope. The agent simulates the work, runs the cascade-identification directive
  read-only (TaskList/TaskGet only), and emits the standard status block listing
  would-be-dispatched IDs. The orchestrator iterates: parse each returned status block,
  dispatch the next wave (also with simulate prefix, also synchronous), repeat until
  DISPATCHED is "none" for all agents. Backgrounding is exempted in dry-run because the
  simulate-prefix path depends on the orchestrator parsing each agent's returned text
  inline; dry-run also produces no real work to drain context.

  Orchestrator-owned cascade loop (live mode):
    On each `<task-notification>` (one per backgrounded agent that completes):
      1. Read the `<status>` field. Harness exit status only — `completed` means the agent process exited cleanly; `failed` means the harness itself errored. The agent's *semantic* outcome is in `<result>`. Both branches proceed to step 2; do not gate cascade on `<status>` alone.
      2. Read the `<result>` field — the agent's STATUS block. Parse the `RESULT:` line. (`DISPATCHED:` is always `none` — the orchestrator does not rely on it for cascade decisions; it runs its own TaskList rescan in step 3b.)
      3. **`RESULT: complete`** — run the orchestrator merge (step 3a) for chain-tail and standalone completions, then cascade:

         **Step 3a — Orchestrator merge (runs for every chain-tail and standalone completion):**

         When the completing delivery-agent has `chain_role == "tail"` or `chain_role == "none"` (standalone), the orchestrator runs the merge algorithm below. Chain heads and links do NOT trigger a merge — their commit lands on the worktree branch and the next chain member continues there.

         Orchestrator merge script (runs per chain-tail or standalone completion). The agent
         already rebased and verified in its own worktree (`## Pre-completion rebase` in
         `agents/delivery-agent.md`) before signaling complete, so the orchestrator merge is
         a single `--no-ff` integration. Only race recovery — a parallel lane landing between
         the agent's rebase and this merge — requires a second pass:
         ```bash
         # Inputs (read via TaskGet on the completing agent's task):
         #   MAIN_REPO_ROOT, WORKTREE_PATH, WORKTREE_BRANCH, MERGE_TARGET, CHAIN_ID, UPSTREAM_BRANCH
         # No VERIFY_CMD here — the agent runs verify itself after rebase.
         REPO_ROOT="$MAIN_REPO_ROOT"

         do_merge() {
           if [ -n "$CHAIN_ID" ] && [ "$CHAIN_ID" != "none" ]; then
             CHAIN_LOG=$(git -C "$REPO_ROOT" log --reverse --pretty='format:--- %s%n%b%n' \
                         "$MERGE_TARGET..$WORKTREE_BRANCH")
             git -C "$REPO_ROOT" merge --no-ff "$WORKTREE_BRANCH" \
                 -m "merge: $WORKTREE_BRANCH → $MERGE_TARGET (chain: $CHAIN_ID)

$CHAIN_LOG"
           else
             LAST_COMMIT_BODY=$(git -C "$REPO_ROOT" log -1 --pretty=%B "$WORKTREE_BRANCH")
             git -C "$REPO_ROOT" merge --no-ff "$WORKTREE_BRANCH" \
                 -m "merge: $WORKTREE_BRANCH → $MERGE_TARGET

$LAST_COMMIT_BODY"
           fi
         }

         cleanup_and_exit_success() {
           git -C "$REPO_ROOT" worktree remove "$WORKTREE_PATH" --force
           git -C "$REPO_ROOT" branch -d "$WORKTREE_BRANCH"
           git -C "$REPO_ROOT" checkout "$UPSTREAM_BRANCH"
           exit 0
         }

         # Attempt 1: agent already rebased; merge should be clean.
         git -C "$REPO_ROOT" checkout "$MERGE_TARGET"
         if do_merge; then
           cleanup_and_exit_success
         fi

         # Attempt 2: a parallel agent merged between this agent's rebase and our merge.
         # One orchestrator-side rebase to refresh, then merge again. The agent already
         # resolved any conflict that was visible at its rebase time, so this rebase is
         # expected to be a fast-forward of new parallel work onto the resolved branch.
         git -C "$REPO_ROOT" merge --abort
         git -C "$REPO_ROOT" checkout "$UPSTREAM_BRANCH"
         if ! git -C "$WORKTREE_PATH" rebase "$MERGE_TARGET"; then
           git -C "$WORKTREE_PATH" rebase --abort
           echo "MERGE_FAIL_REASON=race_conflict_needs_user"
           exit 1
         fi

         git -C "$REPO_ROOT" checkout "$MERGE_TARGET"
         if do_merge; then
           cleanup_and_exit_success
         fi

         git -C "$REPO_ROOT" merge --abort
         git -C "$REPO_ROOT" checkout "$UPSTREAM_BRANCH"
         echo "MERGE_FAIL_REASON=retries_exhausted"
         exit 1
         ```

         **Why this is simple now.** The agent rebases and verifies in its own worktree before
         signaling complete (`## Pre-completion rebase` in `agents/delivery-agent.md`). By the
         time the orchestrator runs `do_merge`, the agent's branch is already up to date with
         `MERGE_TARGET` and known to pass its verify command. A conflict in attempt 1 is
         therefore unexpected — it only happens when a parallel lane landed between the
         agent's rebase and the orchestrator's `checkout $MERGE_TARGET`. Attempt 2 handles
         exactly that narrow race; further retries are unnecessary because by attempt 2 the
         agent's branch has been rebased onto the latest tip.

         On merge failure (`MERGE_FAIL_REASON` printed): TaskCreate an investigation sibling task using `references/investigation-task-template.md` (subject: `INVESTIGATE: <agent task subject> — merge failure`, body includes `failure_reason`, diagnostic details, affected dependents). Mark affected downstream dependents as staying blocked. Emit merge-failure notice to orchestrator log. Do NOT cascade from a merge failure.

         On merge success: proceed to the TaskList rescan and cascade dispatch (step 3b).

         **Step 3b — Cascade dispatch (runs after successful merge, or immediately for chain-head/link completions):**

         The orchestrator runs its own TaskList rescan (not relying on `DISPATCHED:` from the agent — `DISPATCHED: none` is always emitted by the agent):
         a. Call `TaskList({})`. For each pending task `t`: check if all of `t.blockedBy` are `completed`. If yes, `t` is newly unblocked.
         b. For newly-unblocked tasks: call `TaskGet(id)` first. **If `status != "pending"`, skip** — a sibling notification handler already claimed it.
         c. For tasks still `pending`: call `TaskUpdate(id, status=in-progress)` to claim, then dispatch by `metadata.task_type`:
            - `delivery-agent`, `create-wt`, `regression` (when `execution_lane: agent`): `Agent({subagent_type: "delivery-agent" | <as appropriate>, prompt: TaskGet(id).description, run_in_background: true})`. Backgrounded; notifications come back via `<task-notification>`.
            - `recap`: `Agent({subagent_type: "general-purpose", description: TaskGet(id).subject, prompt: TaskGet(id).description})` — **foreground**, no `run_in_background`. The returned agent text IS the user-facing run recap; print it under a `## Run Recap` heading in the orchestrator transcript and then call `TaskUpdate({taskId: id, status: "completed"})` to mark the recap task complete. In `dry-run`, `plan-only`, and `dry-run-analyze` modes, do NOT dispatch the recap agent — print `[DRY] would dispatch recap agent for task #N` and immediately mark the recap task `completed` (ledger or real).
            - `open-pr`: backgrounded Bash (per Step 5), not a delivery-agent Agent.
         d. Batch backgrounded claims and dispatches in a SINGLE parallel response. The recap dispatch is foreground — if recap and another task both become unblocked in the same tick, dispatch the backgrounded ones first (parallel batch), then run the recap dispatch in a follow-up message; this avoids blocking the orchestrator on recap while parallel work is still in flight.

      4. **`RESULT: partial`** — do NOT cascade. The agent has called `TaskUpdate(failed)` itself (per `## On RESULT: partial` in delivery-agent.md — partial is a terminal disposition under the new contract). No orchestrator action; downstream dependents stay `pending` (same as `RESULT: failed`). If the agent left its task `in-progress` instead of `failed`, that's a contract violation — surface as STALLED via hang-detection.
      5. **`RESULT: failed`** — do NOT cascade. The agent has called `TaskUpdate(failed)`. The orchestrator (not the agent) TaskCreates the investigation sibling task using `references/investigation-task-template.md`. Failed tasks do not unblock dependents — downstream tasks stay `pending` and visible via `TaskList({})`.
      6. **Termination check:** repeat until `TaskList({})` shows no `pending` or `in-progress` tasks of type delivery-agent / regression / open-pr / recap. Tasks left `in-progress` past `MAX_AGENT_WALL_TIME` trigger hang detection (below).

    The orchestrator therefore DOES loop — driven by notification events, not poll intervals. (Earlier "orchestrator does not loop" wording was based on a synchronous-cascade model; under backgrounding, the orchestrator is the only entity that can see notifications, so it must own dispatch.)

  **Hang detection.** When dispatching, record `agentId → dispatch_epoch` in orchestrator memory. After each notification, also check: any agentId whose elapsed wall-time > `MAX_AGENT_WALL_TIME` (default 1800s; configurable per plan via `MAX_AGENT_WALL_TIME=<sec>` env var) — surface STALLED via AskUserQuestion (kill / wait N minutes / abandon). No TaskList heartbeat is available; this timer is the only signal.

  Failure: on `RESULT: failed`, the orchestrator (not the agent) JIT-loads
  `references/investigation-task-template.md` and calls TaskCreate to register a sibling
  investigation task. The agent only emits the status block — no TaskCreate on the agent side.
  Status protocol uses RESULT/WORK/INCOMPLETE/FAILURE/ARTIFACT/DISPATCHED fields; FAILURE ∈
  {no_change, partial_change, test_failures, conflict_needs_user, needs_split, verify_regression}. Failed tasks
  do not cascade — downstream dependents stay pending, visible via `TaskList({})`.

  Trivial delivery-agents, regression, and open-pr tasks are claimed and dispatched by the
  ORCHESTRATOR (per the inversion above) — the orchestrator's TaskList rescan finds them
  newly-unblocked after each notification and dispatches them. Regression and open-pr both
  run as backgrounded Agents (regression) / backgrounded Bash (open-pr body); see Step 5.
```

---

**Git prep task execution** (inline; all git commands route through `$REPO_ROOT`):
- `Bootstrap` (only when `BootstrapNeeded == yes`): run the bootstrap bash body from Step 3 (`mkdir -p` + `git -C "$REPO_ROOT" init` + `README.md` + initial commit). Surface git's error verbatim and halt if `git commit` fails (missing user.name/user.email). Capture the resulting default branch via `git -C "$REPO_ROOT" branch --show-current` for downstream use.
- `Pre-flight staging check`: `git -C "$REPO_ROOT" status`, stage relevant files (`git -C "$REPO_ROOT" add <files>`, never `-A`).

  **Uncommitted-work coverage (explicit contract):** the user's working tree may contain
  files the user has been editing but not staged or committed. Without extra capture,
  staged-and-committed work travels into worktrees via the branch fork, but
  modified-not-staged and untracked files do NOT — every worktree starts from
  `INTEGRATION_BRANCH`'s tip and never sees those edits.

  | State of file in user's working tree    | Reaches worktrees? | How                                |
  |-----------------------------------------|--------------------|------------------------------------|
  | Tracked + staged before invocation      | yes                | `git add` above + checkpoint       |
  | Tracked + modified, NOT staged          | yes (NEW)          | `.preflight-tracked.patch` capture |
  | Untracked (new file)                    | yes (NEW)          | `.preflight-untracked.tgz` capture |
  | Already committed on `UPSTREAM_BRANCH`  | yes                | branch fork                        |

  After the selective `git add`, also capture anything still dirty into a single
  uncommitted-on-entry patch and a tarball of untracked files. These are applied later
  inside each worktree by the create-wt task body so the user's in-progress edits travel
  with the run:

  ```bash
  git -C "$REPO_ROOT" diff > "$REPO_ROOT/.worktrees/.preflight-tracked.patch"
  git -C "$REPO_ROOT" ls-files --others --exclude-standard \
    | tar -czf "$REPO_ROOT/.worktrees/.preflight-untracked.tgz" -T -
  ```

  These two staging files are removed inside the `open-pr` task body once the PR is
  open or skipped (`rm -f "$REPO_ROOT/.worktrees/.preflight-*"`). Patch-apply inside
  each worktree is best-effort — if the user's uncommitted state conflicts with work a
  delivery-agent introduces, `git apply` fails inside that worktree and the create-wt
  task reports `STATUS: failure — preflight patch did not apply`, halting just that
  worktree; siblings continue.
- `Checkpoint commit`: if staged changes → `git -C "$REPO_ROOT" commit -m "checkpoint: pre-execution state"` and capture SHA into orchestrator context; if clean → capture HEAD SHA via `git -C "$REPO_ROOT" rev-parse HEAD`. This SHA is held by the orchestrator for trivial task resume checks — it is never written into task descriptions.
- `Create integration branch`: run the bash from Step 3 — `git -C "$REPO_ROOT" checkout -b "$INTEGRATION_BRANCH" "$UPSTREAM_BRANCH"` then `git -C "$REPO_ROOT" checkout "$UPSTREAM_BRANCH"` to leave the user on their starting branch. Halt on `show-ref --verify` collision per the pre-flight rule above.
- `Setup .worktrees`: use existing `$REPO_ROOT/.worktrees/` or create it (`mkdir -p "$REPO_ROOT/.worktrees"`), add `.worktrees/` to `$REPO_ROOT/.gitignore`, `git -C "$REPO_ROOT" add .gitignore && git -C "$REPO_ROOT" commit -m "chore: ignore .worktrees"`. **Note:** this commit lands on `UPSTREAM_BRANCH` (the user is checked out there), not on `INTEGRATION_BRANCH`. That's fine — the `.gitignore` change is meta-bookkeeping and the integration branch will inherit it on the next merge from upstream if needed.

**Create worktree task execution** (async background Task, lazy dispatch):

Each create-wt is dispatched as a background Task (`run_in_background=True`) when all its blockers become completed (per Phase B lazy cascade). Description = exact bash from `${CLAUDE_SKILL_DIR}/references/create-wt-prompt.md` (loaded JIT). No prose form. Agent runs and reports a STATUS line. Create-wt tasks are NOT batched up-front — each is dispatched individually as its blocked-by set clears.

Orchestrator reads only the `STATUS:` line. `success` → mark create-wt completed (unblocks its delivery-agent). `failure` → mark failed, halt dependent delivery-agent, report.

---

---

### Step 5 — Final PR (open-pr task body)

The graph terminates with a single `open-pr` task that PRs `INTEGRATION_BRANCH →
UPSTREAM_BRANCH`. In `live` mode the body executes as a single `Bash(run_in_background: true)`
script (push + body assembly + `gh pr create` + cleanup); the orchestrator waits for the
backgrounded-Bash completion notification (same `<task-notification>` pattern as Agents),
then reads `$REPO_ROOT/.worktrees/.openpr-result` for the outcome. The interactive `AskUserQuestion` (approve / leave open / close)
stays inline in the orchestrator session — it is interactive and small. In
`dry-run`/`plan-only`/`dry-run-analyze` modes the side-effecting body is replaced by
`[DRY] would gh pr create` (consistent with the git/Agent verb-guard table). The task is
dispatched only after every chain-tail and standalone delivery-agent (and the regression
task, if present) has completed.

Body (live mode — backgrounded Bash; result file at `$REPO_ROOT/.worktrees/.openpr-result`):

1. **Push.** `git -C "$REPO_ROOT" push -u origin "$INTEGRATION_BRANCH"`. If push fails
   because no `origin` remote exists (or push is otherwise impossible), print a notice
   that no remote was reachable and skip steps 3–5 — fall through to the local-only
   path below.
2. **Assemble the PR body.** `Read ${CLAUDE_SKILL_DIR}/references/pr-body-template.md`
   and substitute:
   - `{plan_path}` — source plan file path (Branch A) or `Branch B (session learnings)`
   - `{integration_branch}` — `$INTEGRATION_BRANCH`
   - `{upstream_branch}` — `$UPSTREAM_BRANCH`
   - `{task_summary_table}` — markdown table of every delivery-agent task: ID, subject, RESULT
   - `{commit_log}` — `git -C "$REPO_ROOT" log --reverse --pretty=format:'%n### %s%n%n%b' "$UPSTREAM_BRANCH..$INTEGRATION_BRANCH"`
   - `{verify_summary}` — aggregated `VERIFY_CMD` lines extracted from each task's commit body
   - `{review_notes}` — aggregated `Critical applied` / `Advisory deferred` lines from each task's commit body
   Write the result to a tempfile.
3. **Create the PR.** `gh -R <owner/repo> pr create --base "$UPSTREAM_BRANCH" --head "$INTEGRATION_BRANCH" --title "<plan-slug>: <N tasks merged>" --body-file <tempfile>`.
4. **Capture the PR URL.**
5. **Prompt the user via `AskUserQuestion`:**
   - "Approve and auto-merge now (`gh pr merge --auto --squash --delete-branch`)" — runs the merge command, deletes the branch, and reports the result.
   - "Leave open for human review (default)" — leaves PR open, prints URL, exits.
   - "Close PR and discard the integration branch" — `gh pr close <url>` then `git -C "$REPO_ROOT" branch -D "$INTEGRATION_BRANCH"` (and `git push origin --delete "$INTEGRATION_BRANCH"` if pushed).

**Local-only path** (gh missing or no remote): skip steps 3–5. In addition to printing a
notice with the local integration branch name, **write the assembled PR body to a
persistent file** at:

```
$REPO_ROOT/.schedule-summary-<short-sha-of-INTEGRATION_BRANCH>.md
```

(short-sha computed via `git -C "$REPO_ROOT" rev-parse --short "$INTEGRATION_BRANCH"`). The
leading dot keeps the file out of `git status` noise without mutating `.gitignore`. Print
the path in the completion banner so the user can later run `gh pr create
--body-file=<path>` if they push the branch. If the user wants the file ignored in their
repo, the banner mentions adding `.schedule-summary-*.md` to their own ignore file.

The integration branch stays on disk for the user to push when ready.

**Key-learnings aggregation (runs at end of every open-pr task body — agent or inline lane,
remote or local-only):**

After the PR body assembly (or instead of it on the local-only path), aggregate the
`## Key learnings` section of every delivery-agent commit between
`$UPSTREAM_BRANCH..$INTEGRATION_BRANCH` (or `$ORIGIN_BRANCH..feat/<plan-slug>-<short-sha>`
for the linear-chain shortcut). Write to:

```
$REPO_ROOT/.skill-learnings-<short-sha-of-INTEGRATION_BRANCH>.md
```

The file format:
```
# Schedule run learnings — <integration-branch-or-feature-branch> @ <date>

## task-N — <subject>
<contents of that commit's "Key learnings" section>

...
```

Implementation sketch (live mode, the orchestrator runs this bash):
```bash
git -C "$REPO_ROOT" log --reverse --pretty='format:%n=== %s ===%n%b' "$UPSTREAM_BRANCH..$INTEGRATION_BRANCH" \
  | awk '/^=== / {subj=$0; in_kl=0; next}
         /^Key learnings:/ {in_kl=1; print "\n## " subj; next}
         in_kl && /^[A-Z][a-z]+:/ {in_kl=0}
         in_kl {print}' > "$REPO_ROOT/.skill-learnings-<sha>.md"
```

Reference the learnings file in the PR body's `## Review notes` section so reviewers see
all gotchas together. The file is gitignored by default (leading dot) but the user can
`git add` it to track. In `dry-run`, `plan-only`, and `dry-run-analyze` modes, write a
`[DRY] would aggregate learnings to <path>` notice instead of executing the bash.

**Cleanup.** Whether the PR was opened, skipped, or closed, remove the pre-flight
staging files at the end of this task: `rm -f "$REPO_ROOT/.worktrees/.preflight-tracked.patch" "$REPO_ROOT/.worktrees/.preflight-untracked.tgz"`.

`open-pr` is the graph terminus — emit a final completion banner and exit.

---

**Dry-Run Report (printed at end of Step 4, plan-only / dry-run-analyze only):**

(In `dry-run` mode, the orchestrator prints a Simulated Execution Trace instead — see below.)

```
## Dry-Run Report
Mode: <plan-only|dry-run-analyze>
Repo: <REPO_ROOT>[ (bootstrap pending)]
Branch: <A|B>
Plan file: <path|none>
Senior reviewer: <dispatched (Branch B)|skipped (Branch A)>

### Proposals (N)
<proposals table from Step 1 / reviewer output>

### Chains
Build from ledger: for each unique `chain_id`, emit one row — list members in creation order (arrow-separated delivery-agent DRY IDs from `chain_role: head` → links → tail); worktree = `<REPO_ROOT>/.worktrees/<chain_id>` for chains, `<REPO_ROOT>/.worktrees/task-<C>` for standalones where `<C>` is the **create-wt task's DRY-N** (always one before its delivery-agent in the creation pass); merge point = the `chain_role: tail` member's delivery-agent DRY-N (or the standalone's delivery-agent DRY-N).

Also emit a one-line repo banner above the table: `Repo: <REPO_ROOT>` (and `Bootstrap: yes` when `BootstrapNeeded == yes`).

| Chain ID | Members (in order)            | Worktree                              | Merge point |
|----------|-------------------------------|---------------------------------------|-------------|
| chain-1  | DRY-6 → DRY-9 → DRY-12      | $REPO_ROOT/.worktrees/chain-1         | DRY-12      |
| none     | DRY-15 (standalone)           | $REPO_ROOT/.worktrees/task-14         | DRY-15      |

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

In `plan-only` mode, stop after printing the Dry-Run Report. In `dry-run-analyze` mode, continue:

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

**Simulated Execution Trace (printed at end of Step 4, `dry-run` mode only):**

After all dispatched simulate-prefix Agents return their status blocks and the cascade
has drained (no DISPATCHED IDs remain), emit:

```
## Simulated Execution Trace
Mode: dry-run  (real Task API ceremony, real Agent dispatch, simulate-prefix on each agent)
Branch: <A|B>
Plan file: <path|none>
Total tasks: <N>     Waves: <M>     Total agents dispatched: <N>

### Wave 1
| Agent (task ID) | RESULT | WORK summary | DISPATCHED → |
|-----------------|--------|--------------|---------------|
| #87 head A      | complete | "would create src/config/auth.js" | #88 |
| ...             | ...    | ...          | ...           |

### Wave 2
| ... |

(repeat per wave until DISPATCHED is "none" for all)

### Aggregate cascade
- Total dispatch edges traced: <K>
- Cascade depth: <D> waves
- Failures (RESULT: failed): <list, or "none">
- Partial (RESULT: partial): <list, or "none">

### Validation
- Every chain head dispatched in wave 1 ✓ / ✗
- Every chain tail dispatched downstream of its head ✓ / ✗
- Regression dispatched after all chain-tail and standalone delivery-agents ✓ / ✗
- Failed tasks did not cascade ✓ / ✗
- DISPATCHED graph matches the static topology from --plan-only ✓ / ✗
```

Stop after printing the trace. The user re-invokes `/schedule-plan-tasks` (no flag) for live execution.

---

## Invariants

Rules not stated inline elsewhere. For mode/reference/wiring discipline, see Modes, Steps 0–3, and the dispatch protocols.

- **Division of labor — orchestrator vs. task agent:**
  - The **orchestrator** (this skill) reads plans, extracts proposals, builds the task graph, dispatches Agents, and reports. **It NEVER writes implementation code.** Even when the input plan contains code blocks, the orchestrator extracts the contract (file paths, exports, behaviors) and passes that as the task description — see "Task definition rules" in Step 3.
  - The **task agent** (the dispatched delivery-agent) reads its task description, writes the actual implementation, runs the tests, and commits. The agent owns 100% of the typing in source files. The orchestrator owns 100% of the topology, dispatch, and post-notification merging into INTEGRATION_BRANCH.
  - If you find yourself (the orchestrator) writing code into a task description, stop. Convert it to a contract first.
- **Sub-task agents are internal to a parent delivery-agent.** No TaskCreate. They are invisible to the orchestrator's task graph.
- **Sub-task `MERGE_TARGET` = the parent delivery-agent's working branch.** Never TARGET_BRANCH.
- **`run_in_background: true` (live mode) on:** create-wt, delivery-agent, regression Agent, open-pr Bash, heavy git-prep Bash, and orchestrator merge Bash (per ORCHESTRATOR_MERGE_ALGORITHM). **Foreground (synchronous) in dry-run mode** — the simulate-prefix iteration parses each agent's returned text inline.
- **`conflict_needs_user` does not halt the loop** — only the affected merge chain stalls. Independent delivery-agents continue.
- **`git add -A` is forbidden in checkpoints.** Stage by name to avoid pulling unrelated state.
- **Parallel same-file edits are not automatic conflicts.** Restructure only when edits overlap semantically (same region, function, or config key). See Step 1 Output Mapping Pass.
- **Agents bias toward action.** Diagnose, fix, continue. Max 3 distinct attempts per obstacle.
- **Branch B drafts proposals from any signal** — commits, uncommitted changes, conversation context. Clean `git diff` alone is not terminal.
- **Senior reviewer retries on error.** A failed review is not approval.
- **No TaskCreate on Branch B before senior review completes.** Branch A may TaskCreate after Step 1.
- **When in doubt about isolation, create a worktree.**
- **`MERGE_TARGET` for delivery-agents is the integration branch, never the user's
  starting branch.** Worktrees fork from `INTEGRATION_BRANCH`, the orchestrator
  merges each chain-tail and standalone agent branch into `INTEGRATION_BRANCH` after
  receiving the agent's completion notification, and the final `open-pr` task PRs
  `INTEGRATION_BRANCH → UPSTREAM_BRANCH`. The starting branch is left untouched as
  the PR target — the user ends the run on the same branch they started on.
- **Commit messages follow the structured Why / What was considered / What was tested
  / Review findings / Key learnings template** (see `agents/delivery-agent.md` §"Before
  return: commit"). The merge-commit body on `INTEGRATION_BRANCH` is the per-task
  commit body (or full chain log for chain tails) so `git log --first-parent` reads as
  a story and the `open-pr` PR body can be assembled by aggregating those bodies.
