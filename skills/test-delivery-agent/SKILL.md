---
name: test-delivery-agent
description: Execute a delivery-agent fixture through an actual agent dispatch and print the full response. Supports --dry-run for safe simulation.
tools: Read, Agent, TaskCreate, TaskUpdate, TaskGet, TaskList, ToolSearch
---

# /test-delivery-agent

Execute a fixture through an agent dispatch and print the full response verbatim.

In **live mode** the skill dispatches one Agent per fixture and prints the
result. In **dry-run mode** the skill orchestrates an 11-phase plan (P0..P10)
per fixture: it creates real harness tasks for every planned phase, wires
their dependencies in both directions, then dispatches **specialist agents in
parallel waves** following the task graph. Each agent returns a markdown
planning artifact (no file writes, no git).

## Invocation

```
/test-delivery-agent [--fixture <path>] [--dry-run]
```

`--fixture` accepts a repo-relative file path. If omitted, runs all fixtures in
`test/fixtures/delivery-agent/`. `--dry-run` activates the orchestration described below.

## Step 1 — Parse args

| arg | values | default |
|-----|--------|---------|
| `--fixture` | repo-relative file path | omitted = run all defaults |
| `--dry-run` | flag | off |

## Step 2 — Resolve fixture list

If `--fixture` was supplied, fixture list = `[ <path> ]`. Otherwise fixture list =
all `.md` files under `test/fixtures/delivery-agent/`, sorted alphabetically:

```
test/fixtures/delivery-agent/fixture-chain-head.md
test/fixtures/delivery-agent/fixture-standalone.md
test/fixtures/delivery-agent/fixture-trivial.md
```

Read each fixture file in full using the Read tool.

## Step 3 — Live mode dispatch (skip if `--dry-run`)

For each fixture, call Agent in a single parallel batch:

```js
Agent({
  model: "claude-sonnet-4-6",
  description: "delivery-agent test: <fixture-label>",
  prompt: <fixture content>
})
```

After all agents return, jump to **Step 5 — Print** and **Step 6 — Analyze**.

## Step 4 — Dry-run orchestration (skip if not `--dry-run`)

**Step 4.0 — Load deferred task tools.** Before any TaskCreate / TaskUpdate /
TaskGet / TaskList call, run once per skill invocation:

```
ToolSearch({ query: "select:TaskCreate,TaskUpdate,TaskGet,TaskList", max_results: 5 })
```

Their schemas are not pre-loaded; calling them without this raises
`InputValidationError`.

Process each fixture **sequentially** (one fixture at a time so harness task IDs
and the EXECUTION REPORT remain attributable per fixture). Within a fixture all
parallelism rules below MUST be honored — every wave dispatches its non-inline
members in a single parallel Agent batch.

### 4.1 Extract from fixture

Pull the `## Purpose`, `## What to do`, and `## Definition of done` sections.
Also locate the fixture's `## Agent selection` block (top-level h2 — the
worked declaration that the delivery-agent's L0a step would emit). The harness no
longer reasons about agent fit; it parses this block in 4.3a-parse and
verifies the picks in Step 6. Ignore the fixture's `## Execution lifecycle`
block for orchestration purposes — the wave/cascade machinery lives in this
skill.

### 4.2 Inline P0 — Goal expansion (no agent dispatch)

Emit:

```
#### Goal expansion (P0)
Restated: <2–3 sentence restatement of Purpose + What to do>
Assumptions: <bulleted list>
Ambiguities: <bulleted list, "none" if none>
```

### 4.3 Decide skip set and build phase list

Apply the skip rules below to each phase P1..P10.

| ID  | Phase                          | Skip when                                                  |
|-----|--------------------------------|------------------------------------------------------------|
| P0  | Goal expansion                 | never (inline)                                             |
| P1  | Research                       | `## What to do` self-contained, no unfamiliar APIs         |
| P2  | Environment prep               | environment known correct (inline)                         |
| P3  | Test spec / fixtures / mocks   | docs-only, migration-only                                  |
| P4  | Implement                      | never                                                      |
| P5  | Code quality + security review | docs-only, config-only, migration-only                     |
| P6  | Tests + fix                    | docs-only                                                  |
| P7  | Documentation                  | Definition of done has no doc criteria                     |
| P8  | Config-state migration         | no schema/data/config change                               |
| P9  | Deployment-state migration docs| no deployable state change                                 |
| P10 | CI/CD instructions             | no CI/CD change                                            |

The table is authoritative for *which phases run*, not *who runs them* —
agent selection is parsed from the fixture's `## Agent selection` block
in 4.3a-parse.

**Standard wiring (collapse edges through skipped phases):**

- P1 ← P0
- P2 ← P0
- P3 ← P2
- P4 ← P2
- P5 ← P3, P4
- P6 ← P5
- P7 ← P4
- P8 ← P4
- P9 ← P8 (or P4 if P8 skipped)
- P10 ← P9 (or P8/P4 if upstreams skipped)

If a blocker is skipped, redirect the edge through to its nearest non-skipped
ancestor (P0 inline counts as "satisfied at start").

### 4.3a-parse Parse the fixture's `## Agent selection` declaration

The delivery-agent lifecycle's L0a step is the source of agent-fit reasoning.
The harness's job is to **parse** the `## Agent selection` block the
fixture carries and **verify** it in Step 6 — not to reason about agent
fit itself.

1. Locate the top-level `## Agent selection` block extracted in 4.1.
   - **Missing block → record FAIL with reason `agent selection block
     missing from lifecycle`** and skip to 4.8 to emit a partial report.
2. Parse each phase entry into the canonical map
   `phaseId → [{ subId, agent, justification, blockedBy }]`. The parser
   accepts these line shapes:

   - Header: `P<n> (<K> sub-task<s>):`
   - Single-agent body (K=1): `P<n>: <agent> — <justification>` (no
     `blockedBy`; `subId` defaults to `null` so report rows render the
     bare phase id)
   - Split body: `P<n>.<a|b|c>: <agent> — <justification>` optionally
     followed by `(blockedBy: P<n>.<x>)` or
     `(parallel: <independence justification>)`

3. Treat the parsed map as input to 4.4 (TaskCreate), 4.5 (intra-phase
   edges in addition to cross-phase edges), 4.6 (wave grouping respects
   intra-phase ordering), 4.7 (prompt heads parameterized on the parsed
   agent), and 4.8 (report rendering).

The seven selection rules (groundedness, specificity, fallback, Explore
reserved for P1, split conditions, parallel justification, cap of 3 sub-
tasks per phase) live in the canonical lifecycle's L0a step and are
**verified** by Step 6's PASS conditions against the parsed declaration.

### 4.4 TaskCreate the phase backlog (one parallel batch)

For every **sub-task** of every non-inline planned phase (per the 4.3a-parse map),
call `TaskCreate` in a single parallel batch — multiple TaskCreate tool calls
in one response. Capture the harness IDs returned.

```
TaskCreate({ subject: "[<fixture-label>] P<n>.<a|b|c> <chosen-agent> — <short subject>",
             description: "<phase intent>",
             activeForm: "<-ing form>" })
```

Single-agent phases use the bare phase id (no `.a` suffix) in the subject:
`[<fixture-label>] P<n> <chosen-agent> — <short subject>`.

Inline phases (P0, P2) and skipped phases get NO task — they are reported
separately. Maintain a map `(phaseId, subId) → harnessTaskId` for use in
4.5–4.8.

### 4.5 Wire dependencies (one parallel batch)

Wire **two kinds** of edges in a single parallel batch:

1. **Intra-phase edges.** For every sub-task with a `blockedBy` entry from
   4.3a-parse (e.g. `P<n>.b blockedBy P<n>.a`), wire both directions.
2. **Cross-phase edges.** For each standard wiring edge `(downstream ←
   upstream)`, the *downstream* end attaches to the **first** sub-task of
   the downstream phase, and the *upstream* end attaches to the **last**
   sub-task of the upstream phase (the sub-task with no further intra-phase
   successors). For single-agent phases, first == last == the sole sub-task.

Both kinds use the same call shape:

```
TaskUpdate({ taskId: <downstream-harness-id>, addBlockedBy: [<upstream-harness-id>] })
TaskUpdate({ taskId: <upstream-harness-id>,   addBlocks:    [<downstream-harness-id>] })
```

Edges where the upstream is inline (P0, P2) need no TaskUpdate — the inline
phase runs first and is treated as satisfied.

### 4.6 Topologically group into waves

Group **sub-tasks** by topological level — each sub-task joins the earliest
wave whose blockers are all in earlier waves. A phase split into sequential
sub-tasks naturally spans multiple waves (e.g. `P4.a` in wave 2 and `P4.b`
in wave 3). Parallel sub-tasks within a phase land in the same wave.
Standard single-agent layout:

| Wave | Members |
|------|---------|
| 0    | P0 (inline) |
| 1    | P1 (Explore, dispatch), P2 (inline) |
| 2    | P3 ∥ P4 (parallel dispatch) |
| 3    | P5 ∥ P7 ∥ P8 (parallel dispatch) |
| 4    | P6 ∥ P9 ∥ P10 (parallel dispatch) |

Skipped phases drop out, and remaining members may shift up.

### 4.7 Execute waves — SIMULATE non-inline dispatch (no Agent calls)

For each wave in order:

1. Run inline members directly (P0, P2 — emit their inline blocks).
2. Mark every non-inline sub-task in the wave `in_progress` in one parallel
   TaskUpdate batch. (Real task-graph state transitions still happen — the
   harness validates the orchestrator's task-mutation path.)
3. For each non-inline sub-task, build the prompt that *would* have been
   sent (`<fixture excerpt>` + `<phase-specific instructions>` from the
   table below, with `(<chosen agent for P<n>.<sub>>)` — the agent
   parsed from the fixture's `## Agent selection` block — substituted
   into each phase head). Do NOT call `Agent`. Capture the first ~80
   chars of the constructed prompt as the `→ would-prompt:` summary for
   the EXECUTION REPORT.
4. Mark every non-inline sub-task `completed` in one parallel TaskUpdate
   batch.

The phase-specific prompt heads (P1/P3/P4/P5/P6/P7/P8/P9/P10) below
parameterize on the agent parsed in 4.3a-parse — the parenthetical
`(<chosen agent>)` is metadata about who would receive the prompt, not part
of the instruction text. The English body stays the same regardless of
agent. When a phase splits into multiple sub-tasks, each sub-task gets the
same body but its own `(<chosen agent for P<n>.<sub>>)` parenthetical and
its own `→ would-prompt:` summary.

**Phase-specific prompt heads** (after the fixture excerpt):

- **P1 Research (<chosen agent for P1>):** "Identify any unfamiliar APIs /
  patterns referenced in this fixture and summarize what they do. Output as
  a short markdown brief. Do not modify files."
- **P3 Test spec (<chosen agent for P3.<sub>>):** "Generate test
  specifications and fixture/mock scaffolds for the component described.
  Output the test plan as markdown."
- **P4 Implement (<chosen agent for P4.<sub>>):** "Draft the implementation
  for the component described. Output the code inside one or more markdown
  code-fences."
- **P5 Review (<chosen agent for P5.<sub>>):** "Review the draft code below
  for correctness, security, and code quality. Return findings classified
  Critical or Advisory."
- **P6 Tests + fix (<chosen agent for P6.<sub>>):** "Describe the test run
  you would execute and any fixes needed. Do not run tests."

P5 and P6 prompt heads describe what live mode would do (substitute the
upstream agent's return). In dry-run, the prompt summary just notes that
these prompts would carry upstream returns — no actual return exists.
- **P7 Documentation (<chosen agent for P7.<sub>>):** "Draft documentation
  updates for the component. Output as markdown."
- **P8 Config-state migration (<chosen agent for P8.<sub>>):** "Draft a
  migration script / procedure for any schema, data, or config change
  implied. Output as markdown."
- **P9 Deployment-state migration docs (<chosen agent for P9.<sub>>):**
  "Draft deployment-state migration notes. Output as markdown."
- **P10 CI/CD (<chosen agent for P10.<sub>>):** "Draft any CI/CD pipeline
  changes required. Output as markdown."

### 4.8 Emit EXECUTION REPORT

After the last wave, emit (per fixture):

```
### EXECUTION REPORT

#### Goal expansion (P0)
Restated: ...
Assumptions: ...
Ambiguities: ...

#### Phase Backlog
inline   P0   [completed]   Goal expansion
                skip-reason : —
                agent       : inline
skipped  P1   [skipped]     Research
                skip-reason : ## What to do self-contained
                agent       : —
inline   P2   [completed]   Environment prep
                skip-reason : —
                agent       : inline
#<id>    P3   [completed]   Test spec
                agent       : qa-analyst — <≤15-word justification>
                blockedBy   : —
#<id>    P4.a [completed]   Implement (backend)
                agent       : general-purpose — <≤15-word justification>
                blockedBy   : —
#<id>    P4.b [completed]   Implement (sidebar UI)
                agent       : ui-designer — <≤15-word justification>
                blockedBy   : P4.a
... (one row per sub-task; single-agent phases use bare P<n>, split phases
use P<n>.a / P<n>.b / P<n>.c)

#### Wave Schedule
Wave 0: P0 (inline)
Wave 1: P1 ∥ P2
Wave 2: P3 ∥ P4.a
Wave 3: P4.b ∥ P5 ∥ P7 ∥ P8
Wave 4: P6 ∥ P9 ∥ P10

(Wave members are sub-task IDs — split phases visibly span multiple waves.)

#### Dispatches
[DRY-RUN] #<id> (P3): would dispatch qa-analyst — Test spec
  → would-prompt: <first ~80 chars of the prompt that would have been sent>
  → why: <≤15-word justification grounded in fixture signal>
[DRY-RUN] #<id> (P4.a): would dispatch general-purpose — Implement (backend)
  → would-prompt: <first ~80 chars of the prompt that would have been sent>
  → why: <≤15-word justification grounded in fixture signal>
[DRY-RUN] #<id> (P4.b): would dispatch ui-designer — Implement (sidebar UI)
  → would-prompt: <first ~80 chars of the prompt that would have been sent>
  → why: <≤15-word justification grounded in fixture signal>
... (one block per non-inline planned sub-task)

Note: dry-run does NOT call `Agent`. Each `[DRY-RUN] #<id> (P<n>): would
dispatch <agent-type>` line describes what live mode would have done; the
`→ would-prompt:` line is the first ~80 chars of the prompt that would have
been sent.

#### Phase Mapping
inline   Goal expansion (P0)
  → #<id>  Research (P1)        (blockedBy: P0)
  → inline Environment prep (P2, blockedBy: P0)
      → #<id>  Test spec (P3)    (blockedBy: P2)
      → #<id>  Implement (P4)    (blockedBy: P2)
          → #<id>  Review (P5)   (blockedBy: P3, P4)
              → #<id>  Tests + fix (P6) (blockedBy: P5)
          → #<id>  Documentation (P7)   (blockedBy: P4)
          → #<id>  Config-state migration (P8) (blockedBy: P4)
              → #<id>  Deployment-state docs (P9) (blockedBy: P8)
                  → #<id>  CI/CD (P10) (blockedBy: P9)

#### Cleanup
Cleaned up N tasks: #<id>, #<id>, ...
```

### 4.9 Cleanup

In one parallel batch, mark every task created in step 4.4 as deleted:
`TaskUpdate({ taskId: <id>, status: "deleted" })`. Then emit the
`Cleanup` line above with N = number of deleted tasks.

### 4.10 Status block (per fixture)

After the EXECUTION REPORT and Cleanup line, emit:

```
RESULT:      complete
WORK:        Orchestrated <N> phases across <W> waves; cleaned up <N-task-backed> tasks.
INCOMPLETE:  none
FAILURE:     none
ARTIFACT:    none
DISPATCHED:  none
```

Set `RESULT: partial` and populate `INCOMPLETE` if any wave dispatch errored.

## Step 5 — Print

After all fixtures finish, print results in the original fixture list order:

```
=== delivery-agent: <fixture-label> [DRY-RUN] ===
<full agent response — unfiltered (live mode), or EXECUTION REPORT (dry-run)>
===
```

`[DRY-RUN]` is included only when `--dry-run` was specified.

## Step 6 — Analyze

Immediately after each `===` block, emit an analysis block.

**Live mode — always check:**

```
--- analysis: <fixture-label> ---
status block   : present (RESULT: <value>) | MISSING
```

**Dry-run mode — check:**

```
--- analysis: <fixture-label> ---
status block          : present (RESULT: <value>) | MISSING
EXECUTION REPORT      : present | MISSING
goal expansion (P0)   : present | MISSING
agent selection block : parsed (K phase entries) | MISSING
phase backlog         : N rows (covers P0..P10? yes | no)
real task IDs         : M planned non-inline sub-tasks, all with #<numeric> | MISSING
agent selection       : N sub-tasks with chosen agent + grounded justification | M missing
sub-task coherence    : K phases split, all intra-phase edges sound | n/a | <details if not>
wave schedule         : present; multi-member waves shown in parallel? yes | no | n/a
dispatches            : K `[DRY-RUN] #<id> (P<n>[.<sub>]): would dispatch ...` lines, K would-prompt summaries, K why summaries
phase mapping         : present | MISSING
cleanup               : "Cleaned up N tasks: ..." present AND N=<created count> | MISMATCH | MISSING
verdict               : PASS | FAIL
  reasons             : <bullet list, omit if PASS>
```

**Dry-run PASS conditions (all must hold):**

- EXECUTION REPORT present
- Goal expansion present
- **Agent selection block present.** The fixture carries a top-level `## Agent selection` block that 4.3a-parse successfully parsed. A missing block FAILs with reason `agent selection block missing from lifecycle`.
- Phase Backlog addresses all 11 IDs (P0..P10) — each `planned`, `skipped`, or `inline`; planned phases may render as one row (single-agent) or multiple sub-task rows (split)
- All `planned` non-inline sub-tasks have a real numeric task ID (`#<N>`, harness-issued — no `T-A`/`T-B` placeholders)
- **Agent selection.** Every Phase Backlog row for a non-inline planned sub-task has both an agent name AND a non-empty justification, AND the agent name appears in the available `subagent_type` list for this session. `general-purpose` with no domain signal in the justification FAILs unless the justification explicitly states "no domain specialist matches <X>".
- **Sub-task coherence.** For any phase split into ≥2 sub-tasks, every non-first sub-task carries an intra-phase `blockedBy` to an earlier sub-task in the same phase, OR is explicitly tagged parallel with a justification of mutual independence. The phase's downstream cross-phase consumers `blockedBy` the *last* sub-task in topological order, never an intermediate one.
- Wave Schedule present, AND every wave whose non-inline planned sub-task membership ≥ 2 lists all members in a single parallel batch in the simulation. (Vacuously satisfied if no wave has ≥ 2 members.)
- ≥ 1 `[DRY-RUN] #<id> (P<n>[.<sub>]): would dispatch <agent-type>` line, each with `→ would-prompt:` and `→ why:` follow-ups
- Phase Mapping present
- Cleanup line present and N equals count of created tasks
- Status block present

List each failed condition under `reasons`. Omit `reasons` on PASS.
