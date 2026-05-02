---
name: test-schedule-plan-tasks
description: |
  Test harness for the schedule-plan-tasks skill. Creates one Task() per plan fixture in an
  isolated context, runs the skill in --dry-run mode, and validates the Dry-Run Report against
  expected chain/standalone topology and wiring rules (Asserts 3, 5, 6, 7, 8).

  **AUTOMATICALLY INVOKE** when:
  - User says "test schedule-plan-tasks", "validate the skill", "run fixture tests"
  - /test-schedule-plan-tasks is invoked

allowed-tools: TaskCreate, TaskUpdate, TaskList, Agent, Read, Bash
---

# test-schedule-plan-tasks

Each plan fixture is run through the schedule-plan-tasks skill in `--dry-run` mode inside its
own Task(), in its own execution context, in parallel. The orchestrator collects RESULT lines
and prints a pass/fail summary.

---

## Step 0 — Preflight

`TaskList`. If the Task API is unavailable, print the error and halt.

Resolve paths (run once, hold in context):

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
SKILL_DIR="${REPO_ROOT}/skills/schedule-plan-tasks"
TEST_DIR="${REPO_ROOT}/skills/test-schedule-plan-tasks"
FIXTURE_DIR="${SKILL_DIR}/fixtures"
```

Print:
```
## test-schedule-plan-tasks
Running 7 fixture tests via Task() — each in its own context.
```

---

## Step 1 — Create Test Tasks (parallel, Phase 1)

**FIRST: `Read ${TEST_DIR}/references/agent-template.md`** — load the verbatim agent prompt.

Create all 7 tasks in a single response with 7 parallel `TaskCreate` calls. Capture all
returned task IDs. Print creation ticker: `[test-N] Created #<id>: <fixture name>`.

For each task, the `description` is the agent-template content (which instructs the agent
to run `/schedule-plan-tasks --dry-run --plan <fixture>`) with these substitutions:

| Placeholder          | Substitution                                      |
|----------------------|---------------------------------------------------|
| `[SKILL_MD_PATH]`    | `${SKILL_DIR}/SKILL.md`                           |
| `[FIXTURE_PATH]`     | `${FIXTURE_DIR}/<fixture-file>`                   |
| `[EXPECTATIONS_PATH]`| `${TEST_DIR}/references/expect-<N>.md`            |
| `[FIXTURE_NAME]`     | Short fixture label (e.g. `plan1-max-concurrency`)|

The 7 fixtures and their expectation files:

| # | Fixture file                       | Expectation file   |
|---|------------------------------------|--------------------|
| 1 | `plan1-max-concurrency.md`         | `expect-plan1.md`  |
| 2 | `plan2-linear-chain.md`            | `expect-plan2.md`  |
| 3 | `plan3-diamond.md`                 | `expect-plan3.md`  |
| 4 | `plan4-trivial-mixed.md`           | `expect-plan4.md`  |
| 5 | `plan5-multi-chain.md`             | `expect-plan5.md`  |
| 6 | `plan6-deep-cascading.md`          | `expect-plan6.md`  |
| 7 | `plan7-assert6-violation.md`       | `expect-plan7.md`  |

No dependencies between test tasks — skip Phase 2 wiring.

---

## Step 2 — Dispatch Test Agents (parallel)

Dispatch all 7 agents in a single response with 7 parallel `Agent` calls. Each agent receives
the fully-substituted agent-template as its prompt (load via TaskGet if not already in context).

Each agent will invoke `/schedule-plan-tasks --dry-run --plan <fixture>` — the skill handles
dry-run mode internally. The agent then validates the resulting Dry-Run Report against its
expectations file and reports `RESULT: PASS | FAIL`.

**Do NOT use `run_in_background`** — wait for all 7 to return before proceeding.

---

## Step 3 — Aggregate and Report

Scan each agent response for the last occurrence of `RESULT:`. Extract: `PASS` or `FAIL`.

Print the summary table:

```markdown
## test-schedule-plan-tasks — Results

| # | Fixture                   | Chains | Standalones | Wiring | Result |
|---|---------------------------|--------|-------------|--------|--------|
| 1 | plan1-max-concurrency     | 0      | 6           | PASS   | ✓ PASS |
| 2 | plan2-linear-chain        | 1      | 0           | PASS   | ✓ PASS |
| 3 | plan3-diamond             | 0      | 3           | PASS   | ✓ PASS |
| 4 | plan4-trivial-mixed       | 0      | 3           | PASS   | ✓ PASS |
| 5 | plan5-multi-chain         | 2      | 2           | PASS   | ✓ PASS |
| 6 | plan6-deep-cascading      | 2      | 4           | PASS   | ✓ PASS |
| 7 | plan7-assert6-violation   | 0      | 1           | PASS   | ✓ PASS |

VERDICT: PASS (7/7) | FAIL (N/7)
```

For any FAIL, print the full agent response beneath the table so the user can see what failed.
