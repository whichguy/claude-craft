---
name: test-schedule-plan-tasks
description: |
  Test harness for the schedule-plan-tasks skill. Runs each plan fixture through the skill
  inline in the orchestrator session (where TaskCreate/TaskUpdate/TaskList are available),
  in two tracks: --plan-only validates the Dry-Run Report against expected chain/standalone
  topology and wiring rules (Asserts 3, 5, 6, 7, 8); --dry-run validates the Simulated
  Execution Trace against expected wave structure, cascade ordering, and validation predicates.
  Currently covers 8 fixtures (plan1–plan7 + plan8 cascade fan-in).

  **AUTOMATICALLY INVOKE** when:
  - User says "test schedule-plan-tasks", "validate the skill", "run fixture tests"
  - /test-schedule-plan-tasks is invoked

allowed-tools: Skill, Read, Bash, TaskList, TaskUpdate
---

# test-schedule-plan-tasks

Each plan fixture is run through the schedule-plan-tasks skill in two tracks:
- **plan-only track**: `--plan-only` mode, validates the Dry-Run Report topology.
- **dry-run track**: `--dry-run` mode, validates the Simulated Execution Trace wave structure.

**Both tracks run inline in the orchestrator (main) session.** The schedule-plan-tasks skill
requires the Task API (TaskCreate/TaskUpdate/TaskList), which is only available in the
orchestrator — sub-agent dispatch is NOT used. Each fixture is invoked sequentially via
the `Skill` tool. The orchestrator validates each captured report inline, records a
PASS/FAIL row, and prints a combined summary.

---

## Step 0 — Resolve paths and parse arguments

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SKILL_DIR="${REPO_ROOT}/plugins/planning-suite/skills/schedule-plan-tasks"
TEST_DIR="${REPO_ROOT}/plugins/planning-suite/skills/test-schedule-plan-tasks"
FIXTURE_DIR="${SKILL_DIR}/fixtures"
```

**Argument parsing.** `$ARGUMENTS` may contain a fixture filter token: bare `plan1`..`plan8`,
or `--only planN`. If a filter is present, restrict BOTH tracks to that single fixture
(useful as a fast smoke test). Default is all 8 fixtures.

Print:
```
## test-schedule-plan-tasks
Running <N> fixture test(s) × 2 tracks inline (no sub-agent dispatch).
  plan-only track: <N> sequential Skill invocation(s).
  dry-run track:   <N> sequential Skill invocation(s) — TaskList isolation between fixtures.
```
(N = 8 by default, or 1 if filtered.)

---

## Fixtures

| # | Fixture file                       | Plan-only expectation | Dry-run expectation         |
|---|------------------------------------|-----------------------|-----------------------------|
| 1 | `plan1-max-concurrency.md`         | `expect-plan1.md`     | `expect-plan1-dryrun.md`    |
| 2 | `plan2-linear-chain.md`            | `expect-plan2.md`     | `expect-plan2-dryrun.md`    |
| 3 | `plan3-diamond.md`                 | `expect-plan3.md`     | `expect-plan3-dryrun.md`    |
| 4 | `plan4-trivial-mixed.md`           | `expect-plan4.md`     | `expect-plan4-dryrun.md`    |
| 5 | `plan5-multi-chain.md`             | `expect-plan5.md`     | `expect-plan5-dryrun.md`    |
| 6 | `plan6-deep-cascading.md`          | `expect-plan6.md`     | `expect-plan6-dryrun.md`    |
| 7 | `plan7-assert6-violation.md`       | `expect-plan7.md`     | `expect-plan7-dryrun.md`    |
| 8 | `plan8-cascade-fan-in.md`          | `expect-plan8.md`     | `expect-plan8-dryrun.md`    |

---

## Step 1a — Plan-only track (run inline, sequentially)

For each fixture in scope (filtered or all 8), execute the following per-fixture flow in the
**main orchestrator session**. Do NOT dispatch sub-agents — the Task API and Skill tool are
only usable here.

### Per-fixture flow (plan-only)

1. `Read ${TEST_DIR}/references/expect-<N>.md` — hold expected topology in context.

2. Invoke the skill in the main session:
   `Skill({ skill: "schedule-plan-tasks", args: "--plan-only --plan <FIXTURE_PATH>" })`

   Capture the returned Dry-Run Report (banner through `### Wiring Integrity`) IN CONTEXT.

3. **Banner check (first validation step).** The first non-blank line of the
   captured report MUST byte-match `## Dry-Run Report`. If not, mark FAIL with reason
   `skill not invoked — re-implementation detected` and skip remaining checks.

4. Validate silently in context:
   - **A.** Chain count matches `expected_chains`
   - **B.** Standalone count matches `expected_standalones`
   - **C.** Chain membership matches `chain_specs` (member order, head/tail roles)
   - **D.** Standalone membership matches `standalone_specs`
   - **E.** Wiring Integrity says `PASS — N tasks verified` (no Assert violations)
   - **F.** Special assertions: each check from `special_assertions`

5. Record a row for this fixture:
   - **ON PASS** — record only:
     ```
     RESULT: PASS
     NOTES: chains=N, standalones=M, tasks=K, wiring PASS, [key assertion summary]
     ```
     Plus the captured report's banner line (`## Dry-Run Report`) so the user can see the
     skill was actually invoked.
   - **ON FAIL** — record the full captured Dry-Run Report verbatim followed by:
     ```
     RESULT: FAIL — [first failing check label, e.g. "Chain count: expected 2, got 1"]
     NOTES: [details of expected vs actual]
     ```

Token discipline: on PASS, only banner + RESULT + NOTES are printed in the final report.
On FAIL, the full captured report is included so the user can diagnose.

---

## Step 1b — Dry-run track (run inline, sequentially)

**Runs AFTER Step 1a completes.** Each `--dry-run` invocation issues real
TaskCreate/TaskUpdate calls into the orchestrator's TaskList. Fixtures must be serialized
so cascade scans don't intermingle task IDs across runs.

### TaskList isolation and cleanup

Before each fixture, snapshot the current TaskList (`TaskList()`) and remember the set of
task IDs already present (carry-over from prior conversation work).

After each fixture, run a cleanup pass:
1. `TaskList()` — find any tasks created during this fixture run (i.e. not in the
   pre-snapshot set).
2. For each fixture-created task whose status is not already `completed`, call
   `TaskUpdate({ id, status: "deleted" })` to remove it from the active list.

This keeps subsequent fixtures from seeing stragglers in their cascade scans.

### Per-fixture flow (dry-run)

1. `TaskList()` → save pre-snapshot of task IDs.

2. `Read ${TEST_DIR}/references/expect-<N>-dryrun.md` — hold expected wave structure in context.

3. Invoke the skill in the main session:
   `Skill({ skill: "schedule-plan-tasks", args: "--dry-run --plan <FIXTURE_PATH>" })`

   Capture the returned Simulated Execution Trace (banner through `### Validation`) IN CONTEXT.

4. **Banner check.** The first non-blank line of the captured trace MUST byte-match
   `## Simulated Execution Trace`. If not, mark FAIL with reason
   `skill not invoked — re-implementation detected` and skip remaining checks.

5. Validate silently in context:
   - **A. Trace header** — `## Simulated Execution Trace` present with `Mode: dry-run`
   - **B. Validation section** — all 5 predicates show ✓ (none show ✗)
   - **C. Wave 1 delivery-agents** — the first delivery-agent wave (Phase C dispatch)
     contains each entry from `expected_first_delivery_agents` (match by subject keyword,
     not exact string)
   - **D. Regression ordering** — the regression task appears in the final wave —
     dispatched only after all chain-tail and standalone delivery-agents have appeared
     in the trace
   - **E. No unexpected failures** — no agent row shows `RESULT: failed` unless
     `expected_failures` explicitly lists that agent's keyword
   - **F. Special assertions** — each check from the `special_assertions` section

6. Record a row for this fixture:
   - **ON PASS** — record only:
     ```
     RESULT: PASS
     NOTES: waves=N, agents=M, validation all ✓, [key assertion summary]
     ```
     Plus the captured trace's banner line so the user can see the skill was actually invoked.
   - **ON FAIL** — record the full captured Simulated Execution Trace verbatim followed by:
     ```
     RESULT: FAIL — [first failing check label]
     NOTES: [details of expected vs actual]
     ```

7. **Cleanup pass.** `TaskList()` → for each task ID not in the pre-snapshot whose status
   is not `completed`, `TaskUpdate({ id, status: "deleted" })`.

Move on to the next fixture only after cleanup completes.

---

## Step 2 — Aggregate and Report

Print the combined summary table:

```markdown
## test-schedule-plan-tasks — Results

### plan-only track

| # | Fixture                   | Chains | Standalones | Wiring | Result |
|---|---------------------------|--------|-------------|--------|--------|
| 1 | plan1-max-concurrency     | 0      | 6           | PASS   | ✓ PASS |
| 2 | plan2-linear-chain        | 1      | 0           | PASS   | ✓ PASS |
| 3 | plan3-diamond             | 0      | 3           | PASS   | ✓ PASS |
| 4 | plan4-trivial-mixed       | 0      | 3           | PASS   | ✓ PASS |
| 5 | plan5-multi-chain         | 2      | 2           | PASS   | ✓ PASS |
| 6 | plan6-deep-cascading      | 2      | 4           | PASS   | ✓ PASS |
| 7 | plan7-assert6-violation   | 0      | 1           | PASS   | ✓ PASS |
| 8 | plan8-cascade-fan-in      | 2      | 2           | PASS   | ✓ PASS |

### dry-run track

| # | Fixture                   | Waves | Agents | Validation | Result |
|---|---------------------------|-------|--------|------------|--------|
| 1 | plan1-max-concurrency     | N     | M      | all ✓      | ✓ PASS |
| 2 | plan2-linear-chain        | N     | M      | all ✓      | ✓ PASS |
| 3 | plan3-diamond             | N     | M      | all ✓      | ✓ PASS |
| 4 | plan4-trivial-mixed       | N     | M      | all ✓      | ✓ PASS |
| 5 | plan5-multi-chain         | N     | M      | all ✓      | ✓ PASS |
| 6 | plan6-deep-cascading      | N     | M      | all ✓      | ✓ PASS |
| 7 | plan7-assert6-violation   | N     | M      | all ✓      | ✓ PASS |
| 8 | plan8-cascade-fan-in      | N     | M      | all ✓      | ✓ PASS |

VERDICT: PASS (16/16) | FAIL (N/16)
```

For any FAIL, print the full captured report/trace beneath the table so the user can see
what failed.
