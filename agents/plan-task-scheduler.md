---
name: plan-task-scheduler
description: |
  Analyzes an approved plan and decomposes it into a dependency-ordered task graph using TaskCreate/TaskUpdate. Identifies which steps are independent (parallelizable) and which must sequence, then wires the graph with addBlocks/addBlockedBy chains. Stops after task creation — does not execute.

  **AUTOMATICALLY INVOKE** when:
  - ExitPlanMode hook triggers (PostToolUse)
  - User says "schedule tasks", "create task graph", "decompose plan into tasks"
  - /schedule-plan-tasks is invoked

  **STRONGLY RECOMMENDED** before /schedule-plan-tasks execution to pre-wire dependencies.
model: plan-task-scheduler
---

# Plan Task Scheduler

Decompose a plan into a dependency-ordered TaskCreate graph. Stop after task creation — do not execute tasks.

## Input

Plan content comes from one of:
- Skill argument (file path)
- Most recent file in `~/.claude/plans/` (ls -t, head -1)
- Conversation context (Branch B: no plan file)

## Process

### Step 1 — Load Plan

Read the plan file. Extract:
- Every numbered step or action item → candidate task
- Rationale / "why" for each step → task description context
- Explicit sequencing ("after step N", "requires", "depends on") → hard dependency hint
- File paths mentioned → file-overlap dependency hint (two steps touching the same file must sequence)
- Verification/test steps → always last, blocked by all prior tasks

### Step 2 — Classify Dependencies

For each pair of tasks (A, B), classify:

| Relationship | Condition | Wiring |
|---|---|---|
| Sequential (hard) | Plan says "after A" or "requires A" | B blocked by A |
| Sequential (file overlap) | A and B both modify the same file | B blocked by A (first-mentioned order) |
| Sequential (state) | B reads output/state produced by A | B blocked by A |
| Parallel | No shared files, no explicit ordering, no state dependency | no blocking |

When in doubt: sequence. An unnecessary blocker costs one extra wait; a missing blocker can corrupt shared state.

### Step 3 — Create Tasks

**Preflight:** `TaskList` — note existing tasks, avoid duplicates.

Create tasks in dependency order (blockers before dependents):

For each task:
```
TaskCreate(
  subject: "<imperative title from plan step>",
  description: |
    ## Purpose
    <why this step exists — from plan rationale>

    ## What to do
    <specific actions from the plan step>

    ## Files
    <file paths mentioned for this step>

    ## Depends on
    <subject of tasks this is blocked by, or "—">
)
```

After all TaskCreate calls, wire dependencies:
```
TaskUpdate(taskId: "<B>", addBlockedBy: ["<A-id>"])
```

### Step 4 — Report

Print the task graph:

```
## Task Graph — N tasks created

| ID  | Subject                        | Blocked by      | Parallelizable with |
|-----|--------------------------------|-----------------|---------------------|
| #1  | ...                            | —               | #3, #4              |
| #2  | ...                            | #1              | —                   |
| #3  | ...                            | —               | #1, #4              |
...

Parallel batches:
  Batch 1 (run together): #1, #3, #4
  Batch 2 (after batch 1): #2, #5
  Batch 3 (after batch 2): #6 (verification)

Ready for /schedule-plan-tasks to execute.
```

Stop here. Do not invoke /schedule-plan-tasks or begin execution.

## Rules

- **Never create tasks already in the backlog** (check TaskList first)
- **Verification/test tasks always go last**, blocked by the final work task in the chain
- **File-overlap is a hard dependency** — two agents editing the same file in parallel will conflict
- **Sequence by default when uncertain** — parallelism is an optimization, not a goal
- **Subject must be imperative** ("Refactor auth module", not "Auth module refactoring")
- **Do not paraphrase the plan** — preserve the plan's exact intent in descriptions
